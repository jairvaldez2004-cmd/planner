'use client';

// SIMULACIÓN — resultados de correr los procesos de la etapa sobre el espacio: tiempo total,
// carga por espacio y por rol (con cuellos de botella) y el recorrido cronológico marcando los
// cambios de espacio (caminatas). Lee del Mapa Operativo; no muta nada.

import type { CSSProperties } from 'react';
import type { ProcesoNodo } from '@/domain/mapa';
import { procesosDeEtapa } from '@/domain/mapa';
import type { EtapaObjetivo } from '@/domain/etapas';
import { simular } from '@/domain/simulacion';
import type { SimItem } from '@/domain/simulacion';

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const card: CSSProperties = { border: '1px solid #dde', borderRadius: 10, padding: '0.6rem 0.8rem', background: '#fff', minWidth: 120 };
const cap: CSSProperties = { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.3 };
const bignum: CSSProperties = { fontSize: 20, fontWeight: 'bold', color: '#2b5a97' };

function minutos(n: number): string {
  if (n < 60) return `${Math.round(n)} min`;
  const h = Math.floor(n / 60), m = Math.round(n % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

function Barras({ items, cuello, color }: { items: SimItem[]; cuello?: SimItem | undefined; color: string }) {
  const max = Math.max(1, ...items.map((i) => i.minutos));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((it) => (
        <div key={it.nombre}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
            <span style={{ fontWeight: cuello?.nombre === it.nombre ? 'bold' : 'normal' }}>{cuello?.nombre === it.nombre ? '🔥 ' : ''}{it.nombre} <span style={{ color: '#aaa' }}>({it.procesos})</span></span>
            <span style={{ color: '#666', fontVariantNumeric: 'tabular-nums' }}>{minutos(it.minutos)}</span>
          </div>
          <div style={{ height: 8, background: '#eef', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((it.minutos / max) * 100)}%`, height: '100%', background: color }} />
          </div>
        </div>
      ))}
      {items.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Sin datos (faltan espacios/roles o tiempos en los procesos).</p>}
    </div>
  );
}

export function SimulacionMapa({ procesos, etapa, onCerrar, onIrProceso }: {
  procesos: ProcesoNodo[]; etapa: EtapaObjetivo; onCerrar: () => void; onIrProceso?: (nombre: string) => void;
}) {
  const vigentes = procesosDeEtapa(procesos, etapa);
  const r = simular(vigentes);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>🎬 Simulación <span style={{ fontSize: 13, color: '#888' }}>· procesos sobre el espacio</span></h2>
        <button style={btn} onClick={onCerrar}>← Mapa</button>
      </div>
      <p style={{ fontSize: 12, color: '#888', margin: '0.2rem 0 0.8rem' }}>Estimación a partir de los tiempos, roles y espacios capturados en cada proceso. {r.sinTiempo > 0 && <span style={{ color: '#a60' }}>{r.sinTiempo} proceso(s) sin tiempo declarado (cuentan como 0 — captúralos para afinar).</span>}</p>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={card}><div style={cap}>Tiempo total</div><div style={bignum}>{minutos(r.totalMin)}</div></div>
        <div style={card}><div style={cap}>Procesos</div><div style={bignum}>{vigentes.length}</div></div>
        <div style={card}><div style={cap}>Cambios de espacio</div><div style={bignum}>🚶 {r.cambiosEspacio}</div></div>
        <div style={card}><div style={cap}>Cuello (espacio)</div><div style={{ ...bignum, fontSize: 15, color: '#c0392b' }}>{r.cuelloEspacio ? `${r.cuelloEspacio.nombre}` : '—'}</div></div>
        <div style={card}><div style={cap}>Cuello (rol)</div><div style={{ ...bignum, fontSize: 15, color: '#c0392b' }}>{r.cuelloRol ? `${r.cuelloRol.nombre}` : '—'}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.4rem' }}>📐 Carga por espacio</h3>
          <Barras items={r.porEspacio} cuello={r.cuelloEspacio} color="#e0795b" />
        </div>
        <div>
          <h3 style={{ margin: '0 0 0.4rem' }}>👤 Carga por rol</h3>
          <Barras items={r.porRol} cuello={r.cuelloRol} color="#8a4fbf" />
        </div>
      </div>

      <h3 style={{ margin: '1rem 0 0.4rem' }}>🚶 Recorrido cronológico <span style={{ fontSize: 12, color: '#888', fontWeight: 'normal' }}>({r.recorrido.length} pasos con espacio · {r.cambiosEspacio} caminatas)</span></h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, fontSize: 12.5 }}>
        {r.recorrido.map((p, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span style={{ color: p.cambio ? '#c0392b' : '#c9cfdd' }}>{p.cambio ? '🚶→' : '→'}</span>}
            <span onClick={() => onIrProceso?.(p.proceso)} title={p.proceso}
              style={{ cursor: onIrProceso ? 'pointer' : 'default', background: '#f2f4f8', border: '1px solid #dde', borderRadius: 12, padding: '2px 8px' }}>
              {p.espacio}
            </span>
          </span>
        ))}
        {r.recorrido.length === 0 && <span style={{ color: '#999' }}>Asigna espacios a los procesos para ver el recorrido.</span>}
      </div>
    </section>
  );
}
