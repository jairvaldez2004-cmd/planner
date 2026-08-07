// Traductor de CONTENIDO DEL USUARIO (server-only). No traduce la UI: eso lo hace el
// diccionario estático de `src/domain/i18n` (instantáneo y gratis). Esto es para lo que
// TÚ escribiste: nombres de negocio, respuestas de planos, catálogo, procesos.
//
// Reglas de diseño:
//   · El original nunca se toca. Esto solo PRODUCE texto; quien lo guarda es la caché.
//   · Salida en el MISMO orden y con la MISMA longitud que la entrada. Si un texto no
//     vuelve, se devuelve el original — un dato sin traducir es aceptable; uno perdido no.
//   · Protocolo con delimitadores en vez de `output_config.format`: los structured outputs
//     no están disponibles en Sonnet 4.6, que sí es elegible en el panel de modelos.

import Anthropic from '@anthropic-ai/sdk';
import { modeloDe } from '@/config/modelos';
import type { ModeloClaude } from '@/config/modelos';
import type { Locale } from '@/domain/i18n';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY en el entorno.');
  if (!_client) _client = new Anthropic();
  return _client;
}

const IDIOMA: Record<Locale, string> = { es: 'español', en: 'inglés' };

// `effort` no existe en Haiku 4.5 (devuelve 400). Solo se manda donde está soportado.
const SOPORTA_EFFORT: Record<ModeloClaude, boolean> = {
  'claude-haiku-4-5': false,
  'claude-sonnet-4-6': true,
  'claude-opus-4-8': true,
  'claude-fable-5': true,
};

const SEP = (i: number) => `<<<${i}>>>`;

function construirSystem(destino: Locale): string {
  return `Eres un traductor profesional de documentación de negocio. Traduces del español al ${IDIOMA[destino]}.

Recibes textos numerados, cada uno precedido por un marcador \`<<<N>>>\` en su propia línea.
Devuelves EXACTAMENTE los mismos marcadores, en el mismo orden, cada uno seguido de la traducción.

Reglas:
- Traduce SOLO el contenido. No añadas comentarios, encabezados ni explicaciones.
- Conserva el formato interno: saltos de línea, viñetas, mayúsculas iniciales, signos de puntuación.
- NO traduzcas: nombres propios de empresas, marcas, personas, ni códigos/SKU/identificadores.
- Terminología de negocio: usa el término estándar del ${IDIOMA[destino]} de negocios, no una traducción literal.
- Si un texto ya está en ${IDIOMA[destino]}, devuélvelo sin cambios.
- Si un texto es un número, una fecha o una cadena vacía, devuélvelo idéntico.

Tu respuesta empieza directamente con \`<<<1>>>\`. Nada antes, nada después.`;
}

function parsear(salida: string, n: number): (string | undefined)[] {
  const out: (string | undefined)[] = new Array(n).fill(undefined);
  // Corta por los marcadores conservando su índice; tolera espacios alrededor.
  const partes = salida.split(/^[ \t]*<<<(\d+)>>>[ \t]*$/m);
  // split con un grupo de captura intercala: [previo, idx, texto, idx, texto, …]
  for (let i = 1; i < partes.length; i += 2) {
    const idx = Number(partes[i]) - 1;
    const texto = partes[i + 1];
    if (idx >= 0 && idx < n && texto !== undefined) out[idx] = texto.replace(/^\n+|\n+$/g, '');
  }
  return out;
}

export interface ResultadoTraduccion {
  traducciones: string[];       // mismo orden y longitud que la entrada
  tokensEntrada: number;
  tokensSalida: number;
  fallidos: number;             // cuántos volvieron sin traducir (se devolvió el original)
}

/** Traduce un lote. Pensado para ~40 textos; el troceado lo hace quien llama. */
export async function traducirLote(
  textos: string[],
  destino: Locale,
  modelo?: ModeloClaude,
): Promise<ResultadoTraduccion> {
  if (textos.length === 0) return { traducciones: [], tokensEntrada: 0, tokensSalida: 0, fallidos: 0 };

  const m = modelo ?? modeloDe('traductor');
  const entrada = textos.map((tx, i) => `${SEP(i + 1)}\n${tx}`).join('\n');

  const response = await getClient().messages.create({
    model: m,
    max_tokens: 8000,
    system: construirSystem(destino),
    ...(SOPORTA_EFFORT[m] ? { output_config: { effort: 'low' as const } } : {}),
    messages: [{ role: 'user', content: entrada }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('El modelo rechazó la traducción de este lote.');
  }

  const texto = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const parsed = parsear(texto, textos.length);
  let fallidos = 0;
  const traducciones = parsed.map((tr, i) => {
    if (tr === undefined || tr.trim() === '') { fallidos++; return textos[i]!; }
    return tr;
  });

  return {
    traducciones,
    tokensEntrada: response.usage.input_tokens,
    tokensSalida: response.usage.output_tokens,
    fallidos,
  };
}
