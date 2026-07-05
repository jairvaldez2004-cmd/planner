'use server';

// Server Actions para planes, workspaces, proyectos y versiones.
// La UI llama estas funciones; ellas orquestan repos Prisma.
// El OS sigue siendo el único publicador (OSPublicador.publicar).

import { prisma } from '@/adapters/persistence/prisma-client';
import {
  PrismaPlanoRepository,
  PrismaInstanciaRepository,
  PrismaVersionStore,
  PrismaWorkspaceRepository,
  PrismaProyectoRepository,
} from '@/adapters/persistence/prisma-repository';
import { OSPublicador } from '@/app/publicacion/os-publicador';
import { ValidacionService } from '@/app/validacion/validacion-service';
import type { PlanoComExp } from '@/domain/plano-com-exp';
import type { Instancia, Proyecto, Workspace } from '@/domain/workspace';
import type { VersionSnapshot } from '@/domain/version';

// --- Workspace / Proyecto ---

export async function listarWorkspaces(): Promise<Workspace[]> {
  return new PrismaWorkspaceRepository(prisma).list();
}

export async function asegurarWorkspace(ws: Workspace): Promise<Workspace> {
  return new PrismaWorkspaceRepository(prisma).save(ws);
}

export async function listarProyectos(): Promise<Proyecto[]> {
  return new PrismaProyectoRepository(prisma).list();
}

export async function asegurarProyecto(p: Proyecto): Promise<Proyecto> {
  return new PrismaProyectoRepository(prisma).save(p);
}

// --- Planes (CRUD) ---

export async function guardarDraft(plano: PlanoComExp, instancia: Instancia): Promise<void> {
  // BUG-1 fix: vincular la instancia al plano al GUARDAR el draft (antes el planoId solo
  // se establecía al publicar, vía OSPublicador). Sin esto, abrirPlano no encuentra la
  // instancia de un draft (busca por instancia.planoId === plano.id). No cambia contratos
  // ni FROZEN: el valor vinculado es el mismo que asigna el OS al publicar (plano.id).
  const instanciaVinculada: Instancia = { ...instancia, planoId: plano.id };
  await new PrismaPlanoRepository(prisma).save(plano);
  await new PrismaInstanciaRepository(prisma).save(instanciaVinculada);
}

export async function abrirPlano(id: string): Promise<{
  plano: PlanoComExp | null;
  instancia: Instancia | null;
}> {
  const plano = await new PrismaPlanoRepository(prisma).get(id);
  const todas = await new PrismaInstanciaRepository(prisma).list();
  const instancia = todas.find((i) => i.planoId === id) ?? null;
  return { plano, instancia };
}

export async function listarPlanos(): Promise<PlanoComExp[]> {
  return new PrismaPlanoRepository(prisma).list();
}

export async function listarInstancias(): Promise<Instancia[]> {
  return new PrismaInstanciaRepository(prisma).list();
}

export async function duplicarPlano(id: string): Promise<PlanoComExp | null> {
  const repo = new PrismaPlanoRepository(prisma);
  const original = await repo.get(id);
  if (!original) return null;
  const copia: PlanoComExp = {
    ...original,
    id: `${original.id}-COPIA-${Date.now()}`,
    publicado: false,
    version: 0,
  };
  await repo.save(copia);
  return copia;
}

// --- Publicación (OS único publicador) ---

export async function publicarPlano(
  plano: PlanoComExp,
  instancia: Instancia,
  validadorNombre: string,
  aprobadoPorHumano: boolean,
): Promise<{ plano: PlanoComExp; instancia: Instancia; version: number }> {
  const planos = new PrismaPlanoRepository(prisma);
  const instancias = new PrismaInstanciaRepository(prisma);
  const versiones = new PrismaVersionStore(prisma);
  const validacion = new ValidacionService().validar(plano, {
    aprobadoPorHumano,
    validador: validadorNombre,
  });
  return new OSPublicador(planos, instancias, versiones).publicar(plano, instancia, validacion);
}

// --- Versiones ---

export async function listarHistorial(planoId: string): Promise<VersionSnapshot[]> {
  return new PrismaVersionStore(prisma).listar(planoId);
}

export async function restaurarVersion(planoId: string, version: number): Promise<PlanoComExp> {
  const versiones = new PrismaVersionStore(prisma);
  const snap = await versiones.obtener(planoId, version);
  if (!snap) throw new Error(`Versión ${version} de ${planoId} no existe.`);
  const draft: PlanoComExp = {
    ...snap.plano,
    id: `${snap.plano.id}-DRAFT-V${version}-${Date.now()}`,
    version: 0,
    publicado: false,
  };
  await new PrismaPlanoRepository(prisma).save(draft);
  return draft;
}
