// Agente Arquitecto (IA) — server-only. Conduce el INTAKE/DIAGNÓSTICO del proyecto.
// Usa la API de Claude (modelo configurable por rol en @/config/modelos) con tool use: cuando entiende el proyecto,
// llama `registrar_diagnostico` y emite el vector estructurado. NO decide planos/módulos
// (eso lo hace el Motor de Selección determinista). NO menciona COM-EXP ni planos.

import Anthropic from '@anthropic-ai/sdk';
import type { Diagnostico } from '@/domain/diagnostico';
import { modeloDe } from '@/config/modelos';
import type { ModeloClaude } from '@/config/modelos';

// Cliente perezoso: se construye al primer uso (lee ANTHROPIC_API_KEY del entorno).
// Si falta la key, lanza aquí y la acción lo captura con un mensaje claro. Local; sin cloud.
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Falta ANTHROPIC_API_KEY en el entorno.');
  }
  if (!_client) _client = new Anthropic();
  return _client;
}

export type MensajeChat = { role: 'user' | 'assistant'; content: string };

export type ResultadoArquitecto =
  | { tipo: 'pregunta'; texto: string }
  | { tipo: 'diagnostico'; diagnostico: Diagnostico; nota: string };

const SYSTEM = `Eres el CURADOR (Superadmin) del Business Planner de CPF (Corporativo Palo Fierro). Gobiernas el workspace y curas sus proyectos.

Tus responsabilidades:
1) ENTENDER la idea del usuario, diagnosticar y clasificar el proyecto. Cuando tengas los datos mínimos, llama la herramienta "registrar_diagnostico" para acomodar el proyecto como un nodo en el grafo del workspace.
2) GOBIERNO (Nivel B protegido): respeta lo congelado del método (ARQOS, PLANO ALV, contratos). NO inventes datos: lo que falte queda PENDIENTE. Aplica la Regla AP-1 — ningún módulo especializado se decide antes del diagnóstico; nunca asumas exportación/COM-EXP/tecnología/marketing por defecto.
3) CONFIGURACIÓN (Nivel A): puedes orientar sobre qué necesita el proyecto, pero la selección final de planos/módulos la calcula el motor de reglas a partir de tu diagnóstico; no la inventes ni la prometas tú.
4) CURADURÍA: conoces los proyectos ya acomodados en el workspace (te los doy como contexto). Puedes informar sobre ellos, evitar duplicados y orientar al usuario.

Estilo: español, claro y breve. 1–3 preguntas por turno, las mínimas. Responde solo con tu mensaje (sin razonamiento extenso).
Datos mínimos para registrar un proyecto: nombre de la entidad, resumen de una línea, tipo de negocio, industria, etapa, objetivo, escala y presupuesto. Si puedes, también recursos, restricciones, urgencia y complejidad. Si el usuario te dio todo de una vez, llama la herramienta de inmediato.`;

const TOOL: Anthropic.Tool = {
  name: 'registrar_diagnostico',
  description: 'Registra el diagnóstico estructurado del proyecto una vez entendido. Llamar SOLO cuando tengas los datos obligatorios.',
  // strict: true garantiza que el input valide exactamente el esquema.
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      nombreEntidad: { type: 'string', description: 'Nombre del negocio/proyecto.' },
      resumen: { type: 'string', description: 'Una línea: qué es el proyecto.' },
      tipoNegocio: { type: 'string', enum: ['producto-fisico', 'servicio', 'software', 'comercio-bienes', 'hibrido'] },
      industria: { type: 'string', description: 'Industria (alimentos, tecnología, agrícola, etc.).' },
      etapa: { type: 'string', enum: ['idea', 'validacion', 'early', 'crecimiento', 'consolidado'] },
      objetivo: { type: 'string', enum: ['lanzar', 'ordenar', 'escalar', 'levantar-capital', 'exportar', 'franquiciar'] },
      escala: { type: 'string', enum: ['local', 'regional', 'nacional', 'internacional'] },
      presupuesto: { type: 'string', enum: ['bajo', 'medio', 'alto'] },
      recursos: { type: 'string', enum: ['solo-fundador', 'equipo-pequeno', 'equipo-completo'] },
      restricciones: { type: 'string', description: 'Restricciones relevantes (texto libre).' },
      urgencia: { type: 'string', enum: ['exploratoria', 'normal', 'urgente'] },
      complejidad: { type: 'string', enum: ['simple', 'media', 'alta'] },
    },
    required: ['nombreEntidad', 'resumen', 'tipoNegocio', 'industria', 'etapa', 'objetivo', 'escala', 'presupuesto'],
  },
};

export interface ContextoWorkspace {
  workspace?: string;
  proyectos?: string[]; // nombres de proyectos ya acomodados
  estado?: string;      // snapshot vivo del workspace (todo su contenido, se reinyecta cada turno)
}

