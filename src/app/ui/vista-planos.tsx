'use client';

// Administración / Planos de empresa: grafo de los 13 planos + Coordinador determinista.
// (Se abre desde el nodo "Administración" del grafo de proyecto.)

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { obtenerGrafoPlanos, generarPaqueteEntregables, obtenerPaqueteDetallado, simularEmpresaProyecto } from '@/app/actions/especialista.actions';
import type { GrafoPlanos, NodoPlano, ReporteSimulacion } from '@/app/actions/especialista.actions';
import { PAQUETES } from '@/domain/entregables';
import { DocumentoPaqueteView } from './documento-plano-view';
import type { PaqueteDetallado } from './documento-plano-view';
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
  const [verEntregables, setVerEntregables] = useState(false);
  const [verSimulacion, setVerSimulacion] = useState(false);

  const cargar = () => { setLoading(true); obtenerGrafoPlanos(proyectoId).then(setGrafo).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);

  if (planoAbierto) return <VistaPlano proyectoId={proyectoId} planoId={planoAbierto} onVolver={() => { setPlanoAbierto(null); cargar(); }} />;
  if (verEntregables) return <PanelEntregables proyectoId={proyectoId} onVolver={() => setVerEntregables(false)} />;
  if (verSimulacion) return <PanelSimulacion proyectoId={proyectoId} onVolver={() => setVerSimulacion(false)} />;

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
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button style={{ ...btn, borderColor: '#2b7a93', color: '#1f5c70', fontWeight: 'bold' }} onClick={() => setVerSimulacion(true)}>🏢 Simular empresa</button>
          <button style={{ ...btn, borderColor: '#8a4fbf', color: '#6a3aa0', fontWeight: 'bold' }} onClick={() => setVerEntregables(true)}>📦 Generar entregables</button>
          <button style={btn} onClick={onVolver}>← Proyecto</button>
        </div>
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

