// Motor de captura/validación mínima (bloque 5, alpha).
// El formulario gobierna; valores faltantes export → PENDIENTE(). El OS publica (aquí solo se arma draft).

import type { PlanoComExp, Producto } from '@/domain/plano-com-exp';
import { PENDIENTE } from '@/domain/plano-com-exp';
import type { CapturaComExp, CapturaProducto, ResultadoValidacion } from './form-com-exp';

let prodSeq = 0;
function nextProdId(): string {
  prodSeq += 1;
  return `PROD-${prodSeq.toString().padStart(4, '0')}`;
}

/** Valida requeridos; lista export-específicos ausentes como PENDIENTE (no bloquean). */
export function validarCaptura(c: CapturaComExp): ResultadoValidacion {
  const errores: string[] = [];
  const pendientes: string[] = [];

  if (!c.entidad.trim()) errores.push('entidad requerida');
  if (c.productos.length === 0) errores.push('al menos 1 producto requerido');

  c.productos.forEach((p, i) => {
    if (!p.sku.trim()) errores.push(`producto[${i}].sku requerido`);
    if (!p.nombre.trim()) errores.push(`producto[${i}].nombre requerido`);
    if (!p.categoria.trim()) errores.push(`producto[${i}].categoria requerida`);
    if (p.hsCode === undefined) pendientes.push(`producto[${i}].hsCode`);
    if (p.incotermSugerido === undefined) pendientes.push(`producto[${i}].incoterm`);
    if (p.puertoSalida === undefined) pendientes.push(`producto[${i}].puertoSalida`);
    if (p.certificadoOrigenRequerido === undefined) pendientes.push(`producto[${i}].certificadoOrigen`);
    if (p.precio === undefined) pendientes.push(`producto[${i}].precio`);
  });

  return { ok: errores.length === 0, errores, pendientes };
}

/** Mapea captura → Producto del dominio; rellena faltantes con PENDIENTE (no inventa). */
export function construirProducto(p: CapturaProducto): Producto {
  return {
    id: nextProdId(),
    sku: p.sku,
    nombre: p.nombre,
    categoria: p.categoria,
    restriccion: p.restriccion,
    hsCode: p.hsCode ?? PENDIENTE('DATO_REAL'),
    incotermSugerido: p.incotermSugerido ?? PENDIENTE('DATO_REAL'),
    puertoSalida: p.puertoSalida ?? PENDIENTE('DATO_REAL'),
    certificadoOrigenRequerido: p.certificadoOrigenRequerido ?? PENDIENTE('DATO_REAL'),
    precio: p.precio ?? PENDIENTE('DECISION_PROPIETARIO'),
  };
}

/** Arma un draft del plano (version 0, no publicado). La publicación la hace el OS. */
export function construirPlanoDraft(c: CapturaComExp): PlanoComExp {
  return {
    id: `PLANO-${c.entidad.replace(/\s+/g, '').toUpperCase()}-COMEXP`,
    entidad: c.entidad,
    productos: c.productos.map(construirProducto),
    cotizaciones: c.cotizaciones ?? [],
    documentos: c.documentos ?? [],
    version: 0,
    publicado: false,
  };
}

/** Suficiencia mínima = requeridos presentes (los export pueden quedar PENDIENTE). */
export function declararSuficiencia(c: CapturaComExp): boolean {
  return validarCaptura(c).ok;
}
