'use server';

// Server Actions de la capa 2 (ADITIVO): especialistas por plano, tablas maestras y readiness.
// No toca FROZEN/COM-EXP/OS. La IA solo conduce la captura de campos; tablas por CSV.

import { Prisma } from '@prisma/client';
import { prisma } from '@/adapters/persistence/prisma-client';
import { obtenerProyecto, obtenerProyectoBase } from '@/app/actions/workspace.actions';
import type { EtapaObjetivo } from '@/domain/etapas';
import {
  ESPECIALISTAS, especialista, aristasPlanos,
} from '@/domain/especialistas';
import type { EspecialistaConfig } from '@/domain/especialistas';
import { ORDEN_PLANOS, PLANOS_MAESTROS } from '@/domain/diagnostico';
import { TABLAS_BASE } from '@/domain/tablas';
import type { Columna } from '@/domain/tablas';
import { calcularReadiness } from '@/app/readiness/readiness-engine';
import type { EstadoPlano, Readiness } from '@/app/readiness/readiness-engine';
import { turnoEspecialista } from '@/adapters/ai/especialista-agent';
import type { MensajeChat } from '@/adapters/ai/especialista-agent';
import { aCSV, desdeCSV, upsertPorLlave, columnasEfectivas } from '@/app/captura/csv';
import type { Fila } from '@/app/captura/csv';
import { modeloActual } from '@/app/actions/config.actions';
import { generarDocumentoPlano } from '@/domain/plano-doc';
import type { DocumentoPlano } from '@/domain/plano-doc';
import { ambientesDeEspacios, procesosDeMapa, personasDeSuperficies, puestosDeEmpleados, costosDeRecursos, componentesDeEquipo, proveedoresATabla } from '@/domain/proyeccion';
import { listarSedes, listarEspacios } from '@/app/actions/espacios.actions';
import { listarProcesos } from '@/app/actions/mapa.actions';
import { listarEmpleados } from '@/app/actions/rh.actions';
import { listarRecursos, listarProveedores } from '@/app/actions/recursos.actions';

function toJson(v: unknown): Prisma.InputJsonValue { return v as unknown as Prisma.InputJsonValue; }
function nowISO(): string { return new Date().toISOString(); }

// --- helpers de carga ---
async function cargarCampos(proyectoId: string, planoId: string): Promise<Record<string, string>> {
  const r = await prisma.proyectoPlanoEstado.findUnique({ where: { proyectoId_planoId: { proyectoId, planoId } } });
  return r ? (r.campos as Record<string, string>) : {};
}

async function cargarFilasPorTabla(proyectoId: string): Promise<Record<string, number>> {
  const rs = await prisma.tablaProyecto.findMany({ where: { proyectoId } });
  const out: Record<string, number> = {};
  for (const r of rs) out[r.tablaRef] = Array.isArray(r.filas) ? (r.filas as unknown[]).length : 0;
  return out;
}

// PROYECCIÓN: filas DERIVADAS de las superficies reales (Sedes/Mapa) para las tablas que
// un plano lee. Es el "flujo de datos real": un espacio de Sedes se vuelve un ambiente del
// plano Arquitectónico sin re-teclearlo. Carga cada superficie una sola vez y solo si hace falta.
async function proyectarTablas(proyectoId: string, refs: Set<string>): Promise<Record<string, Fila[]>> {
  const out: Record<string, Fila[]> = {};
  let espacios: Awaited<ReturnType<typeof listarEspacios>> | null = null;
  let procesos: Awaited<ReturnType<typeof listarProcesos>> | null = null;
  let empleados: Awaited<ReturnType<typeof listarEmpleados>> | null = null;
  const getEspacios = async () => {
    if (!espacios) { const sedes = await listarSedes(proyectoId); espacios = (await Promise.all(sedes.map((s) => listarEspacios(s.id)))).flat(); }
    return espacios;
  };
  const getProcesos = async () => { if (!procesos) procesos = await listarProcesos(proyectoId); return procesos; };
  const getEmpleados = async () => { if (!empleados) empleados = await listarEmpleados(proyectoId); return empleados; };
  let recursos: Awaited<ReturnType<typeof listarRecursos>> | null = null;
  let proveedores: Awaited<ReturnType<typeof listarProveedores>> | null = null;
  const getRecursos = async () => { if (!recursos) recursos = await listarRecursos(proyectoId); return recursos; };
  const getProveedores = async () => { if (!proveedores) proveedores = await listarProveedores(proyectoId); return proveedores; };
  if (refs.has('ambientes')) out['ambientes'] = ambientesDeEspacios(await getEspacios());
  if (refs.has('procesos')) out['procesos'] = procesosDeMapa(await getProcesos());
  if (refs.has('puestos')) out['puestos'] = puestosDeEmpleados(await getEmpleados());
  if (refs.has('personas')) out['personas'] = personasDeSuperficies(await getEspacios(), await getProcesos(), await getEmpleados());
  if (refs.has('costos')) out['costos'] = costosDeRecursos(await getRecursos());
  if (refs.has('componentes')) out['componentes'] = componentesDeEquipo(await getRecursos());
  if (refs.has('proveedores')) out['proveedores'] = proveedoresATabla(await getProveedores());
  return out;
}

