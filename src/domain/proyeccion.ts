// PROYECCIÓN de superficies → planos (ADITIVO). El corazón de "sin repetir datos":
// lo que capturas en Sedes & Espacios o en el Mapa Operativo NO se re-teclea en el plano —
// se PROYECTA como filas de la tabla maestra que el plano lee. Un espacio real se vuelve un
// "ambiente" del plano Arquitectónico; un nodo del Mapa se vuelve un "proceso" del plano de
// Procesos; los roles asignados a espacios/procesos se vuelven "personas" de ORG/OPE.
//
// Funciones puras (sin IO). El agregador que carga las superficies vive en la capa de actions.

import type { Fila } from './plano-doc';
import type { Empleado } from './rh';
import type { Automatizacion } from './mapa';
import type { Recurso, Proveedor, Producto, ProductoProveedor, Embarque, Contrato } from './recursos';
import { ETAPAS_OBJETIVO } from './etapas';
import { subtotalRecurso, formatoMoneda, categoriaRecurso, numero, proveedorMasBarato, precioVigente, costoLogisticoEmbarque } from './recursos';

// ---------- Registro declarativo: qué planos enriquece cada superficie (para UI) ----------
export type Superficie = 'sedes' | 'mapa' | 'uc' | 'personas' | 'recursos';

export interface Aporte {
  planoId: string;
  tablaRef?: string | undefined;  // si el aporte proyecta filas de una tabla maestra
  nota: string;                   // cómo enriquece (texto para la UI)
}

export const ENRIQUECE: Record<Superficie, Aporte[]> = {
  sedes: [
    { planoId: 'ARQ', tablaRef: 'ambientes', nota: 'cada espacio → un ambiente (distribución y flujo)' },
    { planoId: 'ORG', tablaRef: 'personas', nota: 'roles con acceso / responsables por espacio' },
    { planoId: 'PRO', nota: 'dónde ocurre cada proceso' },
    { planoId: 'OPE', nota: 'espacios y ejecutores por etapa' },
    { planoId: 'FIN', nota: 'costos y mantenimiento por espacio/objeto' },
  ],
  mapa: [
    { planoId: 'PRO', tablaRef: 'procesos', nota: 'cada nodo → un proceso con entrada/salida/responsable' },
    { planoId: 'ORG', tablaRef: 'personas', nota: 'roles que ejecutan cada proceso' },
    { planoId: 'OPE', nota: 'ciclo, ejecutores y handoffs' },
    { planoId: 'CTR', tablaRef: 'kpis', nota: 'tiempo de cada proceso → KPI (dueño = sus roles)' },
    { planoId: 'IA', tablaRef: 'agentes', nota: 'procesos automatizados con IA → fichas de agente' },
    { planoId: 'TEC', tablaRef: 'componentes', nota: 'automatizaciones (n8n/software) → componentes técnicos' },
  ],
  uc: [
    { planoId: 'COM', nota: 'catálogo y oferta de la unidad' },
    { planoId: 'MKT', nota: 'campañas por unidad' },
    { planoId: 'FIN', tablaRef: 'ingresos', nota: 'cada oferta/unidad → una fuente de ingreso' },
    { planoId: 'ESC', tablaRef: 'unidades', nota: 'cada unidad comercial → una unidad de escala replicable' },
  ],
  personas: [
    { planoId: 'RH', tablaRef: 'puestos', nota: 'cada persona → puesto, competencias, KPIs, nómina' },
    { planoId: 'ORG', tablaRef: 'personas', nota: 'roles y jerarquía por persona' },
    { planoId: 'OPE', nota: 'ejecutores por proceso' },
    { planoId: 'FIN', nota: 'nómina y costo del personal' },
    { planoId: 'JUR', tablaRef: 'legales', nota: 'contrato laboral y alta fiscal por persona interna' },
  ],
  recursos: [
    { planoId: 'FIN', tablaRef: 'costos', nota: 'costo de insumos, herramientas, equipo y muebles' },
    { planoId: 'TEC', tablaRef: 'componentes', nota: 'inventario de equipo / tecnología' },
    { planoId: 'COM', tablaRef: 'proveedores', nota: 'proveedores de todo' },
    { planoId: 'JUR', tablaRef: 'legales', nota: 'cada contrato de proveedor → un documento legal' },
  ],
};

export const LABEL_SUPERFICIE: Record<Superficie, string> = {
  sedes: 'Sedes & Espacios', mapa: 'Mapa Operativo', uc: 'Unidad Comercial', personas: 'Personas & RH', recursos: 'Recursos & Proveedores',
};

