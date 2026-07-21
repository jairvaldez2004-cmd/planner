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

// `imagenes` = fotos de referencia adjuntas (base64, solo en el turno en que se mandan;
// al persistir el historial se quitan para no engordar la BD ni re-pagar sus tokens).
export interface ImagenChat { mime: string; base64: string }
export type MensajeChat = {
  role: 'user' | 'assistant';
  content: string;
  imagenes?: ImagenChat[] | undefined;
};

// Convierte el historial a mensajes de la API; un mensaje con fotos se vuelve
// bloques [imagen…, texto] para que el modelo las VEA todas (en su orden).
export function aMensajesApi(historial: MensajeChat[]): Anthropic.MessageParam[] {
  return historial.map((m) => {
    if (m.role === 'user' && m.imagenes?.length) {
      return {
        role: 'user' as const,
        content: [
          ...m.imagenes.map((img) => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: img.mime as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: img.base64 },
          })),
          { type: 'text' as const, text: m.content || 'Fotos de referencia.' },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

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
  const messages: Anthropic.MessageParam[] = aMensajesApi(historial); // soporta fotos adjuntas
  const client = getClient();
  let huboCambios = false;

  // Construir un mapa operativo cuesta muchas llamadas (un proceso + una conexión por paso),
  // así que el tope es holgado; el modelo corta solo en cuanto termina.
  const MAX_VUELTAS = 16;
  for (let i = 0; i < MAX_VUELTAS; i++) {
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

  // Se agotaron las vueltas: hay que decirlo, no dar por hecho que quedó completo.
  return { reply: 'Hice varias acciones pero me quedé a medias (llegué al tope de pasos por turno). Dime "continúa" y sigo desde donde me quedé.', huboCambios };
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
3c) MAPA OPERATIVO: conoces el mapa completo (lo ves abajo en el estado) y puedes CONSTRUIRLO conversando. Cuando el usuario describa cómo opera el negocio ("primero abro caja, luego el cliente llega y…"), NO le pidas que lo dibuje: crea tú los procesos con "crear_proceso" y conéctalos en orden con "conectar_procesos" indicando el disparador de cada paso. Reglas:
   · El DEPARTAMENTO es una etiqueta del proceso (quién lo hace), no un contenedor. Si falta uno administrativo (Contabilidad, Dirección…), créalo con "crear_departamento".
   · La FASE es antes (preparación) / durante (operación) / después (seguimiento).
   · La ETAPA es la ruta de 5: un proceso nace en una etapa y se HEREDA a las siguientes. Lo que el negocio hace hoy nace en "arrancar". Si el usuario dice "eso lo haremos cuando crezcamos" o "en la etapa 2", el proceso nace en esa etapa futura.
   · TRABAJO DE HOY PARA UNA ETAPA FUTURA: si el usuario dice algo como "quiero ir guardando las facturas desde ya para el departamento de contabilidad de la etapa 2", crea el proceso de hoy ("Guardar la factura", etapa arrancar) Y el futuro ("Contabilizar facturas", departamento Contabilidad, etapa expandir), y conéctalos con "conectar_procesos". El mapa mostrará el enlace hacia la etapa futura.
   · Si un proceso manual será reemplazado más adelante (típico al automatizar), márcalo con "etapaHasta" en "actualizar_proceso".
   · Pregunta lo mínimo: si falta el rol, el lugar o el tiempo de un paso, créalo igual y pregunta después por los huecos importantes.
4) NO inventes: lo que no sepas queda PENDIENTE. No dupliques negocios, UC ni procesos ya existentes (los ves en el estado).
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
  // --- MAPA OPERATIVO: el Curador puede construir la operación conversando ---
  {
    name: 'crear_proceso',
    description: 'Crea un PROCESO en el mapa operativo. Un proceso es un paso real de la operación ("Abrir caja", "Cobrar", "Guardar la factura"). Va etiquetado con un departamento, vive en una fase (antes/durante/después) y NACE en una etapa de la ruta: desde ahí se hereda a todas las etapas siguientes. Usa esto cuando el usuario describe cómo opera o cómo quiere operar.',
    // Sin strict: la API limita a 24 los parámetros opcionales sumados entre schemas
    // estrictos, y este tool es rico a propósito. El ejecutor valida cada campo.
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        nombre: { type: 'string', description: 'Nombre del proceso, en verbo. Ej: "Dar de alta el catálogo".' },
        departamento: { type: 'string', description: 'Nombre del departamento que lo ejecuta (es una ETIQUETA, no un contenedor). Debe existir; si no, créalo antes con crear_departamento. Si no se sabe, usa "Administración".' },
        fase: { type: 'string', enum: ['antes', 'durante', 'despues'], description: 'antes = preparación · durante = operación · despues = seguimiento.' },
        etapa: { type: 'string', enum: ['arrancar', 'expandir', 'replicar', 'automatizar', 'vender'], description: 'Etapa de la ruta en la que NACE. Si el usuario habla de la operación de hoy, es "arrancar". Si dice "cuando crezcamos" o "en la etapa 2", usa la que corresponda.' },
        descripcion: { type: 'string' },
        roles: { type: 'array', items: { type: 'string' }, description: 'Roles que lo ejecutan. Ej: ["Perforador", "Recepción"].' },
        herramientas: { type: 'array', items: { type: 'string' }, description: 'Herramientas/muebles/equipo que usa (se REUSAN).' },
        insumos: { type: 'array', items: { type: 'string' }, description: 'Lo que se CONSUME al ejecutarlo (gasas, guantes, solución). Distinto de las herramientas.' },
        espacios: { type: 'array', items: { type: 'string' }, description: 'Dónde ocurre (nombres de espacios del plano).' },
        tiempoMin: { type: 'number', description: 'Duración en minutos.' },
        entrada: { type: 'string', description: 'Qué recibe para empezar.' },
        salida: { type: 'string', description: 'Qué produce al terminar.' },
        instructivo: { type: 'string', description: 'El paso a paso para ejecutarlo.' },
      },
      required: ['nombre', 'departamento', 'fase', 'etapa'],
    },
  },
  {
    name: 'actualizar_proceso',
    description: 'Actualiza un proceso existente del mapa (reetiquetarlo a otro departamento, cambiarlo de fase o de etapa, completar sus recursos, tiempo, entrada/salida o instructivo). Refiere al proceso por su nombre actual.',
    // Sin strict por el mismo límite de parámetros opcionales (ver crear_proceso).
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        proceso: { type: 'string', description: 'Nombre actual del proceso.' },
        nuevoNombre: { type: 'string' },
        departamento: { type: 'string' },
        fase: { type: 'string', enum: ['antes', 'durante', 'despues'] },
        etapa: { type: 'string', enum: ['arrancar', 'expandir', 'replicar', 'automatizar', 'vender'], description: 'Cambia la etapa en la que NACE.' },
        etapaHasta: { type: 'string', enum: ['arrancar', 'expandir', 'replicar', 'automatizar', 'vender', 'siempre'], description: 'Última etapa en la que sigue vigente; después se jubila. Úsalo para el proceso manual que una automatización reemplaza. "siempre" quita la jubilación.' },
        descripcion: { type: 'string' },
        roles: { type: 'array', items: { type: 'string' } },
        herramientas: { type: 'array', items: { type: 'string' } },
        insumos: { type: 'array', items: { type: 'string' } },
        espacios: { type: 'array', items: { type: 'string' } },
        tiempoMin: { type: 'number' },
        entrada: { type: 'string' },
        salida: { type: 'string' },
        instructivo: { type: 'string' },
      },
      required: ['proceso'],
    },
  },
  {
    name: 'conectar_procesos',
    description: 'Conecta dos procesos con una RAMA: el disparador (evento) que hace que del primero se pase al segundo. Así se arma el flujo. El destino PUEDE nacer en una etapa posterior: así se declara el trabajo que se hace hoy para habilitar el mañana (ej. "Guardar la factura" hoy → "Contabilizar" que nace en la etapa 2). Un proceso con varias ramas se bifurca según el disparador que se active.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        desde: { type: 'string', description: 'Nombre del proceso de origen.' },
        hasta: { type: 'string', description: 'Nombre del proceso de destino.' },
        disparador: { type: 'string', description: 'El evento que dispara el paso. Ej: "Pago recibido", "Cliente cancela". Si es simplemente el siguiente paso, usa "continúa".' },
      },
      required: ['desde', 'hasta', 'disparador'],
    },
  },
  {
    name: 'crear_departamento',
    description: 'Crea un departamento administrativo como ETIQUETA del mapa (ej. Contabilidad, Dirección, Marketing, Recursos Humanos). Los departamentos de las unidades comerciales se crean solos; solo crea aquí los administrativos que falten.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: { nombre: { type: 'string' } },
      required: ['nombre'],
    },
  },
  {
    name: 'eliminar_proceso',
    description: 'Elimina un proceso del mapa. Acción destructiva: confirma con el usuario antes.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: { proceso: { type: 'string' } },
      required: ['proceso'],
    },
  },
];

