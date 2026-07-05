// OS BP — Máquina de estados mínima de una instancia (alpha)
// Fuente: Sistema_Operativo_BP.md (13 estados). El OS es el único que mueve estados.
// Agente ⇏ Runtime: ningún agente cambia estados; solo el OS tras validación humana.

export type EstadoInstancia =
  | 'IDEA'
  | 'SOLICITUD'
  | 'CAPTURA'
  | 'DISENO'
  | 'VALIDACION'
  | 'APROBADO'
  | 'GENERACION'
  | 'ENTREGADO'
  | 'IMPLEMENTACION'
  | 'SEGUIMIENTO'
  | 'ARCHIVADO'
  // transversales
  | 'BLOQUEADO'
  | 'CANCELADO';

// Transiciones permitidas (subconjunto alpha; coherente con SO BP §2.2).
const TRANSICIONES: Record<EstadoInstancia, EstadoInstancia[]> = {
  IDEA: ['SOLICITUD', 'CANCELADO'],
  SOLICITUD: ['CAPTURA', 'BLOQUEADO', 'CANCELADO'],
  CAPTURA: ['DISENO', 'BLOQUEADO'],
  DISENO: ['VALIDACION', 'CAPTURA', 'BLOQUEADO'], // rollback DISENO→CAPTURA (vacíos)
  VALIDACION: ['APROBADO', 'DISENO', 'BLOQUEADO'], // rollback VALIDACION→DISENO (observaciones)
  APROBADO: ['GENERACION', 'VALIDACION'], // rollback solo gobernanza
  GENERACION: ['ENTREGADO', 'DISENO'],
  ENTREGADO: ['IMPLEMENTACION', 'ARCHIVADO'],
  IMPLEMENTACION: ['SEGUIMIENTO', 'BLOQUEADO'],
  SEGUIMIENTO: ['ARCHIVADO'],
  ARCHIVADO: [], // terminal
  BLOQUEADO: ['SOLICITUD', 'CAPTURA', 'DISENO', 'VALIDACION', 'CANCELADO'],
  CANCELADO: [], // terminal
};

export function puedeTransicionar(de: EstadoInstancia, a: EstadoInstancia): boolean {
  const permitidas = TRANSICIONES[de] ?? [];
  return permitidas.includes(a);
}

/** El OS mueve el estado. Lanza si la transición no está permitida (no se fuerza). */
export function transicionar(de: EstadoInstancia, a: EstadoInstancia): EstadoInstancia {
  if (!puedeTransicionar(de, a)) {
    throw new Error(`Transición no permitida: ${de} → ${a}`);
  }
  return a;
}
