// Dominio de LOGÍSTICA (ADITIVO). Nodo propio: COMPRA/ABASTO (embarques que consolidan
// órdenes de compra, con landed cost) + ENTREGA (envío al cliente final) + el directorio de
// TRANSPORTISTAS que sirve a ambos sentidos. Se guarda como filas JSON en TablaProyecto.
// "Interna" (contingencias ancladas a procesos del Mapa) y "Capital humano" (empleados con
// departamento Logística) NO viven aquí: son vistas de solo lectura sobre Mapa Operativo y
// Personas & RH — no se duplica el dato.

import type { OrdenCompra } from './recursos';
import { numero, totalOrden } from './recursos';

function s(v: unknown): string { return typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : ''); }
function sa(v: unknown): string[] { return Array.isArray(v) ? v.map(s).map((x) => x.trim()).filter(Boolean) : []; }

// ---------- COMPRA/ABASTO: embarques + landed cost (costo puesto en tienda) ----------
// Un EMBARQUE consolida una o varias órdenes de compra en un envío, con transportista,
// fechas, estado/tracking y costos logísticos (flete/seguro/aduana/maniobras). El "landed
// cost" = valor de la mercancía + logística; se prorratea entre las órdenes por su valor.
export const ESTADOS_EMBARQUE = [
  { id: 'preparando', label: 'Preparando', emoji: '📦' },
  { id: 'recoleccion', label: 'Recolección', emoji: '🏭' },
  { id: 'transito', label: 'En tránsito', emoji: '🚚' },
  { id: 'aduana', label: 'Aduana', emoji: '🛃' },
  { id: 'entregado', label: 'Entregado', emoji: '✅' },
] as const;
export type EstadoEmbarque = typeof ESTADOS_EMBARQUE[number]['id'];
export function estadoEmbarqueInfo(id: string) {
  return ESTADOS_EMBARQUE.find((e) => e.id === id) ?? ESTADOS_EMBARQUE[0];
}

// MODALIDAD de envío: no todo va en tráiler. La paquetería (courier) cobra por GUÍA/peso/
// volumen y no se consolida en tarima; la carga (flete/tráiler) sí. También local/recolección.
// La usan tanto Embarques (entrada) como Entregas (salida) — mismo catálogo, mismo directorio.
export const MODALIDADES_ENVIO = [
  { id: 'paqueteria', label: 'Paquetería (courier)', emoji: '📮' },
  { id: 'carga', label: 'Carga / flete (tráiler)', emoji: '🚚' },
  { id: 'mensajeria', label: 'Mensajería local', emoji: '🛵' },
  { id: 'recoleccion', label: 'Recolección propia', emoji: '🚗' },
  { id: 'digital', label: 'Digital / sin envío', emoji: '💾' },
] as const;
export type ModalidadEnvio = typeof MODALIDADES_ENVIO[number]['id'];
export function modalidadEnvioInfo(id: string) {
  return MODALIDADES_ENVIO.find((m) => m.id === id) ?? MODALIDADES_ENVIO[0];
}
export function siguienteEstadoEmbarque(id: EstadoEmbarque): EstadoEmbarque {
  const i = ESTADOS_EMBARQUE.findIndex((e) => e.id === id);
  return ESTADOS_EMBARQUE[Math.min(i + 1, ESTADOS_EMBARQUE.length - 1)]!.id;
}

