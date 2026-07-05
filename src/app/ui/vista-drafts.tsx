'use client';

import { useEffect, useState } from 'react';
import { listarPlanos, listarInstancias, duplicarPlano } from '@/app/actions/plano.actions';
import type { PlanoComExp } from '@/domain/plano-com-exp';
import type { Instancia } from '@/domain/workspace';

const card = { border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem 1rem', margin: '0.5rem 0', background: '#fafafa' } as const;
const row = { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' as const, marginTop: '0.5rem' };
const btn = { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 } as const;
const tag = (pub: boolean) => ({ fontSize: 12, padding: '2px 6px', borderRadius: 4, background: pub ? '#d4f7d4' : '#fff3cd', color: pub ? '#0a5' : '#a60' });

interface Props {
  onAbrir: (planoId: string) => void;
}

export function VistaDrafts({ onAbrir }: Props) {
  const [planos, setPlanos] = useState<PlanoComExp[]>([]);
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [msg, setMsg] = useState('');

  const cargar = () => {
    setLoading(true);
    Promise.all([listarPlanos(), listarInstancias()])
      .then(([ps, is]) => { setPlanos(ps); setInstancias(is); })
      .catch(() => setMsg('Error al cargar desde DB.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const filtrados = planos.filter((p) =>
    !p.publicado &&
    (busqueda === '' ||
      p.entidad.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.id.toLowerCase().includes(busqueda.toLowerCase())),
  );

  function instanciaDe(planoId: string): Instancia | undefined {
    return instancias.find((i) => i.planoId === planoId);
  }

  async function onDuplicar(id: string) {
    const copia = await duplicarPlano(id);
    if (copia) { cargar(); setMsg(`Duplicado: ${copia.id}`); }
  }

  return (
    <section>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por entidad o ID…"
          style={{ padding: '0.35rem 0.6rem', borderRadius: 6, border: '1px solid #ccc', flex: 1, minWidth: 180 }}
        />
        <button style={btn} onClick={cargar} disabled={loading}>
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>
      {msg && <p style={{ color: '#0a5', margin: '0.25rem 0' }}>{msg}</p>}
      {filtrados.length === 0 && !loading && (
        <p style={{ color: '#666' }}>No hay drafts{busqueda ? ' que coincidan.' : '. Crea uno en "Nuevo Plano".'}</p>
      )}
      {filtrados.map((p) => {
        const inst = instanciaDe(p.id);
        return (
          <div key={p.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong>{p.entidad || '(sin entidad)'}</strong>
                <span style={{ marginLeft: 8, ...tag(false) }}>DRAFT</span>
                {inst && <span style={{ marginLeft: 6, fontSize: 12, color: '#555' }}>estado: {inst.estado}</span>}
              </div>
              <span style={{ fontSize: 12, color: '#888' }}>{p.id}</span>
            </div>
            <div style={{ fontSize: 13, color: '#555', margin: '0.25rem 0' }}>
              {p.productos.length} producto(s) · {p.cotizaciones.length} cotización(es) · v{p.version}
            </div>
            <div style={row}>
              <button style={{ ...btn, background: '#e8f5e9' }} onClick={() => onAbrir(p.id)}>Abrir</button>
              <button style={btn} onClick={() => void onDuplicar(p.id)}>Duplicar</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
