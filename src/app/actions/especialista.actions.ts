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
import { PAQUETES, paquete } from '@/domain/entregables';
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
import { normalizarCatalogo } from '@/domain/mkt-catalogo';
import type { CatalogoMkt } from '@/domain/mkt-catalogo';
import { ambientesDeEspacios, procesosDeMapa, personasDeSuperficies, puestosDeEmpleados, costosDeRecursos, costosDeProductos, costosDeEmbarques, componentesDeEquipo, componentesDeAutomatizacion, agentesDeProcesos, proveedoresATabla, ingresosDeOfertas, kpisDeProcesos, legalesDeContratos, legalesDeEmpleados, unidadesDeUCs, rondasDeRuta } from '@/domain/proyeccion';
import { listarSedes, listarEspacios } from '@/app/actions/espacios.actions';
import { listarProcesos, listarContingencias } from '@/app/actions/mapa.actions';
import { simularEmpresa, SUPUESTOS_DEFAULT } from '@/domain/simulacion-empresa';
import type { SupuestosSim, ReporteSimulacion } from '@/domain/simulacion-empresa';
import { listarEmpleados } from '@/app/actions/rh.actions';
import { listarRecursos, listarProveedores, listarProductos, listarVinculos, listarEmbarques, listarContratos } from '@/app/actions/recursos.actions';

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
  let productos: Awaited<ReturnType<typeof listarProductos>> | null = null;
  let vinculos: Awaited<ReturnType<typeof listarVinculos>> | null = null;
  const getRecursos = async () => { if (!recursos) recursos = await listarRecursos(proyectoId); return recursos; };
  const getProveedores = async () => { if (!proveedores) proveedores = await listarProveedores(proyectoId); return proveedores; };
  const getProductos = async () => { if (!productos) productos = await listarProductos(proyectoId); return productos; };
  const getVinculos = async () => { if (!vinculos) vinculos = await listarVinculos(proyectoId); return vinculos; };
  let embarques: Awaited<ReturnType<typeof listarEmbarques>> | null = null;
  const getEmbarques = async () => { if (!embarques) embarques = await listarEmbarques(proyectoId); return embarques; };
  let contratos: Awaited<ReturnType<typeof listarContratos>> | null = null;
  const getContratos = async () => { if (!contratos) contratos = await listarContratos(proyectoId); return contratos; };
  // Ofertas (fuentes de ingreso) y Unidades Comerciales, con el nombre de su UC.
  // El precio de una Oferta es un RANGO derivado de sus Presentaciones (SKUs): así el plano
  // Financiero muestra "$400–$700" en vez de PENDIENTE cuando el catálogo ya está tarifado.
  let ofertas: { nombre: string; centro: string; precio?: string }[] | null = null;
  const getOfertas = async () => {
    if (!ofertas) {
      const [ofs, ucs, pres] = await Promise.all([
        prisma.oferta.findMany({ where: { proyectoId } }),
        prisma.unidadComercial.findMany({ where: { proyectoId } }),
        prisma.presentacion.findMany({ where: { proyectoId } }),
      ]);
      const ucNombre = new Map(ucs.map((u) => [u.id, u.nombre]));
      const preciosPorOferta = new Map<string, number[]>();
      for (const p of pres) {
        const raw = (p.data as Record<string, unknown> | null)?.precio;
        const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/[^0-9.]/g, ''));
        if (Number.isFinite(n) && n > 0) { const arr = preciosPorOferta.get(p.ofertaId) ?? []; arr.push(n); preciosPorOferta.set(p.ofertaId, arr); }
      }
      const rango = (id: string): string | undefined => {
        const arr = preciosPorOferta.get(id);
        if (!arr || !arr.length) return undefined;
        const min = Math.min(...arr), max = Math.max(...arr);
        const fmt = (v: number) => `$${v.toLocaleString('es-MX')}`;
        return min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
      };
      const dataPrecio = (o: { data: unknown }) => { const v = (o.data as Record<string, unknown> | null)?.precio; return typeof v === 'string' && v.trim() ? v : undefined; };
      ofertas = ofs.map((o) => { const precio = dataPrecio(o) ?? rango(o.id); return { nombre: o.nombre, centro: ucNombre.get(o.ucId) ?? '', ...(precio ? { precio } : {}) }; });
    }
    return ofertas!;
  };
  let ucs: { nombre: string }[] | null = null;
  const getUCs = async () => { if (!ucs) ucs = (await prisma.unidadComercial.findMany({ where: { proyectoId } })).map((u) => ({ nombre: u.nombre })); return ucs; };
  let etapaObj: string | undefined | null = null;
  const getEtapaObjetivo = async () => { if (etapaObj === null) etapaObj = (await obtenerProyectoBase(proyectoId))?.etapaObjetivo; return etapaObj; };
  if (refs.has('ambientes')) out['ambientes'] = ambientesDeEspacios(await getEspacios());
  if (refs.has('procesos')) out['procesos'] = procesosDeMapa(await getProcesos());
  if (refs.has('puestos')) out['puestos'] = puestosDeEmpleados(await getEmpleados());
  if (refs.has('personas')) out['personas'] = personasDeSuperficies(await getEspacios(), await getProcesos(), await getEmpleados());
  // Financiero = activos/obra (Recursos) + insumos recurrentes (Productos), sin duplicar el ítem.
  if (refs.has('costos')) out['costos'] = [...costosDeRecursos(await getRecursos()), ...costosDeProductos(await getProductos(), await getVinculos()), ...costosDeEmbarques(await getEmbarques())];
  // Componentes técnicos = inventario de equipo (Recursos) + automatizaciones n8n/software (Mapa).
  if (refs.has('componentes')) out['componentes'] = [...componentesDeEquipo(await getRecursos()), ...componentesDeAutomatizacion(await getProcesos())];
  // Fichas de agente = procesos que el Organizador (IA) decidió automatizar con IA.
  if (refs.has('agentes')) out['agentes'] = agentesDeProcesos(await getProcesos());
  if (refs.has('proveedores')) out['proveedores'] = proveedoresATabla(await getProveedores());
  // Proyecciones nuevas: ingresos (FIN) · kpis (CTR) · legales (JUR) · unidades (ESC).
  if (refs.has('ingresos')) out['ingresos'] = ingresosDeOfertas(await getOfertas());
  if (refs.has('kpis')) out['kpis'] = kpisDeProcesos(await getProcesos());
  // Jurídico = contratos del abastecimiento + contrato laboral/alta fiscal por persona interna.
  if (refs.has('legales')) out['legales'] = [...legalesDeContratos(await getContratos()), ...legalesDeEmpleados(await getEmpleados())];
  if (refs.has('unidades')) out['unidades'] = unidadesDeUCs(await getUCs());
  // Inversionista = tramos de inversión derivados de la ruta de etapas (estrategia).
  if (refs.has('rondas')) out['rondas'] = rondasDeRuta(await getEtapaObjetivo());
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
export interface TablaResumen { tablaRef: string; etiqueta: string; columnas: Columna[]; filas: Fila[]; manuales: Fila[]; derivadas: Fila[]; llave: string; disparadorCSV: number; proyectadas: number }
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
    tablas.push({ tablaRef: ref, etiqueta: bloque.tabla!.etiqueta ?? TABLAS_BASE[ref]?.nombre ?? ref, columnas, filas, manuales, derivadas, llave: TABLAS_BASE[ref]?.llave ?? 'id', disparadorCSV: bloque.tabla!.disparadorCSV, proyectadas: derivadas.length });
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

