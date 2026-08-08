// FICHA ESTRUCTURAL DE UNIDAD COMERCIAL (ADITIVO).
//
// Toda UC se describe con la MISMA ficha, para que sean comparables y para que el mapa
// operativo de cada una se pueda leer con el mismo lente. Vive en `UnidadComercial.data.ficha`
// (JSON), sin cambio de esquema.
//
// ── La decisión que gobierna este archivo ──────────────────────────────────────────────
// De los campos que describen una UC, unos son SUYOS y otros ya tienen dueño en otra parte
// del Planner. Capturar los segundos aquí crearía dos copias del mismo dato que se
// desincronizan en cuanto alguien edite una sola. Por eso hay dos clases de campo:
//
//   · CAPTURADO — la UC es el dueño. Se escribe aquí y de aquí lo leen los planos.
//   · DERIVADO  — el dueño es el mapa operativo (procesos, roles, herramientas,
//                 automatizaciones). La ficha lo MUESTRA, no lo guarda.
//
// Es el mismo principio que ya rige el resto del sistema: un dato, un dueño, muchos lentes.

export type ClaseCampoUC = 'capturado' | 'derivado';

export interface CampoFichaUC {
  id: string;
  label: string;
  clase: ClaseCampoUC;
  /** Agrupación para la UI y para el documento generado. */
  grupo: string;
  /** Qué se espera; se muestra como ayuda bajo el campo. */
  ayuda: string;
  /** true = lista (una entrada por línea). false = prosa. */
  lista?: boolean;
  /** Solo en derivados: de dónde sale el dato, para poder mandar al usuario ahí. */
  fuente?: string;
}

export const GRUPOS_FICHA_UC = [
  'Identidad',
  'Entrada',
  'Oferta',
  'Ejecución',
  'Participantes',
  'Insumos de información',
  'Medición y riesgo',
  'Automatización',
  'Economía',
  'Salida',
] as const;