// Inverso: qué superficies alimentan un plano dado (para la vista del plano).
export function superficiesDePlano(planoId: string): { superficie: Superficie; nota: string }[] {
  const out: { superficie: Superficie; nota: string }[] = [];
  for (const s of Object.keys(ENRIQUECE) as Superficie[]) {
    for (const a of ENRIQUECE[s]) if (a.planoId === planoId) out.push({ superficie: s, nota: a.nota });
  }
  return out;
}

// ---------- Formas mínimas de las superficies (subconjunto de los tipos reales) ----------
export interface EspacioSrc {
  nombre: string; tipo: string; ancho: number; alto: number; data: Record<string, string>;
}
export interface ProcesoSrc {
  nombre: string; entrada?: string | undefined; salida?: string | undefined;
  roles: string[]; tiempoMin?: number | undefined; padreProcesoId?: string | undefined;
  automatizacion?: Automatizacion | undefined;
}

// Divide un campo "Rol1, Rol2 / Rol3" en roles individuales.
function partirRoles(txt: string | undefined): string[] {
  return (txt ?? '').split(/[,;/]+|\by\b/).map((s) => s.trim()).filter(Boolean);
}

// ---------- Proyecciones ----------

// Espacios reales → filas de `ambientes` (plano Arquitectónico). Solo cuartos/áreas reales.
export function ambientesDeEspacios(espacios: EspacioSrc[]): Fila[] {
  return espacios
    .filter((e) => e.tipo === 'area' || e.tipo === 'habitacion')
    .map((e): Fila => ({
      ambiente: e.nombre,
      objetivo: e.data['uso'] || e.data['proc_proceso'] || '',
      adyacencias: '',
      m2: e.ancho > 0 && e.alto > 0 ? String(Math.round(e.ancho * e.alto)) : '',
      requisitos: e.data['fin_mantenimiento'] || e.data['tec_herramienta'] || '',
    }));
}

// Nodos del Mapa Operativo → filas de `procesos` (plano de Procesos). Solo nivel raíz:
// los subprocesos (subflujos dentro de un paso) son el detalle, no procesos de primer nivel.
export function procesosDeMapa(procesos: ProcesoSrc[]): Fila[] {
  return procesos.filter((p) => !p.padreProcesoId).map((p): Fila => ({
    proceso: p.nombre,
    entrada: p.entrada ?? '',
    salida: p.salida ?? '',
    responsable: p.roles.join(', '),
    estados: '',
  }));
}

// Roles asignados en espacios (lente Roles/Procesos) + en procesos + el roster de RH →
// filas de `personas` (planos ORG/OPE). Dedup por nombre de rol.
export function personasDeSuperficies(espacios: EspacioSrc[], procesos: ProcesoSrc[], empleados: Empleado[] = []): Fila[] {
  const map = new Map<string, Fila>();
  const add = (rol: string, area: string, persona = '') => {
    const key = rol.toLowerCase();
    if (rol && !map.has(key)) map.set(key, { rol, persona, area, reportaA: '' });
  };
  for (const e of empleados) {
    if (e.puesto) add(e.puesto, e.departamento, e.nombre);
    for (const rol of e.roles) add(rol, e.departamento, e.nombre);
  }
  for (const e of espacios) {
    for (const campo of ['org_responsable', 'proc_rol', 'org_acceso'] as const) {
      for (const rol of partirRoles(e.data[campo])) add(rol, e.nombre);
    }
  }
  for (const p of procesos) for (const rol of p.roles) add(rol, p.nombre);
  return Array.from(map.values());
}

// Roster de RH → filas de `puestos` (plano de Recursos Humanos). Dedup por puesto:
// varias personas con el mismo puesto = una descripción de puesto, con sus personas.
interface PuestoAgg { puesto: string; mision: string; reportaA: string; competencias: string; kpis: string; personas: string[] }
export function puestosDeEmpleados(empleados: Empleado[]): Fila[] {
  const map = new Map<string, PuestoAgg>();
  for (const e of empleados) {
    const puesto = e.puesto.trim();
    if (!puesto) continue;
    const key = puesto.toLowerCase();
    const prev = map.get(key);
    if (prev) {
      if (e.nombre) prev.personas.push(e.nombre);
    } else {
      map.set(key, {
        puesto, mision: e.responsabilidades, reportaA: e.departamento,
        competencias: e.competencias.join(', '), kpis: e.kpis,
        personas: e.nombre ? [e.nombre] : [],
      });
    }
  }
  return Array.from(map.values()).map((r): Fila => ({
    puesto: r.puesto, mision: r.mision, reportaA: r.reportaA,
    competencias: r.competencias, kpis: r.kpis, ocupantes: r.personas.join(', '),
  }));
}