// --- GENERACIÓN DE ENTREGABLES: empaqueta los documentos de un grupo de planos ---
// Concatena los documentos (generarDocumentoDePlano) de los planos de un paquete en un solo
// Markdown con portada y resumen de completitud. Es el "payoff": la configuración inicial
// empaquetada por audiencia (ver manual PARTE II.6). No inventa: hereda los ⚠ PENDIENTE.
export interface DocumentoPaquete {
  paqueteId: string;
  titulo: string;
  markup: string;
  pendientes: number;
  totalRequerido: number;
  planos: { planoId: string; nombre: string; pendientes: number; total: number }[];
}
// Catálogo de Marketing anidado (árbol producto→campaña→formato→guion/minuta). Vive como
// árbol JSON en TablaProyecto 'mkt_catalogo'; es aditivo y NO altera la tabla plana 'campanas'.
export async function obtenerCatalogoMkt(proyectoId: string): Promise<CatalogoMkt> {
  const r = await prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef: 'mkt_catalogo' } } });
  return normalizarCatalogo(r?.filas ?? []);
}

// Paquete DETALLADO (para la vista de libro estilizada): metadatos + el DetallePlano de cada
// plano del paquete (campos + tablas completas), listo para rendir con índice y docs anidados.
// Los paquetes que incluyen Marketing ('marketing' y 'maestro') además traen el catálogo
// anidado para rendirlo en cascada.
export interface PaqueteDetalladoDTO {
  paqueteId: string; nombre: string; icono: string; descripcion: string; empresa: string;
  planos: NonNullable<Awaited<ReturnType<typeof obtenerDetallePlano>>>[];
  catalogoMkt?: CatalogoMkt | undefined;
}
export async function obtenerPaqueteDetallado(proyectoId: string, paqueteId: string): Promise<PaqueteDetalladoDTO | null> {
  const pq = paquete(paqueteId);
  const det = await obtenerProyecto(proyectoId);
  if (!pq || !det) return null;
  const planos: PaqueteDetalladoDTO['planos'] = [];
  for (const planoId of pq.planos) {
    if (!especialista(planoId)) continue;
    const d = await obtenerDetallePlano(proyectoId, planoId);
    if (d) planos.push(d);
  }
  const incluyeMkt = pq.planos.includes('MKT');
  const catalogoMkt = incluyeMkt ? await obtenerCatalogoMkt(proyectoId) : undefined;
  return { paqueteId, nombre: pq.nombre, icono: pq.icono, descripcion: pq.descripcion, empresa: det.nombre, planos, catalogoMkt };
}

