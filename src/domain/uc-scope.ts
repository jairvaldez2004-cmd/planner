// CAPTURA POR UNIDAD COMERCIAL (ADITIVO). Mismo patrón que ya usa `Espacio.ucIds` y
// `Oferta.ucId`: una entidad SIN ucIds (o vacío) es COMPARTIDA — se ve en el proyecto y en
// TODAS las UC. Una entidad CON ucIds solo se ve en esas UC (y siempre a nivel proyecto,
// donde no se filtra nada). No hay "rollup": es la misma fila, distintas lentes.

// ¿Es visible esta entidad dentro de la UC `ucId`? Sin etiquetas = compartida (siempre visible).
export function enUC(ucIds: string[] | undefined, ucId: string): boolean {
  return !ucIds || ucIds.length === 0 || ucIds.includes(ucId);
}

// Etiqueta inicial al dar de alta algo DESDE una UC (vacío si se captura a nivel proyecto).
export function ucIdsIniciales(ucId: string | undefined): string[] {
  return ucId ? [ucId] : [];
}
