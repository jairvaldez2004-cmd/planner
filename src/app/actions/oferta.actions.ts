'use server';

// Server Actions del CATÁLOGO por UC (ADITIVO). Ref: PLANNER_CATALOG_TO_OFFERING_V1.md.
// Oferta = {Entregable} + {Ruta base}. Presentación = SKU vendible que hereda la ruta.
// Patrón igual al del Módulo de Espacios: typed (id/proyectoId/ucId·ofertaId/nombre) + `data` JSON.

import { Prisma } from '@prisma/client';
import { prisma } from '@/adapters/persistence/prisma-client';
import type { Oferta, Presentacion, Paso, TipoEntregable, Insumo, Disparador } from '@/domain/oferta';

function toJson(v: unknown): Prisma.InputJsonValue { return v as unknown as Prisma.InputJsonValue; }
function nid(p: string): string { return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function obj(v: unknown): Record<string, unknown> { return (v && typeof v === 'object') ? v as Record<string, unknown> : {}; }
function str(v: unknown): string { return typeof v === 'string' ? v : ''; }
function num(v: unknown): number | undefined { return typeof v === 'number' ? v : undefined; }
function arr<T>(v: unknown): T[] { return Array.isArray(v) ? v as T[] : []; }

// Normaliza un paso venido del cliente/JSON (defensivo: insumos siempre array).
// Migra los campos legacy `rol`/`herramientas` (texto) a `roles`/`herramientasTags` (tags).
function normPaso(v: unknown): Paso {
  const d = obj(v);
  const legacyRol = str(d.rol);
  const legacyHerr = str(d.herramientas);
  const roles = arr<unknown>(d.roles).map(str).map((s) => s.trim()).filter(Boolean);
  const herrTags = arr<unknown>(d.herramientasTags).map(str).map((s) => s.trim()).filter(Boolean);
  const splitLegacy = (s: string) => s.split(/[,;/]/).map((x) => x.trim()).filter(Boolean);
  return {
    id: str(d.id) || nid('PASO'),
    nombre: str(d.nombre),
    fase: (str(d.fase) || 'produccion') as Paso['fase'],
    lugar: str(d.lugar) || undefined,
    rol: legacyRol || undefined,
    herramientas: legacyHerr || undefined,
    roles: roles.length ? roles : (legacyRol ? splitLegacy(legacyRol) : []),
    herramientasTags: herrTags.length ? herrTags : (legacyHerr ? splitLegacy(legacyHerr) : []),
    insumos: arr<unknown>(d.insumos).map(normInsumo),
    tiempoMin: num(d.tiempoMin),
    entrada: str(d.entrada) || undefined,
    salida: str(d.salida) || undefined,
    manual: str(d.manual) || undefined,
    disparadores: arr<unknown>(d.disparadores).map(normDisparador),
  };
}
function normInsumo(v: unknown): Insumo {
  const d = obj(v);
  return { item: str(d.item), cantidad: str(d.cantidad) || undefined, costo: num(d.costo) };
}
function normDisparador(v: unknown): Disparador {
  const d = obj(v);
  return {
    id: str(d.id) || nid('DISP'),
    tipo: str(d.tipo) === 'inicio' ? 'inicio' : 'fin',
    evento: str(d.evento),
    destinoOfertaId: str(d.destinoOfertaId) || undefined,
  };
}

// =================== OFERTAS ===================
function mapOferta(r: { id: string; ucId: string; nombre: string; data: unknown }): Oferta {
  const d = obj(r.data);
  return {
    id: r.id, ucId: r.ucId, nombre: r.nombre,
    tipoEntregable: (str(d.tipoEntregable) || 'servicio') as TipoEntregable,
    categoria: str(d.categoria) || undefined,
    descripcion: str(d.descripcion) || undefined,
    rutaBase: arr<unknown>(d.rutaBase).map(normPaso),
  };
}

export async function listarOfertas(proyectoId: string, ucId: string): Promise<Oferta[]> {
  return (await prisma.oferta.findMany({ where: { proyectoId, ucId } })).map(mapOferta);
}
export async function obtenerOferta(id: string): Promise<Oferta | null> {
  const r = await prisma.oferta.findUnique({ where: { id } }); return r ? mapOferta(r) : null;
}
export async function crearOferta(proyectoId: string, ucId: string, nombre: string, tipoEntregable: TipoEntregable = 'servicio'): Promise<Oferta> {
  const id = nid('OF');
  await prisma.oferta.create({ data: { id, proyectoId, ucId, nombre: nombre.trim() || 'Oferta', data: toJson({ tipoEntregable, rutaBase: [] }) } });
  return { id, ucId, nombre: nombre.trim() || 'Oferta', tipoEntregable, rutaBase: [] };
}
export interface OfertaPatch { nombre?: string; tipoEntregable?: TipoEntregable; categoria?: string; descripcion?: string; rutaBase?: Paso[] }
export async function actualizarOferta(id: string, patch: OfertaPatch): Promise<void> {
  const r = await prisma.oferta.findUnique({ where: { id } }); if (!r) return;
  const d = obj(r.data);
  const data = { ...d } as Record<string, unknown>;
  if (patch.tipoEntregable !== undefined) data.tipoEntregable = patch.tipoEntregable;
  if (patch.categoria !== undefined) data.categoria = patch.categoria;
  if (patch.descripcion !== undefined) data.descripcion = patch.descripcion;
  if (patch.rutaBase !== undefined) data.rutaBase = patch.rutaBase.map(normPaso);
  await prisma.oferta.update({ where: { id }, data: {
    ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
    data: toJson(data),
  } });
}
export async function eliminarOferta(id: string): Promise<void> {
  await prisma.presentacion.deleteMany({ where: { ofertaId: id } });
  await prisma.oferta.deleteMany({ where: { id } });
}

// Añade/actualiza/elimina un paso de la ruta BASE (helper cómodo para el front).
export async function guardarPasoBase(ofertaId: string, paso: Paso): Promise<void> {
  const of = await obtenerOferta(ofertaId); if (!of) return;
  const p = normPaso(paso);
  const idx = of.rutaBase.findIndex((s) => s.id === p.id);
  const rutaBase = idx >= 0 ? of.rutaBase.map((s) => s.id === p.id ? p : s) : [...of.rutaBase, p];
  await actualizarOferta(ofertaId, { rutaBase });
}
export async function eliminarPasoBase(ofertaId: string, pasoId: string): Promise<void> {
  const of = await obtenerOferta(ofertaId); if (!of) return;
  await actualizarOferta(ofertaId, { rutaBase: of.rutaBase.filter((s) => s.id !== pasoId) });
}

// =================== PRESENTACIONES ===================
function mapPresentacion(r: { id: string; ofertaId: string; nombre: string; data: unknown }): Presentacion {
  const d = obj(r.data);
  const overridesRaw = obj(d.overrides);
  const overrides: Record<string, Partial<Paso>> = {};
  for (const [k, v] of Object.entries(overridesRaw)) overrides[k] = obj(v) as Partial<Paso>;
  return {
    id: r.id, ofertaId: r.ofertaId, nombre: r.nombre,
    precio: num(d.precio), unidad: str(d.unidad) || undefined, minimo: str(d.minimo) || undefined,
    composicion: arr<unknown>(d.composicion).map(normInsumo),
    omitidos: arr<unknown>(d.omitidos).map(str).filter(Boolean),
    overrides,
    pasosExtra: arr<unknown>(d.pasosExtra).map(normPaso),
  };
}

export async function listarPresentaciones(proyectoId: string, ofertaId: string): Promise<Presentacion[]> {
  return (await prisma.presentacion.findMany({ where: { proyectoId, ofertaId } })).map(mapPresentacion);
}
export async function crearPresentacion(proyectoId: string, ofertaId: string, nombre: string): Promise<Presentacion> {
  const id = nid('PRES');
  await prisma.presentacion.create({ data: { id, proyectoId, ofertaId, nombre: nombre.trim() || 'Presentación', data: toJson({ composicion: [], omitidos: [], overrides: {}, pasosExtra: [] }) } });
  return { id, ofertaId, nombre: nombre.trim() || 'Presentación', composicion: [], omitidos: [], overrides: {}, pasosExtra: [] };
}
export interface PresentacionPatch {
  nombre?: string; precio?: number; unidad?: string; minimo?: string;
  composicion?: Insumo[]; omitidos?: string[]; overrides?: Record<string, Partial<Paso>>; pasosExtra?: Paso[];
}
export async function actualizarPresentacion(id: string, patch: PresentacionPatch): Promise<void> {
  const r = await prisma.presentacion.findUnique({ where: { id } }); if (!r) return;
  const d = obj(r.data);
  const data = { ...d } as Record<string, unknown>;
  if (patch.precio !== undefined) data.precio = patch.precio;
  if (patch.unidad !== undefined) data.unidad = patch.unidad;
  if (patch.minimo !== undefined) data.minimo = patch.minimo;
  if (patch.composicion !== undefined) data.composicion = patch.composicion.map(normInsumo);
  if (patch.omitidos !== undefined) data.omitidos = patch.omitidos;
  if (patch.overrides !== undefined) data.overrides = patch.overrides;
  if (patch.pasosExtra !== undefined) data.pasosExtra = patch.pasosExtra.map(normPaso);
  await prisma.presentacion.update({ where: { id }, data: {
    ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
    data: toJson(data),
  } });
}
export async function eliminarPresentacion(id: string): Promise<void> {
  await prisma.presentacion.deleteMany({ where: { id } });
}

// Genera un paso nuevo vacío (id + fase) para que el front lo edite. Puro, sin persistir.
export async function nuevoPasoVacio(fase: Paso['fase'] = 'produccion'): Promise<Paso> {
  return { id: nid('PASO'), nombre: '', fase, insumos: [] };
}

// =================== MAESTRO DE PERSONAS / ROLES (compartido por proyecto) ===================
// Vive en TablaProyecto (tablaRef='personas'), llave = rol. Lo consumen los pasos de la ruta
// (rol → persona) y el plano Organizacional. Ref: domain/tablas.ts + AGENT_ARCHITECTURE (Decisión 5).
export interface RolPersona { rol: string; persona: string; area?: string | undefined }

async function filasPersonas(proyectoId: string): Promise<Record<string, unknown>[]> {
  const r = await prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef: 'personas' } } });
  return (r && Array.isArray(r.filas)) ? (r.filas as Record<string, unknown>[]) : [];
}

export async function listarPersonas(proyectoId: string): Promise<RolPersona[]> {
  const filas = await filasPersonas(proyectoId);
  return filas
    .map((f) => ({ rol: str(f.rol), persona: str(f.persona), area: str(f.area) || undefined }))
    .filter((x) => x.rol);
}

// Asigna (o crea) el rol en el maestro con su persona. Upsert por rol (case-insensitive).
export async function guardarRolPersona(proyectoId: string, rol: string, persona: string): Promise<void> {
  const rolT = rol.trim(); if (!rolT) return;
  const filas = (await filasPersonas(proyectoId)).map((f) => ({ ...f }));
  const idx = filas.findIndex((f) => str(f.rol).toLowerCase() === rolT.toLowerCase());
  if (idx >= 0) filas[idx] = { ...filas[idx], rol: rolT, persona };
  else filas.push({ rol: rolT, persona });
  const now = new Date().toISOString();
  await prisma.tablaProyecto.upsert({
    where: { proyectoId_tablaRef: { proyectoId, tablaRef: 'personas' } },
    create: { proyectoId, tablaRef: 'personas', filas: toJson(filas), actualizadoEn: now },
    update: { filas: toJson(filas), actualizadoEn: now },
  });
}
