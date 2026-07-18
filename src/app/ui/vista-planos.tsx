'use client';

// Administración / Planos de empresa: grafo de los 13 planos + Coordinador determinista.
// (Se abre desde el nodo "Administración" del grafo de proyecto.)

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { obtenerGrafoPlanos } from '@/app/actions/especialista.actions';
import type { GrafoPlanos, NodoPlano } from '@/app/actions/especialista.actions';
import { COLOR_ESTADO, LABEL_ESTADO } from '@/app/readiness/readiness-engine';
import type { EstadoPlano } from '@/app/readiness/readiness-engine';
import { etapaInfo, objetivoDe, esFoco } from '@/domain/etapas';
import { VistaPlano } from './vista-plano';
import { useEsMovil } from './use-movil';

const btn: CSSProperties = { padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 14 };
const ENTREGA_ICON: Record<string, string> = { documento: '📄', tabla: '📊', diagrama: '🔀', dashboard: '📈' };

export function VistaPlanos({ proyectoId, onVolver }: { proyectoId: string; onVolver: () => void }) {
  const [grafo, setGrafo] = useState<GrafoPlanos | null>(null);
  const [loading, setLoading] = useState(true);
  const movil = useEsMovil();
  const [hover, setHover] = useState<string | null>(null);
  const [planoAbierto, setPlanoAbierto] = useState<string | null>(null);

  const cargar = () => { setLoading(true); obtenerGrafoPlanos(proyectoId).then(setGrafo).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);

  if (planoAbierto) return <VistaPlano proyectoId={proyectoId} planoId={planoAbierto} onVolver={() => { setPlanoAbierto(null); cargar(); }} />;

  const nodos = grafo?.nodos ?? [];
  const seleccionados = nodos.filter((n) => n.seleccionado);
  const etapa = grafo?.etapaObjetivo;
  const etInfo = etapaInfo(etapa);
  // Siguiente: prioriza un plano del FOCO de la etapa que aún no llega a su objetivo.
  const siguiente = (etapa ? seleccionados.find((n) => esFoco(etapa, n.planoId) && Math.round(n.progreso * 100) < objetivoDe(etapa, n.planoId)) : undefined)
    ?? seleccionados.find((n) => n.estado === 'DISPONIBLE' || n.estado === 'MIN_OPERABLE')
    ?? seleccionados.find((n) => n.estado !== 'PUBLICADO' && n.estado !== 'COMPLETO');
  const publicados = seleccionados.filter((n) => n.estado === 'PUBLICADO' || n.estado === 'COMPLETO').length;
  const minOp = seleccionados.filter((n) => n.estado === 'MIN_OPERABLE').length;

  const W = 760, H = 560, cx = W / 2, cy = H / 2, R = 215;
  const posOf = (i: number, n: number) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; };
  const posById = new Map(nodos.map((n, i) => [n.planoId, posOf(i, nodos.length)]));
  const estados: EstadoPlano[] = ['LOCKED', 'DISPONIBLE', 'MIN_OPERABLE', 'PUBLICADO', 'COMPLETO'];

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Administración · Planos <span style={{ fontSize: 13, color: '#888' }}>· Coordinador + grafo</span></h2>
        <button style={btn} onClick={onVolver}>← Proyecto</button>
      </div>

      {loading && <p style={{ color: '#666' }}>Cargando planos…</p>}
      {!loading && grafo && (
        <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : 'minmax(300px, 4fr) 8fr', gap: '1rem', alignItems: 'start', marginTop: '0.75rem' }}>
          <div style={{ border: '1px solid #cdd8ef', borderRadius: 10, padding: '0.75rem', background: '#f7f9ff' }}>
            <strong style={{ fontSize: 14 }}>Coordinador del proyecto</strong>
            <p style={{ margin: '0.25rem 0 0.5rem', fontSize: 12, color: '#555' }}>
              Profundidad: <strong>{grafo.profundidadProyecto}</strong> · {seleccionados.length} planos · {publicados} publicados · {minOp} mín. operable.
            </p>
            {etInfo ? (
              <div style={{ border: '1px solid #b3d4ff', borderRadius: 8, padding: '0.4rem 0.6rem', background: '#eaf3ff', marginBottom: '0.5rem', fontSize: 12 }}>
                🎚️ Etapa <strong>{etInfo.n}. {etInfo.label}</strong>
                <div style={{ color: '#2b5a97', marginTop: 2 }}>Foco: {etInfo.foco.join(' · ')}</div>
              </div>
            ) : (
              <div style={{ border: '1px dashed #b3b3b3', borderRadius: 8, padding: '0.4rem 0.6rem', background: '#fafafa', marginBottom: '0.5rem', fontSize: 11.5, color: '#888' }}>
                Sin etapa definida. Fíjala en la vista del proyecto (o dile al Curador) para ver el objetivo por plano.
              </div>
            )}
            {siguiente ? (
              <div style={{ border: '1px solid #b3d4ff', borderRadius: 8, padding: '0.5rem 0.7rem', background: '#eaf3ff', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: 12, color: '#555' }}>Siguiente recomendado:</div>
                <strong>{ENTREGA_ICON[siguiente.entrega]} {siguiente.nombre}</strong>
                <div style={{ fontSize: 12, color: '#777' }}>{LABEL_ESTADO[siguiente.estado]} · {Math.round(siguiente.progreso * 100)}%</div>
                <button style={{ ...btn, marginTop: '0.4rem' }} onClick={() => setPlanoAbierto(siguiente.planoId)}>Trabajar este plano →</button>
              </div>
            ) : <p style={{ fontSize: 13, color: '#2e9e63' }}>✅ Todos los planos seleccionados están publicados.</p>}
            <div style={{ fontSize: 13 }}>
              {seleccionados.map((n) => {
                const pct = Math.round(n.progreso * 100);
                const obj = objetivoDe(etapa, n.planoId);
                const foco = esFoco(etapa, n.planoId);
                const faltaParaObj = etapa && obj > 0 && pct < obj;
                return (
                  <div key={n.planoId} onClick={() => setPlanoAbierto(n.planoId)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0.25rem 0.3rem', borderRadius: 6, background: hover === n.planoId ? '#eef4ff' : (foco ? '#f3f8ff' : 'transparent') }}
                    onMouseEnter={() => setHover(n.planoId)} onMouseLeave={() => setHover(null)}>
                    <span>{foco && <span title="Foco de la etapa" style={{ color: '#2b5a97' }}>★ </span>}{ENTREGA_ICON[n.entrega]} {n.nombre} {n.minOperable && <span style={{ color: '#a60', fontSize: 11 }}>·mín</span>}</span>
                    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                      <span style={{ background: COLOR_ESTADO[n.estado], color: '#fff', borderRadius: 5, padding: '0 0.4rem', fontSize: 11 }}>{pct}%</span>
                      {etapa && obj > 0 && <span title="Objetivo de la etapa" style={{ fontSize: 10, color: faltaParaObj ? '#a60' : '#2e9e63' }}>/ {obj}%</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '0.6rem', borderTop: '1px solid #e3e9f5', paddingTop: '0.4rem' }}>
              {estados.map((e) => (
                <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 8, fontSize: 11, color: '#555' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_ESTADO[e], display: 'inline-block' }} /> {LABEL_ESTADO[e]}
                </span>
              ))}
            </div>
          </div>

          <div style={{ border: '1px solid #eee', borderRadius: 10, background: '#fcfcfc' }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              {grafo.aristas.map((a, i) => { const p = posById.get(a.de); const q = posById.get(a.a); if (!p || !q) return null; return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#dcdcdc" strokeWidth={1} />; })}
              {nodos.map((n: NodoPlano) => {
                const p = posById.get(n.planoId)!; const activo = hover === n.planoId; const col = COLOR_ESTADO[n.estado];
                return (
                  <g key={n.planoId} style={{ cursor: 'pointer' }} onMouseEnter={() => setHover(n.planoId)} onMouseLeave={() => setHover(null)} onClick={() => setPlanoAbierto(n.planoId)}>
                    <circle cx={p.x} cy={p.y} r={activo ? 30 : 26} fill={col} opacity={n.seleccionado ? 1 : 0.35} stroke="#fff" strokeWidth={2} />
                    <text x={p.x} y={p.y + 3} textAnchor="middle" fill="#fff" fontSize={10} fontWeight="bold">{n.planoId}</text>
                    <text x={p.x} y={p.y + 40} textAnchor="middle" fill="#333" fontSize={11}>{n.nombre}</text>
                  </g>
                );
              })}
            </svg>
            <p style={{ fontSize: 12, color: '#888', padding: '0 0.75rem 0.5rem' }}>Nodos = 13 planos (atenuados = no seleccionados). Color = estado. Clic para entrar.</p>
          </div>
        </div>
      )}
    </section>
  );
}