// Fusiona filas derivadas (proyectadas) con las capturadas a mano: lo MANUAL manda sobre lo
// derivado (misma llave). Así editar a mano una fila proyectada la fija sin perder el resto.
function fusionarProyeccion(proyectadas: Fila[], manuales: Fila[], tablaRef: string): Fila[] {
  const llave = TABLAS_BASE[tablaRef]?.llave ?? 'id';
  return upsertPorLlave(proyectadas, manuales, llave);
}

// Columnas de la vista de un especialista sobre una tabla (base + contexto unido entre bloques).
export async function columnasDeVista(planoId: string, tablaRef: string): Promise<Columna[]> {
  const cfg = especialista(planoId);
  const base = TABLAS_BASE[tablaRef]?.columnas ?? [];
  const contexto: Columna[] = [];
  for (const b of cfg?.bloques ?? []) {
    if (b.tabla?.tablaRef === tablaRef) contexto.push(...(b.tabla.columnasContexto ?? []));
  }
  return columnasEfectivas(base, contexto);
}

// --- estado de los 13 planos del proyecto (para el grafo) ---
export interface NodoPlano {
  planoId: string;
  nombre: string;
  seleccionado: boolean;
  estado: EstadoPlano;
  progreso: number;
  profundidad: string;
  minOperable: boolean;
  entrega: string;
}

export interface GrafoPlanos {
  nodos: NodoPlano[];
  aristas: { de: string; a: string }[];
  profundidadProyecto: string;
  etapaObjetivo?: EtapaObjetivo; // etapa de la ruta hacia la que trabaja el negocio (si está fijada)
}

export async function obtenerGrafoPlanos(proyectoId: string): Promise<GrafoPlanos | null> {
  const det = await obtenerProyecto(proyectoId);
  if (!det) return null;
  const base = await obtenerProyectoBase(proyectoId);
  const bp = det.blueprint;
  const seleccionados = new Map(bp.planos.map((p) => [p.id, p]));
  const filasPorTabla = await cargarFilasPorTabla(proyectoId);

  const nodos: NodoPlano[] = [];
  for (const planoId of ORDEN_PLANOS) {
    const cfg = ESPECIALISTAS[planoId];
    const sel = seleccionados.get(planoId);
    const seleccionado = !!sel;
    let readiness: Readiness;
    if (cfg) {
      const campos = await cargarCampos(proyectoId, planoId);
      readiness = calcularReadiness(cfg, bp.profundidadProyecto, { campos, filasPorTabla }, seleccionado);
    } else {
      readiness = { estado: seleccionado ? 'DISPONIBLE' : 'LOCKED', progreso: 0, totalRequerido: 0, cumplidoRequerido: 0, faltanEsencial: [], faltanNivel: [], faltanCompleto: [] };
    }
    nodos.push({
      planoId,
      nombre: PLANOS_MAESTROS[planoId] ?? planoId,
      seleccionado,
      estado: readiness.estado,
      progreso: readiness.progreso,
      profundidad: sel?.profundidad ?? bp.profundidadProyecto,
      minOperable: sel?.minOperable ?? false,
      entrega: cfg?.contratoEntrega.tipo ?? 'documento',
    });
  }

  // aristas solo entre nodos existentes
  const ids = new Set(nodos.map((n) => n.planoId));
  const aristas = aristasPlanos().filter((a) => ids.has(a.de) && ids.has(a.a));
  return { nodos, aristas, profundidadProyecto: bp.profundidadProyecto, ...(base?.etapaObjetivo ? { etapaObjetivo: base.etapaObjetivo } : {}) };
}