export async function generarPaqueteEntregables(proyectoId: string, paqueteId: string): Promise<DocumentoPaquete | null> {
  const pq = paquete(paqueteId);
  const det = await obtenerProyecto(proyectoId);
  if (!pq || !det) return null;
  const partes: string[] = [];
  const planos: DocumentoPaquete['planos'] = [];
  let pendientes = 0, totalRequerido = 0;
  for (const planoId of pq.planos) {
    if (!especialista(planoId)) continue;
    const doc = await generarDocumentoDePlano(proyectoId, planoId);
    if (!doc) continue;
    planos.push({ planoId, nombre: PLANOS_MAESTROS[planoId] ?? planoId, pendientes: doc.pendientes, total: doc.totalRequerido });
    pendientes += doc.pendientes; totalRequerido += doc.totalRequerido;
    partes.push(`\n\n---\n\n${doc.markup}`);
  }
  const listo = totalRequerido > 0 ? Math.round((1 - pendientes / totalRequerido) * 100) : 100;
  const portada = [
    `# ${pq.icono} ${pq.nombre}`,
    `**Empresa:** ${det.nombre}`,
    `**Paquete:** ${pq.descripcion}`,
    `**Planos incluidos (${planos.length}):** ${planos.map((p) => p.nombre).join(' · ')}`,
    `**Completitud:** ${listo}% · **${pendientes}** pendientes de **${totalRequerido}** requeridos.`,
    planos.length ? `\n| Plano | Pendientes | Requeridos |\n|---|---|---|\n${planos.map((p) => `| ${p.nombre} | ${p.pendientes} | ${p.total} |`).join('\n')}` : '',
  ].join('\n\n');
  return { paqueteId, titulo: pq.nombre, markup: portada + partes.join(''), pendientes, totalRequerido, planos };
}

// --- SIMULACIÓN EMPRESARIAL: valida la lógica del negocio antes de publicar ---
export type { ReporteSimulacion } from '@/domain/simulacion-empresa';
export async function simularEmpresaProyecto(proyectoId: string, supuestos?: Partial<SupuestosSim>): Promise<ReporteSimulacion> {
  const [procesos, productos, proveedores, empleados, contingencias, ingresosT, costosT] = await Promise.all([
    listarProcesos(proyectoId), listarProductos(proyectoId), listarProveedores(proyectoId), listarEmpleados(proyectoId),
    listarContingencias(proyectoId),
    prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef: 'ingresos' } } }),
    prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef: 'costos' } } }),
  ]);
  const filasDe = (t: { filas: unknown } | null) => (t && Array.isArray(t.filas) ? t.filas as Record<string, string>[] : []);
  const ofertas = filasDe(ingresosT).map((f) => ({ nombre: f.fuente ?? '', precio: f.precio ?? '' }));
  const costos = filasDe(costosT).map((f) => ({ concepto: f.concepto ?? '', monto: f.monto ?? '' }));
  const sup: SupuestosSim = { ...SUPUESTOS_DEFAULT, ...(supuestos ?? {}) };
  return simularEmpresa({ procesos, productos, empleados, ofertas, costos, proveedores, contingencias: contingencias.length }, sup);
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

// --- Edición inline de filas MANUALES de una tabla (sin CSV) ---
// Reemplaza la capa manual de la tabla (las derivadas de superficies NO se tocan: se
// fusionan al leer). Filtra filas totalmente vacías. Guarda desde la Vista de Plano.
export async function guardarFilasTabla(proyectoId: string, tablaRef: string, filas: Fila[]): Promise<void> {
  const limpias = (filas ?? []).filter((f) => Object.values(f).some((v) => String(v ?? '').trim()));
  await prisma.tablaProyecto.upsert({
    where: { proyectoId_tablaRef: { proyectoId, tablaRef } },
    create: { proyectoId, tablaRef, filas: toJson(limpias), actualizadoEn: nowISO() },
    update: { filas: toJson(limpias), actualizadoEn: nowISO() },
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
