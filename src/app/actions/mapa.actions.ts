'use server';

// Server Actions del MAPA OPERATIVO (ADITIVO). Ref: domain/mapa.ts.
// Departamentos (Administración + UCs en una lista) + Procesos (nodos con ramas por disparador).
// Patrón igual al Módulo de Espacios/Catálogo: columnas typed + `data` JSON.

import { Prisma } from '@prisma/client';
import { prisma } from '@/adapters/persistence/prisma-client';
import type { AsignacionRecurso, Departamento, FaseMapa, ProcesoNodo, Rama, TipoDepartamento } from '@/domain/mapa';
import { ETAPA_BASE } from '@/domain/mapa';
import type { EtapaObjetivo } from '@/domain/etapas';
import { ETAPAS_OBJETIVO } from '@/domain/etapas';
import type { FasePaso } from '@/domain/oferta';
import { parseDuracion, repartirDuracion } from '@/domain/duracion';

function etapa(v: unknown, fallback?: EtapaObjetivo): EtapaObjetivo | undefined {
  return ETAPAS_OBJETIVO.some((x) => x.id === v) ? v as EtapaObjetivo : fallback;
}

function toJson(v: unknown): Prisma.InputJsonValue { return v as unknown as Prisma.InputJsonValue; }
function nid(p: string): string { return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function obj(v: unknown): Record<string, unknown> { return (v && typeof v === 'object') ? v as Record<string, unknown> : {}; }
function str(v: unknown): string { return typeof v === 'string' ? v : ''; }
function num(v: unknown): number | undefined { return typeof v === 'number' ? v : undefined; }
function arr<T>(v: unknown): T[] { return Array.isArray(v) ? v as T[] : []; }

function normAsig(v: unknown): AsignacionRecurso {
  const d = obj(v);
  return { ref: str(d.ref) || undefined, nombre: str(d.nombre), horario: str(d.horario) || undefined };
}
function normRama(v: unknown): Rama {
  const d = obj(v);
  return { id: str(d.id) || nid('RAMA'), evento: str(d.evento), destinoProcesoId: str(d.destinoProcesoId) || undefined };
}

// =================== DEPARTAMENTOS ===================

function mapDepto(r: { id: string; nombre: string; tipo: string; ucId: string | null; orden: number; data: unknown }): Departamento {
  const d = obj(r.data);
  return {
    id: r.id, nombre: r.nombre,
    tipo: (r.tipo === 'uc' ? 'uc' : 'admin') as TipoDepartamento,
    ucId: r.ucId ?? undefined,
    orden: r.orden,
    color: str(d.color) || undefined,
    descripcion: str(d.descripcion) || undefined,
    espacios: arr<unknown>(d.espacios).map(normAsig),
    herramientas: arr<unknown>(d.herramientas).map(normAsig),
  };
}

// Lista los departamentos del proyecto SINCRONIZANDO la lista con la estructura real:
//   · garantiza el carril "Administración" (transversal), y
//   · garantiza un carril por cada Unidad Comercial existente (derivado, no duplicado).
// Los departamentos admin extra los crea el usuario con crearDepartamento.
export async function listarDepartamentos(proyectoId: string): Promise<Departamento[]> {
  const [existentes, ucs] = await Promise.all([
    prisma.departamento.findMany({ where: { proyectoId } }),
    prisma.unidadComercial.findMany({ where: { proyectoId } }),
  ]);

  const creates: { id: string; proyectoId: string; nombre: string; tipo: string; ucId: string | null; orden: number; data: Prisma.InputJsonValue }[] = [];

  // Carril transversal de Administración (siempre presente, orden 0).
  if (!existentes.some((d) => d.tipo === 'admin')) {
    creates.push({ id: nid('DEP'), proyectoId, nombre: 'Administración', tipo: 'admin', ucId: null, orden: 0, data: toJson({ espacios: [], herramientas: [] }) });
  }
  // Un carril por UC (aparece/actualiza nombre automáticamente).
  let orden = Math.max(0, ...existentes.map((d) => d.orden)) + 1;
  for (const uc of ucs) {
    const ya = existentes.find((d) => d.ucId === uc.id);
    if (!ya) {
      creates.push({ id: nid('DEP'), proyectoId, nombre: uc.nombre, tipo: 'uc', ucId: uc.id, orden: orden++, data: toJson({ espacios: [], herramientas: [] }) });
    } else if (ya.nombre !== uc.nombre) {
      await prisma.departamento.update({ where: { id: ya.id }, data: { nombre: uc.nombre } });
    }
  }
  if (creates.length) await prisma.departamento.createMany({ data: creates });

  const rows = await prisma.departamento.findMany({ where: { proyectoId }, orderBy: { orden: 'asc' } });
  return rows.map(mapDepto);
}

export async function crearDepartamento(proyectoId: string, nombre: string): Promise<Departamento> {
  const max = await prisma.departamento.aggregate({ where: { proyectoId }, _max: { orden: true } });
  const id = nid('DEP');
  const orden = (max._max.orden ?? 0) + 1;
  await prisma.departamento.create({ data: { id, proyectoId, nombre: nombre.trim() || 'Departamento', tipo: 'admin', ucId: null, orden, data: toJson({ espacios: [], herramientas: [] }) } });
  return { id, nombre: nombre.trim() || 'Departamento', tipo: 'admin', orden, espacios: [], herramientas: [] };
}

export interface DepartamentoPatch {
  nombre?: string; color?: string; descripcion?: string; orden?: number;
  espacios?: AsignacionRecurso[]; herramientas?: AsignacionRecurso[];
}
export async function actualizarDepartamento(id: string, patch: DepartamentoPatch): Promise<void> {
  const r = await prisma.departamento.findUnique({ where: { id } }); if (!r) return;
  const d = obj(r.data);
  const data = { ...d } as Record<string, unknown>;
  if (patch.color !== undefined) data.color = patch.color;
  if (patch.descripcion !== undefined) data.descripcion = patch.descripcion;
  if (patch.espacios !== undefined) data.espacios = patch.espacios.map(normAsig);
  if (patch.herramientas !== undefined) data.herramientas = patch.herramientas.map(normAsig);
  await prisma.departamento.update({ where: { id }, data: {
    ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
    ...(patch.orden !== undefined ? { orden: patch.orden } : {}),
    data: toJson(data),
  } });
}

// Elimina un departamento admin extra. Sus procesos pasan al carril de Administración.
// Los carriles de UC no se eliminan aquí (viven ligados a la UC).
export async function eliminarDepartamento(id: string): Promise<void> {
  const r = await prisma.departamento.findUnique({ where: { id } }); if (!r || r.tipo === 'uc') return;
  const admin = await prisma.departamento.findFirst({ where: { proyectoId: r.proyectoId, tipo: 'admin', NOT: { id } }, orderBy: { orden: 'asc' } });
  if (admin) await prisma.proceso.updateMany({ where: { departamentoId: id }, data: { departamentoId: admin.id } });
  else await prisma.proceso.deleteMany({ where: { departamentoId: id } });
  await prisma.departamento.delete({ where: { id } });
}

// =================== PROCESOS ===================

function mapProceso(r: { id: string; departamentoId: string; nombre: string; fase: string; orden: number; data: unknown }): ProcesoNodo {
  const d = obj(r.data);
  const origen = obj(d.origen);
  return {
    id: r.id, departamentoId: r.departamentoId, nombre: r.nombre,
    fase: (['antes', 'durante', 'despues'].includes(r.fase) ? r.fase : 'durante') as FaseMapa,
    // Los procesos creados antes del eje de etapas nacen en la etapa base (retrocompatible).
    etapaDesde: etapa(d.etapaDesde, ETAPA_BASE)!,
    etapaHasta: etapa(d.etapaHasta),
    orden: r.orden,
    posX: num(d.posX),
    posY: num(d.posY),
    descripcion: str(d.descripcion) || undefined,
    roles: arr<unknown>(d.roles).map(str).filter(Boolean),
    herramientas: arr<unknown>(d.herramientas).map(str).filter(Boolean),
    insumos: arr<unknown>(d.insumos).map(str).filter(Boolean),
    espacios: arr<unknown>(d.espacios).map(normAsig),
    tiempoMin: num(d.tiempoMin),
    tiempoEstimado: d.tiempoEstimado === true ? true : undefined,
    entrada: str(d.entrada) || undefined,
    salida: str(d.salida) || undefined,
    instructivo: str(d.instructivo) || undefined,
    ramas: arr<unknown>(d.ramas).map(normRama),
    origen: (str(origen.ofertaId) && str(origen.pasoId)) ? { ofertaId: str(origen.ofertaId), pasoId: str(origen.pasoId) } : undefined,
  };
}

export async function listarProcesos(proyectoId: string): Promise<ProcesoNodo[]> {
  const rows = await prisma.proceso.findMany({ where: { proyectoId }, orderBy: { orden: 'asc' } });
  return rows.map(mapProceso);
}

export async function crearProceso(proyectoId: string, departamentoId: string, nombre: string, fase: FaseMapa, pos?: { x: number; y: number }, etapaDesde?: EtapaObjetivo): Promise<ProcesoNodo> {
  const max = await prisma.proceso.aggregate({ where: { proyectoId, fase }, _max: { orden: true } });
  const id = nid('PROC');
  const orden = (max._max.orden ?? 0) + 1;
  const posX = pos?.x ?? 40 + ((orden - 1) % 4) * 240;
  const posY = pos?.y ?? 40 + Math.floor((orden - 1) / 4) * 150;
  const et = etapa(etapaDesde, ETAPA_BASE)!;
  await prisma.proceso.create({ data: { id, proyectoId, departamentoId, nombre: nombre.trim() || 'Proceso', fase, orden, data: toJson({ posX, posY, etapaDesde: et, roles: [], herramientas: [], insumos: [], espacios: [], ramas: [] }) } });
  return { id, departamentoId, nombre: nombre.trim() || 'Proceso', fase, etapaDesde: et, orden, posX, posY, roles: [], herramientas: [], insumos: [], espacios: [], ramas: [] };
}

export interface ProcesoPatch {
  nombre?: string | undefined; descripcion?: string | undefined; roles?: string[] | undefined;
  herramientas?: string[] | undefined; insumos?: string[] | undefined; espacios?: AsignacionRecurso[] | undefined;
  tiempoMin?: number | undefined; entrada?: string | undefined; salida?: string | undefined;
  instructivo?: string | undefined; ramas?: Rama[] | undefined;
  posX?: number | undefined; posY?: number | undefined;
  departamentoId?: string | undefined; fase?: FaseMapa | undefined;
  etapaDesde?: EtapaObjetivo | undefined; etapaHasta?: EtapaObjetivo | null | undefined;
}
export async function actualizarProceso(id: string, patch: ProcesoPatch): Promise<void> {
  const r = await prisma.proceso.findUnique({ where: { id } }); if (!r) return;
  const d = obj(r.data);
  const data = { ...d } as Record<string, unknown>;
  if (patch.posX !== undefined) data.posX = patch.posX;
  if (patch.posY !== undefined) data.posY = patch.posY;
  if (patch.descripcion !== undefined) data.descripcion = patch.descripcion;
  if (patch.roles !== undefined) data.roles = patch.roles.map((x) => x.trim()).filter(Boolean);
  if (patch.herramientas !== undefined) data.herramientas = patch.herramientas.map((x) => x.trim()).filter(Boolean);
  if (patch.insumos !== undefined) data.insumos = patch.insumos.map((x) => x.trim()).filter(Boolean);
  if (patch.espacios !== undefined) data.espacios = patch.espacios.map(normAsig);
  // Editar el tiempo a mano lo convierte en declarado (deja de ser una estimación).
  if (patch.tiempoMin !== undefined) { data.tiempoMin = patch.tiempoMin; data.tiempoEstimado = false; }
  if (patch.entrada !== undefined) data.entrada = patch.entrada;
  if (patch.salida !== undefined) data.salida = patch.salida;
  if (patch.instructivo !== undefined) data.instructivo = patch.instructivo;
  if (patch.ramas !== undefined) data.ramas = patch.ramas.map(normRama);
  if (patch.etapaDesde !== undefined) data.etapaDesde = etapa(patch.etapaDesde, ETAPA_BASE);
  if (patch.etapaHasta !== undefined) data.etapaHasta = patch.etapaHasta === null ? undefined : etapa(patch.etapaHasta);
  await prisma.proceso.update({ where: { id }, data: {
    ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
    ...(patch.departamentoId !== undefined ? { departamentoId: patch.departamentoId } : {}),
    ...(patch.fase !== undefined ? { fase: patch.fase } : {}),
    data: toJson(data),
  } });
}

// Mueve un proceso a otro carril/fase/posición (drag & drop del mapa).
export async function moverProceso(id: string, departamentoId: string, fase: FaseMapa, orden: number): Promise<void> {
  await prisma.proceso.update({ where: { id }, data: { departamentoId, fase, orden } });
}

export async function eliminarProceso(id: string): Promise<void> {
  const r = await prisma.proceso.findUnique({ where: { id } }); if (!r) return;
  // Limpia las ramas de otros procesos que apuntaban a este.
  const hermanos = await prisma.proceso.findMany({ where: { proyectoId: r.proyectoId } });
  for (const h of hermanos) {
    if (h.id === id) continue;
    const d = obj(h.data);
    const ramas = arr<unknown>(d.ramas).map(normRama);
    if (ramas.some((x) => x.destinoProcesoId === id)) {
      const limpias = ramas.map((x) => x.destinoProcesoId === id ? { ...x, destinoProcesoId: undefined } : x);
      await prisma.proceso.update({ where: { id: h.id }, data: { data: toJson({ ...d, ramas: limpias }) } });
    }
  }
  await prisma.proceso.delete({ where: { id } });
}

// =================== SEMBRAR DESDE EL CATÁLOGO ===================
// Importa las rutas base de las Ofertas de cada UC como procesos del carril de esa UC.
// El catálogo ALIMENTA el mapa (no es requisito previo). Idempotente por origen{ofertaId,pasoId}.

const FASE_PASO_A_MAPA: Record<FasePaso, FaseMapa> = {
  aprovisionamiento: 'antes',
  produccion: 'durante',
  entrega: 'durante',
  postventa: 'despues',
};

// "Aguja 16G, pinza" → ["Aguja 16G", "pinza"]. Los campos legacy son texto libre.
function partirEtiquetas(txt: string): string[] {
  return txt.split(/[,;/]|\sy\s/).map((x) => x.trim()).filter(Boolean);
}

// Los procesos sembrados nacen en la etapa que se está viendo (por defecto, la base).
export async function importarRutasCatalogo(proyectoId: string, etapaDesde?: EtapaObjetivo): Promise<{ creados: number; omitidos: number }> {
  const etapaNace = etapa(etapaDesde, ETAPA_BASE)!;
  const [deptos, ofertas, procesos, espaciosReales] = await Promise.all([
    listarDepartamentos(proyectoId),
    prisma.oferta.findMany({ where: { proyectoId } }),
    listarProcesos(proyectoId),
    prisma.espacio.findMany({ where: { proyectoId } }),
  ]);
  // Índice nombre→id para enlazar el "lugar" del paso con el Espacio real del plano.
  const espacioPorNombre = new Map(espaciosReales.map((e) => [e.nombre.trim().toLowerCase(), e.id]));
  const refEspacio = (lugar: string): string | undefined => espacioPorNombre.get(lugar.trim().toLowerCase());
  const yaImportados = new Set(procesos.filter((p) => p.origen).map((p) => `${p.origen!.ofertaId}:${p.origen!.pasoId}`));
  const ordenPorCelda = new Map<string, number>();
  for (const p of procesos) {
    const k = `${p.departamentoId}:${p.fase}`;
    ordenPorCelda.set(k, Math.max(ordenPorCelda.get(k) ?? 0, p.orden));
  }

  let creados = 0, omitidos = 0;
  let fila = 0; // una fila del canvas por oferta
  for (const of of ofertas) {
    const depto = deptos.find((d) => d.ucId === of.ucId);
    if (!depto) continue;
    const d = obj(of.data);
    const rutaBase = arr<unknown>(d.rutaBase).map(obj);
    let anteriorId: string | null = null;
    const colPorFase = new Map<string, number>(); // columna por fase (cadena horizontal)
    let creoAlguno = false;
    for (const paso of rutaBase) {
      const pasoId = str(paso.id); if (!pasoId) continue;
      const k = `${of.id}:${pasoId}`;
      if (yaImportados.has(k)) { omitidos++; anteriorId = null; continue; }
      const fase = FASE_PASO_A_MAPA[(str(paso.fase) || 'produccion') as FasePaso] ?? 'durante';
      const celda = `${depto.id}:${fase}`;
      const orden = (ordenPorCelda.get(celda) ?? 0) + 1;
      ordenPorCelda.set(celda, orden);
      const col = colPorFase.get(fase) ?? 0;
      colPorFase.set(fase, col + 1);
      const posX = 40 + col * 240;
      const posY = 40 + fila * 160;
      creoAlguno = true;
      const id = nid('PROC');
      // Los pasos viejos guardan `rol`/`herramientas` como TEXTO (campos LEGACY de
      // domain/oferta.ts, previos a la migración a etiquetas). Si solo existen esos,
      // se usan — si no, el import los tiraría en silencio.
      const roles = arr<unknown>(paso.roles).map(str).filter(Boolean);
      if (!roles.length && str(paso.rol)) roles.push(...partirEtiquetas(str(paso.rol)));
      const herrs = arr<unknown>(paso.herramientasTags).map(str).filter(Boolean);
      if (!herrs.length && str(paso.herramientas)) herrs.push(...partirEtiquetas(str(paso.herramientas)));
      // Insumos = lo que se consume. Vienen como [{item, cantidad}] y nadie los llevaba al mapa.
      const insumos = arr<unknown>(paso.insumos).map((i) => {
        const o = obj(i);
        const item = str(o.item);
        const cant = num(o.cantidad);
        return item ? (cant && cant > 1 ? `${cant}× ${item}` : item) : '';
      }).filter(Boolean);
      const lugar = str(paso.lugar);
      await prisma.proceso.create({ data: {
        id, proyectoId, departamentoId: depto.id, nombre: str(paso.nombre) || 'Paso', fase, orden,
        data: toJson({
          posX, posY,
          etapaDesde: etapaNace,
          descripcion: `De la oferta "${of.nombre}"`,
          roles, herramientas: herrs, insumos,
          // Si el lugar coincide con un Espacio real del plano, se guarda la REFERENCIA:
          // ese es el vínculo proceso↔geometría que necesitan las verificaciones y la simulación.
          espacios: lugar ? [{ ...(refEspacio(lugar) ? { ref: refEspacio(lugar) } : {}), nombre: lugar }] : [],
          tiempoMin: num(paso.tiempoMin),
          entrada: str(paso.entrada) || undefined,
          salida: str(paso.salida) || undefined,
          instructivo: str(paso.manual) || undefined,
          ramas: [],
          origen: { ofertaId: of.id, pasoId },
        }),
      } });
      // Encadena secuencialmente los pasos de la misma oferta (flujo visible).
      if (anteriorId) {
        const ant = await prisma.proceso.findUnique({ where: { id: anteriorId } });
        if (ant) {
          const ad = obj(ant.data);
          const ramas = [...arr<unknown>(ad.ramas).map(normRama), { id: nid('RAMA'), evento: 'continúa', destinoProcesoId: id }];
          await prisma.proceso.update({ where: { id: anteriorId }, data: { data: toJson({ ...ad, ramas }) } });
        }
      }
      anteriorId = id;
      creados++;
    }
    if (creoAlguno) fila++;
  }
  return { creados, omitidos };
}

// =================== RESCATE DE DURACIONES DEL CATÁLOGO ===================
// Los catálogos cargados traen el tiempo del servicio como TEXTO en los atributos de
// cada presentación ("10–20 min"), dato que nadie interpretaba. Esto lo estructura y lo
// baja a los pasos de la ruta, que es lo que la simulación necesita.
// El tiempo de la presentación es del SERVICIO COMPLETO: se reparte entre los pasos que
// no declaran tiempo propio, y eso queda marcado como estimado (`tiempoEstimado`).

export interface ResultadoDuraciones {
  presentaciones: number;      // cuántas tenían tiempo interpretable
  sinInterpretar: string[];    // textos que no se pudieron leer (para revisarlos)
  procesosActualizados: number;
}

export async function rescatarDuraciones(proyectoId: string): Promise<ResultadoDuraciones> {
  const [ofertas, presentaciones, procesos] = await Promise.all([
    prisma.oferta.findMany({ where: { proyectoId } }),
    prisma.presentacion.findMany({ where: { proyectoId } }),
    listarProcesos(proyectoId),
  ]);

  // Duración típica por oferta = promedio de las duraciones de sus presentaciones.
  const porOferta = new Map<string, number[]>();
  const sinInterpretar: string[] = [];
  let conTiempo = 0;

  for (const p of presentaciones) {
    const d = obj(p.data);
    const atributos = obj(d.atributos);
    const txt = str(atributos.tiempo) || str(atributos.time);
    if (!txt) continue;
    const dur = parseDuracion(txt);
    if (!dur) { if (!sinInterpretar.includes(txt)) sinInterpretar.push(txt); continue; }
    conTiempo++;
    // Se guarda estructurado en la propia presentación (rango completo, no solo el promedio).
    await prisma.presentacion.update({ where: { id: p.id }, data: {
      data: toJson({ ...d, duracion: { min: dur.min, max: dur.max, prom: dur.prom } }),
    } });
    const arr = porOferta.get(p.ofertaId) ?? [];
    arr.push(dur.prom);
    porOferta.set(p.ofertaId, arr);
  }

  // Baja el total del servicio a los pasos de la ruta de cada oferta.
  let procesosActualizados = 0;
  for (const of of ofertas) {
    const proms = porOferta.get(of.id);
    if (!proms?.length) continue;
    const totalServicio = proms.reduce((s, v) => s + v, 0) / proms.length;

    // Procesos del mapa sembrados desde ESTA oferta, en el orden de la ruta.
    const rutaBase = arr<unknown>(obj(of.data).rutaBase).map(obj);
    const ordenPaso = new Map(rutaBase.map((p, i) => [str(p.id), i]));
    const suyos = procesos
      .filter((p) => p.origen?.ofertaId === of.id)
      .sort((a, b) => (ordenPaso.get(a.origen!.pasoId) ?? 0) - (ordenPaso.get(b.origen!.pasoId) ?? 0));
    if (!suyos.length) continue;

    const reparto = repartirDuracion(totalServicio, suyos.map((p) => ({ tiempoMin: p.tiempoMin })));
    for (let i = 0; i < suyos.length; i++) {
      const p = suyos[i]!, nuevo = reparto[i] ?? 0;
      if (p.tiempoMin || !nuevo) continue;            // no pisa un tiempo ya declarado
      const r = await prisma.proceso.findUnique({ where: { id: p.id } });
      if (!r) continue;
      await prisma.proceso.update({ where: { id: p.id }, data: {
        // `tiempoEstimado` distingue lo repartido de lo que el usuario declaró de verdad.
        data: toJson({ ...obj(r.data), tiempoMin: nuevo, tiempoEstimado: true }),
      } });
      procesosActualizados++;
    }
  }

  return { presentaciones: conTiempo, sinInterpretar, procesosActualizados };
}

// =================== RECURSOS DISPONIBLES (para asignar / "crear y volver") ===================
// Espacios reales del plano/render + roles del maestro Personas + herramientas
// (maestro 'herramientas' + objetos físicos ya dibujados en el render).

export interface RecursosProyecto {
  espacios: { id: string; nombre: string; sedeNombre: string }[];
  roles: string[];
  herramientas: string[];
}

export async function listarRecursosProyecto(proyectoId: string): Promise<RecursosProyecto> {
  const [sedes, espacios, objetos, tPersonas, tHerr] = await Promise.all([
    prisma.sede.findMany({ where: { proyectoId } }),
    prisma.espacio.findMany({ where: { proyectoId } }),
    prisma.objetoFisico.findMany({ where: { proyectoId } }),
    prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef: 'personas' } } }),
    prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef: 'herramientas' } } }),
  ]);
  const sedeNombre = new Map(sedes.map((s) => [s.id, s.nombre]));
  const roles = (tPersonas && Array.isArray(tPersonas.filas) ? tPersonas.filas as Record<string, unknown>[] : [])
    .map((f) => str(f.rol)).filter(Boolean);
  const herrMaestro = (tHerr && Array.isArray(tHerr.filas) ? tHerr.filas as Record<string, unknown>[] : [])
    .map((f) => str(f.nombre)).filter(Boolean);
  const herrObjetos = objetos.map((o) => o.nombre).filter(Boolean);
  const herramientas = [...new Set([...herrMaestro, ...herrObjetos])];
  return {
    espacios: espacios.map((e) => ({ id: e.id, nombre: e.nombre, sedeNombre: sedeNombre.get(e.sedeId) ?? '' })),
    roles: [...new Set(roles)],
    herramientas,
  };
}