// =================== DISEÑADOR 3D (amuebla la sede conversando) ===================
// Dentro de la vista 3D de una sede: el usuario DESCRIBE los objetos ("pon una camilla
// de 1.9×0.7 en la Cabina 2") y el agente los crea/coloca/mueve/gira/quita de verdad.

const SYSTEM_DISENADOR = `Eres el DISEÑADOR 3D del Business Planner: amueblas la sede de un negocio colocando OBJETOS reales en su plano, conversando.

SISTEMA DE COORDENADAS (métrico): origen (0,0) = esquina superior-izquierda del plano; x crece a la DERECHA hasta el ancho de la huella; y crece hacia ABAJO (el fondo) hasta el alto. Un objeto se define por su esquina superior-izquierda (x, y) + ancho (en x) + fondo (en y), en METROS, + giro en grados (sentido horario).

REGLAS:
1) Ve el estado del plano abajo (huella, áreas y objetos con posiciones). Coloca cada objeto DENTRO del área que corresponda y SIN encimarlo con lo que ya hay. Si el usuario no da posición, OMITE x/y: el sistema busca hueco libre solo.
2) NOMBRES = FORMA 3D: la vista dibuja una forma reconocible si el nombre contiene una de estas palabras: camilla/sillón de tatuaje · sofá/sillón · silla(s) · banco/taburete · escritorio en L · mostrador/barra/recepción · vitrina · mesa/escritorio · lámpara · autoclave · tarja/lavabo · WC/inodoro · carro/carrito · estante/anaquel/rack · TV/pantalla/monitor · pizarrón · refrigerador/frigobar · dispensador de agua · impresora · espejo · computadora/laptop · planta/maceta · cortina/divisor · archivero · bote de basura · minisplit/aire acondicionado · microondas. Úsalas SIEMPRE que apliquen ("TV de sala", "Pizarrón blanco", "Sofá gris"). Solo si de verdad no matchea ninguna se verá como caja: dilo y sugiere subir un .glb (escaneado, de poly.pizza, o generado en meshy.ai).
3) Si el usuario no da medidas, usa medidas REALES sensatas (camilla 1.9×0.7 · silla 0.45×0.45 · mostrador 1.5×0.6 · vitrina 1.2×0.4 · banco 0.4×0.4 · carrito 0.5×0.4 · estante 0.9×0.35 · lámpara 0.4×0.4) y dilas en tu respuesta.
4) Puedes crear VARIOS objetos en un turno, y también mover, girar, redimensionar, renombrar o eliminar los existentes (refiérelos por su nombre). Antes de ELIMINAR, confirma con el usuario.
5) ACABADOS: puedes vestir el espacio con "acabado_piso" (toda la sede u un área concreta) y "acabado_muros". Tipos de piso: duela · porcelanato · azulejo · cemento · alfombra · pintura. Tipos de muro: pintura · azulejo · ladrillo · cemento · yeso. El color acepta nombres en español (blanco, arena, verde menta, terracota, madera clara…) o hex (#a67c52).
6) FOTOS DE REFERENCIA: el usuario puede mandarte fotos de ejemplos (muebles, acabados, diseños que le gustan). MÍRALAS y actúa: identifica materiales, colores y estilo, DI lo que ves ("veo duela clara y muros verde menta…") y aplícalo con las herramientas — acabados equivalentes, objetos con medidas parecidas. Si la foto muestra un mueble específico que las formas genéricas no cubren, créalo con el nombre más cercano y sugiere subir un .glb (escaneado o de meshy.ai) para el detalle fino.
7) ÁREAS Y HUELLA: también puedes crear/ajustar/eliminar ÁREAS (habitaciones) con "crear_area"/"actualizar_area"/"eliminar_area" y cambiar el tamaño total con "ajustar_huella". Las áreas se acomodan como un plano real: pegadas entre sí, cubriendo la huella, sin encimarse (revisa las posiciones que ya existen en el estado).
8) RECREAR UN ESPACIO DESDE FOTOS: si el usuario te pasa fotos de SU local y pide recrearlo, NO digas que no puedes — hazlo así, en este orden: (a) ESTIMA medidas reales con pistas visuales: las losetas de piso miden ~33×33 cm (cuéntalas), una puerta ~0.9 m de ancho, el plafón ~2.4–2.7 m; DI tus estimaciones para que el usuario las corrija. (b) Si el total difiere de la huella actual, usa "ajustar_huella". (c) Crea UN ÁREA POR AMBIENTE/FOTO (oficina, baño, bodega…) con posiciones que embonen. (d) Aplica los ACABADOS que ves (piso de la foto por área, muros). (e) Crea los OBJETOS visibles (escritorio, silla, TV, lavabo, WC…) donde aparecen. (f) Resume qué armaste y qué asumiste, e invita a corregir medidas.
9) Español, claro y breve. Di siempre QUÉ hiciste y DÓNDE quedó (área y posición).`;

