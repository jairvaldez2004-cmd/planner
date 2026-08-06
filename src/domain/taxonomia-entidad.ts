// TAXONOMÍA DE ENTIDADES (ADITIVO). Un proyecto del Planner puede ser cosas muy distintas:
// un holding que solo posee, una empresa que opera, una unidad dentro de una empresa, una
// marca sin persona moral, o un producto de software. Antes todas se veían igual ("NEG").
//
// Regla rectora: los niveles NO se mezclan. Holding · Empresa · Unidad · Marca · Producto ·
// Sistema · Proyecto · Activo intelectual son cosas distintas, con jerarquías distintas.
//
// Funciones puras (sin IO). Los campos viven en `Proyecto` (JSON), sin cambio de esquema.

export type TipoEntidad =
  | 'holding_matriz'
  | 'holding_sectorial'
  | 'empresa_operativa'
  | 'unidad_negocio'
  | 'marca_comercial'
  | 'producto_tecnologico'
  | 'sistema_interno'
  | 'plataforma_saas'
  | 'proyecto'
  | 'metodologia'
  | 'activo_intelectual'
  | 'concepto_comercial'
  | 'entidad_historica';

export interface InfoTipoEntidad {
  id: TipoEntidad;
  label: string;
  emoji: string;
  /** Nivel jerárquico: 0 = matriz, 1 = holding, 2 = empresa, 3 = unidad/producto, 4 = marca. */
  nivel: number;
  descripcion: string;
  /** Qué tipos puede contener directamente. Vacío = no contiene entidades. */
  contiene: TipoEntidad[];
}

export const TIPOS_ENTIDAD: InfoTipoEntidad[] = [
  {
    id: 'holding_matriz', label: 'Holding matriz', emoji: '🏛', nivel: 0,
    descripcion: 'Propietario final del grupo. Solo posee holdings. No opera.',
    contiene: ['holding_sectorial'],
  },
  {
    id: 'holding_sectorial', label: 'Holding sectorial', emoji: '🏢', nivel: 1,
    descripcion: 'Agrupa y posee empresas de una misma función estratégica. No opera productos.',
    contiene: ['empresa_operativa'],
  },
  {
    id: 'empresa_operativa', label: 'Empresa operativa', emoji: '🏭', nivel: 2,
    descripcion: 'Tiene operación, estructura, clientes, costos, riesgos y resultados propios.',
    contiene: ['unidad_negocio', 'marca_comercial', 'producto_tecnologico', 'sistema_interno', 'plataforma_saas'],
  },
  {
    id: 'unidad_negocio', label: 'Unidad de negocio', emoji: '📦', nivel: 3,
    descripcion: 'Opera DENTRO de una empresa. Depende jurídicamente de su empresa matriz.',
    contiene: ['marca_comercial'],
  },
  {
    id: 'marca_comercial', label: 'Marca comercial', emoji: '🏷️', nivel: 4,
    descripcion: 'Identidad frente al mercado. NO implica persona moral.',
    contiene: [],
  },
  {
    id: 'producto_tecnologico', label: 'Producto tecnológico', emoji: '💻', nivel: 3,
    descripcion: 'Plataforma, app o servicio digital. Pertenece a quien lo DESARROLLA, no a quien lo usa.',
    contiene: [],
  },
  {
    id: 'plataforma_saas', label: 'Plataforma SaaS', emoji: '☁️', nivel: 3,
    descripcion: 'Producto tecnológico comercializado a terceros por suscripción o comisión.',
    contiene: [],
  },
  {
    id: 'sistema_interno', label: 'Sistema interno', emoji: '⚙️', nivel: 3,
    descripcion: 'Herramienta de uso interno, no necesariamente comercializada.',
    contiene: [],
  },
  {
    id: 'proyecto', label: 'Proyecto', emoji: '🚧', nivel: 3,
    descripcion: 'Esfuerzo TEMPORAL para construir o lanzar algo. No es el producto final.',
    contiene: [],
  },
  {
    id: 'metodologia', label: 'Metodología', emoji: '📐', nivel: 3,
    descripcion: 'Conjunto estructurado de reglas.',
    contiene: [],
  },
  {
    id: 'activo_intelectual', label: 'Activo intelectual', emoji: '🧠', nivel: 3,
    descripcion: 'Propiedad intelectual: marcas, patentes, documentación, know-how.',
    contiene: [],
  },
  {
    id: 'concepto_comercial', label: 'Concepto comercial', emoji: '✨', nivel: 2,
    descripcion: 'Concepto o ecosistema frente al consumidor. No implica persona moral.',
    contiene: ['empresa_operativa', 'unidad_negocio', 'marca_comercial'],
  },
  {
    id: 'entidad_historica', label: 'Entidad histórica', emoji: '🕰', nivel: 5,
    descripcion: 'Nombre anterior o etapa previa. Conserva trazabilidad; no opera.',
    contiene: [],
  },
];

export function infoTipoEntidad(id: string | undefined): InfoTipoEntidad | null {
  return TIPOS_ENTIDAD.find((t) => t.id === id) ?? null;
}

// ---------- Estado del ciclo de vida ----------
// Distingue lo que EXISTE de lo que solo está en la arquitectura. Evita que una empresa
// objetivo se lea como constituida.
export type EstadoEntidad = 'existente' | 'en_construccion' | 'propuesta' | 'objetivo' | 'inactiva' | 'historica';

