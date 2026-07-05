'use client';

import { useEffect, useState } from 'react';
import { listarPlanos, listarHistorial, restaurarVersion } from '@/app/actions/plano.actions';
import type { PlanoComExp } from '@/domain/plano-com-exp';
import type { VersionSnapshot } from '@/domain/version';

const card = { border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem 1rem', margin: '0.5rem 0', background: '#fafafa' } as const;
const btn = { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 } as const;
const row = { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' as const };

interface Props {
  planoIdInicial?: string | undefined;
  onRestaurado?: (nuevoDraftId: string) => void;
}

export function VistaVersiones({ planoIdInicial, onRestaurado }: Props) {
  const [planos, setPlanos] = useState<PlanoComExp[]>([]);
  const [planoSel, setPlanoSel] = useState(planoIdInicial ?? '');
  const [historial, setHistorial] = useState<VersionSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [restaurando, setRestaurando] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    listarPlanos().then(setPlanos).catch(console.error);
  }, []);

  useEffect(() => {
    if (planoIdInicial) setPlanoSel(planoIdInicial);
  }, [planoIdInicial]);

  useEffect(() => {
    if (!planoSel) { setHistorial([]); return; }
    setLoading(true);
    listarHistorial(planoSel)
      .then(setHistorial)
      .catch(() => setMsg('Error al cargar historial.'))
      .finally(() => setLoading(false));
  }, [planoSel]);

  async function onRestaurar(version: number) {
    if (!planoSel) return;
    setRestaurando(version);
    try {
      const draft = await restaurarVersion(planoSel, version);
      setMsg(`Nueva draft creada: ${draft.id} (la versión original queda intacta).`);
      if (onRestaurado) onRestaurado(draft.id);
    } catch (e) {
      setMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRestaurando(null);
    }
  }

  return (
    <section>
      <div style={{ ...row, marginBottom: '0.75rem' }}>
        <select
          value={planoSel}
          onChange={(e) => setPlanoSel(e.target.value)}
          style={{ padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid #ccc', flex: 1, minWidth: 200 }}
        >
          <option value="">(seleccionar plano)</option>
          {planos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.entidad || p.id} {p.publicado ? '✓' : '(draft)'}
            </option>
          ))}
        </select>
      </div>

      {msg && <p style={{ color: '#0a5', margin: '0.25rem 0' }}>{msg}</p>}

      {loading && <p style={{ color: '#666' }}>Cargando historial…</p>}

      {!loading && planoSel && historial.length === 0 && (
        <p style={{ color: '#666' }}>Este plano no tiene versiones publicadas aún.</p>
      )}

      {historial.map((snap) => (
        <div key={`${snap.planoId}-${snap.version}`} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <strong>v{snap.version}</strong>
              <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 6px', borderRadius: 4,
                background: snap.publicado ? '#d4f7d4' : '#fff3cd',
                color: snap.publicado ? '#0a5' : '#a60' }}>
                {snap.publicado ? 'publicado' : 'draft'}
              </span>
            </div>
            <span style={{ fontSize: 12, color: '#888' }}>{snap.timestamp.slice(0, 19).replace('T', ' ')}</span>
          </div>
          <div style={{ fontSize: 13, color: '#555', margin: '0.25rem 0' }}>
            {snap.plano.productos.length} producto(s) · {snap.plano.cotizaciones.length} cotización(es)
          </div>
          <div style={{ ...row, marginTop: '0.4rem' }}>
            <button
              style={btn}
              onClick={() => void onRestaurar(snap.version)}
              disabled={restaurando !== null}
            >
              {restaurando === snap.version ? 'Restaurando…' : 'Restaurar como draft'}
            </button>
          </div>
        </div>
      ))}

      {!planoSel && !loading && (
        <p style={{ color: '#666' }}>Selecciona un plano para ver su historial de versiones.</p>
      )}
    </section>
  );
}
