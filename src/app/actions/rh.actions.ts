'use server';

// Server Actions de PERSONAS / RH (ADITIVO). El roster de empleados vive como filas JSON
// en TablaProyecto ref 'empleados' (sin cambio de schema). Es una superficie de captura:
// alimenta el plano RH (puestos) y ORG/OPE (personas) por proyección.

import { Prisma } from '@prisma/client';
import { prisma } from '@/adapters/persistence/prisma-client';
import { normalizarEmpleado } from '@/domain/rh';
import type { Empleado } from '@/domain/rh';

const REF = 'empleados';
function toJson(v: unknown): Prisma.InputJsonValue { return v as unknown as Prisma.InputJsonValue; }
function nowISO(): string { return new Date().toISOString(); }
function nid(): string { return `EMP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }

export async function listarEmpleados(proyectoId: string): Promise<Empleado[]> {
  const r = await prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef: REF } } });
  const filas = r && Array.isArray(r.filas) ? (r.filas as unknown[]) : [];
  return filas.map(normalizarEmpleado);
}

async function guardarLista(proyectoId: string, lista: Empleado[]): Promise<void> {
  await prisma.tablaProyecto.upsert({
    where: { proyectoId_tablaRef: { proyectoId, tablaRef: REF } },
    create: { proyectoId, tablaRef: REF, filas: toJson(lista), actualizadoEn: nowISO() },
    update: { filas: toJson(lista), actualizadoEn: nowISO() },
  });
}

export async function guardarEmpleado(proyectoId: string, emp: Empleado): Promise<Empleado> {
  const lista = await listarEmpleados(proyectoId);
  const id = emp.id?.trim() || nid();
  const norm = normalizarEmpleado({ ...emp, id });
  const i = lista.findIndex((e) => e.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, lista);
  return norm;
}

export async function eliminarEmpleado(proyectoId: string, id: string): Promise<void> {
  const lista = (await listarEmpleados(proyectoId)).filter((e) => e.id !== id);
  await guardarLista(proyectoId, lista);
}
