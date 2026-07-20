// Dominio del Módulo de Espacios (Fase 1). Ref: PLANNER_FLOW_AND_SPACES_V1.md.
// Un lienzo 2D compartido; cada plano es una LENTE con sus propios campos sobre el
// mismo espacio/objeto. Los datos se guardan en `data` (namespaced por lente).

export type TipoEspacio = 'edificio' | 'capa' | 'habitacion' | 'area';
export type CategoriaObjeto = 'mueble' | 'herramienta' | 'insumo' | 'equipo';
export type LenteId = 'espacios' | 'procesos' | 'organizacional' | 'operativo' | 'financiero' | 'tecnologico';

export const TIPOS_ESPACIO: TipoEspacio[] = ['edificio', 'capa', 'habitacion', 'area'];
export const CATEGORIAS_OBJETO: CategoriaObjeto[] = ['mueble', 'herramienta', 'insumo', 'equipo'];

export type TipoCampoLente = 'texto' | 'parrafo' | 'numero' | 'opcion';
export interface CampoLente {
  id: string;                 // se guarda en data[id]
  label: string;
  tipo: TipoCampoLente;
  opciones?: string[];
  soloObjeto?: boolean;       // solo aplica a objetos físicos
}

export interface Lente {
  id: LenteId;
  etiqueta: string;
  color: string;              // acento visual del lienzo
  campos: CampoLente[];
}

// Catálogo de lentes = qué se captura por plano al seleccionar un espacio/objeto.
export const LENTES: Lente[] = [
  {
    id: 'espacios', etiqueta: 'Espacios (base)', color: '#5b8def',
    campos: [
      { id: 'uso', label: 'Uso / para qué es', tipo: 'texto' },
      { id: 'que_almacena', label: 'Qué almacena', tipo: 'texto' },
      { id: 'forma', label: 'Forma', tipo: 'texto', soloObjeto: true },
    ],
  },
  {
    id: 'procesos', etiqueta: 'Procesos', color: '#e0795b',
    campos: [
      { id: 'proc_proceso', label: 'Proceso que ocurre aquí', tipo: 'texto' },
      { id: 'proc_rol', label: 'Rol que lo ejecuta', tipo: 'texto' },
      { id: 'proc_horario', label: 'Horario / turno', tipo: 'texto' },
      { id: 'proc_manual', label: 'Manual del proceso', tipo: 'texto' },
    ],
  },
  {
    id: 'organizacional', etiqueta: 'Roles y accesos', color: '#b06be0',
    campos: [
      { id: 'org_acceso', label: 'Roles con acceso', tipo: 'texto' },
      { id: 'org_responsable', label: 'Responsable', tipo: 'texto' },
      { id: 'org_jerarquia', label: 'Reporta a / jerarquía', tipo: 'texto' },
    ],
  },
  {
    id: 'operativo', etiqueta: 'Operativo', color: '#3bb0c9',
    campos: [
      { id: 'ope_ejecutor', label: 'Ejecutor (humano/IA/mixto)', tipo: 'opcion', opciones: ['humano', 'IA', 'mixto'] },
      { id: 'ope_etapa', label: 'Etapa del ciclo', tipo: 'texto' },
      { id: 'ope_flujo', label: 'Handoff / flujo hacia', tipo: 'texto' },
    ],
  },
  {
    id: 'financiero', etiqueta: 'Costos', color: '#2e9e63',
    campos: [
      { id: 'fin_costo', label: 'Costo ($)', tipo: 'numero' },
      { id: 'fin_proveedor', label: 'Proveedor', tipo: 'texto' },
      { id: 'fin_mantenimiento', label: 'Mantenimiento (qué/cada cuánto)', tipo: 'texto' },
      { id: 'fin_encargado', label: 'Encargado de mantenimiento', tipo: 'texto' },
    ],
  },
  {
    id: 'tecnologico', etiqueta: 'Tecnología', color: '#d9a23b',
    campos: [
      { id: 'tec_automatizar', label: '¿Se automatiza?', tipo: 'opcion', opciones: ['sí', 'no', 'parcial'] },
      { id: 'tec_herramienta', label: 'Herramienta / software', tipo: 'texto' },
    ],
  },
];

export function lente(id: LenteId): Lente {
  return LENTES.find((l) => l.id === id) ?? LENTES[0]!;
}

