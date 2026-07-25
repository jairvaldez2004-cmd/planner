// SIMULACIÓN de procesos sobre el espacio (ADITIVO, puro). Cruza el Mapa Operativo (procesos
// con tiempo, roles y espacio) para estimar: carga por ESPACIO (minutos y nº de procesos),
// carga por ROL, el RECORRIDO cronológico (y cuántos cambios de espacio implica) y los
// CUELLOS DE BOTELLA (el espacio y el rol más cargados). No anima nada: es el cálculo que
// alimenta una vista de resultados (y, después, la animación).

import type { ProcesoNodo } from './mapa';
import { ordenCronologico } from './mapa';

export interface SimItem { nombre: string; minutos: number; procesos: number }
export interface PasoRecorrido { proceso: string; espacio: string; cambio: boolean }
export interface ResultadoSim {
  totalMin: number;
  sinTiempo: number;       // procesos sin tiempo declarado (se cuentan como 0)
  porEspacio: SimItem[];   // desc por minutos
  porRol: SimItem[];       // desc por minutos
  recorrido: PasoRecorrido[];
  cambiosEspacio: number;  // cuántas veces el flujo cambia de espacio (caminatas)
  cuelloEspacio?: SimItem | undefined;
  cuelloRol?: SimItem | undefined;
}

export function simular(procesos: ProcesoNodo[]): ResultadoSim {
  const top = procesos.filter((p) => !p.padreProcesoId);
  const esp = new Map<string, SimItem>();
  const rol = new Map<string, SimItem>();
  let totalMin = 0, sinTiempo = 0;

  for (const p of top) {
    const t = p.tiempoMin ?? 0;
    if (!p.tiempoMin) sinTiempo++;
    totalMin += t;
    for (const e of p.espacios) {
      const cur = esp.get(e.nombre) ?? { nombre: e.nombre, minutos: 0, procesos: 0 };
      cur.minutos += t; cur.procesos++; esp.set(e.nombre, cur);
    }
    for (const r of p.roles) {
      const cur = rol.get(r) ?? { nombre: r, minutos: 0, procesos: 0 };
      cur.minutos += t; cur.procesos++; rol.set(r, cur);
    }
  }

  // Recorrido: orden cronológico siguiendo las flechas; marca cuándo cambia de espacio.
  const num = ordenCronologico(top);
  const ordenados = [...top].sort((a, b) => (num.get(a.id) ?? 0) - (num.get(b.id) ?? 0));
  const recorrido: PasoRecorrido[] = [];
  let ultimo = '', cambios = 0;
  for (const p of ordenados) {
    const espN = p.espacios[0]?.nombre ?? '';
    if (!espN) continue;
    const cambio = ultimo !== '' && espN !== ultimo;
    if (cambio) cambios++;
    recorrido.push({ proceso: p.nombre, espacio: espN, cambio });
    ultimo = espN;
  }

  const porEspacio = Array.from(esp.values()).sort((a, b) => b.minutos - a.minutos);
  const porRol = Array.from(rol.values()).sort((a, b) => b.minutos - a.minutos);
  return {
    totalMin, sinTiempo, porEspacio, porRol, recorrido, cambiosEspacio: cambios,
    cuelloEspacio: porEspacio[0], cuelloRol: porRol[0],
  };
}
