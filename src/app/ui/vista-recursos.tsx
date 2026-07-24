'use client';

// RECURSOS & PROVEEDORES — catálogo maestro de todo lo que el negocio necesita (insumos,
// herramientas, equipo, muebles, materiales, servicios) con costo, cantidad, unidad,
// impuesto, proveedor y un GRUPO libre para AGRUPAR COMO SE QUIERA. Alimenta Financiero
// (costos), Tecnológico (equipo) y Comercial (proveedores).

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { listarRecursos, guardarRecurso, eliminarRecurso, listarProveedores, guardarProveedor, eliminarProveedor } from '@/app/actions/recursos.actions';
import { CATEGORIAS_RECURSO, categoriaRecurso, TIPOS_PROVEEDOR, recursoVacio, proveedorVacio, subtotalRecurso, formatoMoneda } from '@/domain/recursos';
import type { Recurso, Proveedor } from '@/domain/recursos';
import { useEsMovil } from './use-movil';

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const btnSm: CSSProperties = { ...btn, padding: '0.15rem 0.5rem', fontSize: 12 };
const inp: CSSProperties = { padding: '0.35rem 0.55rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: '#666', marginTop: '0.5rem', fontWeight: 'bold' };

type Agrupar = 'categoria' | 'grupo' | 'proveedor' | 'ninguno';

export function VistaRecursos({ proyectoId }: { proyectoId: string }) {
  const [recs, setRecs] = useState<Recurso[]>([]);
  const [provs, setProvs] = useState<Proveedor[]>([]);
  const [tab, setTab] = useState<'recursos' | 'proveedores'>('recursos');
  const [agrupar, setAgrupar] = useState<Agrupar>('categoria');
  const [selR, setSelR] = useState<string | null>(null);
  const [selP, setSelP] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const movil = useEsMovil();

  const cargar = () => {
    setLoading(true);
    Promise.all([listarRecursos(proyectoId), listarProveedores(proyectoId)])
      .then(([r, p]) => { setRecs(r); setProvs(p); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);

  const rSel = recs.find((x) => x.id === selR) ?? null;
  const pSel = provs.find((x) => x.id === selP) ?? null;

  async function nuevoRec() { const n = await guardarRecurso(proyectoId, { ...recursoVacio(''), nombre: 'Nuevo recurso' }); setRecs((l) => [...l, n]); setSelR(n.id); }
  async function patchRec(partial: Partial<Recurso>) { if (!rSel) return; const u = { ...rSel, ...partial }; setRecs((l) => l.map((x) => x.id === u.id ? u : x)); await guardarRecurso(proyectoId, u); }
  async function borrarRec() { if (!rSel) return; if (!window.confirm(`¿Eliminar "${rSel.nombre}"?`)) return; await eliminarRecurso(proyectoId, rSel.id); setSelR(null); cargar(); }

  async function nuevoProv() { const n = await guardarProveedor(proyectoId, { ...proveedorVacio(''), nombre: 'Nuevo proveedor' }); setProvs((l) => [...l, n]); setSelP(n.id); }
  async function patchProv(partial: Partial<Proveedor>) { if (!pSel) return; const u = { ...pSel, ...partial }; setProvs((l) => l.map((x) => x.id === u.id ? u : x)); await guardarProveedor(proyectoId, u); }
  async function borrarProv() { if (!pSel) return; if (!window.confirm(`¿Eliminar "${pSel.nombre}"?`)) return; await eliminarProveedor(proyectoId, pSel.id); setSelP(null); cargar(); }

  // Agrupación libre + subtotales
  const claveGrupo = (r: Recurso) => agrupar === 'categoria' ? categoriaRecurso(r.categoria).label : agrupar === 'grupo' ? (r.grupo || '(sin grupo)') : agrupar === 'proveedor' ? (r.proveedor || '(sin proveedor)') : 'Todos';
  const grupos = new Map<string, Recurso[]>();
  for (const r of recs) { const k = claveGrupo(r); grupos.set(k, [...(grupos.get(k) ?? []), r]); }
  const subtotalDe = (arr: Recurso[]) => arr.reduce((s, r) => s + (subtotalRecurso(r) ?? 0), 0);
  const total = subtotalDe(recs);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>📦 Recursos & Proveedores <span style={{ fontSize: 13, color: '#888' }}>· catálogo del negocio</span></h2>
        {tab === 'recursos' ? <button style={btn} onClick={() => void nuevoRec()}>＋ Recurso</button> : <button style={btn} onClick={() => void nuevoProv()}>＋ Proveedor</button>}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', margin: '0.5rem 0 0.4rem', flexWrap: 'wrap' }}>
        {([['recursos', '📦 Recursos'], ['proveedores', '🏭 Proveedores']] as const).map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setSelR(null); setSelP(null); }}
            style={{ ...btn, background: tab === id ? '#a9720f' : '#fff', color: tab === id ? '#fff' : '#6b5320', borderColor: tab === id ? '#a9720f' : '#e0d3b0', fontWeight: 'bold' }}>{label}</button>
        ))}
      </div>

      {loading && <p style={{ color: '#666' }}>Cargando…</p>}

      {/* ======= RECURSOS ======= */}
      {tab === 'recursos' && (
        <>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', margin: '0 0 0.6rem' }}>
            <span style={{ fontSize: 12, color: '#666' }}>Agrupar por:</span>
            <select style={{ ...inp, width: 'auto' }} value={agrupar} onChange={(e) => setAgrupar(e.target.value as Agrupar)}>
              <option value="categoria">Categoría</option>
              <option value="grupo">Grupo (libre)</option>
              <option value="proveedor">Proveedor</option>
              <option value="ninguno">Sin agrupar</option>
            </select>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: '#6b5320' }}>Total estimado: <strong>{formatoMoneda(total)}</strong> <span style={{ color: '#999' }}>({recs.length} recursos)</span></span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: movil || !rSel ? '1fr' : 'minmax(0, 1fr) 340px', gap: '0.75rem', alignItems: 'start' }}>
            <div>
              {!loading && recs.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Aún no hay recursos. Pulsa <strong>＋ Recurso</strong>.</p>}
              {Array.from(grupos.entries()).map(([g, arr]) => (
                <div key={g} style={{ marginBottom: '0.7rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 'bold', color: '#6b5320', borderBottom: '2px solid #e0d3b0', padding: '2px 2px 3px' }}>
                    <span>{g} <span style={{ color: '#aaa', fontWeight: 'normal' }}>({arr.length})</span></span>
                    <span>{formatoMoneda(subtotalDe(arr))}</span>
                  </div>
                  {arr.map((r) => {
                    const c = categoriaRecurso(r.categoria); const sub = subtotalRecurso(r);
                    return (
                      <div key={r.id} onClick={() => setSelR(r.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0.4rem', borderBottom: '1px solid #f0ead9', cursor: 'pointer', background: selR === r.id ? '#fdf6e3' : 'transparent' }}>
                        <span title={c.label}>{c.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 'bold' }}>{r.nombre || '(sin nombre)'}{r.existe ? <span style={{ color: '#2e9e63', fontSize: 10, fontWeight: 'normal' }}> ✅ ya</span> : null}</div>
                          <div style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.cantidad ? `${r.cantidad} ${r.unidad}` : ''}{r.proveedor ? ` · 🏭 ${r.proveedor}` : ''}{r.impuesto ? ` · ${r.impuesto}` : ''}
                          </div>
                        </div>
                        <div style={{ fontSize: 12.5, color: '#6b5320', textAlign: 'right' }}>
                          {r.costo ? <div>{r.costo}{r.unidad ? `/${r.unidad}` : ''}</div> : <div style={{ color: '#c60' }}>sin costo</div>}
                          {sub !== null && r.cantidad ? <div style={{ fontSize: 11, color: '#999' }}>= {formatoMoneda(sub)}</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {rSel && (
              <div style={{ border: '1px solid #e0d3b0', borderRadius: 10, background: '#fdf6e3', padding: '0.7rem', position: 'sticky', top: 8, maxHeight: '84vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 14 }}>{categoriaRecurso(rSel.categoria).emoji} Recurso</strong>
                  <button style={btnSm} onClick={() => setSelR(null)}>✕</button>
                </div>
                <label style={lbl}>Nombre</label>
                <input style={inp} defaultValue={rSel.nombre} key={`n-${rSel.id}`} onBlur={(e) => { if (e.target.value !== rSel.nombre) void patchRec({ nombre: e.target.value }); }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <div><label style={lbl}>Categoría</label>
                    <select style={inp} value={rSel.categoria} onChange={(e) => void patchRec({ categoria: e.target.value as Recurso['categoria'] })}>
                      {CATEGORIAS_RECURSO.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
                    </select></div>
                  <div><label style={lbl}>Grupo (libre)</label>
                    <input style={inp} defaultValue={rSel.grupo} key={`g-${rSel.id}`} placeholder="ej. Cabina, Obra 1ª planta…" onBlur={(e) => void patchRec({ grupo: e.target.value })} /></div>
                </div>
                <label style={lbl}>🏭 Proveedor</label>
                <input style={inp} list="prov-dl" defaultValue={rSel.proveedor} key={`p-${rSel.id}`} placeholder="proveedor…" onBlur={(e) => void patchRec({ proveedor: e.target.value })} />
                <datalist id="prov-dl">{provs.map((p) => <option key={p.id} value={p.nombre} />)}</datalist>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                  <div><label style={lbl}>Costo unit.</label><input style={inp} defaultValue={rSel.costo} key={`c-${rSel.id}`} placeholder="$" onBlur={(e) => void patchRec({ costo: e.target.value })} /></div>
                  <div><label style={lbl}>Cantidad</label><input style={inp} defaultValue={rSel.cantidad} key={`q-${rSel.id}`} onBlur={(e) => void patchRec({ cantidad: e.target.value })} /></div>
                  <div><label style={lbl}>Unidad</label><input style={inp} defaultValue={rSel.unidad} key={`u-${rSel.id}`} placeholder="pza" onBlur={(e) => void patchRec({ unidad: e.target.value })} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <div><label style={lbl}>Impuesto</label><input style={inp} defaultValue={rSel.impuesto} key={`i-${rSel.id}`} placeholder="16% IVA" onBlur={(e) => void patchRec({ impuesto: e.target.value })} /></div>
                  <div><label style={lbl}>Subtotal</label><input style={{ ...inp, background: '#f5efdd' }} value={subtotalRecurso(rSel) !== null ? formatoMoneda(subtotalRecurso(rSel)!) : '—'} readOnly /></div>
                </div>
                <label style={lbl}>🚚 Logística (dónde/tiempo de entrega)</label>
                <input style={inp} defaultValue={rSel.logistica} key={`l-${rSel.id}`} onBlur={(e) => void patchRec({ logistica: e.target.value })} />
                <label style={{ fontSize: 12, color: '#2e7a4d', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: '0.6rem' }}>
                  <input type="checkbox" checked={rSel.existe} onChange={(e) => void patchRec({ existe: e.target.checked })} /> ✅ Ya lo tenemos (inventario actual)
                </label>
                <label style={lbl}>Notas</label>
                <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={rSel.notas} key={`no-${rSel.id}`} onBlur={(e) => void patchRec({ notas: e.target.value })} />
                <div style={{ borderTop: '1px solid #e0d3b0', marginTop: '0.6rem', paddingTop: '0.5rem' }}>
                  <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={() => void borrarRec()}>🗑 Eliminar</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ======= PROVEEDORES ======= */}
      {tab === 'proveedores' && (
        <div style={{ display: 'grid', gridTemplateColumns: movil || !pSel ? '1fr' : 'minmax(0, 1fr) 340px', gap: '0.75rem', alignItems: 'start' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.5rem', alignContent: 'start' }}>
            {!loading && provs.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Aún no hay proveedores. Pulsa <strong>＋ Proveedor</strong> para dar de alta a quien te surte insumos, muebles, herramientas, construcción, diseño de interiores…</p>}
            {provs.map((p) => (
              <div key={p.id} onClick={() => setSelP(p.id)}
                style={{ border: `1px solid ${selP === p.id ? '#a9720f' : '#e0d3b0'}`, borderLeft: '4px solid #a9720f', borderRadius: 9, padding: '0.5rem 0.6rem', background: selP === p.id ? '#fdf6e3' : '#fff', cursor: 'pointer' }}>
                <div style={{ fontWeight: 'bold', fontSize: 13.5 }}>🏭 {p.nombre || '(sin nombre)'}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{p.tipo}{p.contacto ? ` · ${p.contacto}` : ''}</div>
              </div>
            ))}
          </div>
          {pSel && (
            <div style={{ border: '1px solid #e0d3b0', borderRadius: 10, background: '#fdf6e3', padding: '0.7rem', position: 'sticky', top: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 14 }}>🏭 Proveedor</strong>
                <button style={btnSm} onClick={() => setSelP(null)}>✕</button>
              </div>
              <label style={lbl}>Nombre</label>
              <input style={inp} defaultValue={pSel.nombre} key={`pn-${pSel.id}`} onBlur={(e) => { if (e.target.value !== pSel.nombre) void patchProv({ nombre: e.target.value }); }} />
              <label style={lbl}>Provee</label>
              <input style={inp} list="tipoprov-dl" defaultValue={pSel.tipo} key={`pt-${pSel.id}`} onBlur={(e) => void patchProv({ tipo: e.target.value })} />
              <datalist id="tipoprov-dl">{TIPOS_PROVEEDOR.map((t) => <option key={t} value={t} />)}</datalist>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <div><label style={lbl}>Contacto</label><input style={inp} defaultValue={pSel.contacto} key={`pc-${pSel.id}`} onBlur={(e) => void patchProv({ contacto: e.target.value })} /></div>
                <div><label style={lbl}>Teléfono</label><input style={inp} defaultValue={pSel.telefono} key={`pp-${pSel.id}`} onBlur={(e) => void patchProv({ telefono: e.target.value })} /></div>
                <div><label style={lbl}>Correo</label><input style={inp} defaultValue={pSel.email} key={`pe-${pSel.id}`} onBlur={(e) => void patchProv({ email: e.target.value })} /></div>
                <div><label style={lbl}>RFC</label><input style={inp} defaultValue={pSel.rfc} key={`pr-${pSel.id}`} onBlur={(e) => void patchProv({ rfc: e.target.value })} /></div>
              </div>
              <label style={lbl}>Notas</label>
              <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={pSel.notas} key={`pno-${pSel.id}`} onBlur={(e) => void patchProv({ notas: e.target.value })} />
              <div style={{ borderTop: '1px solid #e0d3b0', marginTop: '0.6rem', paddingTop: '0.5rem' }}>
                <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={() => void borrarProv()}>🗑 Eliminar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
