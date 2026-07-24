// Dominio del MAPA OPERATIVO (ADITIVO). Un solo lienzo de procesos estilo n8n:
//   · Carriles (swimlanes) = DEPARTAMENTOS: la Administración (transversal) + cada
//     Unidad Comercial, en UNA sola lista. Se pueden dar de alta departamentos admin extra.
//   · Bandas cronológicas = FASES: Antes · Durante · Después.
//   · Nodo = PROCESO (orden dentro de su celda) con recursos asignados
//     (roles, herramientas/muebles, espacios del plano/render, insumos, tiempo).
//   · ETAPA (ruta de 5: arrancar→expandir→replicar→automatizar→vender) = eje ACUMULATIVO:
//     cada proceso NACE en una etapa y sigue vigente en todas las siguientes (herencia),
//     salvo que se JUBILE en una (el proceso manual que la automatización reemplaza).
//     Así el mapa de la etapa 2 = el de la etapa 1 + lo nuevo; y un proceso de hoy puede
//     alimentar a uno que nace después (ej. "guardar factura" → "contabilizar" en etapa 2).
//   · Flecha = RAMA: disparador (evento) que conecta un proceso con el siguiente;
//     un proceso puede partirse en varios caminos según el disparador que se active.
// Los recursos pueden COMPARTIRSE entre departamentos en horarios distintos.
// Ancla conceptual: Sistema de Eventos del OS (Trigger → Condición → Acción → Resultado).

import type { EtapaObjetivo } from './etapas';
import { ETAPAS_OBJETIVO } from './etapas';

export type FaseMapa = 'antes' | 'durante' | 'despues';

export const FASES_MAPA: { id: FaseMapa; label: string; orden: number }[] = [
  { id: 'antes', label: 'Antes · Preparación', orden: 0 },
  { id: 'durante', label: 'Durante · Operación', orden: 1 },
  { id: 'despues', label: 'Después · Seguimiento', orden: 2 },
];

export function ordenFaseMapa(f: FaseMapa): number {
  return FASES_MAPA.find((x) => x.id === f)?.orden ?? 99;
}

// Asignación de un recurso a un departamento/proceso, con horario propio.
// El MISMO recurso puede asignarse a otros departamentos en tiempos diferentes.
export interface AsignacionRecurso {
  ref?: string | undefined;    // id del Espacio/Objeto si es referencia real
  nombre: string;              // etiqueta visible
  horario?: string | undefined; // "L-V 9-14" · "sáb 10-13" … (compartición por tiempo)
}

export type TipoDepartamento = 'admin' | 'uc';

export interface Departamento {
  id: string;
  nombre: string;
  tipo: TipoDepartamento;
  ucId?: string | undefined;   // si el carril representa una Unidad Comercial
  orden: number;
  color?: string | undefined;
  descripcion?: string | undefined;
  espacios: AsignacionRecurso[];      // espacios del plano/render asignados
  herramientas: AsignacionRecurso[];  // herramientas/muebles/equipo asignados
}

// Rama = salida condicionada por disparador hacia otro proceso.
export interface Rama {
  id: string;
  evento: string;                        // qué disparador la activa ("Pago recibido", "Cliente cancela")
  destinoProcesoId?: string | undefined; // → a qué proceso conecta
}

export interface ProcesoNodo {
  id: string;
  departamentoId: string;          // ETIQUETA de departamento (no contenedor)
  nombre: string;
  fase: FaseMapa;                  // en qué página del mapa vive (antes/durante/después)
  etapaDesde: EtapaObjetivo;       // etapa en la que NACE (existe desde ahí en adelante)
  etapaHasta?: EtapaObjetivo | undefined; // última etapa vigente; después se jubila (opcional)
  orden: number;
  posX?: number | undefined;       // posición libre en el canvas de su fase
  posY?: number | undefined;
  descripcion?: string | undefined;
  roles: string[];                     // etiquetas de rol (maestro Personas)
  herramientas: string[];              // etiquetas de herramienta (se reusan)
  insumos: string[];                   // lo que se CONSUME al ejecutarlo (gasas, solución…)
  espacios: AsignacionRecurso[];       // dónde ocurre (con horario)
  equipo?: string[] | undefined;       // maquinaria/equipo (autoclave, esterilizador…)
  muebles?: string[] | undefined;      // mobiliario (camilla, mostrador…)
  cantidades?: Record<string, string> | undefined; // insumo → cantidad (ej. "2 pzas", "50 ml")
  manuales?: Record<string, string> | undefined;   // herramienta/equipo → manual anidado (cómo se usa/limpia)
  tiempoMin?: number | undefined;
  tiempoEstimado?: boolean | undefined;  // true = repartido del total del servicio, no declarado
  entrada?: string | undefined;
  salida?: string | undefined;
  instructivo?: string | undefined;    // el paso a paso (vista instructivo)
  ramas: Rama[];                       // salidas por disparador (el flujo)
  origen?: { ofertaId: string; pasoId: string } | undefined; // si vino sembrado del catálogo
  padreProcesoId?: string | undefined; // si es un SUBPROCESO dentro de otro paso (flujo anidado)
}

