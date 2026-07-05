// Repositorios Prisma (server-only). Implementan los MISMOS contratos que LocalRepository (R5D).
// Guardan el dominio como JSON (data) — NO alteran los contratos FROZEN. Intercambiables.

import { Prisma, PrismaClient } from '@prisma/client';
import type { Repository } from './repo.contract';
import type { PlanoComExp } from '@/domain/plano-com-exp';
import type { Instancia, Proyecto, Workspace } from '@/domain/workspace';
import type { VersionSnapshot } from '@/domain/version';
import type { RegistroVersiones } from '@/app/versionado/version-store';

function toJson(v: unknown): Prisma.InputJsonValue {
  return v as unknown as Prisma.InputJsonValue;
}

export class PrismaPlanoRepository implements Repository<PlanoComExp> {
  constructor(private readonly prisma: PrismaClient) {}
  async save(e: PlanoComExp): Promise<PlanoComExp> {
    await this.prisma.plano.upsert({
      where: { id: e.id },
      create: { id: e.id, data: toJson(e), version: e.version },
      update: { data: toJson(e), version: e.version },
    });
    return e;
  }
  async get(id: string): Promise<PlanoComExp | null> {
    const r = await this.prisma.plano.findUnique({ where: { id } });
    return r ? (r.data as unknown as PlanoComExp) : null;
  }
  async list(): Promise<PlanoComExp[]> {
    const rs = await this.prisma.plano.findMany();
    return rs.map((r) => r.data as unknown as PlanoComExp);
  }
  async snapshot(id: string): Promise<number> {
    const r = await this.prisma.plano.findUnique({ where: { id } });
    const next = (r?.version ?? 0) + 1;
    if (r) await this.prisma.plano.update({ where: { id }, data: { version: next } });
    return next;
  }
}

export class PrismaInstanciaRepository implements Repository<Instancia> {
  constructor(private readonly prisma: PrismaClient) {}
  async save(e: Instancia): Promise<Instancia> {
    await this.prisma.instancia.upsert({
      where: { id: e.id },
      create: { id: e.id, data: toJson(e), version: 0 },
      update: { data: toJson(e) },
    });
    return e;
  }
  async get(id: string): Promise<Instancia | null> {
    const r = await this.prisma.instancia.findUnique({ where: { id } });
    return r ? (r.data as unknown as Instancia) : null;
  }
  async list(): Promise<Instancia[]> {
    const rs = await this.prisma.instancia.findMany();
    return rs.map((r) => r.data as unknown as Instancia);
  }
  async snapshot(id: string): Promise<number> {
    const r = await this.prisma.instancia.findUnique({ where: { id } });
    const next = (r?.version ?? 0) + 1;
    if (r) await this.prisma.instancia.update({ where: { id }, data: { version: next } });
    return next;
  }
}

export class PrismaWorkspaceRepository implements Repository<Workspace> {
  constructor(private readonly prisma: PrismaClient) {}
  async save(e: Workspace): Promise<Workspace> {
    await this.prisma.workspace.upsert({
      where: { id: e.id },
      create: { id: e.id, data: toJson(e), version: 0 },
      update: { data: toJson(e) },
    });
    return e;
  }
  async get(id: string): Promise<Workspace | null> {
    const r = await this.prisma.workspace.findUnique({ where: { id } });
    return r ? (r.data as unknown as Workspace) : null;
  }
  async list(): Promise<Workspace[]> {
    const rs = await this.prisma.workspace.findMany();
    return rs.map((r) => r.data as unknown as Workspace);
  }
  async snapshot(id: string): Promise<number> {
    const r = await this.prisma.workspace.findUnique({ where: { id } });
    const next = (r?.version ?? 0) + 1;
    if (r) await this.prisma.workspace.update({ where: { id }, data: { version: next } });
    return next;
  }
}

export class PrismaProyectoRepository implements Repository<Proyecto> {
  constructor(private readonly prisma: PrismaClient) {}
  async save(e: Proyecto): Promise<Proyecto> {
    await this.prisma.proyecto.upsert({
      where: { id: e.id },
      create: { id: e.id, data: toJson(e), version: 0 },
      update: { data: toJson(e) },
    });
    return e;
  }
  async get(id: string): Promise<Proyecto | null> {
    const r = await this.prisma.proyecto.findUnique({ where: { id } });
    return r ? (r.data as unknown as Proyecto) : null;
  }
  async list(): Promise<Proyecto[]> {
    const rs = await this.prisma.proyecto.findMany();
    return rs.map((r) => r.data as unknown as Proyecto);
  }
  async snapshot(id: string): Promise<number> {
    const r = await this.prisma.proyecto.findUnique({ where: { id } });
    const next = (r?.version ?? 0) + 1;
    if (r) await this.prisma.proyecto.update({ where: { id }, data: { version: next } });
    return next;
  }
}

// Store de versiones en DB (append-only, inmutable). Implementa el puerto R5D.
export class PrismaVersionStore implements RegistroVersiones {
  constructor(private readonly prisma: PrismaClient) {}

  async guardar(s: VersionSnapshot): Promise<VersionSnapshot> {
    const existe = await this.prisma.versionSnapshot.findUnique({
      where: { planoId_version: { planoId: s.planoId, version: s.version } },
    });
    if (existe) {
      throw new Error(`Snapshot inmutable: versión ${s.version} de ${s.planoId} ya existe (no se sobrescribe).`);
    }
    await this.prisma.versionSnapshot.create({
      data: {
        planoId: s.planoId,
        version: s.version,
        publicado: s.publicado,
        timestamp: s.timestamp,
        data: toJson(s.plano),
      },
    });
    return s;
  }

  async listar(planoId: string): Promise<VersionSnapshot[]> {
    const rs = await this.prisma.versionSnapshot.findMany({ where: { planoId }, orderBy: { version: 'asc' } });
    return rs.map((r) => ({
      planoId: r.planoId,
      version: r.version,
      timestamp: r.timestamp,
      publicado: r.publicado,
      plano: r.data as unknown as PlanoComExp,
    }));
  }

  async obtener(planoId: string, version: number): Promise<VersionSnapshot | null> {
    const r = await this.prisma.versionSnapshot.findUnique({
      where: { planoId_version: { planoId, version } },
    });
    return r
      ? {
          planoId: r.planoId,
          version: r.version,
          timestamp: r.timestamp,
          publicado: r.publicado,
          plano: r.data as unknown as PlanoComExp,
        }
      : null;
  }
}