export async function turnoArquitecto(
  historial: MensajeChat[],
  contexto?: ContextoWorkspace,
  modelo?: ModeloClaude,
): Promise<ResultadoArquitecto> {
  const messages: Anthropic.MessageParam[] = historial.map((m) => ({ role: m.role, content: m.content }));

  let system = SYSTEM;
  if (contexto?.workspace) {
    const proyectos = (contexto.proyectos ?? []);
    system += `\n\nContexto del workspace actual: "${contexto.workspace}". `
      + (proyectos.length ? `Proyectos ya acomodados: ${proyectos.join(', ')}.` : 'Aún no hay proyectos acomodados.');
  }

  const response = await getClient().messages.create({
    model: modelo ?? modeloDe('curador'),
    max_tokens: 2048,
    system,
    tools: [TOOL],
    tool_choice: { type: 'auto' },
    messages,
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'registrar_diagnostico',
  );
  if (toolUse) {
    const diagnostico = toolUse.input as unknown as Diagnostico;
    const nota = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return { tipo: 'diagnostico', diagnostico, nota: nota || 'Diagnóstico capturado.' };
  }

  const texto = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return { tipo: 'pregunta', texto: texto || '¿Puedes contarme más sobre el proyecto?' };
}

// =================== CURADOR (tool-runner con curaduría del grafo) ===================
// Además de identificar proyectos, el Curador puede CURAR el grafo: renombrar, relacionar,
// archivar y mover proyectos. Las acciones reales (DB) las ejecuta la capa de actions,
// que se inyecta como `ejecutar`. El adaptador solo corre el bucle de tool use.

const TOOLS_CURADOR: Anthropic.Tool[] = [
  TOOL, // registrar_diagnostico (identificar y acomodar un proyecto)
  {
    name: 'renombrar_proyecto',
    description: 'Renombra un proyecto existente del workspace.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: { proyecto: { type: 'string', description: 'Nombre actual del proyecto.' }, nuevoNombre: { type: 'string' } },
      required: ['proyecto', 'nuevoNombre'],
    },
  },
  {
    name: 'relacionar_proyectos',
    description: 'Crea una relación (arista) entre dos proyectos del workspace.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: { proyectoA: { type: 'string' }, proyectoB: { type: 'string' }, etiqueta: { type: 'string', description: 'Tipo de relación (opcional).' } },
      required: ['proyectoA', 'proyectoB'],
    },
  },
  {
    name: 'archivar_proyecto',
    description: 'Archiva (elimina) un proyecto y sus relaciones del workspace. Acción destructiva: confirma con el usuario antes.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: { proyecto: { type: 'string' } },
      required: ['proyecto'],
    },
  },
  {
    name: 'mover_proyecto',
    description: 'Mueve un proyecto a otro workspace (por nombre del workspace destino).',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: { proyecto: { type: 'string' }, workspaceDestino: { type: 'string' } },
      required: ['proyecto', 'workspaceDestino'],
    },
  },
  {
    name: 'anidar_proyecto',
    description: 'Mete un proyecto DENTRO de otro (jerarquía). El "hijo" pasa a ser un negocio contenido por el "padre". Ej: mete Altercing Studio dentro de Girly Zone.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: { hijo: { type: 'string', description: 'Proyecto que entra (el negocio).' }, padre: { type: 'string', description: 'Proyecto contenedor (el desarrollo/empresa).' } },
      required: ['hijo', 'padre'],
    },
  },
  {
    name: 'desanidar_proyecto',
    description: 'Saca un proyecto de su padre y lo devuelve al nivel superior del workspace.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: { proyecto: { type: 'string' } },
      required: ['proyecto'],
    },
  },
];

export type EjecutorHerramienta = (nombre: string, input: Record<string, unknown>) => Promise<string>;

export interface ResultadoCurador {
  reply: string;
  huboCambios: boolean;
}

// Bucle genérico de tool use (compartido por los distintos curadores). Ejecuta cada
// herramienta pedida vía `ejecutar` (inyectado por la capa de actions) y reencola el
// resultado hasta que el modelo deja de pedir herramientas o se agota el presupuesto.
async function correrBucleTools(
  system: string,
  tools: Anthropic.Tool[],
  historial: MensajeChat[],
  ejecutar: EjecutorHerramienta,
  modelo?: ModeloClaude,
): Promise<ResultadoCurador> {
  const messages: Anthropic.MessageParam[] = historial.map((m) => ({ role: m.role, content: m.content }));
  const client = getClient();
  let huboCambios = false;

  for (let i = 0; i < 6; i++) {
    const response = await client.messages.create({
      model: modelo ?? modeloDe('curador'),
      max_tokens: 2048,
      system,
      tools,
      tool_choice: { type: 'auto' },
      messages,
    });

    const texto = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text).join('\n').trim();

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (toolUses.length === 0) {
      return { reply: texto || 'Listo.', huboCambios };
    }

    messages.push({ role: 'assistant', content: response.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const res = await ejecutar(tu.name, tu.input as Record<string, unknown>);
      huboCambios = true;
      resultados.push({ type: 'tool_result', tool_use_id: tu.id, content: res });
    }
    messages.push({ role: 'user', content: resultados });
  }

  return { reply: 'He realizado las acciones solicitadas.', huboCambios };
}

