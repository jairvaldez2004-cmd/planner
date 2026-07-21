'use server';

// Server Actions del Módulo de Espacios / UC (ADITIVO). CRUD + lentes + costeo.
// No toca FROZEN/OS. Guarda campos por lente en `data` (namespaced).

import { Prisma } from '@prisma/client';
import { prisma } from '@/adapters/persistence/prisma-client';
import type {
  UnidadComercial, Sede, Espacio, ObjetoFisico, TipoEspacio, CategoriaObjeto, ElementoArq, TipoElemento,
} from '@/domain/espacios';

function toJson(v: unknown): Prisma.InputJsonValue { return v as unknown as Prisma.InputJsonValue; }
function nid(p: string): string { return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function obj(v: unknown): Record<string, unknown> { return (v && typeof v === 'object') ? v as Record<string, unknown> : {}; }
function str(v: unknown): string { return typeof v === 'string' ? v : ''; }
function num(v: unknown): number | undefined { return typeof v === 'number' ? v : undefined; }

// =================== UNIDADES COMERCIALES ===================
export async function listarUnidades(proyectoId: string): Promise<UnidadComercial[]> {
  const rs = await prisma.unidadComercial.findMany({ where: { proyectoId } });
  return rs.map((r) => { const d = obj(r.data); return { id: r.id, nombre: r.nombre, tipo: str(d.tipo) || undefined, descripcion: str(d.descripcion) || undefined }; });
}
export async function crearUnidad(proyectoId: string, nombre: string, tipo?: string): Promise<UnidadComercial> {
  const id = nid('UC');
  await prisma.unidadComercial.create({ data: { id, proyectoId, nombre: nombre.trim() || 'Unidad', data: toJson({ tipo: tipo ?? '' }) } });
  return { id, nombre: nombre.trim() || 'Unidad', tipo };
}
export async function actualizarUnidad(id: string, patch: { nombre?: string; tipo?: string; descripcion?: string }): Promise<void> {
  const r = await prisma.unidadComercial.findUnique({ where: { id } }); if (!r) return;
  const d = obj(r.data);
  await prisma.unidadComercial.update({ where: { id }, data: {
    ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
    data: toJson({ ...d, ...(patch.tipo !== undefined ? { tipo: patch.tipo } : {}), ...(patch.descripcion !== undefined ? { descripcion: patch.descripcion } : {}) }),
  } });
}
export async function eliminarUnidad(id: string): Promise<void> { await prisma.unidadComercial.deleteMany({ where: { id } }); }

// =================== SEDES ===================
function mapSede(r: { id: string; nombre: string; data: unknown }): Sede {
  const d = obj(r.data);
  const poligono = Array.isArray(d.poligono) ? (d.poligono as [number, number][]) : undefined;
  return { id: r.id, nombre: r.nombre, direccion: str(d.direccion) || undefined, lat: num(d.lat), lng: num(d.lng), medidas: str(d.medidas) || undefined, rentaMensual: num(d.rentaMensual), footAncho: num(d.footAncho), footAlto: num(d.footAlto), poligono, muroExterior: num(d.muroExterior), muroInterior: num(d.muroInterior), acabadoPiso: str(d.acabadoPiso) || undefined, acabadoMuros: str(d.acabadoMuros) || undefined };
}
export async function listarSedes(proyectoId: string): Promise<Sede[]> {
  return (await prisma.sede.findMany({ where: { proyectoId } })).map(mapSede);
}
export async function obtenerSede(id: string): Promise<Sede | null> {
  const r = await prisma.sede.findUnique({ where: { id } }); return r ? mapSede(r) : null;
}
export async function crearSede(proyectoId: string, nombre: string): Promise<Sede> {
  const id = nid('SEDE');
  await prisma.sede.create({ data: { id, proyectoId, nombre: nombre.trim() || 'Sede', data: toJson({}) } });
  return { id, nombre: nombre.trim() || 'Sede' };
}
export async function actualizarSede(id: string, patch: Partial<Sede>): Promise<void> {
  const r = await prisma.sede.findUnique({ where: { id } }); if (!r) return;
  const d = obj(r.data);
  const merged = { ...d } as Record<string, unknown>;
  for (const k of ['direccion', 'lat', 'lng', 'medidas', 'rentaMensual', 'footAncho', 'footAlto', 'poligono', 'muroExterior', 'muroInterior', 'acabadoPiso', 'acabadoMuros'] as const) if (patch[k] !== undefined) merged[k] = patch[k];
  await prisma.sede.update({ where: { id }, data: { ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}), data: toJson(merged) } });
}
export async function eliminarSede(id: string): Promise<void> {
  await prisma.objetoFisico.deleteMany({ where: { sedeId: id } });
  await prisma.espacio.deleteMany({ where: { sedeId: id } });
  await prisma.sede.deleteMany({ where: { id } });
}