// --- detalle de un plano (para la Vista de Plano) ---
export interface TablaResumen { tablaRef: string; etiqueta: string; columnas: Columna[]; filas: Fila[]; disparadorCSV: number; proyectadas: number }
export interface DetallePlano {
  planoId: string;
  nombre: string;
  seleccionado: boolean;
  lenguajeTecnico: string;
  entrega: { tipo: string; descripcion: string };
  profundidad: string;
  campos: Record<string, string>;
  bloques: EspecialistaConfig['bloques'];
  tablas: TablaResumen[];
  readiness: Readiness;
}

export async function obtenerDetallePlano(proyectoId: string, planoId: string): Promise<DetallePlano | null> {
  const det = await obtenerProyecto(proyectoId);
  const cfg = especialista(planoId);
  if (!det || !cfg) return null;
  const seleccionado = det.blueprint.planos.some((p) => p.id === planoId);
  const campos = await cargarCampos(proyectoId, planoId);
  const filasPorTabla = await cargarFilasPorTabla(proyectoId);

  // tablas de este plano (refs únicos) — con filas DERIVADAS de las superficies fusionadas
  const refs = Array.from(new Set(cfg.bloques.filter((b) => b.tabla).map((b) => b.tabla!.tablaRef)));
  const proj = await proyectarTablas(proyectoId, new Set(refs));
  const tablas: TablaResumen[] = [];
  for (const ref of refs) {
    const columnas = await columnasDeVista(planoId, ref);
    const fila = await prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef: ref } } });
    const manuales = fila && Array.isArray(fila.filas) ? (fila.filas as Fila[]) : [];
    const derivadas = proj[ref] ?? [];
    const filas = fusionarProyeccion(derivadas, manuales, ref);
    const bloque = cfg.bloques.find((b) => b.tabla?.tablaRef === ref)!;
    tablas.push({ tablaRef: ref, etiqueta: bloque.tabla!.etiqueta ?? TABLAS_BASE[ref]?.nombre ?? ref, columnas, filas, disparadorCSV: bloque.tabla!.disparadorCSV, proyectadas: derivadas.length });
  }

  // readiness contando las filas efectivas (manuales + derivadas de superficies)
  const filasEff: Record<string, number> = { ...filasPorTabla };
  for (const t of tablas) filasEff[t.tablaRef] = t.filas.length;
  const readiness = calcularReadiness(cfg, det.blueprint.profundidadProyecto, { campos, filasPorTabla: filasEff }, seleccionado);

  return {
    planoId, nombre: cfg.nombre, seleccionado, lenguajeTecnico: cfg.lenguajeTecnico,
    entrega: cfg.contratoEntrega, profundidad: det.blueprint.profundidadProyecto,
    campos, bloques: cfg.bloques, tablas, readiness,
  };
}

// --- chat con el especialista ---
export async function conversarEspecialista(
  proyectoId: string, planoId: string, historial: MensajeChat[],
): Promise<{ reply: string; readiness: Readiness | null }> {
  const det = await obtenerProyecto(proyectoId);
  const cfg = especialista(planoId);
  if (!det || !cfg) return { reply: '⚠ Proyecto o plano no encontrado.', readiness: null };

  const seleccionado = det.blueprint.planos.some((p) => p.id === planoId);
  const campos = await cargarCampos(proyectoId, planoId);
  const filasPorTabla = await cargarFilasPorTabla(proyectoId);
  const readiness = calcularReadiness(cfg, det.blueprint.profundidadProyecto, { campos, filasPorTabla }, seleccionado);

  try {
    const r = await turnoEspecialista(cfg, {
      proyecto: det.nombre, resumen: det.blueprint.resumen, profundidad: det.blueprint.profundidadProyecto,
      campos, filasPorTabla, readiness,
    }, historial, await modeloActual('especialista'));

    if (r.huboCambios && Object.keys(r.campos).length) {
      const merged = { ...campos, ...r.campos };
      await prisma.proyectoPlanoEstado.upsert({
        where: { proyectoId_planoId: { proyectoId, planoId } },
        create: { proyectoId, planoId, campos: toJson(merged), actualizadoEn: nowISO() },
        update: { campos: toJson(merged), actualizadoEn: nowISO() },
      });
      const nuevo = calcularReadiness(cfg, det.blueprint.profundidadProyecto, { campos: merged, filasPorTabla }, seleccionado);
      return { reply: r.reply, readiness: nuevo };
    }
    return { reply: r.reply, readiness };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const falta = /api[_ -]?key|authentication|x-api-key/i.test(msg)
      ? 'Falta ANTHROPIC_API_KEY en business-planner-alpha/.env.local.' : msg;
    return { reply: `⚠ No pude consultar al Especialista (IA): ${falta}`, readiness };
  }
}

