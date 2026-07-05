// Store de versiones (bloque 8, alpha). APPEND-ONLY: nunca sobrescribe una versión.
// Local; intercambiable por persistencia real (R5D). El OS es quien registra al publicar.

import type { VersionSnapshot } from '@/domain/version';

// Puerto R5D: registro de versiones intercambiable (in-memory o Prisma).
export interface RegistroVersiones {
  guardar(s: VersionSnapshot): VersionSnapshot | Promise<VersionSnapshot>;
}

export class VersionStore implements RegistroVersiones {
  private historial = new Map<string, VersionSnapshot[]>();

  /** Guarda un snapshot. Lanza si la versión ya existe (inmutabilidad). */
  guardar(snapshot: VersionSnapshot): VersionSnapshot {
    const lista = this.historial.get(snapshot.planoId) ?? [];
    if (lista.some((s) => s.version === snapshot.version)) {
      throw new Error(
        `Snapshot inmutable: versión ${snapshot.version} de ${snapshot.planoId} ya existe (no se sobrescribe).`,
      );
    }
    lista.push(snapshot);
    this.historial.set(snapshot.planoId, lista);
    return snapshot;
  }

  /** Historial ordenado por versión (ascendente). */
  listar(planoId: string): readonly VersionSnapshot[] {
    return [...(this.historial.get(planoId) ?? [])].sort((a, b) => a.version - b.version);
  }

  obtener(planoId: string, version: number): VersionSnapshot | null {
    return this.listar(planoId).find((s) => s.version === version) ?? null;
  }
}
