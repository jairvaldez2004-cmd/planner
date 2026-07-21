'use server';

// Server Actions de RENDERS EXTERNOS (ADITIVO). Ref: domain/render.ts.
// La imagen viaja como base64 y se guarda en Postgres (bytea) — el filesystem de
// Railway es efímero. La lista devuelve dataURL listo para <img>.

import { Prisma } from '@prisma/client';
import { prisma } from '@/adapters/persistence/prisma-client';
import { validarRender } from '@/domain/render';
import type { AnclajeRender, Calibracion } from '@/domain/render';

function toJson(v: unknown): Prisma.InputJsonValue { return v as unknown as Prisma.InputJsonValue; }
function nid(p: string): string { return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function obj(v: unknown): Record<string, unknown> { return (v && typeof v === 'object') ? v as Record<string, unknown> : {}; }

export interface RenderInfo {
  id: string;
  nombre: string;
  mime: string;
  dataUrl: string;                       // data:<mime>;base64,… listo para <img>
  calibracion: Calibracion | null;
  anclajes: AnclajeRender[];
}

function mapRender(r: { id: string; nombre: string; mime: string; datos: Uint8Array; data: unknown }): RenderInfo {
  const d = obj(r.data);
  const c = obj(d.calibracion);
  const cal = (typeof c.x1 === 'number' && typeof c.metros === 'number')
    ? { x1: c.x1 as number, y1: c.y1 as number, x2: c.x2 as number, y2: c.y2 as number, metros: c.metros as number }
    : null;
  return {
    id: r.id, nombre: r.nombre, mime: r.mime,
    dataUrl: `data:${r.mime};base64,${Buffer.from(r.datos).toString('base64')}`,
    calibracion: cal,
    anclajes: Array.isArray(d.anclajes) ? d.anclajes as AnclajeRender[] : [],
  };
}

export async function listarRenders(sedeId: string): Promise<RenderInfo[]> {
  const rows = await prisma.renderSede.findMany({ where: { sedeId } });
  return rows.map(mapRender);
}

export async function subirRender(proyectoId: string, sedeId: string, nombre: string, mime: string, base64: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const datos = Buffer.from(base64, 'base64');
  const motivo = validarRender(mime, datos.byteLength);
  if (motivo) return { ok: false, error: motivo };
  const id = nid('REND');
  await prisma.renderSede.create({ data: {
    id, proyectoId, sedeId, nombre: nombre.trim() || 'Render', mime, datos, data: toJson({ anclajes: [] }),
  } });
  return { ok: true, id };
}

export async function actualizarRender(id: string, patch: { nombre?: string; calibracion?: Calibracion | null; anclajes?: AnclajeRender[] }): Promise<void> {
  const r = await prisma.renderSede.findUnique({ where: { id } }); if (!r) return;
  const d = obj(r.data);
  const data = { ...d } as Record<string, unknown>;
  if (patch.calibracion !== undefined) data.calibracion = patch.calibracion ?? undefined;
  if (patch.anclajes !== undefined) data.anclajes = patch.anclajes;
  await prisma.renderSede.update({ where: { id }, data: {
    ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
    data: toJson(data),
  } });
}

export async function eliminarRender(id: string): Promise<void> {
  await prisma.renderSede.deleteMany({ where: { id } });
}
