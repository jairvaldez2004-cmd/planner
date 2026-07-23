// GRAFO DE DEPENDENCIAS UNIFICADO (ADITIVO). La pieza que convierte "N documentos"
// en un MODELO EJECUTABLE de la empresa. Une las tres capas que hoy viven separadas:
//   · plano → plano   (dependencias declaradas en ESPECIALISTAS; arista 'depende')
//   · tabla → plano   (una Tabla Maestra alimenta a los planos que la usan; arista 'usa').
//                      Una tabla usada por varios planos = espina compartida SIN duplicar dato.
//   · proceso → proceso (ramas por disparador del Mapa Operativo; arista 'dispara')
//
// Cada nodo sabe qué necesita para arrancar y qué produce. Con eso se puede responder
// la pregunta clave del propietario: "si falla X, ¿qué se bloquea aguas abajo?".
// Puro y testeable — sin IO. La UI (vista-planos / mapa-operativo) puede consumirlo.

import { ESPECIALISTAS } from './especialistas';
import type { EspecialistaConfig } from './especialistas';
import { PLANOS_MAESTROS } from './diagnostico';
import { tablaBase } from './tablas';
import type { ProcesoNodo } from './mapa';

export type TipoNodoDep = 'plano' | 'proceso' | 'tabla';
export type TipoAristaDep = 'depende' | 'usa' | 'dispara';

export interface NodoDep {
  id: string;               // 'plano:COM' · 'tabla:productos' · 'proceso:<id>'
  tipo: TipoNodoDep;
  ref: string;              // id crudo (COM · productos · <procesoId>)
  nombre: string;
  queNecesita: string[];    // ids de nodos que lo alimentan (aristas entrantes)
  queProduce: string[];     // ids de nodos que alimenta (aristas salientes)
}

export interface AristaDep {
  de: string;
  a: string;
  tipo: TipoAristaDep;
  etiqueta?: string | undefined;  // p. ej. el disparador de una rama
}

export interface GrafoDependencias {
  nodos: NodoDep[];
  aristas: AristaDep[];
}

export interface EntradaGrafo {
  planos?: EspecialistaConfig[];          // default: Object.values(ESPECIALISTAS)
  procesos?: ProcesoNodo[];               // del Mapa Operativo (opcional)
  nombresProceso?: Record<string, string>; // override de nombres (default: p.nombre)
}

const idPlano = (ref: string) => `plano:${ref}`;
const idTabla = (ref: string) => `tabla:${ref}`;
const idProceso = (ref: string) => `proceso:${ref}`;

export function construirGrafoDependencias(entrada: EntradaGrafo = {}): GrafoDependencias {
  const planos = entrada.planos ?? Object.values(ESPECIALISTAS);
  const procesos = entrada.procesos ?? [];

  const nodos = new Map<string, NodoDep>();
  const aristas: AristaDep[] = [];

  const asegurar = (id: string, tipo: TipoNodoDep, ref: string, nombre: string) => {
    if (!nodos.has(id)) nodos.set(id, { id, tipo, ref, nombre, queNecesita: [], queProduce: [] });
  };
  const conectar = (de: string, a: string, tipo: TipoAristaDep, etiqueta?: string) => {
    if (de === a) return;
    aristas.push({ de, a, tipo, ...(etiqueta ? { etiqueta } : {}) });
  };

  // 1) Planos + sus dependencias + las tablas que usan
  for (const cfg of planos) {
    asegurar(idPlano(cfg.planoId), 'plano', cfg.planoId, PLANOS_MAESTROS[cfg.planoId] ?? cfg.nombre);
  }
  for (const cfg of planos) {
    for (const dep of cfg.dependencias) {
      if (nodos.has(idPlano(dep))) conectar(idPlano(dep), idPlano(cfg.planoId), 'depende');
    }
    for (const b of cfg.bloques) {
      if (b.tabla) {
        const ref = b.tabla.tablaRef;
        asegurar(idTabla(ref), 'tabla', ref, tablaBase(ref)?.nombre ?? ref);
        conectar(idTabla(ref), idPlano(cfg.planoId), 'usa');
      }
    }
  }

  // 2) Procesos + ramas (flujo operativo)
  for (const p of procesos) {
    asegurar(idProceso(p.id), 'proceso', p.id, entrada.nombresProceso?.[p.id] ?? p.nombre);
  }
  for (const p of procesos) {
    for (const r of p.ramas) {
      if (r.destinoProcesoId && nodos.has(idProceso(r.destinoProcesoId))) {
        conectar(idProceso(p.id), idProceso(r.destinoProcesoId), 'dispara', r.evento);
      }
    }
  }

  // 3) Rellenar queNecesita / queProduce
  for (const e of aristas) {
    nodos.get(e.a)?.queNecesita.push(e.de);
    nodos.get(e.de)?.queProduce.push(e.a);
  }

  return { nodos: Array.from(nodos.values()), aristas };
}

// ¿Qué se bloquea aguas abajo si este nodo falla? (alcanzables por aristas salientes).
export function bloqueadosSi(grafo: GrafoDependencias, nodoId: string): string[] {
  const salientes = new Map<string, string[]>();
  for (const e of grafo.aristas) {
    const arr = salientes.get(e.de) ?? [];
    arr.push(e.a);
    salientes.set(e.de, arr);
  }
  const visto = new Set<string>();
  const cola = [...(salientes.get(nodoId) ?? [])];
  while (cola.length) {
    const n = cola.shift()!;
    if (visto.has(n)) continue;
    visto.add(n);
    cola.push(...(salientes.get(n) ?? []));
  }
  return Array.from(visto);
}

// Tablas maestras usadas por >1 plano: prueba de "sin repetir datos" (un dato, muchos lentes).
export function tablasCompartidas(grafo: GrafoDependencias): Map<string, string[]> {
  const m = new Map<string, Set<string>>();
  for (const e of grafo.aristas) {
    if (e.tipo !== 'usa') continue;
    const ref = e.de.replace(/^tabla:/, '');
    const set = m.get(ref) ?? new Set<string>();
    set.add(e.a.replace(/^plano:/, ''));   // dedup: un plano que usa la tabla en 2 bloques cuenta 1 vez
    m.set(ref, set);
  }
  // solo las compartidas: una MISMA tabla consumida por ≥2 planos distintos.
  return new Map(
    Array.from(m.entries())
      .filter(([, planos]) => planos.size >= 2)
      .map(([ref, planos]) => [ref, Array.from(planos)]),
  );
}
