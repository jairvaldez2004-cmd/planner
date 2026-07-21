'use server';

// Server Actions de MODELOS 3D ESCANEADOS por objeto (ADITIVO). Ref: domain/render.ts.
// El .glb del escaneo (Polycam/Scaniverse) viaja en base64 y vive en Postgres (bytea).

import { prisma } from '@/adapters/persistence/prisma-client';
import { validarGlb } from '@/domain/render';

function nid(p: string): string { return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }

export async function subirModelo3D(proyectoId: string, objetoId: string, nombre: string, base64: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const datos = Buffer.from(base64, 'base64');
  const motivo = validarGlb(new Uint8Array(datos.subarray(0, 4)), datos.byteLength);
  if (motivo) return { ok: false, error: motivo };
  // 1 modelo por objeto: subir otro lo reemplaza.
  await prisma.modelo3DObjeto.upsert({
    where: { objetoId },
    create: { id: nid('M3D'), proyectoId, objetoId, nombre: nombre.trim() || 'Escaneo', datos },
    update: { nombre: nombre.trim() || 'Escaneo', datos },
  });
  return { ok: true };
}

// Qué objetos de estos ya tienen escaneo (para marcar la ficha sin bajar los bytes).
export async function idsConModelo3D(objetoIds: string[]): Promise<string[]> {
  if (!objetoIds.length) return [];
  const rows = await prisma.modelo3DObjeto.findMany({ where: { objetoId: { in: objetoIds } }, select: { objetoId: true } });
  return rows.map((r) => r.objetoId);
}

// Los modelos de una sede, en base64, para que la vista 3D los cargue (GLTFLoader.parse).
export async function modelosDeSede(sedeId: string): Promise<{ objetoId: string; base64: string }[]> {
  const objetos = await prisma.objetoFisico.findMany({ where: { sedeId }, select: { id: true } });
  const rows = await prisma.modelo3DObjeto.findMany({ where: { objetoId: { in: objetos.map((o) => o.id) } } });
  return rows.map((r) => ({ objetoId: r.objetoId, base64: Buffer.from(r.datos).toString('base64') }));
}

export async function eliminarModelo3D(objetoId: string): Promise<void> {
  await prisma.modelo3DObjeto.deleteMany({ where: { objetoId } });
}
