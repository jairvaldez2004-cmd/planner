// Pipeline de persistencia en DB local (server-only). Guarda draft + publica (OS) + historial.
// El OS sigue siendo el único publicador. Intercambiable con la versión in-memory (R5D).

import { prisma } from '@/adapters/persistence/prisma-client';
import {
  PrismaInstanciaRepository,
  PrismaPlanoRepository,
  PrismaVersionStore,
} from '@/adapters/persistence/prisma-repository';
import { OSPublicador } from '@/app/publicacion/os-publicador';
import { ValidacionService } from '@/app/validacion/validacion-service';
import type { PlanoComExp } from '@/domain/plano-com-exp';
import type { Instancia } from '@/domain/workspace';
import type { VersionSnapshot } from '@/domain/version';

export interface ResultadoPersistencia {
  publicado: boolean;
  version: number;
  historial: VersionSnapshot[];
}

/** Persiste el draft, publica con el OS y devuelve el historial — todo en PostgreSQL local. */
export async function persistirYPublicar(
  draft: PlanoComExp,
  instanciaEnValidacion: Instancia,
  validador = 'humano-server',
): Promise<ResultadoPersistencia> {
  const planos = new PrismaPlanoRepository(prisma);
  const instancias = new PrismaInstanciaRepository(prisma);
  const versiones = new PrismaVersionStore(prisma);

  await planos.save(draft);
  await instancias.save(instanciaEnValidacion);

  const validacion = new ValidacionService().validar(draft, { aprobadoPorHumano: true, validador });
  const pub = await new OSPublicador(planos, instancias, versiones).publicar(draft, instanciaEnValidacion, validacion);

  const historial = await versiones.listar(pub.plano.id);
  return { publicado: pub.plano.publicado, version: pub.version, historial };
}
