'use server';

// Server Actions de LOGÍSTICA (ADITIVO). Embarques/Transportistas/Entregas viven como filas
// JSON en TablaProyecto ('embarques' / 'transportistas' / 'entregas'), sin cambio de schema.
// Los embarques/transportistas ya existían (movidos desde recursos.actions.ts, mismo tablaRef
// → los datos sembrados no se pierden); Entregas es nuevo.

import { Prisma } from '@prisma/client';
import { prisma } from '@/adapters/persistence/prisma-client';
import { normalizarEmbarque, normalizarTransportista, normalizarEntrega } from '@/domain/logistica';
import type { Embarque, Transportista, Entrega } from '@/domain/logistica';

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

// --- Embarques (compra/abasto: consolidación de órdenes + landed cost) ---
export async function listarEmbarques(proyectoId: string): Promise<Embarque[]> { return listar(proyectoId, 'embarques', normalizarEmbarque); }
export async function guardarEmbarque(proyectoId: string, e: Embarque): Promise<Embarque> {
  const lista = await listarEmbarques(proyectoId);
  const id = e.id?.trim() || nid('EMB');
  const norm = normalizarEmbarque({ ...e, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'embarques', lista);
  return norm;
}
export async function eliminarEmbarque(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'embarques', (await listarEmbarques(proyectoId)).filter((x) => x.id !== id));
}

// --- Transportistas (directorio de fletes + tarifas, compartido por Compra y Entrega) ---
export async function listarTransportistas(proyectoId: string): Promise<Transportista[]> { return listar(proyectoId, 'transportistas', normalizarTransportista); }
export async function guardarTransportista(proyectoId: string, t: Transportista): Promise<Transportista> {
  const lista = await listarTransportistas(proyectoId);
  const id = t.id?.trim() || nid('TRP');
  const norm = normalizarTransportista({ ...t, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'transportistas', lista);
  return norm;
}
export async function eliminarTransportista(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'transportistas', (await listarTransportistas(proyectoId)).filter((x) => x.id !== id));
}

// --- Entregas (envío/despacho al cliente final) ---
export async function listarEntregas(proyectoId: string): Promise<Entrega[]> { return listar(proyectoId, 'entregas', normalizarEntrega); }
export async function guardarEntrega(proyectoId: string, e: Entrega): Promise<Entrega> {
  const lista = await listarEntregas(proyectoId);
  const id = e.id?.trim() || nid('ENT');
  const norm = normalizarEntrega({ ...e, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'entregas', lista);
  return norm;
}
export async function eliminarEntrega(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'entregas', (await listarEntregas(proyectoId)).filter((x) => x.id !== id));
}
