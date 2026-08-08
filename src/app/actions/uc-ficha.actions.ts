'use server';

// Ficha estructural de una Unidad Comercial (ADITIVO — vive en `UnidadComercial.data.ficha`).
//
// Lo que hace distinto a este módulo: NO devuelve solo lo capturado. Los campos marcados
// como `derivado` en `uc-ficha.ts` se CALCULAN aquí leyendo el mapa operativo de la unidad,
// para que la ficha muestre el dato sin guardarlo dos veces. Editar el mapa cambia la ficha;
// no hay forma de que se desincronicen porque solo hay una copia.

import { Prisma } from '@prisma/client';
import { prisma } from '@/adapters/persistence/prisma-client';
import { CAMPOS_CAPTURADOS_UC, completitudFichaUC } from '@/domain/uc-ficha';
import type { FichaUC } from '@/domain/uc-ficha';

function toJson(v: unknown): Prisma.InputJsonValue { return v as unknown as Prisma.InputJsonValue; }
function obj(v: unknown): Record<string, unknown> { return (v && typeof v === 'object') ? v as Record<string, unknown> : {}; }
function arr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
function str(v: unknown): string { return typeof v === 'string' ? v : ''; }

/** Únicos y en orden de aparición: los derivados son inventarios, no listas con repetidos. */
function unicos(xs: string[]): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const x of xs) { const k = x.trim(); if (k && !seen.has(k)) { seen.add(k); out.push(k); } }
  return out;
}

export interface FichaUCCompleta {
  capturado: FichaUC;
  derivado: Record<string, string[]>;
  completitud: { llenos: number; total: number; pct: number };
  /** true si la unidad todavía no tiene mapa operativo: los derivados salen vacíos por eso. */
  sinMapa: boolean;
}

export async function obtenerFichaUC(proyectoId: string, ucId: string): Promise<FichaUCCompleta> {
  const uc = await prisma.unidadComercial.findUnique({ where: { id: ucId } });
  const capturado = obj(obj(uc?.data).ficha) as FichaUC;

  // --- derivación desde el mapa operativo de ESTA unidad ---
  const deptos = await prisma.departamento.findMany({ where: { proyectoId, ucId } });
  const depIds = deptos.map((d) => d.id);
  const procesos = depIds.length
    ? await prisma.proceso.findMany({ where: { proyectoId, departamentoId: { in: depIds } } })
    : [];

  const raiz = procesos.filter((p) => !obj(p.data).padreProcesoId);
  const hijos = procesos.filter((p) => obj(p.data).padreProcesoId);

  const roles: string[] = [];
  const herramientas: string[] = [];
  const automatizaciones: string[] = [];
  const ia: string[] = [];

  for (const p of procesos) {
    const d = obj(p.data);
    for (const r of arr(d.roles)) roles.push(str(r));
    for (const h of arr(d.herramientas)) herramientas.push(str(h));
    const a = obj(d.automatizacion);
    if (a.con) {
      const etiqueta = `${p.nombre} → ${str(a.herramienta) || str(a.con)}${a.nota ? ` (${str(a.nota)})` : ''}`;
      automatizaciones.push(etiqueta);
      if (a.con === 'ia') ia.push(etiqueta);
    }
  }

  // El "software" del que depende la unidad se infiere de las herramientas que parecen
  // sistemas. Es una heurística deliberadamente conservadora: mejor listar de menos que
  // afirmar que algo es software cuando es un mueble.
  const PISTAS_SW = /planner|sica|erp|crm|software|sistema|agente|plataforma|portal|app|n8n|tablero|dashboard/i;
  const software = unicos(herramientas).filter((h) => PISTAS_SW.test(h));

  const derivado: Record<string, string[]> = {
    procesoOperativo: raiz
      .sort((a, b) => a.orden - b.orden)
      .map((p) => `${p.fase === 'antes' ? '◔' : p.fase === 'durante' ? '◑' : '◕'} ${p.nombre}`),
    subprocesos: hijos.map((p) => {
      const padre = procesos.find((x) => x.id === str(obj(p.data).padreProcesoId));
      return `${p.nombre}${padre ? `  ⤴ dentro de: ${padre.nombre}` : ''}`;
    }),
    roles: unicos(roles),
    departamentos: deptos.map((d) => d.nombre),
    herramientas: unicos(herramientas),
    software,
    automatizaciones: unicos(automatizaciones),
    ia: unicos(ia),
  };

  return {
    capturado,
    derivado,
    completitud: completitudFichaUC(capturado),
    sinMapa: procesos.length === 0,
  };
}

/** Guarda UN campo capturado. Rechaza los derivados: su dueño es el mapa, no esta ficha. */
export async function guardarCampoFichaUC(ucId: string, campoId: string, valor: string): Promise<void> {
  if (!CAMPOS_CAPTURADOS_UC.some((c) => c.id === campoId)) {
    throw new Error(`"${campoId}" es un campo derivado del mapa operativo: se edita ahí, no en la ficha.`);
  }
  const uc = await prisma.unidadComercial.findUnique({ where: { id: ucId } });
  if (!uc) return;
  const d = obj(uc.data);
  const ficha = { ...obj(d.ficha), [campoId]: valor };
  await prisma.unidadComercial.update({ where: { id: ucId }, data: { data: toJson({ ...d, ficha }) } });
}
