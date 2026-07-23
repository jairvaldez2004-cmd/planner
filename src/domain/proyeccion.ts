// PROYECCIÓN de superficies → planos (ADITIVO). El corazón de "sin repetir datos":
// lo que capturas en Sedes & Espacios o en el Mapa Operativo NO se re-teclea en el plano —
// se PROYECTA como filas de la tabla maestra que el plano lee. Un espacio real se vuelve un
// "ambiente" del plano Arquitectónico; un nodo del Mapa se vuelve un "proceso" del plano de
// Procesos; los roles asignados a espacios/procesos se vuelven "personas" de ORG/OPE.
//
// Funciones puras (sin IO). El agregador que carga las superficies vive en la capa de actions.

import type { Fila } from './plano-doc';

// ---------- Registro declarativo: qué planos enriquece cada superficie (para UI) ----------
export type Superficie = 'sedes' | 'mapa' | 'uc';

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
    { planoId: 'CTR', nota: 'tiempos y KPIs por proceso' },
  ],
  uc: [
    { planoId: 'COM', nota: 'catálogo y oferta de la unidad' },
    { planoId: 'MKT', nota: 'campañas por unidad' },
    { planoId: 'FIN', nota: 'ingresos por unidad' },
  ],
};

export const LABEL_SUPERFICIE: Record<Superficie, string> = {
  sedes: 'Sedes & Espacios', mapa: 'Mapa Operativo', uc: 'Unidad Comercial',
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
  roles: string[]; tiempoMin?: number | undefined;
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

// Nodos del Mapa Operativo → filas de `procesos` (plano de Procesos).
export function procesosDeMapa(procesos: ProcesoSrc[]): Fila[] {
  return procesos.map((p): Fila => ({
    proceso: p.nombre,
    entrada: p.entrada ?? '',
    salida: p.salida ?? '',
    responsable: p.roles.join(', '),
    estados: '',
  }));
}

// Roles asignados en espacios (lente Roles/Procesos) + en procesos → filas de `personas`
// (planos ORG/OPE). Dedup por nombre de rol; el "área" es dónde se le vio primero.
export function personasDeSuperficies(espacios: EspacioSrc[], procesos: ProcesoSrc[]): Fila[] {
  const map = new Map<string, Fila>();
  const add = (rol: string, area: string) => {
    const key = rol.toLowerCase();
    if (rol && !map.has(key)) map.set(key, { rol, persona: '', area, reportaA: '' });
  };
  for (const e of espacios) {
    for (const campo of ['org_responsable', 'proc_rol', 'org_acceso'] as const) {
      for (const rol of partirRoles(e.data[campo])) add(rol, e.nombre);
    }
  }
  for (const p of procesos) for (const rol of p.roles) add(rol, p.nombre);
  return Array.from(map.values());
}

// ¿Qué tablas maestras de un plano se proyectan desde superficies? (para el agregador)
export function tablasProyectablesDe(planoId: string): string[] {
  const refs = new Set<string>();
  for (const s of Object.keys(ENRIQUECE) as Superficie[]) {
    for (const a of ENRIQUECE[s]) if (a.planoId === planoId && a.tablaRef) refs.add(a.tablaRef);
  }
  return Array.from(refs);
}