export const CAMPOS_FICHA_UC: CampoFichaUC[] = [
  // ---------- Identidad ----------
  { id: 'proposito', label: 'Propósito', clase: 'capturado', grupo: 'Identidad',
    ayuda: 'Qué hace esta unidad, en una frase. Si no cabe en una frase, probablemente son dos unidades.' },
  { id: 'clienteObjetivo', label: 'Cliente objetivo', clase: 'capturado', grupo: 'Identidad',
    ayuda: 'Quién la contrata. Distinguir cliente interno (empresa del grupo) de externo.' },
  { id: 'problemaQueResuelve', label: 'Problema que resuelve', clase: 'capturado', grupo: 'Identidad',
    ayuda: 'La situación concreta del cliente antes de contratar. Sin esto, la unidad no se puede vender.' },

  // ---------- Entrada ----------
  { id: 'triggerEntrada', label: 'Trigger de entrada', clase: 'capturado', grupo: 'Entrada', lista: true,
    ayuda: 'Qué evento hace que un caso entre a esta unidad. Uno por línea.' },
  { id: 'requisitosEntrada', label: 'Requisitos de entrada', clase: 'capturado', grupo: 'Entrada', lista: true,
    ayuda: 'Qué debe existir ANTES de arrancar. Si falta algo de esta lista, el caso no entra.' },
  { id: 'diagnostico', label: 'Diagnóstico', clase: 'capturado', grupo: 'Entrada',
    ayuda: 'Cómo se evalúa el caso al entrar y qué decide (aceptar, rechazar, mandar a otra unidad).' },

  // ---------- Oferta ----------
  { id: 'servicios', label: 'Servicios', clase: 'capturado', grupo: 'Oferta', lista: true,
    ayuda: 'Lo que la unidad vende. Uno por línea.' },
  { id: 'entregables', label: 'Entregables', clase: 'capturado', grupo: 'Oferta', lista: true,
    ayuda: 'Los artefactos concretos que recibe el cliente. Si no se puede entregar, no es entregable.' },

  // ---------- Ejecución (DERIVADO del mapa operativo) ----------
  { id: 'procesoOperativo', label: 'Proceso operativo', clase: 'derivado', grupo: 'Ejecución',
    ayuda: 'Los pasos de nivel raíz del mapa de esta unidad.', fuente: 'Mapa Operativo · procesos raíz' },
  { id: 'subprocesos', label: 'Subprocesos', clase: 'derivado', grupo: 'Ejecución',
    ayuda: 'Los pasos anidados dentro de cada proceso.', fuente: 'Mapa Operativo · subprocesos' },

  // ---------- Participantes ----------
  { id: 'roles', label: 'Roles', clase: 'derivado', grupo: 'Participantes',
    ayuda: 'Quién ejecuta cada paso.', fuente: 'Mapa Operativo · roles de cada proceso' },
  { id: 'departamentos', label: 'Departamentos involucrados', clase: 'derivado', grupo: 'Participantes',
    ayuda: 'Los carriles del mapa que participan.', fuente: 'Mapa Operativo · departamentos' },
  { id: 'empresasDioquis', label: 'Empresas Dioquis involucradas', clase: 'capturado', grupo: 'Participantes', lista: true,
    ayuda: 'Qué empresas del grupo entregan algo. CPF coordina el proyecto; NO las gobierna.' },
  { id: 'proveedoresExternos', label: 'Proveedores externos', clase: 'capturado', grupo: 'Participantes', lista: true,
    ayuda: 'Terceros fuera del grupo de los que depende la unidad.' },

  // ---------- Insumos de información ----------
  { id: 'herramientas', label: 'Herramientas', clase: 'derivado', grupo: 'Insumos de información',
    ayuda: 'Lo que se usa para ejecutar.', fuente: 'Mapa Operativo · herramientas de cada proceso' },
  { id: 'software', label: 'Software', clase: 'derivado', grupo: 'Insumos de información',
    ayuda: 'Plataformas que soportan la unidad.', fuente: 'Mapa Operativo · herramientas + plano Tecnológico' },
  { id: 'formularios', label: 'Formularios', clase: 'capturado', grupo: 'Insumos de información', lista: true,
    ayuda: 'Capturas estructuradas que la unidad usa para recolectar información.' },
  { id: 'documentos', label: 'Documentos', clase: 'capturado', grupo: 'Insumos de información', lista: true,
    ayuda: 'Plantillas, contratos, formatos que la unidad produce o consume.' },
  { id: 'datosGenerados', label: 'Datos generados', clase: 'capturado', grupo: 'Insumos de información', lista: true,
    ayuda: 'Qué queda registrado al ejecutar. Es lo que después alimenta KPIs y automatización.' },

  // ---------- Medición y riesgo ----------
  { id: 'kpis', label: 'KPIs', clase: 'capturado', grupo: 'Medición y riesgo', lista: true,
    ayuda: 'Cómo se mide que la unidad va bien. Cada KPI necesita un dato que ya se genere.' },
  { id: 'riesgos', label: 'Riesgos', clase: 'capturado', grupo: 'Medición y riesgo', lista: true,
    ayuda: 'Qué puede salir mal y con qué consecuencia.' },
  { id: 'controles', label: 'Controles', clase: 'capturado', grupo: 'Medición y riesgo', lista: true,
    ayuda: 'Qué mecanismo evita o detecta cada riesgo. Un riesgo sin control es una apuesta.' },

  // ---------- Automatización (DERIVADO) ----------
  { id: 'automatizaciones', label: 'Automatizaciones', clase: 'derivado', grupo: 'Automatización',
    ayuda: 'Pasos que ya no ejecuta una persona.', fuente: 'Mapa Operativo · automatización de cada proceso' },
  { id: 'ia', label: 'IA', clase: 'derivado', grupo: 'Automatización',
    ayuda: 'Pasos resueltos por un agente.', fuente: 'Mapa Operativo · automatización con IA' },

  // ---------- Economía ----------
  { id: 'costos', label: 'Costos', clase: 'capturado', grupo: 'Economía',
    ayuda: 'Qué cuesta ejecutar un caso: horas, empresas hermanas, terceros, licencias.' },
  { id: 'pricing', label: 'Pricing', clase: 'capturado', grupo: 'Economía',
    ayuda: 'Cómo se cobra: fijo, por fase, por porcentaje, retainer, éxito, equity.' },
  { id: 'sla', label: 'SLA', clase: 'capturado', grupo: 'Economía',
    ayuda: 'Compromiso de tiempo y calidad. Debe ser verificable contra el mapa.' },

  // ---------- Salida ----------
  { id: 'criterioTerminacion', label: 'Criterio de terminación', clase: 'capturado', grupo: 'Salida', lista: true,
    ayuda: 'Cuándo se declara terminado un caso. Sin esto, los proyectos no cierran nunca.' },
  { id: 'handoff', label: 'Handoff a siguiente unidad', clase: 'capturado', grupo: 'Salida',
    ayuda: 'A qué unidad pasa el caso al terminar, y qué se le entrega para que arranque.' },
];

export type FichaUC = Record<string, string>;

export function campoFichaUC(id: string): CampoFichaUC | undefined {
  return CAMPOS_FICHA_UC.find((c) => c.id === id);
}

export const CAMPOS_CAPTURADOS_UC = CAMPOS_FICHA_UC.filter((c) => c.clase === 'capturado');
export const CAMPOS_DERIVADOS_UC = CAMPOS_FICHA_UC.filter((c) => c.clase === 'derivado');

/** Campos de una lista, ya partidos por línea y sin vacíos. */
export function lineasDe(ficha: FichaUC | undefined, campoId: string): string[] {
  const v = ficha?.[campoId];
  if (!v) return [];
  return v.split('\n').map((s) => s.trim()).filter(Boolean);
}

/**
 * Completitud de la ficha: solo cuenta los CAPTURADOS — los derivados no se llenan a mano,
 * así que exigirlos daría un porcentaje que nunca llega a 100 por diseño.
 */
export function completitudFichaUC(ficha: FichaUC | undefined): { llenos: number; total: number; pct: number } {
  const total = CAMPOS_CAPTURADOS_UC.length;
  const llenos = CAMPOS_CAPTURADOS_UC.filter((c) => (ficha?.[c.id] ?? '').trim() !== '').length;
  return { llenos, total, pct: total === 0 ? 0 : Math.round((llenos / total) * 100) };
}