// --- tipos serializables (lo que viaja al front) ---
export interface UnidadComercial { id: string; nombre: string; tipo?: string | undefined; descripcion?: string | undefined }
export interface Sede { id: string; nombre: string; direccion?: string | undefined; lat?: number | undefined; lng?: number | undefined; medidas?: string | undefined; rentaMensual?: number | undefined; footAncho?: number | undefined; footAlto?: number | undefined; poligono?: [number, number][] | undefined; muroExterior?: number | undefined; muroInterior?: number | undefined }

// Proyecta un polígono geográfico [lat,lng][] a metros locales (para el editor).
export function poligonoAMetros(pts: [number, number][]): { puntos: { x: number; y: number }[]; ancho: number; alto: number } {
  if (pts.length < 3) return { puntos: [], ancho: 20, alto: 15 };
  const lats = pts.map((p) => p[0]), lngs = pts.map((p) => p[1]);
  const latMin = Math.min(...lats), latMax = Math.max(...lats), lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);
  const lat0 = (latMin + latMax) / 2, cos = Math.cos(lat0 * Math.PI / 180);
  const puntos = pts.map(([lat, lng]) => ({ x: (lng - lngMin) * 111320 * cos, y: (latMax - lat) * 111320 }));
  const ancho = Math.max(1, (lngMax - lngMin) * 111320 * cos);
  const alto = Math.max(1, (latMax - latMin) * 111320);
  return { puntos, ancho, alto };
}

// `rot` = giro en GRADOS alrededor del centro de la figura. Sin él todo queda alineado
// a los ejes y ninguna distribución real (una camilla en diagonal, una barra en ángulo)
// se puede representar — ni medir bien los recorridos.
export interface Espacio {
  id: string; sedeId: string; padreId?: string | undefined; tipo: TipoEspacio; nombre: string;
  capa: number; x: number; y: number; ancho: number; alto: number; rot: number;
  ucIds: string[]; poligono?: { x: number; y: number }[] | undefined; data: Record<string, string>;
}

export interface ObjetoFisico {
  id: string; sedeId: string; espacioId: string; nombre: string; categoria: CategoriaObjeto;
  capa: number; x: number; y: number; ancho: number; alto: number; rot: number; data: Record<string, string>;
}

// ---------- geometría con rotación ----------

export interface Punto { x: number; y: number }

// Centro de una figura rectangular (el eje del giro).
export function centroDe(f: { x: number; y: number; ancho: number; alto: number }): Punto {
  return { x: f.x + f.ancho / 2, y: f.y + f.alto / 2 };
}

export function rotarPunto(p: Punto, centro: Punto, grados: number): Punto {
  if (!grados) return p;
  const r = (grados * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
  const dx = p.x - centro.x, dy = p.y - centro.y;
  return { x: centro.x + dx * cos - dy * sin, y: centro.y + dx * sin + dy * cos };
}

// Las 4 esquinas reales de un rectángulo ya rotado (para medir, verificar choques
// y calcular recorridos sobre la geometría de verdad, no sobre el bbox).
export function esquinasDe(f: { x: number; y: number; ancho: number; alto: number; rot?: number }): Punto[] {
  const c = centroDe(f);
  const g = f.rot ?? 0;
  return [
    { x: f.x, y: f.y }, { x: f.x + f.ancho, y: f.y },
    { x: f.x + f.ancho, y: f.y + f.alto }, { x: f.x, y: f.y + f.alto },
  ].map((p) => rotarPunto(p, c, g));
}

// Normaliza un ángulo a [0, 360).
export function normalizarGrados(g: number): number {
  return ((g % 360) + 360) % 360;
}

// Elementos arquitectónicos: segmentos en metros por capa (muros/puertas/ventanas).
export type TipoElemento = 'muro' | 'puerta' | 'ventana';
export interface ElementoArq {
  id: string; sedeId: string; capa: number; tipo: TipoElemento;
  x1: number; y1: number; x2: number; y2: number; grosor?: number | undefined; data: Record<string, string>;
}
export const ESTILO_ELEMENTO: Record<TipoElemento, { color: string; grosor: number; label: string }> = {
  muro: { color: '#333', grosor: 6, label: 'Muro' },
  puerta: { color: '#b5651d', grosor: 6, label: 'Puerta' },
  ventana: { color: '#3b86c9', grosor: 6, label: 'Ventana' },
};

// Etiqueta de nivel/capa (sótano / planta baja / pisos).
export function etiquetaNivel(capa: number): string {
  if (capa < 0) return `Sótano ${-capa}`;
  if (capa === 0) return 'Planta baja';
  return `Piso ${capa}`;
}
