'use server';

// Config superadmin desde el frontend (ADITIVO): modelo por agente, persistido en DB.
// Precedencia: DB (este panel) > env (BP_MODELO_*) > default en src/config/modelos.ts.

import { prisma } from '@/adapters/persistence/prisma-client';
import { modeloDe, MODELOS, MODELOS_DISPONIBLES } from '@/config/modelos';
import type { ModeloClaude, RolAgente } from '@/config/modelos';

const ROLES: RolAgente[] = ['curador', 'coordinador', 'especialista'];
const clave = (rol: RolAgente) => `modelo.${rol}`;

export async function obtenerModelosAgentes(): Promise<Record<RolAgente, ModeloClaude>> {
  const filas = await prisma.ajuste.findMany({ where: { clave: { in: ROLES.map(clave) } } });
  const porClave = new Map(filas.map((f) => [f.clave, f.valor as ModeloClaude]));
  const out = {} as Record<RolAgente, ModeloClaude>;
  for (const rol of ROLES) out[rol] = porClave.get(clave(rol)) ?? modeloDe(rol);
  return out;
}

export async function modeloActual(rol: RolAgente): Promise<ModeloClaude> {
  const fila = await prisma.ajuste.findUnique({ where: { clave: clave(rol) } });
  return (fila?.valor as ModeloClaude) ?? modeloDe(rol);
}

export async function guardarModeloAgente(rol: RolAgente, modelo: ModeloClaude): Promise<void> {
  const valido = MODELOS_DISPONIBLES.find((m) => m.id === modelo && m.habilitado);
  if (!valido) throw new Error(`Modelo no permitido: ${modelo}`);
  await prisma.ajuste.upsert({
    where: { clave: clave(rol) },
    create: { clave: clave(rol), valor: modelo },
    update: { valor: modelo },
  });
}

// Restablece a los defaults de código (borra overrides de DB).
export async function restablecerModelos(): Promise<Record<RolAgente, ModeloClaude>> {
  await prisma.ajuste.deleteMany({ where: { clave: { in: ROLES.map(clave) } } });
  return { ...MODELOS };
}
