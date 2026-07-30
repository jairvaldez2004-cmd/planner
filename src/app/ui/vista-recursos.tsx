'use client';

// RECURSOS & PROVEEDORES — Fase 1 (fundamento de datos del módulo de abastecimiento):
//  · Recursos: catálogo maestro (insumos/herramientas/equipo/muebles/materiales/servicios) con
//    costo/cantidad/grupo. Alimenta Financiero, Tecnológico y Comercial.
//  · Proveedores: ficha RICA (razón social, fiscal, ubicación+GPS, contacto, comercial,
//    certificaciones) con clasificación MÚLTIPLE.
//  · Productos: maestro rico (SKU, marca, dimensiones, almacenamiento, docs) vinculado a N
//    proveedores (muchos-a-muchos), con precio/lead-time POR proveedor e HISTORIAL de precios.

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  listarRecursos, guardarRecurso, eliminarRecurso,
  listarProveedores, guardarProveedor, eliminarProveedor,
  listarProductos, guardarProducto, eliminarProducto,
  listarVinculos, guardarVinculo, eliminarVinculo,
} from '@/app/actions/recursos.actions';
import {
  CATEGORIAS_RECURSO, categoriaRecurso, TIPOS_PROVEEDOR, CATEGORIAS_PROVEEDOR,
  recursoVacio, proveedorVacio, productoVacio, vinculoVacio,
  subtotalRecurso, formatoMoneda, precioVigente, registrarCambioPrecio, vinculosDeProducto, proveedorMasBarato,
} from '@/domain/recursos';
import type { Recurso, Proveedor, Producto, ProductoProveedor, Adjunto, PrecioHistorico } from '@/domain/recursos';
import { useEsMovil } from './use-movil';

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const btnSm: CSSProperties = { ...btn, padding: '0.15rem 0.5rem', fontSize: 12 };
const inp: CSSProperties = { padding: '0.35rem 0.55rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: '#666', marginTop: '0.5rem', fontWeight: 'bold' };
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f5ecd8', border: '1px solid #e0d3b0', borderRadius: 12, padding: '0.05rem 0.5rem', fontSize: 12, margin: '2px 3px 0 0' };
const sum: CSSProperties = { cursor: 'pointer', fontSize: 12, fontWeight: 'bold', color: '#6b5320', marginTop: '0.6rem' };

type Agrupar = 'categoria' | 'grupo' | 'proveedor' | 'ninguno';
type Tab = 'recursos' | 'proveedores' | 'productos';

export function VistaRecursos({ proyectoId }: { proyectoId: string }) {
  const [recs, setRecs] = useState<Recurso[]>([]);
  const [provs, setProvs] = useState<Proveedor[]>([]);
  const [prods, setProds] = useState<Producto[]>([]);
  const [vinc, setVinc] = useState<ProductoProveedor[]>([]);
  const [tab, setTab] = useState<Tab>('recursos');
  const [agrupar, setAgrupar] = useState<Agrupar>('categoria');
  const [selR, setSelR] = useState<string | null>(null);
  const [selP, setSelP] = useState<string | null>(null);
  const [selProd, setSelProd] = useState<string | null>(null);
  const [buscar, setBuscar] = useState('');
  const [loading, setLoading] = useState(true);
  const movil = useEsMovil();

  const cargar = () => {
    setLoading(true);
    Promise.all([listarRecursos(proyectoId), listarProveedores(proyectoId), listarProductos(proyectoId), listarVinculos(proyectoId)])
      .then(([r, p, pr, v]) => { setRecs(r); setProvs(p); setProds(pr); setVinc(v); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);

  const rSel = recs.find((x) => x.id === selR) ?? null;
  const pSel = provs.find((x) => x.id === selP) ?? null;
  const prodSel = prods.find((x) => x.id === selProd) ?? null;
  const provNombre = (id: string) => provs.find((p) => p.id === id)?.nombre ?? '(proveedor)';

  async function nuevoRec() { const n = await guardarRecurso(proyectoId, { ...recursoVacio(''), nombre: 'Nuevo recurso' }); setRecs((l) => [...l, n]); setSelR(n.id); }
  async function patchRec(partial: Partial<Recurso>) { if (!rSel) return; const u = { ...rSel, ...partial }; setRecs((l) => l.map((x) => x.id === u.id ? u : x)); await guardarRecurso(proyectoId, u); }
  async function borrarRec() { if (!rSel) return; if (!window.confirm(`¿Eliminar "${rSel.nombre}"?`)) return; await eliminarRecurso(proyectoId, rSel.id); setSelR(null); cargar(); }

  async function nuevoProv() { const n = await guardarProveedor(proyectoId, { ...proveedorVacio(''), nombre: 'Nuevo proveedor' }); setProvs((l) => [...l, n]); setSelP(n.id); }
  async function patchProv(partial: Partial<Proveedor>) { if (!pSel) return; const u = { ...pSel, ...partial }; setProvs((l) => l.map((x) => x.id === u.id ? u : x)); await guardarProveedor(proyectoId, u); }
  async function borrarProv() { if (!pSel) return; if (!window.confirm(`¿Eliminar "${pSel.nombre}"? También se quitan sus vínculos con productos.`)) return; await eliminarProveedor(proyectoId, pSel.id); setSelP(null); cargar(); }

  async function nuevoProd() { const n = await guardarProducto(proyectoId, { ...productoVacio(''), nombre: 'Nuevo producto' }); setProds((l) => [...l, n]); setSelProd(n.id); }
  async function patchProd(partial: Partial<Producto>) { if (!prodSel) return; const u = { ...prodSel, ...partial }; setProds((l) => l.map((x) => x.id === u.id ? u : x)); await guardarProducto(proyectoId, u); }
  async function borrarProd() { if (!prodSel) return; if (!window.confirm(`¿Eliminar "${prodSel.nombre}"?`)) return; await eliminarProducto(proyectoId, prodSel.id); setSelProd(null); cargar(); }

  // Vínculos producto↔proveedor
  async function agregarVinculo(productoId: string, proveedorId: string) {
    const v = await guardarVinculo(proyectoId, vinculoVacio('', productoId, proveedorId));
    setVinc((l) => [...l, v]);
  }
  async function patchVinculo(v: ProductoProveedor) { setVinc((l) => l.map((x) => x.id === v.id ? v : x)); await guardarVinculo(proyectoId, v); }
  async function borrarVinculo(id: string) { setVinc((l) => l.filter((x) => x.id !== id)); await eliminarVinculo(proyectoId, id); }

  // Agrupación libre de recursos + subtotales
  const claveGrupo = (r: Recurso) => agrupar === 'categoria' ? categoriaRecurso(r.categoria).label : agrupar === 'grupo' ? (r.grupo || '(sin grupo)') : agrupar === 'proveedor' ? (r.proveedor || '(sin proveedor)') : 'Todos';
  const grupos = new Map<string, Recurso[]>();
  for (const r of recs) { const k = claveGrupo(r); grupos.set(k, [...(grupos.get(k) ?? []), r]); }
  const subtotalDe = (arr: Recurso[]) => arr.reduce((s, r) => s + (subtotalRecurso(r) ?? 0), 0);
  const total = subtotalDe(recs);

  const q = buscar.trim().toLowerCase();
  const provsVis = q ? provs.filter((p) => (p.nombre + ' ' + p.razonSocial + ' ' + p.categorias.join(' ') + ' ' + p.ciudad).toLowerCase().includes(q)) : provs;
  const prodsVis = q ? prods.filter((p) => (p.nombre + ' ' + p.marca + ' ' + p.modelo + ' ' + p.skuInterno + ' ' + p.categoria).toLowerCase().includes(q)) : prods;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>📦 Recursos & Proveedores <span style={{ fontSize: 13, color: '#888' }}>· abastecimiento</span></h2>
        {tab === 'recursos' && <button style={btn} onClick={() => void nuevoRec()}>＋ Recurso</button>}
        {tab === 'proveedores' && <button style={btn} onClick={() => void nuevoProv()}>＋ Proveedor</button>}
        {tab === 'productos' && <button style={btn} onClick={() => void nuevoProd()}>＋ Producto</button>}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', margin: '0.5rem 0 0.4rem', flexWrap: 'wrap' }}>
        {([['recursos', '📦 Recursos'], ['proveedores', '🏭 Proveedores'], ['productos', '🏷️ Productos']] as const).map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setSelR(null); setSelP(null); setSelProd(null); }}
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
        <>
          <input style={{ ...inp, maxWidth: 340, marginBottom: '0.5rem' }} placeholder="🔎 Buscar proveedor (nombre, categoría, ciudad)…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: movil || !pSel ? '1fr' : 'minmax(0, 1fr) 380px', gap: '0.75rem', alignItems: 'start' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem', alignContent: 'start' }}>
              {!loading && provs.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Aún no hay proveedores. Pulsa <strong>＋ Proveedor</strong> para dar de alta a quien te surte.</p>}
              {provsVis.map((p) => (
                <div key={p.id} onClick={() => setSelP(p.id)}
                  style={{ border: `1px solid ${selP === p.id ? '#a9720f' : '#e0d3b0'}`, borderLeft: '4px solid #a9720f', borderRadius: 9, padding: '0.5rem 0.6rem', background: selP === p.id ? '#fdf6e3' : '#fff', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 'bold', fontSize: 13.5 }}>🏭 {p.nombre || '(sin nombre)'}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{[p.ciudad, p.pais].filter(Boolean).join(', ') || '—'}{p.contacto ? ` · ${p.contacto}` : ''}</div>
                  {p.categorias.length > 0 && <div style={{ marginTop: 3 }}>{p.categorias.slice(0, 3).map((c) => <span key={c} style={{ ...chip, fontSize: 10.5, margin: '1px 3px 0 0' }}>{c}</span>)}{p.categorias.length > 3 ? <span style={{ fontSize: 10, color: '#aaa' }}>+{p.categorias.length - 3}</span> : null}</div>}
                </div>
              ))}
            </div>
            {pSel && <ProveedorEditor prov={pSel} onPatch={patchProv} onClose={() => setSelP(null)} onDelete={borrarProv} />}
          </div>
        </>
      )}

      {/* ======= PRODUCTOS ======= */}
      {tab === 'productos' && (
        <>
          <input style={{ ...inp, maxWidth: 340, marginBottom: '0.5rem' }} placeholder="🔎 Buscar producto (nombre, marca, SKU)…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: movil || !prodSel ? '1fr' : 'minmax(0, 1fr) 400px', gap: '0.75rem', alignItems: 'start' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem', alignContent: 'start' }}>
              {!loading && prods.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Aún no hay productos. Pulsa <strong>＋ Producto</strong>. Cada producto se vincula a los proveedores que lo ofrecen (uno o muchos), cada uno con su precio.</p>}
              {prodsVis.map((p) => {
                const nProv = vinculosDeProducto(vinc, p.id).length;
                const barato = proveedorMasBarato(vinc, p.id);
                return (
                  <div key={p.id} onClick={() => setSelProd(p.id)}
                    style={{ border: `1px solid ${selProd === p.id ? '#a9720f' : '#e0d3b0'}`, borderLeft: '4px solid #6b8e3d', borderRadius: 9, padding: '0.5rem 0.6rem', background: selProd === p.id ? '#fdf6e3' : '#fff', cursor: 'pointer' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 13.5 }}>🏷️ {p.nombre || '(sin nombre)'}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{[p.marca, p.modelo].filter(Boolean).join(' ') || p.categoria}{p.skuInterno ? ` · ${p.skuInterno}` : ''}</div>
                    <div style={{ fontSize: 11, color: nProv ? '#6b5320' : '#c0392b', marginTop: 2 }}>
                      {nProv ? `🏭 ${nProv} proveedor${nProv !== 1 ? 'es' : ''}` : '⚠ sin proveedor'}{barato ? ` · desde ${precioVigente(barato)}${barato.moneda ? ' ' + barato.moneda : ''}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
            {prodSel && (
              <ProductoEditor
                prod={prodSel} provs={provs} vinculos={vinculosDeProducto(vinc, prodSel.id)} provNombre={provNombre}
                onPatch={patchProd} onClose={() => setSelProd(null)} onDelete={borrarProd}
                onAgregar={(provId) => void agregarVinculo(prodSel.id, provId)} onGuardarVinculo={patchVinculo} onBorrarVinculo={borrarVinculo}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ===== Editor de PROVEEDOR (ficha rica) =====
function ProveedorEditor({ prov, onPatch, onClose, onDelete }: {
  prov: Proveedor; onPatch: (p: Partial<Proveedor>) => void; onClose: () => void; onDelete: () => void;
}) {
  const T = (label: string, k: keyof Proveedor, ph = '') => (
    <div><label style={lbl}>{label}</label><input style={inp} defaultValue={String(prov[k] ?? '')} key={`${String(k)}-${prov.id}`} placeholder={ph} onBlur={(e) => { if (e.target.value !== prov[k]) onPatch({ [k]: e.target.value } as Partial<Proveedor>); }} /></div>
  );
  return (
    <div style={{ border: '1px solid #e0d3b0', borderRadius: 10, background: '#fdf6e3', padding: '0.7rem', position: 'sticky', top: 8, maxHeight: '86vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>🏭 Proveedor</strong>
        <button style={btnSm} onClick={onClose}>✕</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        {T('Nombre comercial', 'nombre')}
        {T('Razón social', 'razonSocial')}
        {T('RFC / ID fiscal', 'rfc')}
        {T('Sitio web', 'sitioWeb', 'https://')}
      </div>
      <Chips label="🏷️ Categorías (varias)" valores={prov.categorias} onChange={(v) => onPatch({ categorias: v })} opciones={CATEGORIAS_PROVEEDOR} placeholder="materia prima, transporte…" />

      <details>
        <summary style={sum}>📍 Ubicación</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {T('País', 'pais')}{T('Estado', 'estado')}{T('Ciudad', 'ciudad')}{T('Coordenadas GPS', 'gps', 'lat, lng')}
        </div>
        {T('Dirección', 'direccion')}
        <Chips label="Zonas donde opera" valores={prov.zonas} onChange={(v) => onPatch({ zonas: v })} placeholder="Bajío, Norte…" />
      </details>

      <details>
        <summary style={sum}>📞 Contacto</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {T('Persona de contacto', 'contacto')}{T('Puesto', 'puesto')}
          {T('Teléfono', 'telefono')}{T('WhatsApp', 'whatsapp')}
          {T('Correo', 'email')}{T('Horario de atención', 'horario', 'L-V 9-18')}
        </div>
        <Chips label="Idiomas" valores={prov.idiomas} onChange={(v) => onPatch({ idiomas: v })} placeholder="español, inglés…" />
      </details>

      <details>
        <summary style={sum}>💼 Comercial</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {T('Moneda', 'moneda', 'MXN / USD')}{T('Años en el mercado', 'aniosMercado')}
          {T('Tamaño de la empresa', 'tamano', 'micro/pyme/grande')}
        </div>
        <Chips label="Incoterms que maneja" valores={prov.incoterms} onChange={(v) => onPatch({ incoterms: v })} opciones={['EXW', 'FOB', 'CIF', 'DAP', 'DDP', 'FCA', 'CPT']} placeholder="FOB, DAP…" />
        <Chips label="Certificaciones" valores={prov.certificaciones} onChange={(v) => onPatch({ certificaciones: v })} placeholder="ISO 9001, HACCP…" />
      </details>

      <details>
        <summary style={sum}>📎 Fotos, videos, documentos</summary>
        <Adjuntos valores={prov.adjuntos} onChange={(v) => onPatch({ adjuntos: v })} />
      </details>

      <label style={lbl}>Notas</label>
      <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={prov.notas} key={`pno-${prov.id}`} onBlur={(e) => onPatch({ notas: e.target.value })} />
      <div style={{ borderTop: '1px solid #e0d3b0', marginTop: '0.6rem', paddingTop: '0.5rem' }}>
        <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={onDelete}>🗑 Eliminar</button>
      </div>
    </div>
  );
}

// ===== Editor de PRODUCTO (rico) + vínculos con proveedores =====
function ProductoEditor({ prod, provs, vinculos, provNombre, onPatch, onClose, onDelete, onAgregar, onGuardarVinculo, onBorrarVinculo }: {
  prod: Producto; provs: Proveedor[]; vinculos: ProductoProveedor[]; provNombre: (id: string) => string;
  onPatch: (p: Partial<Producto>) => void; onClose: () => void; onDelete: () => void;
  onAgregar: (proveedorId: string) => void; onGuardarVinculo: (v: ProductoProveedor) => void; onBorrarVinculo: (id: string) => void;
}) {
  const [addSel, setAddSel] = useState('');
  const T = (label: string, k: keyof Producto, ph = '') => (
    <div><label style={lbl}>{label}</label><input style={inp} defaultValue={String(prod[k] ?? '')} key={`${String(k)}-${prod.id}`} placeholder={ph} onBlur={(e) => { if (e.target.value !== prod[k]) onPatch({ [k]: e.target.value } as Partial<Producto>); }} /></div>
  );
  const yaVinculados = new Set(vinculos.map((v) => v.proveedorId));
  const disponibles = provs.filter((p) => !yaVinculados.has(p.id));

  return (
    <div style={{ border: '1px solid #e0d3b0', borderRadius: 10, background: '#fdf6e3', padding: '0.7rem', position: 'sticky', top: 8, maxHeight: '86vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>🏷️ Producto</strong>
        <button style={btnSm} onClick={onClose}>✕</button>
      </div>
      <label style={lbl}>Nombre</label>
      <input style={inp} defaultValue={prod.nombre} key={`nm-${prod.id}`} onBlur={(e) => { if (e.target.value !== prod.nombre) onPatch({ nombre: e.target.value }); }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        <div><label style={lbl}>Categoría</label><input style={inp} list="cat-prod-dl" defaultValue={prod.categoria} key={`cat-${prod.id}`} onBlur={(e) => onPatch({ categoria: e.target.value })} /><datalist id="cat-prod-dl">{CATEGORIAS_PROVEEDOR.map((c) => <option key={c} value={c} />)}</datalist></div>
        {T('Unidad', 'unidad', 'pza / kg / L')}
        {T('Marca', 'marca')}{T('Modelo', 'modelo')}
        {T('SKU interno', 'skuInterno')}{T('Código fabricante', 'codigoFabricante')}
      </div>

      <details>
        <summary style={sum}>📐 Físico y empaque</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {T('Peso', 'peso')}{T('Volumen', 'volumen')}
          {T('Dimensiones', 'dimensiones', 'L×A×H')}{T('Color', 'color')}
          {T('Material', 'material')}{T('Presentación', 'presentacion')}
          {T('Empaque', 'empaque')}{T('Cant. por caja', 'cantidadPorCaja')}
          {T('Cant. por pallet', 'cantidadPorPallet')}
        </div>
      </details>

      <details>
        <summary style={sum}>⏳ Vida útil y almacenamiento</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {T('Vida útil', 'vidaUtil')}{T('Caducidad', 'caducidad')}
          {T('Tiempo de anaquel', 'tiempoAnaquel')}{T('Rotación recomendada', 'rotacion')}
          {T('Almacenamiento', 'almacenamiento')}{T('Temperatura', 'temperatura')}
          {T('Humedad', 'humedad')}{T('Garantía', 'garantia')}
        </div>
      </details>

      <details>
        <summary style={sum}>📎 Fichas técnicas, MSDS, manual, fotos</summary>
        <Adjuntos valores={prod.adjuntos} onChange={(v) => onPatch({ adjuntos: v })} />
      </details>

      <label style={lbl}>Notas</label>
      <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={prod.notas} key={`pdno-${prod.id}`} onBlur={(e) => onPatch({ notas: e.target.value })} />

      {/* ==== VÍNCULOS con proveedores (muchos-a-muchos) ==== */}
      <div style={{ borderTop: '2px solid #e0d3b0', marginTop: '0.7rem', paddingTop: '0.5rem' }}>
        <div style={{ fontSize: 12.5, fontWeight: 'bold', color: '#6b5320' }}>🏭 Proveedores de este producto ({vinculos.length})</div>
        <p style={{ fontSize: 11, color: '#999', margin: '2px 0 6px' }}>El mismo producto puede tener varios proveedores; cada uno con su precio, SKU y condiciones.</p>
        <div style={{ display: 'flex', gap: 4, marginBottom: '0.5rem' }}>
          <select style={{ ...inp, flex: 1 }} value={addSel} onChange={(e) => setAddSel(e.target.value)}>
            <option value="">＋ Vincular un proveedor…</option>
            {disponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <button style={btnSm} disabled={!addSel} onClick={() => { if (addSel) { onAgregar(addSel); setAddSel(''); } }}>Vincular</button>
        </div>
        {vinculos.length === 0 && <p style={{ color: '#c0392b', fontSize: 12 }}>⚠ Sin proveedor. Vincula al menos uno para poder costear y comprar.</p>}
        {vinculos.map((v) => (
          <VinculoRow key={v.id} v={v} proveedor={provNombre(v.proveedorId)} onGuardar={onGuardarVinculo} onBorrar={onBorrarVinculo} />
        ))}
      </div>

      <div style={{ borderTop: '1px solid #e0d3b0', marginTop: '0.6rem', paddingTop: '0.5rem' }}>
        <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={onDelete}>🗑 Eliminar producto</button>
      </div>
    </div>
  );
}

// ===== Una fila de vínculo producto↔proveedor: info comercial + historial de precios =====
function VinculoRow({ v, proveedor, onGuardar, onBorrar }: {
  v: ProductoProveedor; proveedor: string; onGuardar: (v: ProductoProveedor) => void; onBorrar: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pFecha, setPFecha] = useState('');
  const [pPrecio, setPPrecio] = useState('');
  const [pMotivo, setPMotivo] = useState('');
  const set = (k: keyof ProductoProveedor, val: string | boolean) => onGuardar({ ...v, [k]: val });
  const C = (label: string, k: keyof ProductoProveedor, ph = '') => (
    <div><label style={lbl}>{label}</label><input style={inp} defaultValue={String(v[k] ?? '')} key={`${String(k)}-${v.id}`} placeholder={ph} onBlur={(e) => { if (e.target.value !== v[k]) set(k, e.target.value); }} /></div>
  );
  function registrarPrecio() {
    if (!pPrecio.trim()) return;
    const cambio: PrecioHistorico = { fecha: pFecha || new Date().toISOString().slice(0, 10), precio: pPrecio.trim(), moneda: v.moneda, quien: '', motivo: pMotivo.trim(), documento: '' };
    onGuardar(registrarCambioPrecio(v, cambio));
    setPPrecio(''); setPMotivo(''); setPFecha('');
  }
  return (
    <div style={{ border: '1px solid #e0d3b0', borderRadius: 8, background: '#fff', padding: '0.4rem 0.55rem', marginBottom: '0.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => setAbierto((a) => !a)}>
        <span style={{ fontWeight: 'bold', fontSize: 13, flex: 1 }}>🏭 {proveedor}</span>
        <span style={{ fontSize: 12.5, color: '#6b5320' }}>{precioVigente(v) || 'sin precio'}{v.moneda ? ` ${v.moneda}` : ''}</span>
        <span style={{ fontSize: 11, color: '#888' }}>{abierto ? '▲' : '▼'}</span>
      </div>
      {!abierto && (v.tiempoEntrega || v.cantidadMinima) && (
        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{v.tiempoEntrega ? `🚚 ${v.tiempoEntrega}` : ''}{v.cantidadMinima ? ` · mín ${v.cantidadMinima}` : ''}</div>
      )}
      {abierto && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            {C('SKU proveedor', 'skuProveedor')}{C('Moneda', 'moneda', 'MXN')}
            {C('Precio', 'precio', '$')}{C('Precio por volumen', 'precioVolumen')}
            {C('Descuentos', 'descuentos')}{C('Promociones', 'promociones')}
            {C('Tiempo de entrega', 'tiempoEntrega', '3 días')}{C('Costo de envío', 'costoEnvio')}
            {C('Cant. mínima', 'cantidadMinima')}{C('Cant. máxima', 'cantidadMaxima')}
            {C('Capacidad mensual', 'capacidadMensual')}{C('Capacidad anual', 'capacidadAnual')}
            {C('Forma de pago', 'formaPago')}{C('Días de crédito', 'diasCredito')}
            {C('Incoterms', 'incoterms')}{C('Penalizaciones', 'penalizaciones')}
            {C('Lugar de entrega', 'lugarEntrega')}{C('Lugar de recolección', 'lugarRecoleccion')}
          </div>
          <label style={{ fontSize: 12, color: '#2e7a4d', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: '0.5rem' }}>
            <input type="checkbox" checked={v.credito} onChange={(e) => set('credito', e.target.checked)} /> 💳 Da crédito
          </label>

          {/* Historial de precios */}
          <div style={{ marginTop: '0.5rem', borderTop: '1px solid #f0ead9', paddingTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#6b5320' }}>📈 Historial de precios ({v.historial.length})</div>
            {v.historial.length > 0 && (
              <div style={{ maxHeight: 120, overflowY: 'auto', marginTop: 3 }}>
                {[...v.historial].reverse().map((h, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#555', display: 'flex', gap: 6, borderBottom: '1px solid #f5efdd', padding: '1px 0' }}>
                    <span style={{ color: '#999', minWidth: 74 }}>{h.fecha}</span>
                    <span style={{ fontWeight: 'bold' }}>{h.precio}{h.moneda ? ' ' + h.moneda : ''}</span>
                    {h.motivo ? <span style={{ color: '#888' }}>· {h.motivo}</span> : null}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              <input style={{ ...inp, width: 130 }} type="date" value={pFecha} onChange={(e) => setPFecha(e.target.value)} />
              <input style={{ ...inp, width: 90 }} placeholder="precio" value={pPrecio} onChange={(e) => setPPrecio(e.target.value)} />
              <input style={{ ...inp, flex: 1, minWidth: 90 }} placeholder="motivo" value={pMotivo} onChange={(e) => setPMotivo(e.target.value)} />
              <button style={btnSm} disabled={!pPrecio.trim()} onClick={registrarPrecio}>Registrar cambio</button>
            </div>
          </div>

          <label style={lbl}>Notas del vínculo</label>
          <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={v.notas} key={`vno-${v.id}`} onBlur={(e) => { if (e.target.value !== v.notas) set('notas', e.target.value); }} />
          <button style={{ ...btnSm, color: '#b33', borderColor: '#d99', marginTop: 5 }} onClick={() => { if (window.confirm(`¿Quitar el vínculo con ${proveedor}?`)) onBorrar(v.id); }}>🗑 Quitar proveedor</button>
        </div>
      )}
    </div>
  );
}

// ===== Campo de etiquetas (chips) con datalist opcional =====
function Chips({ label, valores, onChange, placeholder, opciones }: {
  label: string; valores: string[]; onChange: (v: string[]) => void; placeholder?: string; opciones?: string[];
}) {
  const [nuevo, setNuevo] = useState('');
  const id = `dl-${label.replace(/\W/g, '')}`;
  function add() {
    const v = nuevo.trim(); if (!v) return;
    if (!valores.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...valores, v]);
    setNuevo('');
  }
  return (
    <>
      <label style={lbl}>{label}</label>
      <div>{valores.map((v) => <span key={v} style={chip}>{v} <span style={{ cursor: 'pointer', color: '#b33' }} onClick={() => onChange(valores.filter((x) => x !== v))}>×</span></span>)}</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
        <input style={{ ...inp, flex: 1 }} list={opciones ? id : undefined} placeholder={placeholder ?? 'agregar…'} value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        {opciones && <datalist id={id}>{opciones.map((o) => <option key={o} value={o} />)}</datalist>}
        <button style={btnSm} onClick={add} disabled={!nuevo.trim()}>＋</button>
      </div>
    </>
  );
}

// ===== Editor de adjuntos (foto/video/documento como URL + título) =====
function Adjuntos({ valores, onChange }: { valores: Adjunto[]; onChange: (v: Adjunto[]) => void }) {
  const [tipo, setTipo] = useState<Adjunto['tipo']>('documento');
  const [titulo, setTitulo] = useState('');
  const [url, setUrl] = useState('');
  const icono: Record<string, string> = { foto: '🖼️', video: '🎬', documento: '📄' };
  function add() {
    if (!url.trim()) return;
    onChange([...valores, { tipo, titulo: titulo.trim() || url.trim(), url: url.trim() }]);
    setTitulo(''); setUrl('');
  }
  return (
    <div>
      {valores.map((a, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 0' }}>
          <span>{icono[a.tipo]}</span>
          <a href={a.url} target="_blank" rel="noreferrer" style={{ flex: 1, color: '#2b5a97', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</a>
          <span style={{ cursor: 'pointer', color: '#b33' }} onClick={() => onChange(valores.filter((_, j) => j !== i))}>×</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
        <select style={{ ...inp, width: 110 }} value={tipo} onChange={(e) => setTipo(e.target.value as Adjunto['tipo'])}>
          <option value="documento">📄 Documento</option><option value="foto">🖼️ Foto</option><option value="video">🎬 Video</option>
        </select>
        <input style={{ ...inp, width: 110 }} placeholder="título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <input style={{ ...inp, flex: 1, minWidth: 120 }} placeholder="URL (https://…)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button style={btnSm} onClick={add} disabled={!url.trim()}>＋</button>
      </div>
    </div>
  );
}
