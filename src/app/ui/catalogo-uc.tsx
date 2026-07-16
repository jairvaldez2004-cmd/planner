'use client';

// Catálogo de una Unidad Comercial: lista de OFERTAS + alta. Entrar abre el EditorOferta.
// Ref: PLANNER_CATALOG_TO_OFFERING_V1.md. (Distinto del vista-catalogo.tsx de COM-EXP/export.)

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { listarOfertas, crearOferta, eliminarOferta } from '@/app/actions/oferta.actions';
import type { Oferta, TipoEntregable } from '@/domain/oferta';
import { TIPOS_ENTREGABLE } from '@/domain/oferta';
import { EditorOferta } from './editor-oferta';

const inp: CSSProperties = { padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 14 };
const btn: CSSProperties = { padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 14 };
const btnSm: CSSProperties = { padding: '0.15rem 0.5rem', borderRadius: 5, border: '1px solid #bbb', background: '#fff', cursor: 'pointer', fontSize: 12 };
const card: CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: '0.6rem 0.9rem', margin: '0.4rem 0', background: '#fafafa' };

export function CatalogoUC({ proyectoId, ucId, ucNombre }: { proyectoId: string; ucId: string; ucNombre: string }) {
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoEntregable>('servicio');
  const [abierta, setAbierta] = useState<Oferta | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = () => { setLoading(true); listarOfertas(proyectoId, ucId).then(setOfertas).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId, ucId]);

  if (abierta) return <EditorOferta proyectoId={proyectoId} oferta={abierta} procesos={ofertas.map((o) => ({ id: o.id, nombre: o.nombre }))} onVolver={() => { setAbierta(null); cargar(); }} />;

  async function crear() {
    if (!nombre.trim()) return;
    const o = await crearOferta(proyectoId, ucId, nombre.trim(), tipo);
    setNombre(''); setOfertas((a) => [...a, o]); setAbierta(o);
  }
  async function borrar(o: Oferta) {
    if (!confirm(`¿Eliminar la oferta "${o.nombre}" y sus presentaciones?`)) return;
    setOfertas((a) => a.filter((x) => x.id !== o.id)); await eliminarOferta(o.id);
  }

  return (
    <div>
      <strong style={{ fontSize: 14 }}>🏷️ Catálogo de {ucNombre}</strong>
      <p style={{ fontSize: 12, color: '#666', margin: '0.25rem 0 0.5rem' }}>¿Qué vende esta unidad? Cada <strong>oferta</strong> = lo que el cliente compra (bien o servicio). Dentro de cada una defines su <strong>ruta de entrega</strong> y sus <strong>presentaciones</strong>.</p>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <input style={{ ...inp, flex: 2, minWidth: 160 }} placeholder="Nueva oferta (ej. Aguacate Hass · Manicura · Asesoría)" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void crear(); }} />
        <select style={inp} value={tipo} onChange={(e) => setTipo(e.target.value as TipoEntregable)}>
          {TIPOS_ENTREGABLE.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button style={btn} onClick={() => void crear()} disabled={!nombre.trim()}>＋ Oferta</button>
      </div>

      {loading && <p style={{ fontSize: 13, color: '#888' }}>Cargando…</p>}
      {!loading && ofertas.length === 0 && <p style={{ fontSize: 13, color: '#999' }}>Sin ofertas aún. Crea la primera arriba.</p>}
      {ofertas.map((o) => {
        const t = TIPOS_ENTREGABLE.find((x) => x.id === o.tipoEntregable);
        return (
          <div key={o.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: 14 }}>{o.nombre}</strong>
              <span style={{ fontSize: 12, color: '#888', marginLeft: 6 }}>· {t?.label ?? o.tipoEntregable}{o.categoria ? ` · ${o.categoria}` : ''}</span>
              {o.descripcion && <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>{o.descripcion}</div>}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button style={btn} onClick={() => setAbierta(o)}>Abrir →</button>
              <button style={{ ...btnSm, color: '#a00' }} onClick={() => void borrar(o)}>Eliminar</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
