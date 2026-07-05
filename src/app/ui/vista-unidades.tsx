'use client';

// Unidades Comerciales de un proyecto (áreas de venta directa). CRUD simple.

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { listarUnidades, crearUnidad, actualizarUnidad, eliminarUnidad } from '@/app/actions/espacios.actions';
import type { UnidadComercial } from '@/domain/espacios';

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const inp: CSSProperties = { padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 14 };
const card: CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: '0.6rem 0.9rem', margin: '0.4rem 0', background: '#fafafa' };

export function VistaUnidades({ proyectoId }: { proyectoId: string }) {
  const [ucs, setUcs] = useState<UnidadComercial[]>([]);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [loading, setLoading] = useState(true);

  const cargar = () => { setLoading(true); listarUnidades(proyectoId).then(setUcs).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);

  async function crear() {
    if (!nombre.trim()) return;
    await crearUnidad(proyectoId, nombre.trim(), tipo.trim() || undefined);
    setNombre(''); setTipo(''); cargar();
  }

  return (
    <section>
      <h3 style={{ marginTop: 0 }}>Unidades Comerciales</h3>
      <p style={{ fontSize: 13, color: '#555', marginTop: 0 }}>
        Las áreas de <strong>venta directa</strong> (cada una casi un mini-negocio). La administración/dirección/contabilidad va en la capa transversal, aparte.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.5rem 0' }}>
        <input style={{ ...inp, flex: 2, minWidth: 160 }} placeholder="Nombre (ej. Tatuajes)" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void crear(); }} />
        <input style={{ ...inp, flex: 1, minWidth: 120 }} placeholder="Tipo (opcional)" value={tipo} onChange={(e) => setTipo(e.target.value)} />
        <button style={btn} onClick={() => void crear()} disabled={!nombre.trim()}>＋ Nueva UC</button>
      </div>

      {loading && <p style={{ color: '#666' }}>Cargando…</p>}
      {!loading && ucs.length === 0 && <p style={{ color: '#666' }}>Sin unidades aún. Crea la primera arriba.</p>}
      {ucs.map((uc) => (
        <div key={uc.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ flex: 1 }}>
            <input style={{ ...inp, fontWeight: 'bold', width: '60%' }} defaultValue={uc.nombre}
              onBlur={(e) => { if (e.target.value !== uc.nombre) void actualizarUnidad(uc.id, { nombre: e.target.value }).then(cargar); }} />
            {uc.tipo && <span style={{ fontSize: 12, color: '#777', marginLeft: 8 }}>· {uc.tipo}</span>}
          </div>
          <button style={{ ...btn, color: '#a00' }} onClick={() => { if (confirm(`¿Eliminar "${uc.nombre}"?`)) void eliminarUnidad(uc.id).then(cargar); }}>Eliminar</button>
        </div>
      ))}
    </section>
  );
}