// IMPORTACIÓN (aduana): datos y cálculo de impuestos de importación (México). Cuando un
// embarque es internacional, la aduana se DESGLOSA y su total se suma al landed cost.
export interface Importacion {
  esImportacion: boolean;
  paisOrigen: string;
  fraccionArancelaria: string; // HS / fracción
  pedimento: string;
  agenteAduanal: string;
  valorAduana: string;         // base de los impuestos
  arancelPct: string;          // IGI (% de arancel de importación)
  ivaPct: string;              // IVA de importación (típico 16)
  dta: string;                 // Derecho de Trámite Aduanero (monto)
  honorariosAgente: string;
  otros: string;               // otros gastos aduanales
}
export function importacionVacia(): Importacion {
  return { esImportacion: false, paisOrigen: '', fraccionArancelaria: '', pedimento: '', agenteAduanal: '', valorAduana: '', arancelPct: '', ivaPct: '16', dta: '', honorariosAgente: '', otros: '' };
}
export function normalizarImportacion(v: unknown): Importacion {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  return {
    esImportacion: d.esImportacion === true, paisOrigen: s(d.paisOrigen), fraccionArancelaria: s(d.fraccionArancelaria),
    pedimento: s(d.pedimento), agenteAduanal: s(d.agenteAduanal), valorAduana: s(d.valorAduana), arancelPct: s(d.arancelPct),
    ivaPct: s(d.ivaPct) || '16', dta: s(d.dta), honorariosAgente: s(d.honorariosAgente), otros: s(d.otros),
  };
}
// Desglose de impuestos de importación: arancel (IGI), IVA sobre (valor+arancel+DTA), DTA,
// honorarios del agente y otros. Total = lo que cuesta "nacionalizar" la mercancía.
export function desgloseAduana(imp: Importacion): { valor: number; arancel: number; iva: number; dta: number; honorarios: number; otros: number; total: number } {
  if (!imp.esImportacion) return { valor: 0, arancel: 0, iva: 0, dta: 0, honorarios: 0, otros: 0, total: 0 };
  const valor = numero(imp.valorAduana) ?? 0;
  const arancel = valor * (numero(imp.arancelPct) ?? 0) / 100;
  const dta = numero(imp.dta) ?? 0;
  const iva = (valor + arancel + dta) * (numero(imp.ivaPct) ?? 0) / 100;
  const honorarios = numero(imp.honorariosAgente) ?? 0;
  const otros = numero(imp.otros) ?? 0;
  return { valor, arancel, iva, dta, honorarios, otros, total: arancel + iva + dta + honorarios + otros };
}
export function costoAduana(imp: Importacion): number { return desgloseAduana(imp).total; }

export interface Embarque {
  id: string;
  folio: string;
  modalidad: ModalidadEnvio; // paquetería / carga / mensajería / recolección / digital
  importacion: Importacion;  // datos de aduana si es internacional
  ordenIds: string[];       // órdenes de compra que consolida (paquetería suele ser 1)
  transportista: string;    // courier o línea de carga
  origen: string;
  destino: string;
  incoterm: string;
  estado: EstadoEmbarque;
  fechaRecoleccion: string;
  fechaEstimada: string;    // ETA
  fechaEntrega: string;     // entrega real
  tracking: string;         // número de guía (paquetería) / carta porte (carga)
  peso: string;             // kg (base del cobro en paquetería)
  bultos: string;           // nº de paquetes/cajas
  // Costos logísticos (texto numérico)
  flete: string;
  seguro: string;
  aduana: string;
  maniobras: string;
  otros: string;
  notas: string;
}
export function embarqueVacio(id: string): Embarque {
  return {
    id, folio: '', modalidad: 'paqueteria', importacion: importacionVacia(), ordenIds: [], transportista: '', origen: '', destino: '', incoterm: '', estado: 'preparando',
    fechaRecoleccion: '', fechaEstimada: '', fechaEntrega: '', tracking: '', peso: '', bultos: '', flete: '', seguro: '', aduana: '', maniobras: '', otros: '', notas: '',
  };
}
export function normalizarEmbarque(v: unknown): Embarque {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  const estado = (ESTADOS_EMBARQUE.some((e) => e.id === d.estado) ? d.estado : 'preparando') as EstadoEmbarque;
  const modalidad = (MODALIDADES_ENVIO.some((m) => m.id === d.modalidad) ? d.modalidad : 'paqueteria') as ModalidadEnvio;
  return {
    id: s(d.id) || `EMB-${Math.random().toString(36).slice(2, 8)}`, folio: s(d.folio), modalidad, importacion: normalizarImportacion(d.importacion), ordenIds: sa(d.ordenIds),
    transportista: s(d.transportista), origen: s(d.origen), destino: s(d.destino), incoterm: s(d.incoterm), estado,
    fechaRecoleccion: s(d.fechaRecoleccion), fechaEstimada: s(d.fechaEstimada), fechaEntrega: s(d.fechaEntrega), tracking: s(d.tracking),
    peso: s(d.peso), bultos: s(d.bultos),
    flete: s(d.flete), seguro: s(d.seguro), aduana: s(d.aduana), maniobras: s(d.maniobras), otros: s(d.otros), notas: s(d.notas),
  };
}
// Costo logístico total del embarque (flete + seguro + aduana + maniobras + otros).
export function costoLogisticoEmbarque(e: Embarque): number {
  return [e.flete, e.seguro, e.aduana, e.maniobras, e.otros].reduce((s2, x) => s2 + (numero(x) ?? 0), 0);
}
// Valor de la mercancía = suma del total de las órdenes que incluye.
export function valorMercanciaEmbarque(e: Embarque, ordenes: OrdenCompra[]): number {
  const ids = new Set(e.ordenIds);
  return ordenes.filter((o) => ids.has(o.id)).reduce((s2, o) => s2 + (totalOrden(o) ?? 0), 0);
}
// Landed cost = valor de mercancía + logística; factor = cuánto encarece la logística.
export function landedCostEmbarque(e: Embarque, ordenes: OrdenCompra[]): { valor: number; logistica: number; total: number; factor: number } {
  const valor = valorMercanciaEmbarque(e, ordenes);
  const logistica = costoLogisticoEmbarque(e);
  const total = valor + logistica;
  return { valor, logistica, total, factor: valor > 0 ? total / valor : 1 };
}
// Prorrateo de la logística entre las órdenes, proporcional a su valor.
export function prorrateoLanded(e: Embarque, ordenes: OrdenCompra[]): { ordenId: string; descripcion: string; valor: number; logistica: number; landed: number }[] {
  const ids = new Set(e.ordenIds);
  const incluidas = ordenes.filter((o) => ids.has(o.id));
  const valorTotal = incluidas.reduce((s2, o) => s2 + (totalOrden(o) ?? 0), 0);
  const logisticaTotal = costoLogisticoEmbarque(e);
  return incluidas.map((o) => {
    const valor = totalOrden(o) ?? 0;
    const logistica = valorTotal > 0 ? logisticaTotal * (valor / valorTotal) : 0;
    return { ordenId: o.id, descripcion: o.descripcion, valor, logistica, landed: valor + logistica };
  });
}
// ¿El embarque va retrasado? (ETA ya pasó y no está entregado).
export function embarqueRetrasado(e: Embarque, hoyISO: string): boolean {
  return !!e.fechaEstimada && e.estado !== 'entregado' && e.fechaEstimada < hoyISO;
}

