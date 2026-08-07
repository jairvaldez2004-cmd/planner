'use client';

// Pantalla de entrada: crear o seleccionar un Workspace (antes de hablar con el agente).

import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import type { Workspace } from '@/domain/workspace';
import { listarWorkspaces, crearWorkspace, eliminarWorkspace } from '@/app/actions/workspace.actions';
import { useT } from './i18n';
import { useTx } from './traduccion';

const card: CSSProperties = { border: '1px solid var(--bp-border)', borderRadius: 10, padding: '1rem 1.25rem', background: 'var(--bp-panel-alt)', cursor: 'pointer', minWidth: 200 };
const btn: CSSProperties = { padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid #999', background: 'var(--bp-panel)', cursor: 'pointer', fontSize: 14 };
const inp: CSSProperties = { padding: '0.5rem 0.7rem', borderRadius: 6, border: '1px solid var(--bp-border)' };

interface Props {
  onAbrir: (ws: Workspace) => void;
}

export function VistaWorkspaces({ onAbrir }: Props) {
  const { t } = useT();
  const { tx } = useTx();
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
    if (!window.confirm(t('workspaces.confirmEliminar', { ws: tx(ws.nombre) }))) return;
    setBusy(true);
    try { await eliminarWorkspace(ws.id); cargar(); } finally { setBusy(false); }
  }

  return (
    <section>
      <h2 style={{ marginTop: 0 }}>{t('workspaces.titulo')}</h2>
      <p style={{ color: 'var(--bp-muted)', fontSize: 14 }}>{t('workspaces.intro')}</p>

      <div style={{ ...card, cursor: 'default', background: 'var(--bp-panel-alt)', borderColor: '#b3d4f7', marginBottom: '1rem' }}>
        <strong>{t('workspaces.crearTitulo')}</strong>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder={t('workspaces.nombrePlaceholder')} value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void onCrear(); }} />
          <button style={btn} onClick={() => void onCrear()} disabled={busy || !nombre.trim()}>{t('workspaces.crearEntrar')}</button>
        </div>
      </div>

      {loading && <p style={{ color: 'var(--bp-muted)' }}>{t('comun.cargando')}</p>}
      {!loading && workspaces.length === 0 && <p style={{ color: 'var(--bp-muted)' }}>{t('workspaces.vacio')}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {workspaces.map((ws) => (
          <div key={ws.id} style={card} onClick={() => onAbrir(ws)}>
            <strong>{tx(ws.nombre)}</strong>
            <div style={{ fontSize: 12, color: 'var(--bp-muted)', marginTop: '0.25rem' }}>{ws.tipo} · {ws.id}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <span style={{ fontSize: 13, color: 'var(--bp-gold)' }}>{t('workspaces.abrirGrafo')}</span>
              <span onClick={(e) => void onEliminar(ws, e)} title={t('workspaces.eliminarTitle')} style={{ fontSize: 12, color: '#c0392b', cursor: 'pointer' }}>{t('workspaces.eliminar')}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
