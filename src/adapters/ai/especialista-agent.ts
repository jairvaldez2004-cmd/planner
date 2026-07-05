// Agente Especialista (capa 2) — server-only. 1 código, parametrizado por EspecialistaConfig.
// Conduce la captura de SU plano: pregunta lo de su plantilla en orden lógico, traduce las
// respuestas a campos (tool use `registrar_campos`), y avisa cuando el plano cruza un umbral.
// Solo ve SU porción (scoping del Coordinador, Decisión 6). NO decide selección ni profundidad.

import Anthropic from '@anthropic-ai/sdk';
import type { EspecialistaConfig } from '@/domain/especialistas';
import type { Profundidad } from '@/domain/diagnostico';
import type { Readiness } from '@/app/readiness/readiness-engine';
import { LABEL_ESTADO } from '@/app/readiness/readiness-engine';
import { modeloDe } from '@/config/modelos';
import type { ModeloClaude } from '@/config/modelos';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY en el entorno.');
  if (!_client) _client = new Anthropic();
  return _client;
}

export type MensajeChat = { role: 'user' | 'assistant'; content: string };

export interface ContextoEspecialista {
  proyecto: string;
  resumen: string;
  profundidad: Profundidad;
  campos: Record<string, string>;
  filasPorTabla: Record<string, number>;
  readiness: Readiness;
}

export interface ResultadoEspecialista {
  reply: string;
  campos: Record<string, string>; // campos a persistir (los que el agente registró)
  huboCambios: boolean;
}

function construirSystem(cfg: EspecialistaConfig, ctx: ContextoEspecialista): string {
  const rank: Record<Profundidad, number> = { esencial: 0, estandar: 1, completo: 2 };
  const nivel = rank[ctx.profundidad];

  const bloques = cfg.bloques.map((b) => {
    const campos = (b.campos ?? []).map((c) => {
      const req = rank[c.requeridoEn] <= nivel ? 'REQUERIDO' : 'opcional';
      const val = ctx.campos[c.id];
      const estado = val && val.trim() ? `✓ "${val.slice(0, 60)}"` : '— vacío';
      return `    · [${req}] ${c.pregunta} (id:${c.id}) → ${estado}`;
    }).join('\n');
    const tabla = b.tabla
      ? `    · [TABLA] ${b.tabla.etiqueta ?? b.titulo} (${ctx.filasPorTabla[b.tabla.tablaRef] ?? 0} filas) — datos repetitivos: el usuario los carga por la sección de Tablas/CSV, NO por chat.`
      : '';
    return `  Bloque ${b.titulo}${b.capas ? ` (${b.capas})` : ''}:\n${[campos, tabla].filter(Boolean).join('\n')}`;
  }).join('\n');

  return `Eres el ESPECIALISTA del plano ${cfg.nombre} del Business Planner de CPF. Asistes al Arquitecto a planear ESTE plano del proyecto "${ctx.proyecto}".

Tu lenguaje técnico: ${cfg.lenguajeTecnico}

Proyecto: ${ctx.resumen}
Profundidad del proyecto: ${ctx.profundidad.toUpperCase()} (define qué campos son REQUERIDOS).
Estado actual del plano: ${LABEL_ESTADO[ctx.readiness.estado]} (${ctx.readiness.cumplidoRequerido}/${ctx.readiness.totalRequerido} requeridos).

Estructura del plano (tu plantilla), con lo ya capturado:
${bloques}

Cómo trabajas:
1) Pregunta SOLO por los campos REQUERIDOS que aún están vacíos, EN ORDEN de bloque. 1–3 preguntas por turno, las mínimas.
2) Cuando el usuario te dé información, TRADÚCELA al lenguaje del plano y llama "registrar_campos" con los ids correspondientes. No inventes: lo que el usuario no sepa déjalo y márcalo como PENDIENTE.
3) Para datos repetitivos (marcados [TABLA]) NO los pidas por chat: dile al usuario que descargue/suba el CSV en la sección de Tablas.
4) Avisa cuando el plano alcance "mínimo operable" o "publicado" según la profundidad.
5) Español, claro y breve. Respeta el método (Nivel B), no contradigas otros planos, no inventes datos.`;
}

export async function turnoEspecialista(
  cfg: EspecialistaConfig,
  ctx: ContextoEspecialista,
  historial: MensajeChat[],
  modelo?: ModeloClaude,
): Promise<ResultadoEspecialista> {
  const messages: Anthropic.MessageParam[] = historial.map((m) => ({ role: m.role, content: m.content }));

  // Tool dinámico: una propiedad string por cada campo del plano.
  const properties: Record<string, { type: 'string'; description: string }> = {};
  for (const b of cfg.bloques) {
    for (const c of b.campos ?? []) {
      properties[c.id] = { type: 'string', description: c.pregunta };
    }
  }
  const TOOL: Anthropic.Tool = {
    name: 'registrar_campos',
    description: 'Registra uno o más campos del plano con el valor entendido del usuario. Incluye solo los campos que tengas claros.',
    input_schema: { type: 'object', additionalProperties: false, properties },
  };

  const system = construirSystem(cfg, ctx);
  const client = getClient();
  const camposNuevos: Record<string, string> = {};
  let huboCambios = false;

  for (let i = 0; i < 4; i++) {
    const response = await client.messages.create({
      model: modelo ?? modeloDe('especialista'),
      max_tokens: 1536,
      system,
      tools: [TOOL],
      tool_choice: { type: 'auto' },
      messages,
    });

    const texto = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

    if (toolUses.length === 0) {
      return { reply: texto || '¿Continuamos?', campos: camposNuevos, huboCambios };
    }

    messages.push({ role: 'assistant', content: response.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const input = tu.input as Record<string, unknown>;
      const ids: string[] = [];
      for (const [k, v] of Object.entries(input)) {
        if (typeof v === 'string' && v.trim() && properties[k]) { camposNuevos[k] = v.trim(); ids.push(k); }
      }
      huboCambios = huboCambios || ids.length > 0;
      resultados.push({ type: 'tool_result', tool_use_id: tu.id, content: ids.length ? `Registrados: ${ids.join(', ')}.` : 'Sin campos válidos.' });
    }
    messages.push({ role: 'user', content: resultados });
  }

  return { reply: 'He registrado lo que me diste.', campos: camposNuevos, huboCambios };
}