// =================== ESPACIOS ===================
function mapEspacio(r: { id: string; sedeId: string; padreId: string | null; tipo: string; nombre: string; capa: number; x: number; y: number; ancho: number; alto: number; data: unknown }): Espacio {
  const d = obj(r.data);
  const { ucIds, poligono, rot, ...campos } = d as { ucIds?: unknown; poligono?: unknown; rot?: unknown } & Record<string, unknown>;
  const camposStr: Record<string, string> = {};
  for (const [k, v] of Object.entries(campos)) camposStr[k] = str(v);
  return {
    id: r.id, sedeId: r.sedeId, padreId: r.padreId ?? undefined, tipo: r.tipo as TipoEspacio, nombre: r.nombre,
    capa: r.capa, x: r.x, y: r.y, ancho: r.ancho, alto: r.alto, rot: typeof rot === 'number' ? rot : 0,
    ucIds: Array.isArray(ucIds) ? (ucIds as string[]) : [],
    poligono: Array.isArray(poligono) ? (poligono as { x: number; y: number }[]) : undefined,
    data: camposStr,
  };
}
export async function listarEspacios(sedeId: string): Promise<Espacio[]> {
  return (await prisma.espacio.findMany({ where: { sedeId } })).map(mapEspacio);
}
export async function crearEspacio(proyectoId: string, sedeId: string, e: { tipo: TipoEspacio; nombre: string; capa: number; padreId?: string; x?: number; y?: number; ancho?: number; alto?: number; poligono?: { x: number; y: number }[] }): Promise<Espacio> {
  const id = nid('ESP');
  const data: Record<string, unknown> = { ucIds: [] };
  if (e.poligono) data.poligono = e.poligono;
  const r = await prisma.espacio.create({ data: {
    id, proyectoId, sedeId, padreId: e.padreId ?? null, tipo: e.tipo, nombre: e.nombre.trim() || 'Espacio', capa: e.capa,
    x: e.x ?? 1, y: e.y ?? 1, ancho: e.ancho ?? 4, alto: e.alto ?? 3, data: toJson(data),
  } });
  return mapEspacio(r);
}
export interface EspacioPatch { nombre?: string; tipo?: TipoEspacio; x?: number; y?: number; ancho?: number; alto?: number; rot?: number; capa?: number; ucIds?: string[]; poligono?: { x: number; y: number }[]; campos?: Record<string, string> }
export async function actualizarEspacio(id: string, patch: EspacioPatch): Promise<void> {
  const r = await prisma.espacio.findUnique({ where: { id } }); if (!r) return;
  const d = obj(r.data);
  const data = { ...d } as Record<string, unknown>;
  if (patch.ucIds !== undefined) data.ucIds = patch.ucIds;
  if (patch.poligono !== undefined) data.poligono = patch.poligono;
  if (patch.rot !== undefined) data.rot = patch.rot;
  if (patch.campos) for (const [k, v] of Object.entries(patch.campos)) data[k] = v;
  await prisma.espacio.update({ where: { id }, data: {
    ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
    ...(patch.tipo !== undefined ? { tipo: patch.tipo } : {}),
    ...(patch.x !== undefined ? { x: patch.x } : {}),
    ...(patch.y !== undefined ? { y: patch.y } : {}),
    ...(patch.ancho !== undefined ? { ancho: patch.ancho } : {}),
    ...(patch.alto !== undefined ? { alto: patch.alto } : {}),
    ...(patch.capa !== undefined ? { capa: patch.capa } : {}),
    data: toJson(data),
  } });
}
export async function eliminarEspacio(id: string): Promise<void> {
  await prisma.objetoFisico.deleteMany({ where: { espacioId: id } });
  await prisma.espacio.deleteMany({ where: { id } });
}

// =================== OBJETOS FÍSICOS ===================
function mapObjeto(r: { id: string; sedeId: string; espacioId: string; nombre: string; categoria: string; capa: number; x: number; y: number; ancho: number; alto: number; data: unknown }): ObjetoFisico {
  const d = obj(r.data); const { rot, ...resto } = d as { rot?: unknown } & Record<string, unknown>;
  const campos: Record<string, string> = {};
  for (const [k, v] of Object.entries(resto)) campos[k] = str(v);
  return { id: r.id, sedeId: r.sedeId, espacioId: r.espacioId, nombre: r.nombre, categoria: r.categoria as CategoriaObjeto, capa: r.capa, x: r.x, y: r.y, ancho: r.ancho, alto: r.alto, rot: typeof rot === 'number' ? rot : 0, data: campos };
}
export async function listarObjetos(sedeId: string): Promise<ObjetoFisico[]> {
  return (await prisma.objetoFisico.findMany({ where: { sedeId } })).map(mapObjeto);
}
export async function crearObjeto(proyectoId: string, sedeId: string, o: { espacioId: string; nombre: string; categoria: CategoriaObjeto; capa: number; x?: number; y?: number }): Promise<ObjetoFisico> {
  const id = nid('OBJ');
  const r = await prisma.objetoFisico.create({ data: {
    id, proyectoId, sedeId, espacioId: o.espacioId, nombre: o.nombre.trim() || 'Objeto', categoria: o.categoria, capa: o.capa,
    x: o.x ?? 20, y: o.y ?? 20, data: toJson({}),
  } });
  return mapObjeto(r);
}
export interface ObjetoPatch { nombre?: string; categoria?: CategoriaObjeto; espacioId?: string; x?: number; y?: number; ancho?: number; alto?: number; rot?: number; campos?: Record<string, string> }
export async function actualizarObjeto(id: string, patch: ObjetoPatch): Promise<void> {
  const r = await prisma.objetoFisico.findUnique({ where: { id } }); if (!r) return;
  const d = obj(r.data); const data = { ...d } as Record<string, unknown>;
  if (patch.campos) for (const [k, v] of Object.entries(patch.campos)) data[k] = v;
  if (patch.rot !== undefined) data.rot = patch.rot;
  await prisma.objetoFisico.update({ where: { id }, data: {
    ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
    ...(patch.categoria !== undefined ? { categoria: patch.categoria } : {}),
    ...(patch.espacioId !== undefined ? { espacioId: patch.espacioId } : {}),
    ...(patch.x !== undefined ? { x: patch.x } : {}),
    ...(patch.y !== undefined ? { y: patch.y } : {}),
    ...(patch.ancho !== undefined ? { ancho: patch.ancho } : {}),
    ...(patch.alto !== undefined ? { alto: patch.alto } : {}),
    data: toJson(data),
  } });
}
export async function eliminarObjeto(id: string): Promise<void> { await prisma.objetoFisico.deleteMany({ where: { id } }); }