// Recursos con costo → filas de `costos` (plano Financiero). Monto = costo × cantidad.
export function costosDeRecursos(recursos: Recurso[]): Fila[] {
  return recursos.filter((r) => r.nombre.trim()).map((r): Fila => {
    const sub = subtotalRecurso(r);
    const cant = r.cantidad ? ` (${r.cantidad}${r.unidad ? ' ' + r.unidad : ''})` : '';
    return {
      concepto: r.nombre + cant,
      tipo: 'costo',
      centro: r.grupo || categoriaRecurso(r.categoria).label,
      monto: sub !== null ? formatoMoneda(sub) : (r.costo || 'PENDIENTE'),
    };
  });
}

// Productos (insumos recurrentes) → filas de `costos` (plano Financiero) = costo de suministro.
// Monto = precio vigente (del proveedor más barato) × consumo mensual → costo recurrente al mes.
// Es la contraparte de costosDeRecursos (que cubre activos/obra); juntos, sin duplicar el ítem.
export function costosDeProductos(productos: Producto[], vinculos: ProductoProveedor[]): Fila[] {
  return productos.filter((p) => p.nombre.trim()).map((p): Fila => {
    const barato = proveedorMasBarato(vinculos, p.id);
    const precio = barato ? numero(precioVigente(barato)) : null;
    const consumo = numero(p.consumoMensual);
    const monto = precio !== null && consumo !== null ? precio * consumo : precio;
    return {
      concepto: p.nombre + (consumo !== null ? ` (${consumo}${p.unidad ? ' ' + p.unidad : ''}/mes)` : ''),
      tipo: 'costo recurrente',
      centro: p.categoria || 'Insumos',
      monto: monto !== null ? formatoMoneda(monto) : 'PENDIENTE',
    };
  });
}

// Embarques → filas de `costos` (plano Financiero) = costo LOGÍSTICO (flete/seguro/aduana…).
// Es la parte del landed cost que no es el precio del producto: el costo de traer la mercancía.
export function costosDeEmbarques(embarques: Embarque[]): Fila[] {
  return embarques.map((e) => ({ e, log: costoLogisticoEmbarque(e) })).filter((x) => x.log > 0).map(({ e, log }): Fila => ({
    concepto: `Logística ${e.folio || e.destino || 'embarque'}${e.transportista ? ` · ${e.transportista}` : ''}`,
    tipo: 'costo logístico',
    centro: 'Logística',
    monto: formatoMoneda(log),
  }));
}

// Equipo del catálogo → filas de `componentes` (plano Tecnológico) = inventario de equipo.
export function componentesDeEquipo(recursos: Recurso[]): Fila[] {
  return recursos.filter((r) => r.categoria === 'equipo' && r.nombre.trim()).map((r): Fila => ({
    componente: r.nombre,
    contrato: r.proveedor,
    sustitucion: '',
    entradaSalida: r.grupo || '',
  }));
}

// Procesos automatizados CON IA → filas de `agentes` (plano IA) = ficha de agente por proceso.
// Es como el Organizador de Equipo (IA) alimenta el plano de software: cada proceso que
// decide automatizar con un agente se vuelve una ficha (capacidad, scope, permisos, apagado).
export function agentesDeProcesos(procesos: ProcesoSrc[]): Fila[] {
  return procesos
    .filter((p) => !p.padreProcesoId && p.automatizacion?.con === 'ia' && p.nombre.trim())
    .map((p): Fila => ({
      nombre: p.automatizacion!.herramienta || `Agente: ${p.nombre}`,
      capability: p.nombre + (p.salida ? ` → ${p.salida}` : ''),
      categoria: 'Automatización de proceso',
      scope: p.automatizacion!.nota || [p.entrada, p.salida].filter(Boolean).join(' → '),
      permisos: p.roles.join(', '),
      apagado: 'Reversible a operación manual',
    }));
}

// Procesos automatizados con n8n/software → filas de `componentes` (plano Tecnológico).
export function componentesDeAutomatizacion(procesos: ProcesoSrc[]): Fila[] {
  return procesos
    .filter((p) => !p.padreProcesoId && p.automatizacion && p.automatizacion.con !== 'ia' && p.nombre.trim())
    .map((p): Fila => ({
      componente: p.automatizacion!.herramienta || `Automatización: ${p.nombre}`,
      contrato: [p.entrada, p.salida].filter(Boolean).join(' → '),
      sustitucion: `Reemplaza el trabajo manual de "${p.nombre}"`,
      entradaSalida: p.automatizacion!.nota || '',
    }));
}

