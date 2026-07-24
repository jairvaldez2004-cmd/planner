// COSTEO DE PROCESOS (ADITIVO, puro). Enlaza los INSUMOS que cada proceso del Mapa
// Operativo etiqueta (por nombre) con el catálogo de Recursos (que tiene el costo unitario),
// y con la CANTIDAD que el proceso declara, calcula el costo de insumos de cada proceso.
// Emparejamiento por nombre (case-insensitive). Sin cambio de datos: es solo lectura cruzada.

import type { Recurso } from './recursos';
import { numero } from './recursos';

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

// Índice del catálogo por nombre (para emparejar rápido).
export function indiceRecursos(recursos: Recurso[]): Map<string, Recurso> {
  const m = new Map<string, Recurso>();
  for (const r of recursos) { const k = r.nombre.trim().toLowerCase(); if (k) m.set(k, r); }
  return m;
}

// Costo de insumos de UN proceso.
export function costearProceso(insumos: string[], cantidades: Record<string, string> | undefined, idx: Map<string, Recurso>): CostoProceso {
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
