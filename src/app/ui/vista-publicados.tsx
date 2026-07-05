'use client';

import { useEffect, useState } from 'react';
import { listarPlanos, listarInstancias, listarHistorial } from '@/app/actions/plano.actions';
import type { PlanoComExp } from '@/domain/plano-com-exp';
import type { Instancia } from '@/domain/workspace';
import type { VersionSnapshot } from '@/domain/version';

const card = { border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem 1rem', margin: '0.5rem 0', background: '#fafafa' } as const;
const btn = { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 } as const;
const tagPub = { fontSize: 12, padding: '2px 6px', borderRadius: 4, background: '#d4f7d4', color: '#0a5' } as const;

interface Props {
  onVerVersiones: (planoId: string) => void;
}

export function VistaPublicados({ onVerVersiones }: Props) {
  const [planos, setPlanos] = useState<PlanoComExp[]>([]);
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [historiales, setHistoriales] = useState<Record<string, VersionSnapshot[]>>({});
  const [loading, setLoading] = useState(true);

  const cargar = () => {
    setLoading(true);
    Promise.all([listarPlanos(), listarInstancias()])
      .then(([ps, is]) => {
        const publicados = ps.filter((p) => p.publicado);
        setPlanos(publicados);
        setInstancias(is);
        return Promise.all(publicados.map((p) => listarHistorial(p.id).then((h) => [p.id, h] as const)));
      })
      .then((pares) => {
        const m: Record<string, VersionSnapshot[]> = {};
        for (const [id, h] of pares) m[id] = h;
        setHistoriales(m);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  function instanciaDe(planoId: string): Instancia | undefined {
    return instancias.find((i) => i.planoId === planoId);
  }

  return (
    <section>
      <div style={{ marginBottom: '0.75rem' }}>
        <button style={btn} onClick={cargar} disabled={loading}>
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>
      {planos.length === 0 && !loading && (
        <p style={{ color: '#666' }}>No hay planos publicados todavía. Publica uno desde "Nuevo Plano".</p>
      )}
      {planos.map((p) => {
        const inst = instanciaDe(p.id);
        const h = historiales[p.id] ?? [];
        return (
          <div key={p.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong>{p.entidad || '(sin entidad)'}</strong>
                <span style={{ marginLeft: 8, ...tagPub }}>PUBLICADO</span>
                <span style={{ marginLeft: 6, fontSize: 12, color: '#555' }}>v{p.version}</span>
                {inst && <span style={{ marginLeft: 6, fontSize: 12, color: '#555' }}>estado: {inst.estado}</span>}
              </div>
              <span style={{ fontSize: 12, color: '#888' }}>{p.id}</span>
            </div>
            <div style={{ fontSize: 13, color: '#555', margin: '0.25rem 0' }}>
              {p.productos.length} producto(s) · {p.cotizaciones.length} cotización(es) · {h.length} versión(es)
            </div>
            {h.length > 0 && (
              <div style={{ fontSize: 12, color: '#666', marginTop: '0.25rem' }}>
                Última publicación: {h.at(-1)?.timestamp?.slice(0, 19).replace('T', ' ')}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button style={btn} onClick={() => onVerVersiones(p.id)}>Ver historial</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
