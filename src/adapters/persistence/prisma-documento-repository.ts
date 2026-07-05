// Repositorio Prisma para Documento y VersionDocumento.
// Implementa DocumentoRepository (R5D). Mismo patrón que PrismaPlanoRepository.

import type { Prisma, PrismaClient } from '@prisma/client';
import type { Documento, DocumentoRepository, VersionDocumento } from '@/domain/documento';

function toJson(v: unknown): Prisma.InputJsonValue {
  return v as unknown as Prisma.InputJsonValue;
}

type DocRow = {
  id: string; planoId: string; tipoPlano: string; tipoDocumento: string;
  version: number; contenido: Prisma.JsonValue; markup: string;
  pendientes: number; publicado: boolean; creadoEn: string; actualizadoEn: string;
};

function fromRow(r: DocRow): Documento {
  return { ...r, contenido: r.contenido as Record<string, unknown> };
}

export class PrismaDocumentoRepository implements DocumentoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(d: Documento): Promise<Documento> {
    await this.prisma.documento.upsert({
      where: { id: d.id },
      create: {
        id: d.id, planoId: d.planoId, tipoPlano: d.tipoPlano,
        tipoDocumento: d.tipoDocumento, version: d.version,
        contenido: toJson(d.contenido), markup: d.markup,
        pendientes: d.pendientes, publicado: d.publicado,
        creadoEn: d.creadoEn, actualizadoEn: d.actualizadoEn,
      },
      update: {
        version: d.version, contenido: toJson(d.contenido),
        markup: d.markup, pendientes: d.pendientes,
        publicado: d.publicado, actualizadoEn: d.actualizadoEn,
      },
    });
    return d;
  }

  async get(id: string): Promise<Documento | null> {
    const r = await this.prisma.documento.findUnique({ where: { id } });
    return r ? fromRow(r) : null;
  }

  async listarPorPlano(planoId: string): Promise<Documento[]> {
    const rs = await this.prisma.documento.findMany({ where: { planoId } });
    return rs.map(fromRow);
  }

  async listar(): Promise<Documento[]> {
    const rs = await this.prisma.documento.findMany({ orderBy: { actualizadoEn: 'desc' } });
    return rs.map(fromRow);
  }

  async guardarVersion(v: VersionDocumento): Promise<VersionDocumento> {
    const existe = await this.prisma.versionDocumento.findUnique({
      where: { documentoId_version: { documentoId: v.documentoId, version: v.version } },
    });
    if (existe) throw new Error(`VersionDocumento inmutable: ${v.documentoId} v${v.version} ya existe.`);
    await this.prisma.versionDocumento.create({
      data: {
        documentoId: v.documentoId, version: v.version, markup: v.markup,
        pendientes: v.pendientes, publicado: v.publicado,
        timestamp: v.timestamp, contenido: toJson(v.contenido),
      },
    });
    return v;
  }

  async listarVersiones(documentoId: string): Promise<VersionDocumento[]> {
    const rs = await this.prisma.versionDocumento.findMany({
      where: { documentoId }, orderBy: { version: 'asc' },
    });
    return rs.map((r) => ({ ...r, contenido: r.contenido as Record<string, unknown> }));
  }
}
