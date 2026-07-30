'use server';

// Server Actions de RECURSOS & PROVEEDORES (ADITIVO). Ambos viven como filas JSON en
// TablaProyecto ('recursos' y 'proveedores'), sin cambio de schema. Alimentan FIN/TEC/COM.

import { Prisma } from '@prisma/client';
import { prisma } from '@/adapters/persistence/prisma-client';
import { normalizarRecurso, normalizarProveedor, normalizarProducto, normalizarVinculo } from '@/domain/recursos';
import type { Recurso, Proveedor, Producto, ProductoProveedor } from '@/domain/recursos';

function toJson(v: unknown): Prisma.InputJsonValue { return v as unknown as Prisma.InputJsonValue; }
function nowISO(): string { return new Date().toISOString(); }
function nid(p: string): string { return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }

async function listar<T>(proyectoId: string, ref: string, norm: (v: unknown) => T): Promise<T[]> {
  const r = await prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef: ref } } });
  const filas = r && Array.isArray(r.filas) ? (r.filas as unknown[]) : [];
  return filas.map(norm);
}
async function guardarLista(proyectoId: string, ref: string, lista: unknown[]): Promise<void> {
  await prisma.tablaProyecto.upsert({
    where: { proyectoId_tablaRef: { proyectoId, tablaRef: ref } },
    create: { proyectoId, tablaRef: ref, filas: toJson(lista), actualizadoEn: nowISO() },
    update: { filas: toJson(lista), actualizadoEn: nowISO() },
  });
}

// --- Recursos ---
export async function listarRecursos(proyectoId: string): Promise<Recurso[]> { return listar(proyectoId, 'recursos', normalizarRecurso); }
export async function guardarRecurso(proyectoId: string, r: Recurso): Promise<Recurso> {
  const lista = await listarRecursos(proyectoId);
  const id = r.id?.trim() || nid('REC');
  const norm = normalizarRecurso({ ...r, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'recursos', lista);
  return norm;
}
export async function eliminarRecurso(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'recursos', (await listarRecursos(proyectoId)).filter((x) => x.id !== id));
}

// --- Proveedores ---
export async function listarProveedores(proyectoId: string): Promise<Proveedor[]> { return listar(proyectoId, 'proveedores_dir', normalizarProveedor); }
export async function guardarProveedor(proyectoId: string, p: Proveedor): Promise<Proveedor> {
  const lista = await listarProveedores(proyectoId);
  const id = p.id?.trim() || nid('PRV');
  const norm = normalizarProveedor({ ...p, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'proveedores_dir', lista);
  return norm;
}
export async function eliminarProveedor(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'proveedores_dir', (await listarProveedores(proyectoId)).filter((x) => x.id !== id));
  // Al borrar un proveedor, se quitan sus vínculos con productos (limpieza del muchos-a-muchos).
  await guardarLista(proyectoId, 'producto_proveedor', (await listarVinculos(proyectoId)).filter((v) => v.proveedorId !== id));
}

// --- Productos (maestro) ---
export async function listarProductos(proyectoId: string): Promise<Producto[]> { return listar(proyectoId, 'productos', normalizarProducto); }
export async function guardarProducto(proyectoId: string, p: Producto): Promise<Producto> {
  const lista = await listarProductos(proyectoId);
  const id = p.id?.trim() || nid('PROD');
  const norm = normalizarProducto({ ...p, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'productos', lista);
  return norm;
}
export async function eliminarProducto(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'productos', (await listarProductos(proyectoId)).filter((x) => x.id !== id));
  await guardarLista(proyectoId, 'producto_proveedor', (await listarVinculos(proyectoId)).filter((v) => v.productoId !== id));
}

// --- Vínculos producto ↔ proveedor (muchos-a-muchos + info comercial + historial de precios) ---
export async function listarVinculos(proyectoId: string): Promise<ProductoProveedor[]> { return listar(proyectoId, 'producto_proveedor', normalizarVinculo); }
export async function guardarVinculo(proyectoId: string, v: ProductoProveedor): Promise<ProductoProveedor> {
  const lista = await listarVinculos(proyectoId);
  const id = v.id?.trim() || nid('PP');
  const norm = normalizarVinculo({ ...v, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'producto_proveedor', lista);
  return norm;
}
export async function eliminarVinculo(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'producto_proveedor', (await listarVinculos(proyectoId)).filter((x) => x.id !== id));
}