// Ofertas / unidades comerciales → filas de `ingresos` (plano Financiero) = fuentes de ingreso.
export interface OfertaSrc { nombre: string; centro: string; precio?: string | undefined }
export function ingresosDeOfertas(ofertas: OfertaSrc[]): Fila[] {
  return ofertas.filter((o) => o.nombre.trim()).map((o): Fila => ({
    fuente: o.nombre, centro: o.centro || '', precio: o.precio && o.precio.trim() ? o.precio : 'PENDIENTE',
  }));
}

// Procesos del Mapa con tiempo → filas de `kpis` (plano Control) = un KPI de tiempo por proceso.
export function kpisDeProcesos(procesos: ProcesoSrc[]): Fila[] {
  return procesos.filter((p) => !p.padreProcesoId && p.nombre.trim() && p.tiempoMin).map((p): Fila => ({
    kpi: `Tiempo de "${p.nombre}"`,
    dueno: p.roles.join(', '),
    frecuencia: 'por servicio',
    fuente: `Mapa Operativo (objetivo ≤ ${p.tiempoMin} min)`,
  }));
}

// Contratos (abastecimiento) → filas de `legales` (plano Jurídico) = documentos/actos legales.
export function legalesDeContratos(contratos: Contrato[]): Fila[] {
  return contratos.filter((c) => c.titulo.trim()).map((c): Fila => ({
    documento: c.titulo,
    tipo: 'contrato',
    responsable: c.responsables || '',
  }));
}

// Personas internas → filas de `legales` (plano Jurídico) = contratos laborales + alta fiscal.
export function legalesDeEmpleados(empleados: Empleado[]): Fila[] {
  const internos = empleados.filter((e) => !e.externo && (e.puesto.trim() || e.nombre.trim()) && e.estado !== 'baja');
  const filas: Fila[] = internos.map((e): Fila => ({
    documento: `Contrato laboral / alta — ${e.nombre || e.puesto}`,
    tipo: 'contrato',
    responsable: 'Dirección / Contador',
  }));
  if (internos.length) filas.push({ documento: 'Alta patronal (IMSS) y registro de nómina', tipo: 'permiso', responsable: 'Contador' });
  return filas;
}

// Ruta de etapas del negocio → filas de `rondas` (plano Inversionista) = tramos de inversión
// derivados de la estrategia (META/EST): cada etapa hasta la objetivo es un tramo que desbloquea
// la siguiente. No recaptura: sale de la etapa objetivo fijada.
export function rondasDeRuta(etapaObjetivo: string | undefined): Fila[] {
  const objN = ETAPAS_OBJETIVO.find((e) => e.id === etapaObjetivo)?.n ?? ETAPAS_OBJETIVO[0]!.n;
  const tramos = ETAPAS_OBJETIVO.filter((e) => e.n <= objN);
  return tramos.map((e, i): Fila => ({
    ronda: `${e.n}. ${e.label}`,
    uso: e.descripcion,
    hito: i < tramos.length - 1 ? `Habilita "${tramos[i + 1]!.label}"` : 'Objetivo alcanzado',
  }));
}

// Unidades Comerciales → filas de `unidades` (plano Escalamiento) = unidades replicables.
export interface UnidadSrc { nombre: string }
export function unidadesDeUCs(ucs: UnidadSrc[]): Fila[] {
  return ucs.filter((u) => u.nombre.trim()).map((u): Fila => ({
    unidad: u.nombre, disparador: '', limite: '',
  }));
}

// Directorio de proveedores → filas de `proveedores` (plano Comercial).
export function proveedoresATabla(proveedores: Proveedor[]): Fila[] {
  return proveedores.filter((p) => p.nombre.trim()).map((p): Fila => ({
    proveedor: p.nombre, tipo: p.categorias.join(', ') || p.tipo, contacto: p.contacto || p.telefono || p.email,
  }));
}

// ¿Qué tablas maestras de un plano se proyectan desde superficies? (para el agregador)
export function tablasProyectablesDe(planoId: string): string[] {
  const refs = new Set<string>();
  for (const s of Object.keys(ENRIQUECE) as Superficie[]) {
    for (const a of ENRIQUECE[s]) if (a.planoId === planoId && a.tablaRef) refs.add(a.tablaRef);
  }
  return Array.from(refs);
}
