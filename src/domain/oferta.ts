// Dominio del CATÁLOGO por Unidad Comercial. Ref: PLANNER_CATALOG_TO_OFFERING_V1.md.
//
// Átomo universal: toda Oferta = {Entregable} + {Ruta de entrega}.
//   - producto  = entregable es un bien físico
//   - servicio  = entregable es un resultado/experiencia
//   - híbrido   = bien + servicio
// La Ruta vive en la OFERTA como plantilla base; cada PRESENTACIÓN (SKU vendible)
// la hereda y solo declara la diferencia (overrides / pasos extra / omitidos).
// V1: lugar/rol/herramientas/insumos son texto libre → futuro: refs a maestros/Espacios.

export type TipoEntregable = 'bien' | 'servicio' | 'hibrido';
export type FasePaso = 'aprovisionamiento' | 'produccion' | 'entrega' | 'postventa';

export const TIPOS_ENTREGABLE: { id: TipoEntregable; label: string }[] = [
  { id: 'bien', label: 'Bien (producto físico)' },
  { id: 'servicio', label: 'Servicio (resultado/experiencia)' },
  { id: 'hibrido', label: 'Híbrido (bien + servicio)' },
];

export const FASES: { id: FasePaso; label: string; orden: number }[] = [
  { id: 'aprovisionamiento', label: 'Antes · Aprovisionamiento', orden: 0 },
  { id: 'produccion', label: 'Durante · Producción/Preparación', orden: 1 },
  { id: 'entrega', label: 'Durante · Venta/Entrega', orden: 2 },
  { id: 'postventa', label: 'Después · Postventa/Seguimiento', orden: 3 },
];

export function ordenFase(f: FasePaso): number {
  return FASES.find((x) => x.id === f)?.orden ?? 99;
}
export function etiquetaFase(f: FasePaso): string {
  return FASES.find((x) => x.id === f)?.label ?? f;
}

// Insumo/componente consumido (BOM de una presentación o insumos de un paso).
export interface Insumo { item: string; cantidad?: string | undefined; costo?: number | undefined }

// Disparador (trigger) del PROCESO (= la oferta/ruta). Marca qué INICIA o qué TERMINA
// el proceso y, opcionalmente, a qué OTRO proceso (oferta) redirige. Puede haber varios.
export type TipoDisparador = 'inicio' | 'fin';
export interface Disparador {
  id: string;
  tipo: TipoDisparador;
  evento: string;                        // qué ocurre (ej. "Cliente agenda cita", "Pago recibido")
  destinoOfertaId?: string | undefined;  // → a qué proceso (oferta) redirige
}

// Nodo atómico: un paso del proceso de entrega.
export interface Paso {
  id: string;
  nombre: string;
  fase: FasePaso;
  lugar?: string | undefined;        // → Espacio (futuro)
  rol?: string | undefined;          // → maestro personas (futuro)
  herramientas?: string | undefined; // → ObjetoFisico (futuro)
  insumos: Insumo[];                 // → costos/componentes (futuro)
  tiempoMin?: number | undefined;
  entrada?: string | undefined;
  salida?: string | undefined;
  manual?: string | undefined;
}

// Oferta = lo que vende la UC (familia). Tiene su ruta base.
export interface Oferta {
  id: string;
  ucId: string;
  nombre: string;
  tipoEntregable: TipoEntregable;
  categoria?: string | undefined;
  descripcion?: string | undefined;
  rutaBase: Paso[];
  disparadores: Disparador[];  // triggers de inicio/fin del proceso + redirección
}

// Presentación = la forma EXACTA en que se vende (SKU vendible).
export interface Presentacion {
  id: string;
  ofertaId: string;
  nombre: string;
  precio?: number | undefined;
  unidad?: string | undefined;   // kg · caja · sesión · pieza…
  minimo?: string | undefined;   // mínimo de compra
  composicion: Insumo[];         // BOM: insumos + complementarios + empaque
  omitidos: string[];            // ids de pasos base saltados
  overrides: Record<string, Partial<Paso>>; // pasoBaseId → cambios
  pasosExtra: Paso[];            // pasos añadidos sobre la base
}

// --- helpers puros ---

// Aplica un override parcial sobre un paso base (sin mutar el original).
function aplicarOverride(base: Paso, ov: Partial<Paso> | undefined): Paso {
  if (!ov) return base;
  return {
    ...base,
    ...ov,
    id: base.id,                               // el id no cambia
    insumos: ov.insumos ?? base.insumos,       // reemplazo total si viene
  };
}

// Ruta EFECTIVA de una presentación = base (− omitidos, con overrides) ++ pasos extra,
// ordenada por fase y luego por orden de captura.
export function rutaEfectiva(rutaBase: Paso[], p: Presentacion): Paso[] {
  const omit = new Set(p.omitidos);
  const heredados = rutaBase.filter((s) => !omit.has(s.id)).map((s) => aplicarOverride(s, p.overrides[s.id]));
  const todos = [...heredados, ...p.pasosExtra];
  return todos
    .map((s, i) => ({ s, i }))
    .sort((a, b) => ordenFase(a.s.fase) - ordenFase(b.s.fase) || a.i - b.i)
    .map((x) => x.s);
}

export interface Costeo { costoBOM: number; costoInsumosRuta: number; costoTotal: number; margen?: number | undefined; tiempoTotalMin: number }

// Costeo de una presentación: BOM + insumos de la ruta efectiva; margen = precio − costoTotal.
export function costearPresentacion(rutaBase: Paso[], p: Presentacion): Costeo {
  const sum = (arr: Insumo[]) => arr.reduce((s, x) => s + (x.costo ?? 0), 0);
  const costoBOM = sum(p.composicion);
  const ruta = rutaEfectiva(rutaBase, p);
  const costoInsumosRuta = ruta.reduce((s, paso) => s + sum(paso.insumos), 0);
  const tiempoTotalMin = ruta.reduce((s, paso) => s + (paso.tiempoMin ?? 0), 0);
  const costoTotal = costoBOM + costoInsumosRuta;
  return {
    costoBOM,
    costoInsumosRuta,
    costoTotal,
    tiempoTotalMin,
    ...(typeof p.precio === 'number' ? { margen: p.precio - costoTotal } : {}),
  };
}
