'use server';

// Acciones de Workspace/Proyecto para la navegación tipo Obsidian (ADITIVO).
// Workspace → (agente identifica) → proyecto como nodo del grafo → entrar a llenarlo.

import { prisma } from '@/adapters/persistence/prisma-client';
import { Prisma } from '@prisma/client';
import {
  PrismaWorkspaceRepository, PrismaProyectoRepository,
} from '@/adapters/persistence/prisma-repository';
import type { Workspace, Proyecto } from '@/domain/workspace';
import type { Blueprint, Diagnostico } from '@/domain/diagnostico';
import type { EtapaObjetivo } from '@/domain/etapas';

function toJson(v: unknown): Prisma.InputJsonValue {
  return v as unknown as Prisma.InputJsonValue;
}
function slug(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '').slice(0, 40) || 'X';
}

export async function listarWorkspaces(): Promise<Workspace[]> {
  return new PrismaWorkspaceRepository(prisma).list();
}

export async function crearWorkspace(nombre: string): Promise<Workspace> {
  const ws: Workspace = { id: `WS-${slug(nombre)}`, nombre: nombre.trim() || 'Workspace', tipo: 'INT' };
  return new PrismaWorkspaceRepository(prisma).save(ws);
}

// Elimina un workspace y TODO su contenido en cascada (proyectos + negocios anidados,
// diagnósticos, relaciones, unidades comerciales, sedes/espacios/objetos/elementos,
// estados de plano, tablas y conversaciones del workspace y de sus proyectos).
export async function eliminarWorkspace(workspaceId: string): Promise<void> {
  const proyectos = (await new PrismaProyectoRepository(prisma).list()).filter((p) => p.workspaceId === workspaceId);
  const ids = proyectos.map((p) => p.id);
  if (ids.length) {
    await prisma.unidadComercial.deleteMany({ where: { proyectoId: { in: ids } } });
    await prisma.objetoFisico.deleteMany({ where: { proyectoId: { in: ids } } });
    await prisma.elementoArq.deleteMany({ where: { proyectoId: { in: ids } } });
    await prisma.espacio.deleteMany({ where: { proyectoId: { in: ids } } });
    await prisma.sede.deleteMany({ where: { proyectoId: { in: ids } } });
    await prisma.proyectoPlanoEstado.deleteMany({ where: { proyectoId: { in: ids } } });
    await prisma.tablaProyecto.deleteMany({ where: { proyectoId: { in: ids } } });
    await prisma.proyectoDiagnostico.deleteMany({ where: { proyectoId: { in: ids } } });
    await prisma.conversacion.deleteMany({ where: { clave: { in: ids.map((id) => `PROJ:${id}`) } } });
    await prisma.proyecto.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.relacionProyecto.deleteMany({ where: { workspaceId } });
  await prisma.conversacion.deleteMany({ where: { clave: `WS:${workspaceId}` } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
}

export interface ProyectoNodo {
  proyectoId: string;
  nombre: string;
  workspaceId: string;
  clasificacion: string[];
  totalPlanos: number;
  comExp: boolean;
  actualizadoEn: string;
  padreId?: string; // proyecto padre en la jerarquía (undefined = nivel superior)
}

export async function listarProyectosDeWorkspace(workspaceId: string): Promise<ProyectoNodo[]> {
  const proyectos = (await new PrismaProyectoRepository(prisma).list()).filter((p) => p.workspaceId === workspaceId);
  const diags = await prisma.proyectoDiagnostico.findMany();
  const porId = new Map(diags.map((d) => [d.proyectoId, d]));
  return proyectos.map((p): ProyectoNodo => {
    const d = porId.get(p.id);
    const bp = d ? (d.blueprint as unknown as Blueprint) : null;
    return {
      proyectoId: p.id,
      nombre: p.nombre,
      workspaceId: p.workspaceId,
      clasificacion: bp?.clasificacion ?? [],
      totalPlanos: bp?.planos.length ?? 0,
      comExp: bp?.modulos.find((m) => m.modulo === 'COM-EXP')?.activo ?? false,
      actualizadoEn: d?.actualizadoEn ?? '',
      ...(p.padreId ? { padreId: p.padreId } : {}),
    };
  });
}

// Proyecto "en crudo" (sin diagnóstico): sirve para negocios hijos creados ligeros.
export async function obtenerProyectoBase(proyectoId: string): Promise<Proyecto | null> {
  return new PrismaProyectoRepository(prisma).get(proyectoId);
}

// Fija la ETAPA OBJETIVO del negocio (la ruta de 5 fases). La define el Curador al inicio.
export async function fijarEtapaObjetivo(proyectoId: string, etapa: EtapaObjetivo): Promise<void> {
  const repo = new PrismaProyectoRepository(prisma);
  const p = await repo.get(proyectoId);
  if (!p) return;
  await repo.save({ ...p, etapaObjetivo: etapa });
}

// Negocios hijos directos de un proyecto (jerarquía).
export async function listarHijosDeProyecto(padreId: string): Promise<ProyectoNodo[]> {
  const padre = await new PrismaProyectoRepository(prisma).get(padreId);
  if (!padre) return [];
  const nodos = await listarProyectosDeWorkspace(padre.workspaceId);
  return nodos.filter((n) => n.padreId === padreId);
}

// Crea un negocio (proyecto hijo) dentro de un proyecto padre, en el mismo workspace.
export async function crearNegocioHijo(padreId: string, nombre: string): Promise<ProyectoNodo | null> {
  const repo = new PrismaProyectoRepository(prisma);
  const padre = await repo.get(padreId);
  if (!padre) return null;
  const id = `PROJ-${slug(nombre)}-${Date.now().toString(36)}`;
  const p: Proyecto = { id, workspaceId: padre.workspaceId, nombre: nombre.trim() || 'Negocio', padreId };
  await repo.save(p);
  return { proyectoId: id, nombre: p.nombre, workspaceId: padre.workspaceId, clasificacion: [], totalPlanos: 0, comExp: false, actualizadoEn: '', padreId };
}

// Anida un proyecto existente bajo otro (lo mete dentro). Evita ciclos triviales.
export async function anidarProyecto(hijoId: string, padreId: string): Promise<boolean> {
  if (hijoId === padreId) return false;
  const repo = new PrismaProyectoRepository(prisma);
  const [hijo, padre] = await Promise.all([repo.get(hijoId), repo.get(padreId)]);
  if (!hijo || !padre) return false;
  if (padre.padreId === hijoId) return false; // evita ciclo directo A→B→A
  await repo.save({ ...hijo, padreId });
  return true;
}

// Saca un proyecto de su padre (vuelve al nivel superior del workspace).
export async function desanidarProyecto(hijoId: string): Promise<void> {
  const repo = new PrismaProyectoRepository(prisma);
  const hijo = await repo.get(hijoId);
  if (!hijo) return;
  await repo.save({ id: hijo.id, workspaceId: hijo.workspaceId, nombre: hijo.nombre });
}

export interface ProyectoDetalle {
  proyectoId: string;
  workspaceId: string;
  nombre: string;
  diagnostico: Diagnostico;
  blueprint: Blueprint;
  actualizadoEn: string;
}

export async function obtenerProyecto(proyectoId: string): Promise<ProyectoDetalle | null> {
  const r = await prisma.proyectoDiagnostico.findUnique({ where: { proyectoId } });
  if (!r) return null;
  const proy = await new PrismaProyectoRepository(prisma).get(proyectoId);
  const bp = r.blueprint as unknown as Blueprint;
  return {
    proyectoId: r.proyectoId,
    workspaceId: proy?.workspaceId ?? '',
    nombre: proy?.nombre ?? bp.nombreEntidad,
    diagnostico: r.diagnostico as unknown as Diagnostico,
    blueprint: bp,
    actualizadoEn: r.actualizadoEn,
  };
}

// --- Curaduría del grafo (acciones reales sobre nodos/aristas) ---

export interface RelacionGrafo { id: string; aId: string; bId: string; etiqueta?: string }

export async function listarRelaciones(workspaceId: string): Promise<RelacionGrafo[]> {
  const rs = await prisma.relacionProyecto.findMany({ where: { workspaceId } });
  return rs.map((r): RelacionGrafo => ({ id: r.id, aId: r.aId, bId: r.bId, ...(r.etiqueta !== null ? { etiqueta: r.etiqueta } : {}) }));
}

export async function relacionarProyectos(workspaceId: string, aId: string, bId: string, etiqueta?: string): Promise<void> {
  const id = `REL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await prisma.relacionProyecto.create({ data: { id, workspaceId, aId, bId, etiqueta: etiqueta ?? null } });
}

export async function renombrarProyecto(proyectoId: string, nuevoNombre: string): Promise<void> {
  const repo = new PrismaProyectoRepository(prisma);
  const p = await repo.get(proyectoId);
  if (!p) return;
  await repo.save({ ...p, nombre: nuevoNombre.trim() });
}

export async function archivarProyecto(proyectoId: string): Promise<void> {
  // Re-parentar los negocios hijos al nivel superior para no dejarlos huérfanos.
  const hijos = await listarHijosDeProyecto(proyectoId);
  for (const h of hijos) await desanidarProyecto(h.proyectoId);
  await prisma.proyectoDiagnostico.deleteMany({ where: { proyectoId } });
  await prisma.relacionProyecto.deleteMany({ where: { OR: [{ aId: proyectoId }, { bId: proyectoId }] } });
  await prisma.proyecto.deleteMany({ where: { id: proyectoId } });
}

export async function moverProyecto(proyectoId: string, workspaceDestinoId: string): Promise<void> {
  const repo = new PrismaProyectoRepository(prisma);
  const p = await repo.get(proyectoId);
  if (!p) return;
  await repo.save({ ...p, workspaceId: workspaceDestinoId });
  await prisma.relacionProyecto.deleteMany({ where: { OR: [{ aId: proyectoId }, { bId: proyectoId }] } });
}

// Guarda el diagnóstico+blueprint como proyecto dentro de un workspace ya existente.
export async function guardarDiagnosticoEnWorkspace(
  workspaceId: string,
  diagnostico: Diagnostico,
  blueprint: Blueprint,
): Promise<{ proyectoId: string }> {
  const projId = `${workspaceId}--${slug(diagnostico.nombreEntidad)}`;
  await new PrismaProyectoRepository(prisma).save({ id: projId, workspaceId, nombre: diagnostico.nombreEntidad });
  const now = new Date().toISOString();
  await prisma.proyectoDiagnostico.upsert({
    where: { proyectoId: projId },
    create: { proyectoId: projId, diagnostico: toJson(diagnostico), blueprint: toJson(blueprint), actualizadoEn: now },
    update: { diagnostico: toJson(diagnostico), blueprint: toJson(blueprint), actualizadoEn: now },
  });
  return { proyectoId: projId };
}
