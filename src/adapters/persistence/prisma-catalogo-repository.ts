// INC-1 · Repositorio Prisma del catálogo maestro (server-only, ADITIVO).
// Implementa CatalogoRepository (contrato NUEVO). NO toca Repository<T> (FROZEN)
// ni los repos de plano/instancia/versión/documento.

import { Prisma, PrismaClient } from '@prisma/client';
import type { Catalogo, CatalogoRepository, ProductoCatalogo } from '@/domain/catalogo';
import type { Incoterm, PuertoMX, RestriccionCarga } from '@/domain/plano-com-exp';

// Pistas export + atributos operativos (INC-2) opcionales que viven en la columna JSON `data`.
// Aditivo: NO requiere migración (la columna `data` ya existe).
interface DataExport {
  hsCode?: string;
  incotermSugerido?: Incoterm;
  puertoSalida?: PuertoMX;
  certificadoOrigenRequerido?: boolean;
  unidad?: string;
  empaque?: string;
  presentacion?: string;
  cantidadMinima?: string;
}

function toJson(v: DataExport): Prisma.InputJsonValue {
  return v as unknown as Prisma.InputJsonValue;
}

export class PrismaCatalogoRepository implements CatalogoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async guardarCatalogo(c: Catalogo): Promise<Catalogo> {
    await this.prisma.catalogo.upsert({
      where: { id: c.id },
      create: { id: c.id, nombre: c.nombre, dueno: c.dueno, descripcion: c.descripcion ?? null },
      update: { nombre: c.nombre, dueno: c.dueno, descripcion: c.descripcion ?? null },
    });
    return c;
  }

  async getCatalogo(id: string): Promise<Catalogo | null> {
    const r = await this.prisma.catalogo.findUnique({ where: { id } });
    if (!r) return null;
    const cat: Catalogo = { id: r.id, nombre: r.nombre, dueno: r.dueno };
    if (r.descripcion !== null) cat.descripcion = r.descripcion;
    return cat;
  }

  async listarCatalogos(): Promise<Catalogo[]> {
    const rs = await this.prisma.catalogo.findMany();
    return rs.map((r) => {
      const cat: Catalogo = { id: r.id, nombre: r.nombre, dueno: r.dueno };
      if (r.descripcion !== null) cat.descripcion = r.descripcion;
      return cat;
    });
  }

  async guardarProducto(p: ProductoCatalogo): Promise<ProductoCatalogo> {
    const data: DataExport = {
      ...(p.hsCode !== undefined ? { hsCode: p.hsCode } : {}),
      ...(p.incotermSugerido !== undefined ? { incotermSugerido: p.incotermSugerido } : {}),
      ...(p.puertoSalida !== undefined ? { puertoSalida: p.puertoSalida } : {}),
      ...(p.certificadoOrigenRequerido !== undefined
        ? { certificadoOrigenRequerido: p.certificadoOrigenRequerido }
        : {}),
      ...(p.unidad !== undefined ? { unidad: p.unidad } : {}),
      ...(p.empaque !== undefined ? { empaque: p.empaque } : {}),
      ...(p.presentacion !== undefined ? { presentacion: p.presentacion } : {}),
      ...(p.cantidadMinima !== undefined ? { cantidadMinima: p.cantidadMinima } : {}),
    };
    const cols = {
      catalogoId: p.catalogoId,
      sku: p.sku,
      nombre: p.nombre,
      categoria: p.categoria,
      restriccion: p.restriccion,
      data: toJson(data),
      activo: p.activo,
      creadoEn: p.creadoEn,
      actualizadoEn: p.actualizadoEn,
    };
    await this.prisma.productoCatalogo.upsert({
      where: { id: p.id },
      create: { id: p.id, ...cols },
      update: cols,
    });
    return p;
  }

  async getProducto(id: string): Promise<ProductoCatalogo | null> {
    const r = await this.prisma.productoCatalogo.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async listarProductos(catalogoId?: string): Promise<ProductoCatalogo[]> {
    const rs = await this.prisma.productoCatalogo.findMany({
      ...(catalogoId !== undefined ? { where: { catalogoId } } : {}),
      orderBy: { nombre: 'asc' },
    });
    return rs.map((r) => this.toDomain(r));
  }

  async eliminarProducto(id: string): Promise<void> {
    await this.prisma.productoCatalogo.deleteMany({ where: { id } });
  }

  private toDomain(r: {
    id: string; catalogoId: string; sku: string; nombre: string; categoria: string;
    restriccion: string; data: Prisma.JsonValue; activo: boolean; creadoEn: string; actualizadoEn: string;
  }): ProductoCatalogo {
    const d = (r.data ?? {}) as DataExport;
    const p: ProductoCatalogo = {
      id: r.id,
      catalogoId: r.catalogoId,
      sku: r.sku,
      nombre: r.nombre,
      categoria: r.categoria,
      restriccion: r.restriccion as RestriccionCarga,
      activo: r.activo,
      creadoEn: r.creadoEn,
      actualizadoEn: r.actualizadoEn,
    };
    if (d.hsCode !== undefined) p.hsCode = d.hsCode;
    if (d.incotermSugerido !== undefined) p.incotermSugerido = d.incotermSugerido;
    if (d.puertoSalida !== undefined) p.puertoSalida = d.puertoSalida;
    if (d.certificadoOrigenRequerido !== undefined) p.certificadoOrigenRequerido = d.certificadoOrigenRequerido;
    if (d.unidad !== undefined) p.unidad = d.unidad;
    if (d.empaque !== undefined) p.empaque = d.empaque;
    if (d.presentacion !== undefined) p.presentacion = d.presentacion;
    if (d.cantidadMinima !== undefined) p.cantidadMinima = d.cantidadMinima;
    return p;
  }
}
