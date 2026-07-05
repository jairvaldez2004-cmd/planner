'use server';

// Server Actions para documentos derivados de planos.
// Usa DocumentoService (motor genérico) con PrismaDocumentoRepository.

import { prisma } from '@/adapters/persistence/prisma-client';
import { PrismaDocumentoRepository } from '@/adapters/persistence/prisma-documento-repository';
import { PrismaPlanoRepository } from '@/adapters/persistence/prisma-repository';
import { PrismaCatalogoRepository } from '@/adapters/persistence/prisma-catalogo-repository';
import { DocumentoService } from '@/app/documentos/documento-service';
import type { GeneradorContexto } from '@/app/documentos/documento-service';
import type { Documento } from '@/domain/documento';
import type { AtributosOperativos } from '@/domain/catalogo';

// INC-2 · Construye el contexto opcional (atributos operativos por SKU desde el catálogo).
// Aditivo: enriquece documentos sin tocar el snapshot del plano (FROZEN). Por SKU (clave natural).
async function contextoOperativo(): Promise<GeneradorContexto> {
  const productos = await new PrismaCatalogoRepository(prisma).listarProductos();
  const atributosPorSku: Record<string, AtributosOperativos> = {};
  for (const p of productos) {
    atributosPorSku[p.sku] = {
      ...(p.unidad !== undefined ? { unidad: p.unidad } : {}),
      ...(p.empaque !== undefined ? { empaque: p.empaque } : {}),
      ...(p.presentacion !== undefined ? { presentacion: p.presentacion } : {}),
      ...(p.cantidadMinima !== undefined ? { cantidadMinima: p.cantidadMinima } : {}),
    };
  }
  return { atributosPorSku };
}

export async function generarDocumento(planoId: string, tipoDocumento: string): Promise<Documento> {
  const plano = await new PrismaPlanoRepository(prisma).get(planoId);
  if (!plano) throw new Error(`Plano no encontrado: ${planoId}`);
  const ctx = await contextoOperativo();
  return new DocumentoService(new PrismaDocumentoRepository(prisma)).generar(plano, tipoDocumento, ctx);
}

export async function listarDocumentos(planoId?: string): Promise<Documento[]> {
  return new DocumentoService(new PrismaDocumentoRepository(prisma)).listar(planoId);
}

export async function regenerarDocumento(documentoId: string): Promise<Documento> {
  const docs = new PrismaDocumentoRepository(prisma);
  const doc = await docs.get(documentoId);
  if (!doc) throw new Error(`Documento no encontrado: ${documentoId}`);
  const plano = await new PrismaPlanoRepository(prisma).get(doc.planoId);
  if (!plano) throw new Error(`Plano origen no encontrado: ${doc.planoId}`);
  const ctx = await contextoOperativo();
  return new DocumentoService(docs).regenerar(documentoId, plano, ctx);
}

export async function exportarMarkdown(documentoId: string): Promise<string> {
  const docs = new PrismaDocumentoRepository(prisma);
  const doc = await docs.get(documentoId);
  if (!doc) throw new Error(`Documento no encontrado: ${documentoId}`);
  return new DocumentoService(docs).exportar(doc);
}
