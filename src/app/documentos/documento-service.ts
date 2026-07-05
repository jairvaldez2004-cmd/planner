// Motor genérico de documentos del Business Planner.
// Genera documentos derivados de cualquier tipo de plano.
// Para soportar un nuevo tipo: agregar su generador en GENERADORES. Nada más cambia.
// Historial append-only: al editar o regenerar, la versión actual se archiva primero.

import type { Documento, DocumentoRepository, VersionDocumento } from '@/domain/documento';
import type { PlanoComExp } from '@/domain/plano-com-exp';
import type { AtributosOperativos } from '@/domain/catalogo';
import { generarResumenComercial } from './plantillas/resumen-comercial';
import { generarResumenOperativo } from './plantillas/resumen-operativo';

// Contexto OPCIONAL que la capa de actions calcula (p. ej. atributos operativos por SKU
// desde el catálogo, INC-2). Los generadores siguen siendo SÍNCRONOS y sin acceso a DB.
export interface GeneradorContexto {
  atributosPorSku?: Record<string, AtributosOperativos>;
}

type Generador = (plano: PlanoComExp, ctx?: GeneradorContexto) => {
  contenido: Record<string, unknown>;
  markup: string;
  pendientes: number;
};

const GENERADORES: Record<string, Generador> = {
  RESUMEN_COMERCIAL: (plano) => {
    const r = generarResumenComercial(plano);
    return { contenido: r.contenido as unknown as Record<string, unknown>, markup: r.markup, pendientes: r.pendientes };
  },
  RESUMEN_OPERATIVO: (plano, ctx) => {
    const r = generarResumenOperativo(plano, ctx?.atributosPorSku ?? {});
    return { contenido: r.contenido as unknown as Record<string, unknown>, markup: r.markup, pendientes: r.pendientes };
  },
};

// Tipos disponibles por tipo de plano. Extensible.
export const TIPOS_POR_PLANO: Record<string, string[]> = {
  'COM-EXP': ['RESUMEN_COMERCIAL', 'RESUMEN_OPERATIVO'],
};

export class DocumentoService {
  constructor(private readonly repo: DocumentoRepository) {}

  async generar(plano: PlanoComExp, tipoDocumento: string, ctx?: GeneradorContexto): Promise<Documento> {
    const gen = GENERADORES[tipoDocumento];
    if (!gen) throw new Error(`Tipo de documento desconocido: ${tipoDocumento}`);
    const { contenido, markup, pendientes } = gen(plano, ctx);
    const now = new Date().toISOString();
    const doc: Documento = {
      id: `DOC-${plano.id}-${tipoDocumento}-${Date.now()}`,
      planoId: plano.id,
      tipoPlano: 'COM-EXP',
      tipoDocumento,
      version: 1,
      contenido,
      markup,
      pendientes,
      publicado: false,
      creadoEn: now,
      actualizadoEn: now,
    };
    return this.repo.save(doc);
  }

  async editar(id: string, markupNuevo: string): Promise<Documento> {
    const doc = await this.repo.get(id);
    if (!doc) throw new Error(`Documento no encontrado: ${id}`);
    await this.archivarVersion(doc);
    return this.repo.save({
      ...doc,
      markup: markupNuevo,
      version: doc.version + 1,
      actualizadoEn: new Date().toISOString(),
    });
  }

  async regenerar(id: string, planoActual: PlanoComExp, ctx?: GeneradorContexto): Promise<Documento> {
    const doc = await this.repo.get(id);
    if (!doc) throw new Error(`Documento no encontrado: ${id}`);
    const gen = GENERADORES[doc.tipoDocumento];
    if (!gen) throw new Error(`Tipo desconocido: ${doc.tipoDocumento}`);
    await this.archivarVersion(doc);
    const { contenido, markup, pendientes } = gen(planoActual, ctx);
    return this.repo.save({
      ...doc,
      contenido,
      markup,
      pendientes,
      version: doc.version + 1,
      actualizadoEn: new Date().toISOString(),
    });
  }

  async listar(planoId?: string): Promise<Documento[]> {
    if (planoId !== undefined) return this.repo.listarPorPlano(planoId);
    return this.repo.listar();
  }

  exportar(doc: Documento): string {
    return doc.markup;
  }

  private async archivarVersion(doc: Documento): Promise<void> {
    const v: VersionDocumento = {
      documentoId: doc.id,
      version: doc.version,
      markup: doc.markup,
      pendientes: doc.pendientes,
      publicado: doc.publicado,
      timestamp: new Date().toISOString(),
      contenido: doc.contenido,
    };
    await this.repo.guardarVersion(v);
  }
}
