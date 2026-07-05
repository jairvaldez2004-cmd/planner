// INC-1 · Mapea un ProductoCatalogo (maestro) → CapturaProducto (entrada del motor de captura).
// Puro y testeable. Sólo copia campos que YA existen en CapturaProducto (no añade dimensiones).
// Si una pista export falta, se omite → el motor la marcará PENDIENTE (no inventa).

import type { ProductoCatalogo } from '@/domain/catalogo';
import type { CapturaProducto } from './form-com-exp';

export function catalogoACaptura(p: ProductoCatalogo): CapturaProducto {
  return {
    sku: p.sku,
    nombre: p.nombre,
    categoria: p.categoria,
    restriccion: p.restriccion,
    ...(p.hsCode !== undefined ? { hsCode: p.hsCode } : {}),
    ...(p.incotermSugerido !== undefined ? { incotermSugerido: p.incotermSugerido } : {}),
    ...(p.puertoSalida !== undefined ? { puertoSalida: p.puertoSalida } : {}),
    ...(p.certificadoOrigenRequerido !== undefined
      ? { certificadoOrigenRequerido: p.certificadoOrigenRequerido }
      : {}),
  };
}
