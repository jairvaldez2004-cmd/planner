// COSTEO DE PROCESOS (ADITIVO, puro). Enlaza los INSUMOS que cada proceso del Mapa
// Operativo etiqueta (por nombre) con el catálogo de Recursos (que tiene el costo unitario),
// y con la CANTIDAD que el proceso declara, calcula el costo de insumos de cada proceso.
// Emparejamiento por nombre (case-insensitive). Sin cambio de datos: es solo lectura cruzada.

import type { Recurso, Producto, ProductoProveedor } from './recursos';
import { numero, proveedorMasBarato, precioVigente } from './recursos';

// Referencia mínima de costeo: costo unitario + unidad. La comparten Recursos y Productos.
export interface CostoRef { costo: string; unidad: string }

export interface LineaCosto {
  insumo: string;
  cantidad: number | null;   // cantidad declarada en el proceso (null = no declarada → se asume 1)
  costoUnit: number | null;  // costo unitario del catálogo (null = no está en catálogo o sin costo)
  unidad: string;
  subtotal: number | null;   // costoUnit × cantidad
  enCatalogo: boolean;
}

export interface CostoProceso {
  lineas: LineaCosto[];
  total: number;             // suma de subtotales conocidos
  sinCosto: string[];        // insumos sin costo en el catálogo (faltan por dar de alta)
}

// Índice del catálogo de Recursos por nombre (para emparejar rápido).
export function indiceRecursos(recursos: Recurso[]): Map<string, CostoRef> {
  const m = new Map<string, CostoRef>();
  for (const r of recursos) { const k = r.nombre.trim().toLowerCase(); if (k) m.set(k, { costo: r.costo, unidad: r.unidad }); }
  return m;
}

// Índice UNIFICADO de costeo: Productos (fuente de precio: el vigente del proveedor más barato)
// tienen prioridad por nombre; Recursos rellena lo que no sea producto (activos/obra/materiales).
// Así el precio se captura UNA vez (en el vínculo del producto) y el costeo del Mapa lo usa.
export function indiceCosto(recursos: Recurso[], productos: Producto[], vinculos: ProductoProveedor[]): Map<string, CostoRef> {
  const m = indiceRecursos(recursos);
  for (const p of productos) {
    const k = p.nombre.trim().toLowerCase(); if (!k) continue;
    const barato = proveedorMasBarato(vinculos, p.id);
    m.set(k, { costo: barato ? precioVigente(barato) : '', unidad: p.unidad });
  }
  return m;
}

// Costo de insumos de UN proceso.
export function costearProceso(insumos: string[], cantidades: Record<string, string> | undefined, idx: Map<string, CostoRef>): CostoProceso {
  const lineas: LineaCosto[] = [];
  const sinCosto: string[] = [];
  let total = 0;
  for (const ins of insumos) {
    const rec = idx.get(ins.trim().toLowerCase());
    const costoUnit = rec ? numero(rec.costo) : null;
    const cantidad = cantidades?.[ins] ? numero(cantidades[ins]!) : null;
    const q = cantidad ?? 1; // sin cantidad declarada se asume 1
    const subtotal = costoUnit !== null ? costoUnit * q : null;
    if (subtotal !== null) total += subtotal; else sinCosto.push(ins);
    lineas.push({ insumo: ins, cantidad, costoUnit, unidad: rec?.unidad ?? '', subtotal, enCatalogo: !!rec });
  }
  return { lineas, total, sinCosto };
}