// --- generar el DOCUMENTO del plano desde lo capturado (campos + tablas) ---
// Motor genérico (domain/plano-doc): rinde bloques/campos/tablas a Markdown y marca
// PENDIENTE lo requerido y vacío al nivel del proyecto. No inventa. Aplica a los 18 planos.
export async function generarDocumentoDePlano(proyectoId: string, planoId: string): Promise<DocumentoPlano | null> {
  const det = await obtenerProyecto(proyectoId);
  const cfg = especialista(planoId);
  if (!det || !cfg) return null;
  const campos = await cargarCampos(proyectoId, planoId);
  const refs = new Set(cfg.bloques.filter((b) => b.tabla).map((b) => b.tabla!.tablaRef));
  const proj = await proyectarTablas(proyectoId, refs);
  const tablas: Record<string, Fila[]> = {};
  for (const ref of refs) {
    const r = await prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef: ref } } });
    const manuales = r && Array.isArray(r.filas) ? (r.filas as Fila[]) : [];
    tablas[ref] = fusionarProyeccion(proj[ref] ?? [], manuales, ref);
  }
  return generarDocumentoPlano(cfg, det.blueprint.profundidadProyecto, { campos, tablas });
}

// --- edición manual de un campo ---
export async function guardarCampo(proyectoId: string, planoId: string, campoId: string, valor: string): Promise<void> {
  const campos = await cargarCampos(proyectoId, planoId);
  campos[campoId] = valor;
  await prisma.proyectoPlanoEstado.upsert({
    where: { proyectoId_planoId: { proyectoId, planoId } },
    create: { proyectoId, planoId, campos: toJson(campos), actualizadoEn: nowISO() },
    update: { campos: toJson(campos), actualizadoEn: nowISO() },
  });
}

// --- CSV de tablas ---
export async function plantillaCSV(proyectoId: string, planoId: string, tablaRef: string): Promise<string> {
  const columnas = await columnasDeVista(planoId, tablaRef);
  const r = await prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef } } });
  const filas = r && Array.isArray(r.filas) ? (r.filas as Fila[]) : [];
  return aCSV(columnas, filas);
}

export async function importarCSV(
  proyectoId: string, planoId: string, tablaRef: string, texto: string,
): Promise<{ ok: boolean; agregadas: number; total: number; errores: string[]; pendientes: string[] }> {
  const columnas = await columnasDeVista(planoId, tablaRef);
  const res = desdeCSV(columnas, texto);
  if (res.errores.length && res.filas.length === 0) return { ok: false, agregadas: 0, total: 0, errores: res.errores, pendientes: res.pendientes };

  const llave = TABLAS_BASE[tablaRef]?.llave ?? columnas[0]?.id ?? 'id';
  const r = await prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef } } });
  const actuales = r && Array.isArray(r.filas) ? (r.filas as Fila[]) : [];
  const merged = upsertPorLlave(actuales, res.filas, llave);

  await prisma.tablaProyecto.upsert({
    where: { proyectoId_tablaRef: { proyectoId, tablaRef } },
    create: { proyectoId, tablaRef, filas: toJson(merged), actualizadoEn: nowISO() },
    update: { filas: toJson(merged), actualizadoEn: nowISO() },
  });
  return { ok: true, agregadas: res.filas.length, total: merged.length, errores: res.errores, pendientes: res.pendientes };
}
