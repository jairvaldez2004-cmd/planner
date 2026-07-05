// Implementación LOCAL del contrato de persistencia (alpha).
// En memoria por ahora; intercambiable por PostgreSQL/Prisma sin tocar el dominio (R5D).
// NO cloud · NO proveedor.

import type { Identificable, Repository } from './repo.contract';

export class LocalRepository<T extends Identificable> implements Repository<T> {
  private store = new Map<string, T>();
  private versions = new Map<string, number>();

  async save(entity: T): Promise<T> {
    this.store.set(entity.id, entity);
    if (!this.versions.has(entity.id)) this.versions.set(entity.id, 0);
    return entity;
  }

  async get(id: string): Promise<T | null> {
    return this.store.get(id) ?? null;
  }

  async list(): Promise<T[]> {
    return [...this.store.values()];
  }

  async snapshot(id: string): Promise<number> {
    const next = (this.versions.get(id) ?? 0) + 1;
    this.versions.set(id, next);
    return next;
  }
}
