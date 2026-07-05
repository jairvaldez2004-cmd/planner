// Servicio de versionado (bloque 8, alpha): historial, comparación básica, restauración como draft.
// Restaurar NUNCA sobrescribe una publicación: produce un NUEVO draft. No inventa.

import type { PlanoComExp } from '@/domain/plano-com-exp';
import type { VersionSnapshot } from '@/domain/version';
import type { VersionStore } from './version-store';

export interface DiffVersion {
  planoId: string;
  versionA: number;
  versionB: number;
  cambios: string[];
}

export class VersionService {
  constructor(private readonly store: VersionStore) {}

  historial(planoId: string): readonly VersionSnapshot[] {
    return this.store.listar(planoId);
  }

  /** Comparación básica entre dos versiones (conteos + estado de publicación). */
  comparar(planoId: string, vA: number, vB: number): DiffVersion {
    const a = this.store.obtener(planoId, vA);
    const b = this.store.obtener(planoId, vB);
    if (!a) throw new Error(`Versión inexistente: ${planoId} v${vA}`);
    if (!b) throw new Error(`Versión inexistente: ${planoId} v${vB}`);

    const cambios: string[] = [];
    if (a.plano.productos.length !== b.plano.productos.length) {
      cambios.push(`productos: ${a.plano.productos.length} → ${b.plano.productos.length}`);
    }
    if (a.plano.documentos.length !== b.plano.documentos.length) {
      cambios.push(`documentos: ${a.plano.documentos.length} → ${b.plano.documentos.length}`);
    }
    if (a.plano.cotizaciones.length !== b.plano.cotizaciones.length) {
      cambios.push(`cotizaciones: ${a.plano.cotizaciones.length} → ${b.plano.cotizaciones.length}`);
    }
    if (a.publicado !== b.publicado) cambios.push(`publicado: ${a.publicado} → ${b.publicado}`);
    if (cambios.length === 0) cambios.push('sin cambios estructurales detectados');

    return { planoId, versionA: vA, versionB: vB, cambios };
  }

  /** Restaura una versión como NUEVO DRAFT (no publicado); la publicación original queda intacta. */
  restaurarComoDraft(planoId: string, version: number): PlanoComExp {
    const snap = this.store.obtener(planoId, version);
    if (!snap) throw new Error(`Versión inexistente: ${planoId} v${version}`);
    return {
      ...snap.plano,
      id: `${snap.plano.id}-DRAFT-DE-V${version}`,
      version: 0,
      publicado: false,
    };
  }
}
