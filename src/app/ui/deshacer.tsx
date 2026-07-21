'use client';

// DESHACER global (ADITIVO). Pila ÚNICA en memoria de acciones con su INVERSA:
// cada vista (mapa de sedes, editor 2D, vista 3D) registra "qué revertiría" antes de
// persistir un cambio, y el botón ↩ ejecuta la inversa más reciente (hasta 30).
// Es deshacer de la sesión (se pierde al recargar la página); los cambios hechos por
// los AGENTES por chat no se registran todavía (multi-operación — pendiente).

import { useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';

interface Accion { descripcion: string; inversa: () => Promise<void> }

const pila: Accion[] = [];
const subs = new Set<() => void>();
let version = 0;
function avisar() { version++; subs.forEach((f) => f()); }

// Registra una acción reversible ANTES de persistirla (captura los valores previos).
export function registrarDeshacer(descripcion: string, inversa: () => Promise<void>): void {
  pila.push({ descripcion, inversa });
  if (pila.length > 30) pila.shift();
  avisar();
}

export async function deshacer(): Promise<string | null> {
  const a = pila.pop();
  avisar();
  if (!a) return null;
  await a.inversa();
  return a.descripcion;
}

function suscribir(fn: () => void): () => void { subs.add(fn); return () => subs.delete(fn); }
function leer(): number { return version; }

const btn: CSSProperties = { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };

// Botón ↩ compartido. `onDespues` = recargar la vista tras revertir.
export function BotonDeshacer({ onDespues }: { onDespues: () => void }) {
  useSyncExternalStore(suscribir, leer, leer);
  const ultima = pila[pila.length - 1];
  return (
    <button style={{ ...btn, opacity: ultima ? 1 : 0.45 }} disabled={!ultima}
      title={ultima ? `Deshacer: ${ultima.descripcion}` : 'Nada que deshacer (en esta sesión)'}
      onClick={() => { void deshacer().then(() => onDespues()); }}>
      ↩ Deshacer{ultima ? ` (${ultima.descripcion.length > 22 ? ultima.descripcion.slice(0, 21) + '…' : ultima.descripcion})` : ''}
    </button>
  );
}