// Hijos directos de un paso: el subflujo que vive DENTRO de ese paso (recursivo).
export function subprocesosDe(procesos: ProcesoNodo[], padreId: string): ProcesoNodo[] {
  return procesos.filter((p) => p.padreProcesoId === padreId);
}
// Procesos de un nivel: los del padre dado (null = nivel raíz del mapa).
export function procesosDeNivel(procesos: ProcesoNodo[], padreId: string | null): ProcesoNodo[] {
  return procesos.filter((p) => (p.padreProcesoId ?? null) === padreId);
}
// Nº de subprocesos directos de cada paso (para el badge "⤵ N").
export function contarSubprocesos(procesos: ProcesoNodo[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of procesos) if (p.padreProcesoId) m.set(p.padreProcesoId, (m.get(p.padreProcesoId) ?? 0) + 1);
  return m;
}

// =================== EJE ETAPA (acumulativo) ===================

export const ETAPA_BASE: EtapaObjetivo = 'arrancar';

export function nEtapa(e: EtapaObjetivo | undefined): number {
  return ETAPAS_OBJETIVO.find((x) => x.id === e)?.n ?? 1;
}

// ¿Este proceso existe en la etapa dada? Nace en `etapaDesde` y sigue vigente hacia
// adelante hasta `etapaHasta` (inclusive) si se declaró jubilación.
export function vigenteEn(p: ProcesoNodo, etapa: EtapaObjetivo): boolean {
  const n = nEtapa(etapa);
  if (nEtapa(p.etapaDesde) > n) return false;                       // todavía no nace
  if (p.etapaHasta && nEtapa(p.etapaHasta) < n) return false;       // ya se jubiló
  return true;
}

// ¿Es NUEVO en esta etapa (lo que agregamos al llegar aquí) o heredado de una anterior?
export function naceEn(p: ProcesoNodo, etapa: EtapaObjetivo): boolean {
  return p.etapaDesde === etapa;
}
// ¿Es su última etapa vigente? (se retira al pasar a la siguiente)
export function seRetiraEn(p: ProcesoNodo, etapa: EtapaObjetivo): boolean {
  return p.etapaHasta === etapa;
}

// Procesos vigentes en una etapa (el mapa acumulado hasta ahí).
export function procesosDeEtapa(procesos: ProcesoNodo[], etapa: EtapaObjetivo): ProcesoNodo[] {
  return procesos.filter((p) => vigenteEn(p, etapa));
}

// LENTES del mapa: misma data, distinta vista (patrón de las 6 lentes de Espacios).
export type VistaMapa = 'general' | 'instructivo' | 'roles' | 'espacios' | 'herramientas' | 'tiempos' | 'costos';

export const VISTAS_MAPA: { id: VistaMapa; label: string }[] = [
  { id: 'general', label: '🗺️ General' },
  { id: 'instructivo', label: '📋 Instructivo' },
  { id: 'roles', label: '👤 Roles' },
  { id: 'espacios', label: '📐 Espacios' },
  { id: 'herramientas', label: '🔧 Herramientas' },
  { id: 'tiempos', label: '⏱️ Tiempos' },
  { id: 'costos', label: '💵 Costos' },
];

// Paleta de carriles (se asigna cíclicamente al crear departamentos).
export const COLORES_DEPTO = ['#33415c', '#3b9e63', '#b06be0', '#e0795b', '#3bb0c9', '#d9a23b', '#c95b7c', '#6b7fd9'];

export function colorDepto(d: Departamento, i: number): string {
  return d.color ?? COLORES_DEPTO[i % COLORES_DEPTO.length]!;
}

// ORDEN CRONOLÓGICO GLOBAL: numera los procesos siguiendo las flechas (ramas) a
// través de TODAS las fases. El #1 es "el primer paso de todos" (sin flechas entrantes,
// en la fase más temprana). Los nodos sueltos se numeran al final por fase/posición.
export function ordenCronologico(procesos: ProcesoNodo[]): Map<string, number> {
  const entrantes = new Map<string, number>();
  for (const p of procesos) entrantes.set(p.id, 0);
  for (const p of procesos) for (const r of p.ramas) {
    if (r.destinoProcesoId && entrantes.has(r.destinoProcesoId)) entrantes.set(r.destinoProcesoId, (entrantes.get(r.destinoProcesoId) ?? 0) + 1);
  }
  const porPos = (a: ProcesoNodo, b: ProcesoNodo) =>
    ordenFaseMapa(a.fase) - ordenFaseMapa(b.fase) || (a.posY ?? 0) - (b.posY ?? 0) || (a.posX ?? 0) - (b.posX ?? 0);
  const raices = procesos.filter((p) => (entrantes.get(p.id) ?? 0) === 0).sort(porPos);
  const byId = new Map(procesos.map((p) => [p.id, p]));
  const num = new Map<string, number>();
  let n = 0;
  const cola = [...raices];
  while (cola.length) {
    const p = cola.shift()!;
    if (num.has(p.id)) continue;
    num.set(p.id, ++n);
    const destinos = p.ramas.map((r) => r.destinoProcesoId).filter((x): x is string => !!x)
      .map((id) => byId.get(id)).filter((x): x is ProcesoNodo => !!x && !num.has(x.id));
    cola.push(...destinos.sort(porPos));
  }
  for (const p of [...procesos].sort(porPos)) if (!num.has(p.id)) num.set(p.id, ++n);
  return num;
}

// Recursos compartidos: nombre de recurso → departamentos que lo usan (para señalar
// "compartido con otros departamentos en tiempos diferentes").
export function recursosCompartidos(deptos: Departamento[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const d of deptos) {
    for (const r of [...d.espacios, ...d.herramientas]) {
      const k = (r.ref ?? r.nombre).toLowerCase();
      const arr = m.get(k) ?? [];
      if (!arr.includes(d.nombre)) arr.push(d.nombre);
      m.set(k, arr);
    }
  }
  return m;
}