// ---------- Transportistas + tarifas (F2) — directorio compartido por Compra y Entrega ----------
// Una TARIFA cotiza según la modalidad: paquetería/mensajería = base + por kg; carga = por viaje.
export interface Tarifa {
  modalidad: string;   // paqueteria / carga / mensajeria
  zona: string;        // "Local", "Bajío", "Nacional", "CDMX"…
  base: string;        // costo fijo
  porKg: string;       // costo por kg (paquetería/mensajería)
  porViaje: string;    // costo por viaje (carga)
  tiempoDias: string;  // días estimados de entrega
  notas: string;
}
export interface Transportista {
  id: string;
  nombre: string;
  modalidades: string[];  // qué modos maneja (paqueteria/carga/mensajeria/recoleccion)
  contacto: string;
  telefono: string;
  email: string;
  sitioWeb: string;
  zonas: string[];
  tarifas: Tarifa[];
  notas: string;
}
export function transportistaVacio(id: string): Transportista {
  return { id, nombre: '', modalidades: ['paqueteria'], contacto: '', telefono: '', email: '', sitioWeb: '', zonas: [], tarifas: [], notas: '' };
}
function normTarifa(v: unknown): Tarifa {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  return {
    modalidad: (['paqueteria', 'carga', 'mensajeria'].includes(s(d.modalidad)) ? s(d.modalidad) : 'paqueteria'),
    zona: s(d.zona), base: s(d.base), porKg: s(d.porKg), porViaje: s(d.porViaje), tiempoDias: s(d.tiempoDias), notas: s(d.notas),
  };
}
export function normalizarTransportista(v: unknown): Transportista {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  return {
    id: s(d.id) || `TRP-${Math.random().toString(36).slice(2, 8)}`, nombre: s(d.nombre), modalidades: sa(d.modalidades),
    contacto: s(d.contacto), telefono: s(d.telefono), email: s(d.email), sitioWeb: s(d.sitioWeb), zonas: sa(d.zonas),
    tarifas: Array.isArray(d.tarifas) ? d.tarifas.map(normTarifa) : [], notas: s(d.notas),
  };
}
// Cotiza el flete de un transportista para una modalidad/zona/peso. null si no hay tarifa.
export function cotizarFlete(t: Transportista, modalidad: string, zona: string, pesoKg: number | null): number | null {
  const cands = t.tarifas.filter((x) => x.modalidad === modalidad);
  if (!cands.length) return null;
  const z = zona.trim().toLowerCase();
  const tar = cands.find((x) => x.zona.trim().toLowerCase() === z) ?? cands[0]!;
  const base = numero(tar.base) ?? 0;
  if (modalidad === 'carga') return base + (numero(tar.porViaje) ?? 0);
  return base + (numero(tar.porKg) ?? 0) * (pesoKg ?? 1);
}
// Mejor (más barato) transportista para una modalidad/zona/peso.
export function mejorTransportista(ts: Transportista[], modalidad: string, zona: string, pesoKg: number | null): { t: Transportista; costo: number } | null {
  const cot = ts.map((t) => ({ t, costo: cotizarFlete(t, modalidad, zona, pesoKg) }))
    .filter((x): x is { t: Transportista; costo: number } => x.costo !== null);
  if (!cot.length) return null;
  return cot.reduce((min, x) => x.costo < min.costo ? x : min);
}