export const ESTADOS_ENTIDAD: { id: EstadoEntidad; label: string; emoji: string; color: string; real: boolean }[] = [
  { id: 'existente', label: 'Existente', emoji: '✅', color: '#2e9e63', real: true },
  { id: 'en_construccion', label: 'En construcción', emoji: '🚧', color: '#d9781f', real: true },
  { id: 'propuesta', label: 'Propuesta', emoji: '📝', color: '#c9a13b', real: false },
  { id: 'objetivo', label: 'Objetivo (no constituida)', emoji: '🎯', color: '#8a6db0', real: false },
  { id: 'inactiva', label: 'Inactiva', emoji: '⏸', color: '#8a93a8', real: false },
  { id: 'historica', label: 'Histórica', emoji: '🕰', color: '#8a93a8', real: false },
];

export function infoEstadoEntidad(id: string | undefined) {
  return ESTADOS_ENTIDAD.find((e) => e.id === id) ?? ESTADOS_ENTIDAD[0]!;
}

/** ¿La entidad opera de verdad hoy? Las 'objetivo'/'propuesta' NO deben contarse como reales. */
export function esEntidadReal(estado: string | undefined): boolean {
  return infoEstadoEntidad(estado).real;
}

// ---------- Taxonomía de un proyecto (campos aditivos) ----------
export interface TaxonomiaEntidad {
  tipoEntidad?: TipoEntidad | undefined;
  estadoEntidad?: EstadoEntidad | undefined;
  esPersonaMoral?: boolean | undefined;
  nombreAnterior?: string | undefined;
  alias?: string | undefined;
  /** Quién desarrolla este producto (para producto_tecnologico / sistema / SaaS). */
  desarrolladoPor?: string | undefined;
  /** Qué entidades lo utilizan (suministro transversal). Nombres libres. */
  utilizadoPor?: string[] | undefined;
  notaEntidad?: string | undefined;
}

// ---------- Validación de jerarquía ----------
export interface ResultadoValidacion {
  valido: boolean;
  motivo: string;
}

/**
 * ¿Puede `hijo` colgar de `padre`? Implementa las prohibiciones del modelo:
 * una empresa no cuelga de la matriz · debajo de una empresa no van holdings ·
 * un producto cuelga de quien lo desarrolla, no de quien lo usa.
 */
export function validarJerarquia(tipoPadre: string | undefined, tipoHijo: string | undefined): ResultadoValidacion {
  const padre = infoTipoEntidad(tipoPadre);
  const hijo = infoTipoEntidad(tipoHijo);
  if (!padre || !hijo) return { valido: true, motivo: 'Sin tipo declarado: no se valida.' };

  if (padre.contiene.includes(hijo.id)) {
    return { valido: true, motivo: `${padre.label} puede contener ${hijo.label}.` };
  }

  // Mensajes específicos para los errores frecuentes.
  if (padre.id === 'holding_matriz' && hijo.id === 'empresa_operativa') {
    return { valido: false, motivo: 'Una empresa no cuelga de la matriz: debe pasar por un holding sectorial.' };
  }
  if (padre.id === 'empresa_operativa' && (hijo.id === 'holding_sectorial' || hijo.id === 'holding_matriz')) {
    return { valido: false, motivo: 'Debajo de una empresa operativa no se colocan holdings: van unidades de negocio.' };
  }
  if (hijo.id === 'producto_tecnologico' && padre.id !== 'empresa_operativa') {
    return { valido: false, motivo: 'Un producto tecnológico cuelga de la empresa que lo DESARROLLA.' };
  }
  return { valido: false, motivo: `${padre.label} no puede contener ${hijo.label}.` };
}

// ---------- Regla de escisión ----------
// Cuándo una unidad de negocio debe volverse empresa independiente. 12 criterios; basta uno.
export const CRITERIOS_ESCISION: { id: string; label: string }[] = [
  { id: 'persona_moral', label: 'Requiere una persona moral distinta' },
  { id: 'riesgos', label: 'Tiene riesgos legales o financieros específicos' },
  { id: 'inversion', label: 'Necesita inversión externa' },
  { id: 'socios', label: 'Tiene socios distintos' },
  { id: 'licencias', label: 'Requiere licencias o permisos independientes' },
  { id: 'regulado', label: 'Opera en un sector regulado' },
  { id: 'admin', label: 'Tiene estructura administrativa propia' },
  { id: 'volumen', label: 'Tiene volumen suficiente para justificar independencia' },
  { id: 'marca', label: 'Tiene una marca con valor separado' },
  { id: 'venta', label: 'Se pretende vender de manera independiente' },
  { id: 'contamina', label: 'Su operación pone en riesgo las demás líneas' },
  { id: 'contabilidad', label: 'Requiere contabilidad, contratos o financiamiento separado' },
];

export interface EvaluacionEscision {
  procede: boolean;
  cumplidos: string[];
  total: number;
  veredicto: string;
}

/** Evalúa si una unidad debe escindirse. Basta UN criterio cumplido. */
export function evaluarEscision(criteriosCumplidos: string[]): EvaluacionEscision {
  const validos = CRITERIOS_ESCISION.filter((c) => criteriosCumplidos.includes(c.id)).map((c) => c.label);
  const procede = validos.length > 0;
  return {
    procede,
    cumplidos: validos,
    total: validos.length,
    veredicto: procede
      ? `Procede escindir: cumple ${validos.length} criterio(s). Puede convertirse en empresa independiente.`
      : 'No procede: se mantiene como unidad de negocio dentro de su empresa.',
  };
}