// ===== SIMULACIÓN EMPRESARIAL: valida la lógica del negocio antes de publicar =====
const VEREDICTO_INFO: Record<string, { label: string; color: string; emoji: string }> = {
  'coherente': { label: 'Diseño coherente', color: '#2e9e63', emoji: '🟢' },
  'con-observaciones': { label: 'Con observaciones', color: '#d9781f', emoji: '🟡' },
  'bloqueado': { label: 'Bloqueado', color: '#c0392b', emoji: '🔴' },
};
function PanelSimulacion({ proyectoId, onVolver }: { proyectoId: string; onVolver: () => void }) {
  const [rep, setRep] = useState<ReporteSimulacion | null>(null);
  const [load, setLoad] = useState(false);
  const [serviciosDia, setServiciosDia] = useState('');
  const [tServicio, setTServicio] = useState('40');
  const [horas, setHoras] = useState('8');
  const [dias, setDias] = useState('26');

  async function correr() {
    setLoad(true);
    try {
      const r = await simularEmpresaProyecto(proyectoId, {
        serviciosPorDia: Number(serviciosDia) || 0, tiempoPorServicioMin: Number(tServicio) || 0, horasOperativas: Number(horas) || 8, diasPorMes: Number(dias) || 26,
      });
      setRep(r);
    } catch { setRep(null); } finally { setLoad(false); }
  }
  useEffect(() => { void correr(); /* eslint-disable-next-line */ }, []);

  const stat: CSSProperties = { border: '1px solid #bcd8e6', borderRadius: 9, padding: '0.5rem 0.7rem', background: '#fff', textAlign: 'center' };
  const v = rep ? VEREDICTO_INFO[rep.veredicto]! : null;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>🏢 Simulación empresarial <span style={{ fontSize: 13, color: '#888' }}>· valida la lógica antes de publicar</span></h2>
        <button style={btn} onClick={onVolver}>← Planos</button>
      </div>
      <p style={{ fontSize: 12, color: '#777', margin: '0.3rem 0 0.6rem' }}>
        Una “corrida” del negocio en papel: capacidad, producción, consumo de insumos, nómina, costos, ingresos y riesgos. Marca lo que falta como PENDIENTE y lista los <strong>hallazgos</strong> a resolver antes de generar el software operativo.
      </p>

      {/* Supuestos */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.7rem', background: '#f7fbfd', border: '1px solid #cfe3ea', borderRadius: 9, padding: '0.5rem 0.7rem' }}>
        <label style={{ fontSize: 11.5, color: '#555' }}>Min/servicio<br /><input style={{ width: 80, padding: '0.25rem', borderRadius: 5, border: '1px solid #ccc' }} value={tServicio} onChange={(e) => setTServicio(e.target.value)} /></label>
        <label style={{ fontSize: 11.5, color: '#555' }}>Servicios/día<br /><input style={{ width: 90, padding: '0.25rem', borderRadius: 5, border: '1px solid #ccc' }} placeholder="máx" value={serviciosDia} onChange={(e) => setServiciosDia(e.target.value)} /></label>
        <label style={{ fontSize: 11.5, color: '#555' }}>Horas/día<br /><input style={{ width: 70, padding: '0.25rem', borderRadius: 5, border: '1px solid #ccc' }} value={horas} onChange={(e) => setHoras(e.target.value)} /></label>
        <label style={{ fontSize: 11.5, color: '#555' }}>Días/mes<br /><input style={{ width: 70, padding: '0.25rem', borderRadius: 5, border: '1px solid #ccc' }} value={dias} onChange={(e) => setDias(e.target.value)} /></label>
        <button style={{ ...btn, background: '#2b7a93', color: '#fff', borderColor: '#2b7a93' }} disabled={load} onClick={() => void correr()}>{load ? 'Simulando…' : '▶ Correr simulación'}</button>
      </div>

      {rep && v && (
        <>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: v.color, color: '#fff', borderRadius: 8, padding: '0.3rem 0.8rem', fontWeight: 'bold', marginBottom: '0.7rem' }}>
            {v.emoji} Veredicto: {v.label}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem', marginBottom: '0.8rem' }}>
            <div style={stat}><div style={{ fontSize: 18, fontWeight: 'bold', color: '#2b7a93' }}>{rep.capacidad.serviciosPorDiaMax}</div><div style={{ fontSize: 11, color: '#888' }}>servicios/día (capacidad)</div></div>
            <div style={stat}><div style={{ fontSize: 18, fontWeight: 'bold', color: '#2b7a93' }}>{rep.produccion.serviciosPorMes}</div><div style={{ fontSize: 11, color: '#888' }}>servicios/mes (simulado)</div></div>
            <div style={stat}><div style={{ fontSize: 18, fontWeight: 'bold', color: '#6b5320' }}>{rep.capacidad.tiempoPorServicioMin} min</div><div style={{ fontSize: 11, color: '#888' }}>por servicio · {rep.capacidad.cabinas} cabina(s)</div></div>
            <div style={stat}><div style={{ fontSize: 18, fontWeight: 'bold', color: '#8a93a8' }}>{rep.capacidad.tiempoTotalMapaMin} min</div><div style={{ fontSize: 11, color: '#888' }}>carga total del mapa</div></div>
            <div style={stat}><div style={{ fontSize: 18, fontWeight: 'bold', color: '#8a4fbf' }}>{rep.nomina.personasInternas}</div><div style={{ fontSize: 11, color: '#888' }}>personas internas</div></div>
            <div style={stat}><div style={{ fontSize: 18, fontWeight: 'bold', color: rep.consumo.some((c) => c.alerta) ? '#c0392b' : '#2e9e63' }}>{rep.consumo.filter((c) => c.alerta).length}</div><div style={{ fontSize: 11, color: '#888' }}>insumos en alerta</div></div>
            <div style={stat}><div style={{ fontSize: 18, fontWeight: 'bold', color: rep.riesgos.proveedoresUnicosSinPlanB ? '#c0392b' : '#2e9e63' }}>{rep.riesgos.proveedoresUnicosSinPlanB}</div><div style={{ fontSize: 11, color: '#888' }}>proveedor único sin plan B</div></div>
          </div>

          {/* Consumo de insumos */}
          {rep.consumo.length > 0 && (
            <div style={{ border: '1px solid #e0d3b0', borderRadius: 9, padding: '0.6rem', marginBottom: '0.7rem', background: '#fff' }}>
              <strong style={{ fontSize: 13, color: '#6b5320' }}>🧴 Consumo de insumos a {rep.produccion.serviciosPorDia} servicios/día</strong>
              <div style={{ overflowX: 'auto', marginTop: 4 }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                  <thead><tr>{['Insumo', 'Por servicio', 'Por mes', 'Stock', 'Cobertura', ''].map((h) => <th key={h} style={{ border: '1px solid #eee', padding: '2px 6px', background: '#f0ead9', textAlign: 'left' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {rep.consumo.map((c, i) => (
                      <tr key={i} style={{ background: c.alerta ? '#fdecea' : 'transparent' }}>
                        <td style={{ border: '1px solid #eee', padding: '2px 6px' }}>{c.insumo}{!c.enCatalogo && <span style={{ color: '#c60' }}> ⚠ sin catálogo</span>}</td>
                        <td style={{ border: '1px solid #eee', padding: '2px 6px' }}>{c.porServicio} {c.unidad}</td>
                        <td style={{ border: '1px solid #eee', padding: '2px 6px' }}>{c.porMes} {c.unidad}</td>
                        <td style={{ border: '1px solid #eee', padding: '2px 6px' }}>{c.stockActual ?? '—'}</td>
                        <td style={{ border: '1px solid #eee', padding: '2px 6px', color: c.alerta ? '#c0392b' : '#555' }}>{c.diasCobertura !== null ? `${c.diasCobertura} d` : '—'}</td>
                        <td style={{ border: '1px solid #eee', padding: '2px 6px' }}>{c.alerta ? '🔴' : '🟢'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Finanzas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.5rem', marginBottom: '0.7rem' }}>
            <div style={{ border: '1px solid #e0d3b0', borderRadius: 9, padding: '0.5rem 0.7rem', background: '#fff' }}>
              <strong style={{ fontSize: 12.5, color: '#6b5320' }}>💵 Ingresos (fuentes: {rep.ingresos.fuentes})</strong>
              <div style={{ fontSize: 12, color: rep.ingresos.total !== null ? '#2e9e63' : '#c60', marginTop: 3 }}>{rep.ingresos.total !== null ? `$${rep.ingresos.total}` : `PENDIENTE (${rep.ingresos.sinPrecio} sin precio)`}</div>
            </div>
            <div style={{ border: '1px solid #e0d3b0', borderRadius: 9, padding: '0.5rem 0.7rem', background: '#fff' }}>
              <strong style={{ fontSize: 12.5, color: '#6b5320' }}>💸 Costos/mes (líneas: {rep.costosMes.lineas})</strong>
              <div style={{ fontSize: 12, color: rep.costosMes.total !== null ? '#c0392b' : '#c60', marginTop: 3 }}>{rep.costosMes.total !== null ? `$${rep.costosMes.total}` : `PENDIENTE (${rep.costosMes.pendientes} sin monto)`}</div>
            </div>
            <div style={{ border: '1px solid #e0d3b0', borderRadius: 9, padding: '0.5rem 0.7rem', background: '#fff' }}>
              <strong style={{ fontSize: 12.5, color: '#6b5320' }}>👥 Nómina</strong>
              <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>{rep.nomina.personasInternas} personas · {rep.nomina.personasSinCifra ? `${rep.nomina.personasSinCifra} sin cifra` : `$${rep.nomina.mensualConocido}/mes`}</div>
            </div>
          </div>

          {/* Hallazgos */}
          <div style={{ border: `1px solid ${rep.hallazgos.length ? '#f0c9c2' : '#bfe6cf'}`, borderRadius: 9, padding: '0.6rem 0.8rem', background: rep.hallazgos.length ? '#fdf3f1' : '#eefaf2' }}>
            <strong style={{ fontSize: 13, color: rep.hallazgos.length ? '#c0392b' : '#2f6b4d' }}>{rep.hallazgos.length ? `⚠ ${rep.hallazgos.length} hallazgo(s) a resolver antes de publicar` : '✅ Sin incoherencias detectadas'}</strong>
            {rep.hallazgos.length > 0 && <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem', fontSize: 12.5, color: '#7a3a30' }}>{rep.hallazgos.map((h, i) => <li key={i} style={{ marginBottom: 2 }}>{h}</li>)}</ul>}
          </div>
        </>
      )}
    </section>
  );
}

// ===== GENERACIÓN DE ENTREGABLES: cada paquete = un LIBRO estilizado con índice de capítulos =====
function PanelEntregables({ proyectoId, onVolver }: { proyectoId: string; onVolver: () => void }) {
  const [gen, setGen] = useState<string | null>(null);
  const [pkg, setPkg] = useState<PaqueteDetallado | null>(null);
  const [exportando, setExportando] = useState(false);

  async function abrir(id: string) {
    setGen(id);
    try { setPkg(await obtenerPaqueteDetallado(proyectoId, id)); } catch { setPkg(null); } finally { setGen(null); }
  }
  async function exportarMd() {
    if (!pkg) return;
    setExportando(true);
    try {
      const d = await generarPaqueteEntregables(proyectoId, pkg.paqueteId);
      if (!d) return;
      const blob = new Blob([d.markup], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${pkg.paqueteId}.md`; a.click(); URL.revokeObjectURL(url);
    } catch { /* noop */ } finally { setExportando(false); }
  }

  if (pkg) return <DocumentoPaqueteView pkg={pkg} onCerrar={() => setPkg(null)} onExportar={() => void exportarMd()} exportando={exportando} />;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>📦 Generación de entregables <span style={{ fontSize: 13, color: '#888' }}>· cada paquete es un libro con índice</span></h2>
        <button style={btn} onClick={onVolver}>← Planos</button>
      </div>
      <p style={{ fontSize: 12, color: '#777', margin: '0.3rem 0 0.7rem' }}>
        Cada paquete junta los planos de una audiencia como un <strong>libro con índice de capítulos</strong> (la <strong>configuración inicial</strong> de la empresa). Cada capítulo trae sus tablas como docs anidados. Hereda los <strong>⚠ PENDIENTE</strong>; no inventa. Imprimible a PDF y exportable a Markdown.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.6rem' }}>
        {PAQUETES.map((p) => (
          <div key={p.id} style={{ border: '1px solid #ddcdef', borderLeft: '4px solid #8a4fbf', borderRadius: 9, padding: '0.6rem 0.7rem', background: '#fff' }}>
            <div style={{ fontWeight: 'bold', fontSize: 13.5 }}>{p.icono} {p.nombre}</div>
            <div style={{ fontSize: 11.5, color: '#777', margin: '2px 0 6px' }}>{p.descripcion}</div>
            <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>{p.planos.length} capítulo(s)</div>
            <button style={{ ...btn, fontSize: 13, background: '#8a4fbf', color: '#fff', borderColor: '#8a4fbf' }} disabled={gen === p.id} onClick={() => void abrir(p.id)}>{gen === p.id ? 'Abriendo…' : '📖 Abrir libro'}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