// "Crear y volver": alta rápida de un rol o herramienta al maestro, sin salir del mapa.
export async function crearRolMaestro(proyectoId: string, rol: string): Promise<void> {
  const rolT = rol.trim(); if (!rolT) return;
  const t = await prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef: 'personas' } } });
  const filas = (t && Array.isArray(t.filas) ? t.filas as Record<string, unknown>[] : []).map((f) => ({ ...f }));
  if (filas.some((f) => str(f.rol).toLowerCase() === rolT.toLowerCase())) return;
  filas.push({ rol: rolT, persona: '' });
  const now = new Date().toISOString();
  await prisma.tablaProyecto.upsert({
    where: { proyectoId_tablaRef: { proyectoId, tablaRef: 'personas' } },
    create: { proyectoId, tablaRef: 'personas', filas: toJson(filas), actualizadoEn: now },
    update: { filas: toJson(filas), actualizadoEn: now },
  });
}

export async function crearHerramientaMaestro(proyectoId: string, nombre: string): Promise<void> {
  const n = nombre.trim(); if (!n) return;
  const t = await prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef: 'herramientas' } } });
  const filas = (t && Array.isArray(t.filas) ? t.filas as Record<string, unknown>[] : []).map((f) => ({ ...f }));
  if (filas.some((f) => str(f.nombre).toLowerCase() === n.toLowerCase())) return;
  filas.push({ nombre: n });
  const now = new Date().toISOString();
  await prisma.tablaProyecto.upsert({
    where: { proyectoId_tablaRef: { proyectoId, tablaRef: 'herramientas' } },
    create: { proyectoId, tablaRef: 'herramientas', filas: toJson(filas), actualizadoEn: now },
    update: { filas: toJson(filas), actualizadoEn: now },
  });
}
