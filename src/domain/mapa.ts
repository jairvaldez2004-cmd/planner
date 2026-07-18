// Dominio del MAPA OPERATIVO (ADITIVO). Un solo lienzo de procesos estilo n8n:
//   · Carriles (swimlanes) = DEPARTAMENTOS: la Administración (transversal) + cada
//     Unidad Comercial, en UNA sola lista. Se pueden dar de alta departamentos admin extra.
//   · Bandas cronológicas = FASES: Antes · Durante · Después.
//   · Nodo = PROCESO (orden dentro de su celda) con recursos asignados
//     (roles, herramientas/muebles, espacios del plano/render, insumos, tiempo).
//   · Flecha = RAMA: disparador (evento) que conecta un proceso con el siguiente;
//     un proceso puede partirse en varios caminos según el disparador que se active.
// Los recursos pueden COMPARTIRSE entre departamentos en horarios distintos.
// Ancla conceptual: Sistema de Eventos del OS (Trigger → Condición → Acción → Resultado).

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
  departamentoId: string;
  nombre: string;
  fase: FaseMapa;
  orden: number;
  descripcion?: string | undefined;
  roles: string[];                     // etiquetas de rol (maestro Personas)
  herramientas: string[];              // etiquetas de herramienta/mueble
  espacios: AsignacionRecurso[];       // dónde ocurre (con horario)
  tiempoMin?: number | undefined;
  entrada?: string | undefined;
  salida?: string | undefined;
  instructivo?: string | undefined;    // el paso a paso (vista instructivo)
  ramas: Rama[];                       // salidas por disparador (el flujo)
  origen?: { ofertaId: string; pasoId: string } | undefined; // si vino sembrado del catálogo
}

// LENTES del mapa: misma data, distinta vista (patrón de las 6 lentes de Espacios).
export type VistaMapa = 'general' | 'instructivo' | 'roles' | 'espacios' | 'herramientas' | 'tiempos';

export const VISTAS_MAPA: { id: VistaMapa; label: string }[] = [
  { id: 'general', label: '🗺️ General' },
  { id: 'instructivo', label: '📋 Instructivo' },
  { id: 'roles', label: '👤 Roles' },
  { id: 'espacios', label: '📐 Espacios' },
  { id: 'herramientas', label: '🔧 Herramientas' },
  { id: 'tiempos', label: '⏱️ Tiempos' },
];

// Paleta de carriles (se asigna cíclicamente al crear departamentos).
export const COLORES_DEPTO = ['#33415c', '#3b9e63', '#b06be0', '#e0795b', '#3bb0c9', '#d9a23b', '#c95b7c', '#6b7fd9'];

export function colorDepto(d: Departamento, i: number): string {
  return d.color ?? COLORES_DEPTO[i % COLORES_DEPTO.length]!;
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
