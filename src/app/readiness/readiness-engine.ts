// Motor de readiness (Sección 5 de AGENT_ARCHITECTURE_V1) — reglas puras, testeable.
// Calcula el estado de un plano comparando lo capturado contra lo requerido según la
// profundidad del proyecto (esencial/estándar/completo, que dicta el Motor de Selección).

import type { EspecialistaConfig, Nivel } from '@/domain/especialistas';
import type { Profundidad } from '@/domain/diagnostico';

export type EstadoPlano = 'LOCKED' | 'DISPONIBLE' | 'MIN_OPERABLE' | 'PUBLICADO' | 'COMPLETO';

const RANK: Record<Nivel, number> = { esencial: 0, estandar: 1, completo: 2 };

export interface EntradaReadiness {
  campos: Record<string, string>;     // campoId -> valor capturado
  filasPorTabla: Record<string, number>; // tablaRef -> nº de filas
}

export interface ItemPendiente {
  tipo: 'campo' | 'tabla';
  bloque: string;
  id: string;
  etiqueta: string;
  nivel: Nivel;
}

export interface Readiness {
  estado: EstadoPlano;
  progreso: number;          // 0..1 sobre lo requerido al nivel del proyecto
  totalRequerido: number;
  cumplidoRequerido: number;
  faltanEsencial: ItemPendiente[];
  faltanNivel: ItemPendiente[];
  faltanCompleto: ItemPendiente[];
}

function tieneValor(v: string | undefined): boolean {
  return !!v && v.trim().length > 0;
}

export function calcularReadiness(
  cfg: EspecialistaConfig,
  proyectoProf: Profundidad,
  entrada: EntradaReadiness,
  seleccionado: boolean,
): Readiness {
  if (!seleccionado) {
    return { estado: 'LOCKED', progreso: 0, totalRequerido: 0, cumplidoRequerido: 0, faltanEsencial: [], faltanNivel: [], faltanCompleto: [] };
  }

  const nivelProyecto = RANK[proyectoProf];
  const todos: ItemPendiente[] = [];
  const cumplido = new Set<string>();

  for (const b of cfg.bloques) {
    for (const c of b.campos ?? []) {
      const key = `campo:${c.id}`;
      const item: ItemPendiente = { tipo: 'campo', bloque: b.titulo, id: c.id, etiqueta: c.pregunta, nivel: c.requeridoEn };
      todos.push(item);
      if (tieneValor(entrada.campos[c.id])) cumplido.add(key);
    }
    if (b.tabla) {
      const key = `tabla:${b.tabla.tablaRef}:${b.id}`;
      const item: ItemPendiente = { tipo: 'tabla', bloque: b.titulo, id: b.tabla.tablaRef, etiqueta: b.tabla.etiqueta ?? b.titulo, nivel: b.tabla.requeridoEn };
      todos.push(item);
      if ((entrada.filasPorTabla[b.tabla.tablaRef] ?? 0) > 0) cumplido.add(key);
    }
  }

  const keyOf = (it: ItemPendiente) => (it.tipo === 'campo' ? `campo:${it.id}` : `tabla:${it.id}:${it.bloque}`);
  // Nota: para tablas la key incluye bloque para no colisionar; reconstruimos igual abajo.
  const cumplidoItem = (it: ItemPendiente): boolean => {
    if (it.tipo === 'campo') return cumplido.has(`campo:${it.id}`);
    // cualquier bloque con esa tablaRef cumplida basta
    return Array.from(cumplido).some((k) => k.startsWith(`tabla:${it.id}:`));
  };

  const requeridoAlNivel = (it: ItemPendiente) => RANK[it.nivel] <= nivelProyecto;
  const esEsencial = (it: ItemPendiente) => it.nivel === 'esencial';

  const faltanEsencial = todos.filter((it) => esEsencial(it) && !cumplidoItem(it));
  const faltanNivel = todos.filter((it) => requeridoAlNivel(it) && !cumplidoItem(it));
  const faltanCompleto = todos.filter((it) => !cumplidoItem(it));

  const requeridos = todos.filter(requeridoAlNivel);
  const totalRequerido = requeridos.length;
  const cumplidoRequerido = requeridos.filter(cumplidoItem).length;
  const progreso = totalRequerido === 0 ? 1 : cumplidoRequerido / totalRequerido;

  let estado: EstadoPlano = 'DISPONIBLE';
  if (faltanCompleto.length === 0) estado = 'COMPLETO';
  else if (faltanNivel.length === 0) estado = 'PUBLICADO';
  else if (faltanEsencial.length === 0) estado = 'MIN_OPERABLE';

  void keyOf;
  return { estado, progreso, totalRequerido, cumplidoRequerido, faltanEsencial, faltanNivel, faltanCompleto };
}

export const COLOR_ESTADO: Record<EstadoPlano, string> = {
  LOCKED: '#bbb',
  DISPONIBLE: '#c97a3b',
  MIN_OPERABLE: '#3b86c9',
  PUBLICADO: '#2e9e63',
  COMPLETO: '#1f7a4d',
};

export const LABEL_ESTADO: Record<EstadoPlano, string> = {
  LOCKED: 'No seleccionado',
  DISPONIBLE: 'Disponible',
  MIN_OPERABLE: 'Mínimo operable',
  PUBLICADO: 'Publicado',
  COMPLETO: 'Completo',
};