const TOOLS_DISENADOR: Anthropic.Tool[] = [
  {
    name: 'crear_objeto',
    description: 'Crea un objeto físico en el plano (mueble/herramienta/equipo/insumo). Si omites x/y, el sistema le busca un hueco libre dentro del área.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        nombre: { type: 'string', description: 'Nombre con palabra clave de forma si aplica. Ej: "Camilla de tatuaje".' },
        area: { type: 'string', description: 'Nombre del área/habitación donde va.' },
        ancho: { type: 'number', description: 'Metros en x.' },
        fondo: { type: 'number', description: 'Metros en y.' },
        x: { type: 'number', description: 'Esquina sup-izq en m (opcional: sin ella se busca hueco).' },
        y: { type: 'number', description: 'Esquina sup-izq en m (opcional).' },
        giro: { type: 'number', description: 'Grados, sentido horario (opcional).' },
        categoria: { type: 'string', enum: ['mueble', 'herramienta', 'insumo', 'equipo'], description: 'Por defecto: mueble.' },
      },
      required: ['nombre', 'area', 'ancho', 'fondo'],
    },
  },
  {
    name: 'mover_objeto', description: 'Mueve un objeto existente a otra posición (esquina sup-izq, metros).', strict: true,
    input_schema: { type: 'object', additionalProperties: false, properties: { objeto: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } }, required: ['objeto', 'x', 'y'] },
  },
  {
    name: 'rotar_objeto', description: 'Gira un objeto (grados absolutos, sentido horario; 0 = sin giro).', strict: true,
    input_schema: { type: 'object', additionalProperties: false, properties: { objeto: { type: 'string' }, grados: { type: 'number' } }, required: ['objeto', 'grados'] },
  },
  {
    name: 'redimensionar_objeto', description: 'Cambia el tamaño de un objeto (metros).', strict: true,
    input_schema: { type: 'object', additionalProperties: false, properties: { objeto: { type: 'string' }, ancho: { type: 'number' }, fondo: { type: 'number' } }, required: ['objeto', 'ancho', 'fondo'] },
  },
  {
    name: 'renombrar_objeto', description: 'Renombra un objeto (recuerda las palabras clave de forma).', strict: true,
    input_schema: { type: 'object', additionalProperties: false, properties: { objeto: { type: 'string' }, nuevoNombre: { type: 'string' } }, required: ['objeto', 'nuevoNombre'] },
  },
  {
    name: 'eliminar_objeto', description: 'Elimina un objeto del plano. Confirma con el usuario antes.', strict: true,
    input_schema: { type: 'object', additionalProperties: false, properties: { objeto: { type: 'string' } }, required: ['objeto'] },
  },
  {
    name: 'acabado_piso',
    description: 'Aplica un acabado al PISO: de toda la sede (omite area) o de un área concreta. El color acepta español ("madera clara", "verde menta") o hex.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        tipo: { type: 'string', enum: ['duela', 'porcelanato', 'azulejo', 'cemento', 'alfombra', 'pintura'] },
        color: { type: 'string', description: 'Opcional: nombre en español o #hex. Sin él, el color típico del material.' },
        area: { type: 'string', description: 'Opcional: nombre del área. Sin él, aplica a toda la sede.' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'acabado_muros',
    description: 'Aplica un acabado a los MUROS de la sede. El color acepta español o #hex.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        tipo: { type: 'string', enum: ['pintura', 'azulejo', 'ladrillo', 'cemento', 'yeso'] },
        color: { type: 'string', description: 'Opcional: nombre en español o #hex.' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'crear_area',
    description: 'Crea un ÁREA/habitación en el plano (oficina, baño, bodega, cabina…). Colócala pegada a las demás, sin encimarse, dentro de la huella.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        nombre: { type: 'string' },
        ancho: { type: 'number', description: 'Metros en x.' },
        fondo: { type: 'number', description: 'Metros en y.' },
        x: { type: 'number', description: 'Esquina sup-izq (m). Opcional: sin ella se pone a la derecha de lo existente.' },
        y: { type: 'number', description: 'Esquina sup-izq (m). Opcional.' },
        tipo: { type: 'string', enum: ['habitacion', 'area'], description: 'habitacion = con muros propios · area = zona abierta. Por defecto: area.' },
      },
      required: ['nombre', 'ancho', 'fondo'],
    },
  },
  {
    name: 'actualizar_area',
    description: 'Mueve, redimensiona o renombra un ÁREA existente (refiérela por su nombre).',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        area: { type: 'string' },
        nuevoNombre: { type: 'string' },
        x: { type: 'number' }, y: { type: 'number' },
        ancho: { type: 'number' }, fondo: { type: 'number' },
      },
      required: ['area'],
    },
  },
  {
    name: 'eliminar_area',
    description: 'Elimina un ÁREA del plano. OJO: los objetos que estén dentro se eliminan con ella. Confirma con el usuario antes.',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, properties: { area: { type: 'string' } }, required: ['area'] },
  },
  {
    name: 'ajustar_huella',
    description: 'Cambia el tamaño TOTAL de la sede (ancho × fondo en metros). Úsalo al recrear un espacio real cuyas medidas difieren de la huella actual.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: { ancho: { type: 'number' }, fondo: { type: 'number' } },
      required: ['ancho', 'fondo'],
    },
  },
];

export async function correrDisenador3D(
  historial: MensajeChat[],
  estado: string,
  ejecutar: EjecutorHerramienta,
  modelo?: ModeloClaude,
): Promise<ResultadoCurador> {
  const system = `${SYSTEM_DISENADOR}\n\n${estado}`;
  return correrBucleTools(system, TOOLS_DISENADOR, historial, ejecutar, modelo);
}

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