// =================== ELEMENTOS ARQUITECTÓNICOS (muros/puertas/ventanas) ===================
function mapElemento(r: { id: string; sedeId: string; capa: number; tipo: string; x1: number; y1: number; x2: number; y2: number; data: unknown }): ElementoArq {
  const d = obj(r.data); const { grosor, ...rest } = d as { grosor?: unknown } & Record<string, unknown>;
  const campos: Record<string, string> = {};
  for (const [k, v] of Object.entries(rest)) campos[k] = str(v);
  return { id: r.id, sedeId: r.sedeId, capa: r.capa, tipo: r.tipo as TipoElemento, x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2, grosor: num(grosor), data: campos };
}
export async function listarElementos(sedeId: string): Promise<ElementoArq[]> {
  return (await prisma.elementoArq.findMany({ where: { sedeId } })).map(mapElemento);
}
export async function crearElemento(proyectoId: string, sedeId: string, e: { capa: number; tipo: TipoElemento; x1: number; y1: number; x2: number; y2: number; grosor?: number }): Promise<ElementoArq> {
  const id = nid('EL');
  const data = e.grosor !== undefined ? { grosor: e.grosor } : {};
  const r = await prisma.elementoArq.create({ data: { id, proyectoId, sedeId, capa: e.capa, tipo: e.tipo, x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, data: toJson(data) } });
  return mapElemento(r);
}
export async function actualizarElemento(id: string, patch: { x1?: number; y1?: number; x2?: number; y2?: number; grosor?: number }): Promise<void> {
  const r = await prisma.elementoArq.findUnique({ where: { id } }); if (!r) return;
  const data = { ...obj(r.data) } as Record<string, unknown>;
  if (patch.grosor !== undefined) data.grosor = patch.grosor;
  await prisma.elementoArq.update({ where: { id }, data: {
    ...(patch.x1 !== undefined ? { x1: patch.x1 } : {}), ...(patch.y1 !== undefined ? { y1: patch.y1 } : {}),
    ...(patch.x2 !== undefined ? { x2: patch.x2 } : {}), ...(patch.y2 !== undefined ? { y2: patch.y2 } : {}),
    data: toJson(data),
  } });
}
export async function eliminarElemento(id: string): Promise<void> { await prisma.elementoArq.deleteMany({ where: { id } }); }

// Espacios asignados a una Unidad Comercial (a través de todas las sedes del proyecto).
export async function espaciosDeUnidad(proyectoId: string, ucId: string): Promise<{ id: string; nombre: string; tipo: string; sedeNombre: string }[]> {
  const [esp, sedes] = await Promise.all([
    prisma.espacio.findMany({ where: { proyectoId } }),
    prisma.sede.findMany({ where: { proyectoId } }),
  ]);
  const sedeNombre = new Map(sedes.map((s) => [s.id, s.nombre]));
  return esp
    .filter((e) => { const u = obj(e.data).ucIds; return Array.isArray(u) && (u as string[]).includes(ucId); })
    .map((e) => ({ id: e.id, nombre: e.nombre, tipo: e.tipo, sedeNombre: sedeNombre.get(e.sedeId) ?? '—' }));
}

// =================== COSTEO ===================
export async function costeoSede(sedeId: string): Promise<{ total: number; objetos: number; espacios: number }> {
  const objetos = await prisma.objetoFisico.findMany({ where: { sedeId } });
  const espacios = await prisma.espacio.findMany({ where: { sedeId } });
  const sumar = (arr: { data: unknown }[]) => arr.reduce((s, r) => s + (Number(str(obj(r.data).fin_costo)) || 0), 0);
  const co = sumar(objetos); const ce = sumar(espacios);
  return { total: co + ce, objetos: co, espacios: ce };
}
