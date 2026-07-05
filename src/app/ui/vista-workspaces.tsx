'use client';

// Pantalla de entrada: crear o seleccionar un Workspace (antes de hablar con el agente).

import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import type { Workspace } from '@/domain/workspace';
import { listarWorkspaces, crearWorkspace, eliminarWorkspace } from '@/app/actions/workspace.actions';

const card: CSSProperties = { border: '1px solid #ddd', borderRadius: 10, padding: '1rem 1.25rem', background: '#fafafa', cursor: 'pointer', minWidth: 200 };
const btn: CSSProperties = { padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 14 };
const inp: CSSProperties = { padding: '0.5rem 0.7rem', borderRadius: 6, border: '1px solid #ccc' };

interface Props {
  onAbrir: (ws: Workspace) => void;
}

export function VistaWorkspaces({ onAbrir }: Props) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = () => {
    setLoading(true);
    listarWorkspaces().then(setWorkspaces).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); }, []);

  async function onCrear() {
    if (!nombre.trim()) return;
    setBusy(true);
    try {
      const ws = await crearWorkspace(nombre);
      setNombre('');
      cargar();
      onAbrir(ws);
    } finally { setBusy(false); }
  }

  async function onEliminar(ws: Workspace, e: MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar el workspace "${ws.nombre}" y TODO su contenido (proyectos, negocios, sedes, espacios y conversaciones)?\n\nEsta acción NO se puede deshacer.`)) return;
    setBusy(true);
    try { await eliminarWorkspace(ws.id); cargar(); } finally { setBusy(false); }
  }

  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Workspaces</h2>
      <p style={{ color: '#555', fontSize: 14 }}>
        Un workspace agrupa los proyectos (de Grupo Dioquis o de un cliente). Elige uno o crea el primero; dentro hablarás con el agente para identificar tus proyectos.
      </p>

      <div style={{ ...card, cursor: 'default', background: '#f0f7ff', borderColor: '#b3d4f7', marginBottom: '1rem' }}>
        <strong>Crear workspace</strong>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="Nombre (p. ej. Grupo Dioquis, Cliente Acme…)" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void onCrear(); }} />
          <button style={btn} onClick={() => void onCrear()} disabled={busy || !nombre.trim()}>+ Crear y entrar</button>
        </div>
      </div>

      {loading && <p style={{ color: '#666' }}>Cargando…</p>}
      {!loading && workspaces.length === 0 && <p style={{ color: '#666' }}>Aún no hay workspaces. Crea el primero arriba.</p>}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {workspaces.map((ws) => (
          <div key={ws.id} style={card} onClick={() => onAbrir(ws)}>
            <strong>{ws.nombre}</strong>
            <div style={{ fontSize: 12, color: '#888', marginTop: '0.25rem' }}>{ws.tipo} · {ws.id}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <span style={{ fontSize: 13, color: '#06c' }}>Abrir grafo →</span>
              <span onClick={(e) => void onEliminar(ws, e)} title="Eliminar workspace y todo su contenido" style={{ fontSize: 12, color: '#c0392b', cursor: 'pointer' }}>🗑 Eliminar</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