export async function correrCurador(
  historial: MensajeChat[],
  contexto: ContextoWorkspace,
  ejecutar: EjecutorHerramienta,
  modelo?: ModeloClaude,
): Promise<ResultadoCurador> {
  let system = SYSTEM;
  if (contexto.workspace) {
    const proyectos = contexto.proyectos ?? [];
    system += `\n\nContexto del workspace actual: "${contexto.workspace}". `
      + (proyectos.length ? `Proyectos ya acomodados: ${proyectos.join(', ')}.` : 'Aún no hay proyectos acomodados.')
      + '\nPara curar el grafo usa las herramientas (renombrar/relacionar/archivar/mover/anidar/desanidar). Refiere a los proyectos por su nombre.'
      + '\nJERARQUÍA: un proyecto puede CONTENER otros (un desarrollo/empresa que agrupa negocios). Ej.: "Girly Zone" es un desarrollo que contiene los negocios "Altercing Studio", "Macao Pilates". Si el usuario quiere meter un negocio dentro de otro, usa "anidar_proyecto" (hijo dentro de padre); para sacarlo, "desanidar_proyecto". El grafo del workspace solo muestra los de nivel superior; los negocios se ven al entrar a su contenedor.'
      + '\nTIENES MEMORIA: recuerdas toda esta conversación y conoces el estado completo del workspace (abajo, ya con la jerarquía). Úsalo; no vuelvas a preguntar lo que ya sabes.';
  }
  if (contexto.estado) system += `\n\n${contexto.estado}`;
  return correrBucleTools(system, TOOLS_CURADOR, historial, ejecutar, modelo);
}

// =================== CURADOR A NIVEL DE PROYECTO (crea Unidades Comerciales) ===================
// Dentro de un proyecto, el Curador estructura la empresa en Unidades Comerciales conversando.
// Herramientas de UC (crear/actualizar/eliminar); la persistencia real la ejecuta la capa de
// actions (inyectada como `ejecutar`). Modelo empresa = Administración transversal + N UCs.

const SYSTEM_PROYECTO = `Eres el CURADOR (Superadmin) del Business Planner de CPF, trabajando DENTRO de un proyecto. Ese proyecto puede ser de dos formas (y a veces ambas):
- Un DESARROLLO/EMPRESA CONTENEDORA que agrupa NEGOCIOS (sub-empresas). Ej.: "Girly Zone" es un desarrollo inmobiliario/espacio físico que contiene los negocios "Altercing Studio" y "Macao Pilates Studio".
- Un NEGOCIO concreto que vende a través de UNIDADES COMERCIALES (líneas de venta directa). Ej.: "Altercing Studio" tiene las UC Uñas, Piercings, Tatuajes, E-commerce.

Modelo: empresa = capa transversal de Administración (1 vez) + N Unidades Comerciales. Y un contenedor = Administración + N Negocios (cada negocio es a su vez una empresa con sus propias UC). La jerarquía es: desarrollo → negocios → unidades comerciales.

Herramientas y cuándo usarlas:
1) NEGOCIOS: si el proyecto es un desarrollo/contenedor y el usuario menciona negocios que están dentro (ej. "dentro de Girly Zone está Altercing y Macao Pilates"), usa "crear_negocio" por cada uno. Cada negocio se podrá abrir por separado para darle sus propias unidades comerciales, sedes y planos.
2) UNIDADES COMERCIALES: si el usuario describe las líneas de venta directa de ESTE negocio, usa "crear_unidad" por cada una; puedes ajustarlas (actualizar_unidad) o eliminarlas (eliminar_unidad).
3) Distingue bien: un NEGOCIO es una empresa dentro del proyecto (tiene su propia administración y UC); una UNIDAD COMERCIAL es una línea de venta del propio proyecto. Ante la duda, pregunta cuál de los dos es.
3b) ETAPA OBJETIVO: al inicio, ayuda a definir en qué ETAPA de la ruta está o hacia dónde va el negocio (arrancar → expandir → replicar → automatizar → vender) y regístrala con "fijar_etapa". Esto define qué planos y a qué % se enfoca el negocio. Si el usuario no la menciona, pregúntala una vez al conocer el negocio.
4) NO inventes: lo que no sepas queda PENDIENTE. No dupliques negocios ni UC ya existentes.
5) Gobierno (Nivel B): respeta el método congelado (ARQOS, PLANO ALV, contratos). Aquí defines estructura (negocios/UC); los planos se trabajan aparte.

Estilo: español, claro y breve. 1–3 preguntas por turno, las mínimas. Antes de eliminar, confirma. Responde solo con tu mensaje.`;

