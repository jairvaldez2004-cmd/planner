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
export interface Sede { id: string; nombre: string; direccion?: string | undefined; lat?: number | undefined; lng?: number | undefined; medidas?: string | undefined; rentaMensual?: number | undefined; footAncho?: number | undefined; footAlto?: number | undefined; poligono?: [number, number][] | undefined; muroExterior?: number | undefined; muroInterior?: number | undefined; acabadoPiso?: string | undefined; acabadoMuros?: string | undefined; existe?: boolean | undefined }

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
// ---------- colocación automática ----------
// Busca un hueco libre dentro de un área para un objeto nuevo de ancho×fondo (m):
// recorre en rejilla y devuelve la primera posición que no se encima con lo ocupado.
// null si no cabe (quien llama decide: centrar, avisar, o pedir otra área).
export interface RectM { x: number; y: number; ancho: number; alto: number }

export function buscarHueco(area: RectM, ocupados: RectM[], ancho: number, fondo: number, margen = 0.06, paso = 0.1): { x: number; y: number } | null {
  const solapa = (a: RectM, b: RectM) =>
    a.x < b.x + b.ancho && a.x + a.ancho > b.x && a.y < b.y + b.alto && a.y + a.alto > b.y;
  for (let y = area.y + margen; y + fondo + margen <= area.y + area.alto + 1e-9; y += paso) {
    for (let x = area.x + margen; x + ancho + margen <= area.x + area.ancho + 1e-9; x += paso) {
      const cand: RectM = { x, y, ancho, alto: fondo };
      const inflado = (o: RectM): RectM => ({ x: o.x - margen, y: o.y - margen, ancho: o.ancho + margen * 2, alto: o.alto + margen * 2 });
      if (!ocupados.some((o) => solapa(cand, inflado(o)))) {
        return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
      }
    }
  }
  return null;
}

// ---------- formas 3D reconocibles ----------
// Qué nombres de objeto tienen forma paramétrica en la vista 3D (ui/modelos-genericos
// construye la geometría; aquí viven los PATRONES para que el server pueda saberlo sin
// importar Three.js). Mantener ambos lados en sincronía por `clave`.
// El ORDEN importa: lo específico va antes que lo general (p. ej. "sillón de tatuaje"
// → camilla antes de que "sillón" caiga en sofá; "escritorio en L" antes que "escritorio").
export const FORMAS_3D: { clave: string; patron: RegExp }[] = [
  { clave: 'camilla', patron: /camilla|cama\b|sill[oó]n de tatu/ },
  { clave: 'sofa', patron: /sof[aá]|sill[oó]n|loveseat|couch/ },
  { clave: 'sillas', patron: /sillas?|asiento/ },
  { clave: 'banco', patron: /banco|taburete/ },
  { clave: 'escritorioL', patron: /escritorio en l|esquinero/ },
  { clave: 'mostrador', patron: /mostrador|barra|recepci[oó]n|caja/ },
  { clave: 'vitrina', patron: /vitrina|exhibidor|aparador/ },
  { clave: 'lampara', patron: /l[aá]mpara/ },
  { clave: 'autoclave', patron: /autoclave|esteriliza/ },
  { clave: 'tarja', patron: /tarja|lavabo|fregadero|lavamanos/ },
  { clave: 'wc', patron: /\bwc\b|inodoro|excusado|escusado|retrete/ },
  { clave: 'carrito', patron: /carro|carrito/ },
  { clave: 'estante', patron: /estante|anaquel|repisa|librero|\brack\b/ },
  { clave: 'tv', patron: /\btv\b|televisor|televisi[oó]n|pantalla|monitor/ },
  { clave: 'pizarron', patron: /pizarr[oó]n|pintarr[oó]n|whiteboard|tablero blanco/ },
  { clave: 'refrigerador', patron: /refri|nevera|frigobar|frigor[ií]fico/ },
  { clave: 'dispensador', patron: /dispensador|garraf[oó]n/ },
  { clave: 'impresora', patron: /impresora|multifuncional|copiadora/ },
  { clave: 'espejo', patron: /espejo/ },
  { clave: 'computadora', patron: /computadora|laptop|\bpc\b|ordenador/ },
  { clave: 'planta', patron: /planta|maceta|palma/ },
  { clave: 'cortina', patron: /cortina|divisor|biombo/ },
  { clave: 'archivero', patron: /archivero|cajonera|gabinete/ },
  { clave: 'bote', patron: /bote de basura|basurero|cesto|papelera/ },
  { clave: 'minisplit', patron: /minisplit|mini split|aire acondicionado|\bclima\b/ },
  { clave: 'microondas', patron: /microondas|horno/ },
  { clave: 'mesa', patron: /mesa|escritorio/ },
];

export function claveForma3D(nombre: string): string | null {
  const n = nombre.toLowerCase();
  return FORMAS_3D.find((f) => f.patron.test(n))?.clave ?? null;
}

// Altura estimada de un objeto (m) para la vista 3D, por su nombre/categoría. Es una
// aproximación razonable mientras no se capture la altura real por objeto.
export function alturaObjeto(nombre: string, categoria: string): number {
  const n = nombre.toLowerCase();
  if (/l[aá]mpara|lampara/.test(n)) return 1.7;
  if (/vitrina|estante|repisa|anaquel/.test(n)) return 1.5;
  if (/mostrador|barra|recepci/.test(n)) return 1.1;
  if (/silla|banco|taburete/.test(n)) return 0.9;
  if (/camilla|cama/.test(n)) return 0.75;
  if (/tarja|lavabo|fregadero/.test(n)) return 0.9;
  if (/carro|carrito/.test(n)) return 0.9;
  if (/autoclave|equipo|esterili/.test(n)) return 0.55;
  if (categoria === 'insumo') return 0.3;
  if (categoria === 'equipo') return 0.6;
  return 0.8;
}

export function etiquetaNivel(capa: number): string {
  if (capa < 0) return `Sótano ${-capa}`;
  if (capa === 0) return 'Planta baja';
  return `Piso ${capa}`;
}