// ---------- ENTREGA: envío/despacho al cliente final ----------
// Simétrico a Embarque pero de SALIDA: reusa el mismo catálogo de modalidades y el mismo
// directorio de Transportistas. Un negocio puede tener solo entrada (compra), solo salida
// (entrega), ambas, o ninguna (servicio 100% en persona) — todas quedan vacías sin problema.
export const ESTADOS_ENTREGA = [
  { id: 'preparando', label: 'Preparando', emoji: '📦' },
  { id: 'enviado', label: 'Enviado', emoji: '📮' },
  { id: 'transito', label: 'En tránsito', emoji: '🚚' },
  { id: 'entregado', label: 'Entregado', emoji: '✅' },
  { id: 'incidencia', label: 'Incidencia', emoji: '⚠️' },
] as const;
export type EstadoEntrega = typeof ESTADOS_ENTREGA[number]['id'];
export function estadoEntregaInfo(id: string) {
  return ESTADOS_ENTREGA.find((e) => e.id === id) ?? ESTADOS_ENTREGA[0];
}
export function siguienteEstadoEntrega(id: EstadoEntrega): EstadoEntrega {
  const i = ESTADOS_ENTREGA.findIndex((e) => e.id === id);
  return ESTADOS_ENTREGA[Math.min(i + 1, ESTADOS_ENTREGA.length - 1)]!.id;
}

export interface Entrega {
  id: string;
  destinatario: string;    // cliente / a quién se entrega
  referencia: string;      // qué se entrega (oferta, UC, pedido… texto libre)
  direccion: string;
  modalidad: ModalidadEnvio;
  transportista: string;   // nombre de un Transportista del directorio (o propio)
  estado: EstadoEntrega;
  fechaCompromiso: string; // ETA prometida al cliente
  fechaEntrega: string;    // entrega real
  tracking: string;
  costoEnvio: string;
  notas: string;
}
export function entregaVacia(id: string): Entrega {
  return { id, destinatario: '', referencia: '', direccion: '', modalidad: 'paqueteria', transportista: '', estado: 'preparando', fechaCompromiso: '', fechaEntrega: '', tracking: '', costoEnvio: '', notas: '' };
}
export function normalizarEntrega(v: unknown): Entrega {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  const estado = (ESTADOS_ENTREGA.some((e) => e.id === d.estado) ? d.estado : 'preparando') as EstadoEntrega;
  const modalidad = (MODALIDADES_ENVIO.some((m) => m.id === d.modalidad) ? d.modalidad : 'paqueteria') as ModalidadEnvio;
  return {
    id: s(d.id) || `ENT-${Math.random().toString(36).slice(2, 8)}`, destinatario: s(d.destinatario), referencia: s(d.referencia),
    direccion: s(d.direccion), modalidad, transportista: s(d.transportista), estado,
    fechaCompromiso: s(d.fechaCompromiso), fechaEntrega: s(d.fechaEntrega), tracking: s(d.tracking), costoEnvio: s(d.costoEnvio), notas: s(d.notas),
  };
}
export function costoEnvioEntrega(e: Entrega): number { return numero(e.costoEnvio) ?? 0; }
// ¿La entrega va retrasada? (compromiso ya pasó y no está entregada).
export function entregaRetrasada(e: Entrega, hoyISO: string): boolean {
  return !!e.fechaCompromiso && e.estado !== 'entregado' && e.fechaCompromiso < hoyISO;
}
