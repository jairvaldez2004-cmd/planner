// Contrato de persistencia (R5D) — agnóstico al motor.
// Permite cambiar de almacenamiento local → PostgreSQL sin romper el dominio.
// Regla: el OS es el único escritor que "publica"; los repos guardan borradores/snapshots.

export interface Identificable {
  id: string;
}

export interface Repository<T extends Identificable> {
  /** Guarda (borrador o snapshot). No publica por sí mismo. */
  save(entity: T): Promise<T>;
  get(id: string): Promise<T | null>;
  /** Lista acotada — la UI aplica default 0 / filtros (4E.9-S); aquí es el back. */
  list(): Promise<T[]>;
  /** Snapshot inmutable: devuelve nueva versión sin sobrescribir (R5C). */
  snapshot(id: string): Promise<number>;
}