const TOOLS_CURADOR_PROYECTO: Anthropic.Tool[] = [
  {
    name: 'crear_negocio',
    description: 'Crea un NEGOCIO (sub-empresa) DENTRO de este proyecto. Úsalo cuando el proyecto es un desarrollo/contenedor. Ej: dentro de "Girly Zone" crea "Altercing Studio" y "Macao Pilates Studio". Cada negocio tendrá luego sus propias unidades comerciales.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        nombre: { type: 'string', description: 'Nombre del negocio.' },
        resumen: { type: 'string', description: 'Qué es el negocio en una línea (opcional).' },
      },
      required: ['nombre'],
    },
  },
  {
    name: 'crear_unidad',
    description: 'Crea una Unidad Comercial (línea de venta directa) en el proyecto. Ej: Tatuajes, Piercings, E-commerce.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        nombre: { type: 'string', description: 'Nombre de la unidad comercial.' },
        tipo: { type: 'string', description: 'servicio · producto · e-commerce… (opcional).' },
        descripcion: { type: 'string', description: 'Qué vende esta unidad (opcional).' },
      },
      required: ['nombre'],
    },
  },
  {
    name: 'actualizar_unidad',
    description: 'Actualiza una Unidad Comercial existente (renombrar, tipo o descripción). Refiere a la unidad por su nombre actual.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        unidad: { type: 'string', description: 'Nombre actual de la UC.' },
        nuevoNombre: { type: 'string' },
        tipo: { type: 'string' },
        descripcion: { type: 'string' },
      },
      required: ['unidad'],
    },
  },
  {
    name: 'eliminar_unidad',
    description: 'Elimina una Unidad Comercial del proyecto. Acción destructiva: confirma con el usuario antes.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: { unidad: { type: 'string' } },
      required: ['unidad'],
    },
  },
  {
    name: 'fijar_etapa',
    description: 'Fija la ETAPA OBJETIVO del negocio: la ruta de 5 fases hacia la que trabaja. Úsalo al inicio, cuando el usuario define en qué etapa está o hacia dónde va. Define qué planos y a qué % se enfoca el negocio.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        etapa: {
          type: 'string',
          enum: ['arrancar', 'expandir', 'replicar', 'automatizar', 'vender'],
          description: '1 arrancar (poner a operar) · 2 expandir (crecer y semi-automatizar) · 3 replicar (estandarizar para franquiciar) · 4 automatizar (agentes de IA operan) · 5 vender (todo listo para due diligence).',
        },
      },
      required: ['etapa'],
    },
  },
];

export interface ContextoProyecto {
  proyecto?: string;   // nombre del proyecto/empresa
  unidades?: string[]; // nombres de UCs ya creadas
  estado?: string;     // snapshot vivo del proyecto (SOLO este proyecto, se reinyecta cada turno)
}

export async function correrCuradorProyecto(
  historial: MensajeChat[],
  contexto: ContextoProyecto,
  ejecutar: EjecutorHerramienta,
  modelo?: ModeloClaude,
): Promise<ResultadoCurador> {
  const unidades = contexto.unidades ?? [];
  let system = SYSTEM_PROYECTO
    + `\n\nProyecto actual: "${contexto.proyecto ?? 'sin nombre'}". `
    + (unidades.length ? `Unidades comerciales ya creadas: ${unidades.join(', ')}.` : 'Aún no hay unidades comerciales creadas.')
    + '\nTIENES MEMORIA Y CONTEXTO HEREDADO: recuerdas esta conversación, ves el estado completo de ESTE proyecto (abajo) — sedes, mapas, espacios, planos y UCs —, sabes a qué desarrollo/empresa PERTENECE (sección "Pertenece a") y compartes la MEMORIA del Curador del workspace (sección "Memoria compartida"). Si el usuario ya describió este negocio o sus unidades comerciales "arriba" (con el Curador del workspace), YA LO SABES: actúa con esa información (crea las UC que mencionó) en vez de volver a preguntar. Trabajas SOLO sobre este proyecto. Solo pregunta si el dato realmente no aparece en ningún contexto.';
  if (contexto.estado) system += `\n\n${contexto.estado}`;
  return correrBucleTools(system, TOOLS_CURADOR_PROYECTO, historial, ejecutar, modelo);
}
