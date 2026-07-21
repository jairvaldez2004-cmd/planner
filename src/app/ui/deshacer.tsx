'use client';

// DESHACER global (ADITIVO). Pila ÚNICA en memoria de acciones con su INVERSA:
// cada vista registra "qué revertiría" antes de persistir, y también los AGENTES
// (el Diseñador 3D devuelve las inversas de cada operación de su turno, agrupadas).
// El botón ↩ deshace la última; el panel ▾ permite deshacer UNA cualquiera, un GRUPO
// (todo un turno del agente) o TODO. Es deshacer de la sesión (se pierde al recargar).

import { useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';

interface Accion { id: number; descripcion: string; grupo?: string | undefined; inversa: () => Promise<void> }

let sec = 0;
const pila: Accion[] = [];
const subs = new Set<() => void>();
let version = 0;
function avisar() { version++; subs.forEach((f) => f()); }

// Registra una acción reversible ANTES de persistirla (o al recibir las inversas de un
// turno de agente). `grupo` junta varias bajo un mismo encabezado (un turno = un grupo).
export function registrarDeshacer(descripcion: string, inversa: () => Promise<void>, grupo?: string): void {
  pila.push({ id: ++sec, descripcion, inversa, ...(grupo ? { grupo } : {}) });
  if (pila.length > 60) pila.shift();
  avisar();
}

export async function deshacer(): Promise<string | null> {
  const a = pila.pop();
  avisar();
  if (!a) return null;
  await a.inversa();
  return a.descripcion;
}

// Deshace UNA acción concreta (elegida en el panel), aunque no sea la última.
// Las inversas son independientes (restaurar valores / recrear / borrar), y las
// acciones del servidor ignoran ids inexistentes, así que fuera de orden es seguro.
export async function deshacerPor(id: number): Promise<void> {
  const i = pila.findIndex((a) => a.id === id);
  if (i < 0) return;
  const [a] = pila.splice(i, 1);
  avisar();
  await a!.inversa();
}

// Deshace TODO un grupo (p. ej. un turno completo del Diseñador), de lo más reciente
// a lo más viejo — el orden correcto para revertir una secuencia.
export async function deshacerGrupo(grupo: string): Promise<number> {
  const del = pila.filter((a) => a.grupo === grupo).sort((a, b) => b.id - a.id);
  for (const a of del) {
    const i = pila.findIndex((x) => x.id === a.id);
    if (i >= 0) pila.splice(i, 1);
  }
  avisar();
  let n = 0;
  for (const a of del) { try { await a.inversa(); n++; } catch { /* sigue con las demás */ } }
  return n;
}

export async function deshacerTodo(): Promise<number> {
  let n = 0;
  while (pila.length) {
    const a = pila.pop()!;
    avisar();
    try { await a.inversa(); n++; } catch { /* sigue */ }
  }
  return n;
}

function suscribir(fn: () => void): () => void { subs.add(fn); return () => subs.delete(fn); }
function leer(): number { return version; }

const btn: CSSProperties = { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const btnMini: CSSProperties = { ...btn, padding: '0.1rem 0.45rem', fontSize: 11.5 };

// Botón ↩ + panel ▾ compartido. `onDespues` = recargar la vista tras revertir.
export function BotonDeshacer({ onDespues }: { onDespues: () => void }) {
  useSyncExternalStore(suscribir, leer, leer);
  const [abierto, setAbierto] = useState(false);
  const ultima = pila[pila.length - 1];
  // más reciente primero; los grupos se encabezan la primera vez que aparecen
  const lista = [...pila].reverse();
  const grupos = new Set<string>();

  return (
    <span style={{ position: 'relative', display: 'inline-flex', gap: 2 }}>
      <button style={{ ...btn, opacity: ultima ? 1 : 0.45 }} disabled={!ultima}
        title={ultima ? `Deshacer: ${ultima.descripcion}` : 'Nada que deshacer (en esta sesión)'}
        onClick={() => { void deshacer().then(() => onDespues()); }}>
        ↩ Deshacer{ultima ? ` (${ultima.descripcion.length > 22 ? ultima.descripcion.slice(0, 21) + '…' : ultima.descripcion})` : ''}
      </button>
      <button style={{ ...btn, padding: '0.3rem 0.45rem', opacity: pila.length ? 1 : 0.45 }} disabled={!pila.length}
        title="Elegir qué deshacer" onClick={() => setAbierto((v) => !v)}>▾</button>

      {abierto && pila.length > 0 && (
        <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 40, background: '#fff', border: '1px solid #ccc', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', padding: '0.5rem', minWidth: 290, maxHeight: 340, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <strong style={{ fontSize: 12.5 }}>Historial de cambios ({pila.length})</strong>
            <button style={{ ...btnMini, color: '#b33', borderColor: '#d99' }}
              onClick={() => { setAbierto(false); void deshacerTodo().then(() => onDespues()); }}>⟲ Deshacer TODO</button>
          </div>
          {lista.map((a) => {
            const encabezado = a.grupo && !grupos.has(a.grupo);
            if (a.grupo) grupos.add(a.grupo);
            return (
              <div key={a.id}>
                {encabezado && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0 2px', paddingTop: 4, borderTop: '1px solid #eee' }}>
                    <span style={{ fontSize: 11, color: '#7a4fbf', fontWeight: 'bold' }}>🤖 {a.grupo}</span>
                    <button style={{ ...btnMini, color: '#7a4fbf', borderColor: '#c9b3e8' }}
                      onClick={() => { setAbierto(false); void deshacerGrupo(a.grupo!).then(() => onDespues()); }}>↩ todo el turno</button>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, padding: '2px 0', paddingLeft: a.grupo ? 10 : 0 }}>
                  <span style={{ fontSize: 12, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.descripcion}</span>
                  <button style={btnMini} title="Deshacer solo esta"
                    onClick={() => { void deshacerPor(a.id).then(() => onDespues()); }}>↩</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
}
