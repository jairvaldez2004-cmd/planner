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
  listarOrdenes, guardarOrden, eliminarOrden,
  listarContratos, guardarContrato, eliminarContrato,
  listarIncidencias, guardarIncidencia, eliminarIncidencia,
  listarInteracciones, guardarInteraccion, eliminarInteraccion,
  listarEmbarques, guardarEmbarque, eliminarEmbarque,
  listarTransportistas, guardarTransportista, eliminarTransportista,
  generarOrdenesArranque,
  conversarCentroAbastecimiento, cargarChatAbastecimiento,
} from '@/app/actions/recursos.actions';
import { ChatArquitecto } from './chat-arquitecto';
import {
  CATEGORIAS_RECURSO, categoriaRecurso, TIPOS_PROVEEDOR, CATEGORIAS_PROVEEDOR,
  recursoVacio, proveedorVacio, productoVacio, vinculoVacio, ordenVacia, contratoVacio,
  subtotalRecurso, formatoMoneda, numero, precioVigente, registrarCambioPrecio, vinculosDeProducto, proveedorMasBarato,
  planearCompra, ACCIONES_COMPRA,
  ETAPAS_COMPRA_INFO, etapaCompraInfo, siguienteEtapaCompra, totalOrden, estadoRecepcion,
  estadoContrato, ESTADOS_CONTRATO, solicitudDesdeProducto,
  CRITERIOS_EVAL, RIESGOS, DEPENDENCIAS, TIPOS_INCIDENCIA, incidenciaVacia, scoreProveedor, NIVELES_SCORE,
  ESTADOS_RELACION, TIPOS_INTERACCION, interaccionesDeProveedor, ultimoContacto, seguimientosPendientes,
  ESTADOS_EMBARQUE, estadoEmbarqueInfo, siguienteEstadoEmbarque, embarqueVacio, costoLogisticoEmbarque, landedCostEmbarque, prorrateoLanded, embarqueRetrasado,
  MODALIDADES_ENVIO, modalidadEnvioInfo, transportistaVacio, cotizarFlete, mejorTransportista, planArranque,
  desgloseAduana, costoAduana,
} from '@/domain/recursos';
import type { Recurso, Proveedor, Producto, ProductoProveedor, Adjunto, PrecioHistorico, OrdenCompra, Contrato, EtapaCompra, Incidencia, Interaccion, Embarque, Transportista, Tarifa, Importacion } from '@/domain/recursos';
import { useEsMovil } from './use-movil';

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const btnSm: CSSProperties = { ...btn, padding: '0.15rem 0.5rem', fontSize: 12 };
const inp: CSSProperties = { padding: '0.35rem 0.55rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: '#666', marginTop: '0.5rem', fontWeight: 'bold' };
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f5ecd8', border: '1px solid #e0d3b0', borderRadius: 12, padding: '0.05rem 0.5rem', fontSize: 12, margin: '2px 3px 0 0' };
const sum: CSSProperties = { cursor: 'pointer', fontSize: 12, fontWeight: 'bold', color: '#6b5320', marginTop: '0.6rem' };

type Agrupar = 'categoria' | 'grupo' | 'proveedor' | 'ninguno';
type Tab = 'recursos' | 'proveedores' | 'productos' | 'compras' | 'logistica' | 'contratos' | 'ia';

export function VistaRecursos({ proyectoId }: { proyectoId: string }) {
  const [recs, setRecs] = useState<Recurso[]>([]);
  const [provs, setProvs] = useState<Proveedor[]>([]);
  const [prods, setProds] = useState<Producto[]>([]);
  const [vinc, setVinc] = useState<ProductoProveedor[]>([]);
  const [ocs, setOcs] = useState<OrdenCompra[]>([]);
  const [ctrs, setCtrs] = useState<Contrato[]>([]);
  const [incs, setIncs] = useState<Incidencia[]>([]);
  const [ints, setInts] = useState<Interaccion[]>([]);
  const [embs, setEmbs] = useState<Embarque[]>([]);
  const [selEmb, setSelEmb] = useState<string | null>(null);
  const [trps, setTrps] = useState<Transportista[]>([]);
  const [selTrp, setSelTrp] = useState<string | null>(null);
  const [logiSub, setLogiSub] = useState<'embarques' | 'transportistas'>('embarques');
  const [comprasSub, setComprasSub] = useState<'flujo' | 'arranque'>('flujo');
  const [selOC, setSelOC] = useState<string | null>(null);
  const [selCtr, setSelCtr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('recursos');
  const [agrupar, setAgrupar] = useState<Agrupar>('categoria');
  const [selR, setSelR] = useState<string | null>(null);
  const [selP, setSelP] = useState<string | null>(null);
  const [selProd, setSelProd] = useState<string | null>(null);
  const [buscar, setBuscar] = useState('');
  const [loading, setLoading] = useState(true);
  const movil = useEsMovil();
  const hoy = new Date().toISOString().slice(0, 10);

  const cargar = () => {
    setLoading(true);
    Promise.all([listarRecursos(proyectoId), listarProveedores(proyectoId), listarProductos(proyectoId), listarVinculos(proyectoId), listarOrdenes(proyectoId), listarContratos(proyectoId), listarIncidencias(proyectoId), listarInteracciones(proyectoId), listarEmbarques(proyectoId), listarTransportistas(proyectoId)])
      .then(([r, p, pr, v, o, c, inc, itx, emb, trp]) => { setRecs(r); setProvs(p); setProds(pr); setVinc(v); setOcs(o); setCtrs(c); setIncs(inc); setInts(itx); setEmbs(emb); setTrps(trp); }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);

  const rSel = recs.find((x) => x.id === selR) ?? null;
  const pSel = provs.find((x) => x.id === selP) ?? null;
  const prodSel = prods.find((x) => x.id === selProd) ?? null;
  const provNombre = (id: string) => provs.find((p) => p.id === id)?.nombre ?? '(proveedor)';
  const prodNombre = (id: string) => prods.find((p) => p.id === id)?.nombre ?? '';

  async function nuevoRec() { const n = await guardarRecurso(proyectoId, { ...recursoVacio(''), nombre: 'Nuevo recurso' }); setRecs((l) => [...l, n]); setSelR(n.id); }
  async function patchRec(partial: Partial<Recurso>) { if (!rSel) return; const u = { ...rSel, ...partial }; setRecs((l) => l.map((x) => x.id === u.id ? u : x)); await guardarRecurso(proyectoId, u); }
  async function borrarRec() { if (!rSel) return; if (!window.confirm(`¿Eliminar "${rSel.nombre}"?`)) return; await eliminarRecurso(proyectoId, rSel.id); setSelR(null); cargar(); }

  async function nuevoProv() { const n = await guardarProveedor(proyectoId, { ...proveedorVacio(''), nombre: 'Nuevo proveedor' }); setProvs((l) => [...l, n]); setSelP(n.id); }
  async function patchProv(partial: Partial<Proveedor>) { if (!pSel) return; const u = { ...pSel, ...partial }; setProvs((l) => l.map((x) => x.id === u.id ? u : x)); await guardarProveedor(proyectoId, u); }
  async function borrarProv() { if (!pSel) return; if (!window.confirm(`¿Eliminar "${pSel.nombre}"? También se quitan sus vínculos con productos.`)) return; await eliminarProveedor(proyectoId, pSel.id); setSelP(null); cargar(); }
  // Incidencias de calidad (por proveedor)
  async function agregarInc(proveedorId: string) { const n = await guardarIncidencia(proyectoId, { ...incidenciaVacia('', proveedorId), fecha: hoy }); setIncs((l) => [...l, n]); }
  async function patchInc(inc: Incidencia) { setIncs((l) => l.map((x) => x.id === inc.id ? inc : x)); await guardarIncidencia(proyectoId, inc); }
  async function borrarInc(id: string) { setIncs((l) => l.filter((x) => x.id !== id)); await eliminarIncidencia(proyectoId, id); }
  // Interacciones (bitácora de relación)
  async function agregarInt(proveedorId: string) { const n = await guardarInteraccion(proyectoId, { id: '', proveedorId, tipo: 'nota', canal: '', direccion: 'saliente', fecha: hoy, resumen: '', ordenId: '' }); setInts((l) => [...l, n]); }
  async function patchInt(it: Interaccion) { setInts((l) => l.map((x) => x.id === it.id ? it : x)); await guardarInteraccion(proyectoId, it); }
  async function borrarInt(id: string) { setInts((l) => l.filter((x) => x.id !== id)); await eliminarInteraccion(proyectoId, id); }

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

  // Órdenes de compra
  async function nuevaOC() { const n = await guardarOrden(proyectoId, { ...ordenVacia(''), descripcion: 'Nueva compra', fechaSolicitud: hoy }); setOcs((l) => [...l, n]); setSelOC(n.id); }
  async function patchOC(o: OrdenCompra) { setOcs((l) => l.map((x) => x.id === o.id ? o : x)); await guardarOrden(proyectoId, o); }
  async function borrarOC(id: string) { if (!window.confirm('¿Eliminar esta orden de compra?')) return; setOcs((l) => l.filter((x) => x.id !== id)); setSelOC(null); await eliminarOrden(proyectoId, id); }
  // Automatización (Sección 17): genera una solicitud desde un producto bajo mínimo.
  async function generarSolicitud(prod: Producto) {
    const plan = planearCompra(prod, hoy);
    const barato = proveedorMasBarato(vinc, prod.id);
    const n = await guardarOrden(proyectoId, solicitudDesdeProducto('', prod, plan.cantidadSugerida, barato?.proveedorId ?? '', hoy));
    setOcs((l) => [...l, n]); setTab('compras'); setSelOC(n.id);
  }

  // Contratos
  async function nuevoCtr() { const n = await guardarContrato(proyectoId, { ...contratoVacio(''), titulo: 'Nuevo contrato' }); setCtrs((l) => [...l, n]); setSelCtr(n.id); }
  async function patchCtr(c: Contrato) { setCtrs((l) => l.map((x) => x.id === c.id ? c : x)); await guardarContrato(proyectoId, c); }
  async function borrarCtr(id: string) { if (!window.confirm('¿Eliminar este contrato?')) return; setCtrs((l) => l.filter((x) => x.id !== id)); setSelCtr(null); await eliminarContrato(proyectoId, id); }

  // Embarques (logística)
  async function nuevoEmb() { const n = await guardarEmbarque(proyectoId, { ...embarqueVacio(''), fechaRecoleccion: hoy }); setEmbs((l) => [...l, n]); setSelEmb(n.id); }
  async function patchEmb(e: Embarque) { setEmbs((l) => l.map((x) => x.id === e.id ? e : x)); await guardarEmbarque(proyectoId, e); }
  async function borrarEmb(id: string) { if (!window.confirm('¿Eliminar este embarque?')) return; setEmbs((l) => l.filter((x) => x.id !== id)); setSelEmb(null); await eliminarEmbarque(proyectoId, id); }
  // Transportistas
  async function nuevoTrp() { const n = await guardarTransportista(proyectoId, { ...transportistaVacio(''), nombre: 'Nuevo transportista' }); setTrps((l) => [...l, n]); setSelTrp(n.id); }
  async function patchTrp(t: Transportista) { setTrps((l) => l.map((x) => x.id === t.id ? t : x)); await guardarTransportista(proyectoId, t); }
  async function borrarTrp(id: string) { if (!window.confirm('¿Eliminar este transportista?')) return; setTrps((l) => l.filter((x) => x.id !== id)); setSelTrp(null); await eliminarTransportista(proyectoId, id); }

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
        {tab === 'compras' && <button style={btn} onClick={() => void nuevaOC()}>＋ Orden de compra</button>}
        {tab === 'contratos' && <button style={btn} onClick={() => void nuevoCtr()}>＋ Contrato</button>}
        {tab === 'logistica' && (logiSub === 'embarques' ? <button style={btn} onClick={() => void nuevoEmb()}>＋ Embarque</button> : <button style={btn} onClick={() => void nuevoTrp()}>＋ Transportista</button>)}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', margin: '0.5rem 0 0.4rem', flexWrap: 'wrap' }}>
        {([['recursos', '📦 Recursos'], ['proveedores', '🏭 Proveedores'], ['productos', '🏷️ Productos'], ['compras', '🛒 Compras'], ['logistica', '🚚 Logística'], ['contratos', '📄 Contratos'], ['ia', '🧠 Centro IA']] as const).map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setSelR(null); setSelP(null); setSelProd(null); setSelOC(null); setSelCtr(null); setSelEmb(null); }}
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
          {(() => {
            const riesgoUnico = provs.filter((p) => p.proveedorUnico && !p.planB && !p.proveedorAlternativo);
            if (!riesgoUnico.length) return null;
            return (
              <div style={{ background: '#fdecea', border: '1px solid #f0c9c2', borderRadius: 9, padding: '0.45rem 0.7rem', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: 12.5, color: '#c0392b' }}>⚠ {riesgoUnico.length} proveedor(es) ÚNICOS sin plan B:</strong>
                <span style={{ fontSize: 12, color: '#a33', marginLeft: 6 }}>{riesgoUnico.map((p) => p.nombre || '(sin nombre)').join(' · ')}</span>
              </div>
            );
          })()}
          <input style={{ ...inp, maxWidth: 340, marginBottom: '0.5rem' }} placeholder="🔎 Buscar proveedor (nombre, categoría, ciudad)…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: movil || !pSel ? '1fr' : 'minmax(0, 1fr) 380px', gap: '0.75rem', alignItems: 'start' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem', alignContent: 'start' }}>
              {!loading && provs.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Aún no hay proveedores. Pulsa <strong>＋ Proveedor</strong> para dar de alta a quien te surte.</p>}
              {provsVis.map((p) => {
                const sc = scoreProveedor(p, incs);
                const niv = NIVELES_SCORE[sc.nivel];
                return (
                  <div key={p.id} onClick={() => setSelP(p.id)}
                    style={{ border: `1px solid ${selP === p.id ? '#a9720f' : '#e0d3b0'}`, borderLeft: '4px solid #a9720f', borderRadius: 9, padding: '0.5rem 0.6rem', background: selP === p.id ? '#fdf6e3' : '#fff', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontWeight: 'bold', fontSize: 13.5, flex: 1 }}>🏭 {p.nombre || '(sin nombre)'}</span>
                      {sc.score !== null && <span style={{ fontSize: 11, fontWeight: 'bold', color: '#fff', background: niv.color, borderRadius: 8, padding: '0 7px' }}>{sc.score}</span>}
                      {p.proximoSeguimiento && p.proximoSeguimiento <= hoy && <span title={`Seguimiento pendiente desde ${p.proximoSeguimiento}`} style={{ fontSize: 12 }}>⏰</span>}
                      {p.proveedorUnico && <span title="Proveedor único (riesgo)" style={{ fontSize: 12 }}>⚠</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{[p.ciudad, p.pais].filter(Boolean).join(', ') || '—'}{p.contacto ? ` · ${p.contacto}` : ''}</div>
                    {p.categorias.length > 0 && <div style={{ marginTop: 3 }}>{p.categorias.slice(0, 3).map((c) => <span key={c} style={{ ...chip, fontSize: 10.5, margin: '1px 3px 0 0' }}>{c}</span>)}{p.categorias.length > 3 ? <span style={{ fontSize: 10, color: '#aaa' }}>+{p.categorias.length - 3}</span> : null}</div>}
                  </div>
                );
              })}
            </div>
            {pSel && <ProveedorEditor prov={pSel} incidencias={incs.filter((i) => i.proveedorId === pSel.id)} score={scoreProveedor(pSel, incs)}
              interacciones={interaccionesDeProveedor(ints, pSel.id)} ultContacto={ultimoContacto(pSel.id, ints)}
              onPatch={patchProv} onClose={() => setSelP(null)} onDelete={borrarProv}
              onAddInc={() => void agregarInc(pSel.id)} onPatchInc={patchInc} onBorrarInc={borrarInc}
              onAddInt={() => void agregarInt(pSel.id)} onPatchInt={patchInt} onBorrarInt={borrarInt} />}
          </div>
        </>
      )}

      {/* ======= PRODUCTOS ======= */}
      {tab === 'productos' && (
        <>
          {(() => {
            const planes = prods.map((p) => planearCompra(p, hoy));
            const urg = planes.filter((x) => x.accion === 'comprar-urgente').length;
            const hoyN = planes.filter((x) => x.accion === 'comprar-hoy').length;
            const pronto = planes.filter((x) => x.accion === 'comprar-pronto').length;
            if (!urg && !hoyN && !pronto) return null;
            return (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', background: '#fbf3e6', border: '1px solid #e0d3b0', borderRadius: 9, padding: '0.4rem 0.7rem', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: 12.5, color: '#6b5320' }}>🛒 Planeación de compras:</strong>
                {urg > 0 && <span style={{ fontSize: 12.5, color: '#c0392b' }}>🔴 {urg} urgente(s)</span>}
                {hoyN > 0 && <span style={{ fontSize: 12.5, color: '#d9781f' }}>🟠 {hoyN} comprar hoy</span>}
                {pronto > 0 && <span style={{ fontSize: 12.5, color: '#c9a13b' }}>🟡 {pronto} pronto</span>}
              </div>
            );
          })()}
          <input style={{ ...inp, maxWidth: 340, marginBottom: '0.5rem' }} placeholder="🔎 Buscar producto (nombre, marca, SKU)…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: movil || !prodSel ? '1fr' : 'minmax(0, 1fr) 400px', gap: '0.75rem', alignItems: 'start' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem', alignContent: 'start' }}>
              {!loading && prods.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Aún no hay productos. Pulsa <strong>＋ Producto</strong>. Cada producto se vincula a los proveedores que lo ofrecen (uno o muchos), cada uno con su precio.</p>}
              {prodsVis.map((p) => {
                const nProv = vinculosDeProducto(vinc, p.id).length;
                const barato = proveedorMasBarato(vinc, p.id);
                const plan = planearCompra(p, hoy);
                const ac = ACCIONES_COMPRA[plan.accion];
                return (
                  <div key={p.id} onClick={() => setSelProd(p.id)}
                    style={{ border: `1px solid ${selProd === p.id ? '#a9720f' : '#e0d3b0'}`, borderLeft: `4px solid ${plan.accion === 'ok' || plan.accion === 'sin-datos' ? '#6b8e3d' : ac.color}`, borderRadius: 9, padding: '0.5rem 0.6rem', background: selProd === p.id ? '#fdf6e3' : '#fff', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontWeight: 'bold', fontSize: 13.5, flex: 1 }}>🏷️ {p.nombre || '(sin nombre)'}</span>
                      {plan.accion !== 'ok' && plan.accion !== 'sin-datos' && <span style={{ fontSize: 10.5, fontWeight: 'bold', color: '#fff', background: ac.color, borderRadius: 8, padding: '0 6px' }}>{ac.emoji} {ac.label}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{[p.marca, p.modelo].filter(Boolean).join(' ') || p.categoria}{p.skuInterno ? ` · ${p.skuInterno}` : ''}</div>
                    <div style={{ fontSize: 11, color: nProv ? '#6b5320' : '#c0392b', marginTop: 2 }}>
                      {nProv ? `🏭 ${nProv} proveedor${nProv !== 1 ? 'es' : ''}` : '⚠ sin proveedor'}{barato ? ` · desde ${precioVigente(barato)}${barato.moneda ? ' ' + barato.moneda : ''}` : ''}
                      {plan.diasCobertura !== null ? ` · ${plan.diasCobertura}d de stock` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
            {prodSel && (
              <ProductoEditor
                prod={prodSel} provs={provs} vinculos={vinculosDeProducto(vinc, prodSel.id)} provNombre={provNombre} hoy={hoy}
                onPatch={patchProd} onClose={() => setSelProd(null)} onDelete={borrarProd}
                onAgregar={(provId) => void agregarVinculo(prodSel.id, provId)} onGuardarVinculo={patchVinculo} onBorrarVinculo={borrarVinculo}
                onSolicitud={() => void generarSolicitud(prodSel)}
              />
            )}
          </div>
        </>
      )}

      {/* ======= COMPRAS (flujo + arranque) ======= */}
      {tab === 'compras' && (
        <>
          <div style={{ display: 'flex', gap: '0.4rem', margin: '0 0 0.6rem' }}>
            {([['flujo', '🛒 Flujo de compras'], ['arranque', '🚀 Arranque del negocio']] as const).map(([id, label]) => (
              <button key={id} onClick={() => { setComprasSub(id); setSelOC(null); }}
                style={{ ...btnSm, background: comprasSub === id ? '#a9720f' : '#fff', color: comprasSub === id ? '#fff' : '#6b5320', borderColor: comprasSub === id ? '#a9720f' : '#e0d3b0', fontWeight: 'bold' }}>{label}</button>
            ))}
          </div>
          {comprasSub === 'flujo'
            ? <ComprasFlujo ocs={ocs} sel={selOC} onSel={setSelOC} provNombre={provNombre} prodNombre={prodNombre} provs={provs} prods={prods} onPatch={patchOC} onDelete={borrarOC} movil={movil} />
            : <ArranquePanel recs={recs} prods={prods} vinc={vinc} provNombre={provNombre} onGenerar={async () => { const r = await generarOrdenesArranque(proyectoId); cargar(); return r; }} onIrFlujo={() => setComprasSub('flujo')} />}
        </>
      )}

      {/* ======= LOGÍSTICA (embarques + transportistas) ======= */}
      {tab === 'logistica' && (
        <>
          <div style={{ display: 'flex', gap: '0.4rem', margin: '0 0 0.6rem' }}>
            {([['embarques', '📦 Embarques'], ['transportistas', '🚛 Transportistas']] as const).map(([id, label]) => (
              <button key={id} onClick={() => { setLogiSub(id); setSelEmb(null); setSelTrp(null); }}
                style={{ ...btnSm, background: logiSub === id ? '#3b9ec9' : '#fff', color: logiSub === id ? '#fff' : '#2b7a93', borderColor: logiSub === id ? '#3b9ec9' : '#bcd8e6', fontWeight: 'bold' }}>{label}</button>
            ))}
          </div>
          {logiSub === 'embarques'
            ? <EmbarquesLista embs={embs} ocs={ocs} trps={trps} sel={selEmb} onSel={setSelEmb} hoy={hoy} onPatch={patchEmb} onDelete={borrarEmb} movil={movil} />
            : <TransportistasLista trps={trps} sel={selTrp} onSel={setSelTrp} onPatch={patchTrp} onDelete={borrarTrp} movil={movil} />}
        </>
      )}

      {/* ======= CONTRATOS ======= */}
      {tab === 'contratos' && (
        <ContratosLista ctrs={ctrs} sel={selCtr} onSel={setSelCtr} provs={provs} provNombre={provNombre}
          hoy={hoy} onPatch={patchCtr} onDelete={borrarCtr} movil={movil} />
      )}

      {/* ======= CENTRO DE ABASTECIMIENTO INTELIGENTE ======= */}
      {tab === 'ia' && (
        <CentroIA proyectoId={proyectoId} prods={prods} provs={provs} ctrs={ctrs} incs={incs} hoy={hoy} movil={movil} onCambio={cargar} />
      )}
    </section>
  );
}

// ===== CENTRO DE ABASTECIMIENTO INTELIGENTE (dashboard + chat IA) =====
function CentroIA({ proyectoId, prods, provs, ctrs, incs, hoy, movil, onCambio }: {
  proyectoId: string; prods: Producto[]; provs: Proveedor[]; ctrs: Contrato[]; incs: Incidencia[]; hoy: string; movil: boolean; onCambio: () => void;
}) {
  const planes = prods.map((p) => planearCompra(p, hoy));
  const porComprar = planes.filter((x) => x.accion === 'comprar-urgente' || x.accion === 'comprar-hoy').length;
  const ctrAlerta = ctrs.filter((c) => estadoContrato(c, hoy).alerta).length;
  const riesgoUnico = provs.filter((p) => p.proveedorUnico && !p.planB && !p.proveedorAlternativo).length;
  const scores = provs.map((p) => scoreProveedor(p, incs).score).filter((s): s is number => s !== null);
  const scorePromedio = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const segHoy = seguimientosPendientes(provs, hoy).length;
  const stat: CSSProperties = { border: '1px solid #e0d3b0', borderRadius: 9, padding: '0.5rem 0.7rem', background: '#fff', textAlign: 'center' };

  return (
    <div>
      <p style={{ fontSize: 12, color: '#777', margin: '0 0 0.6rem' }}>
        Con tus productos, proveedores, inventario, compras, contratos y calidad, la IA te dice <strong>qué comprar</strong>, <strong>a quién</strong>, <strong>qué se agota</strong>, <strong>qué vence</strong> y <strong>qué es riesgo</strong> — y puede <strong>generar solicitudes</strong> y <strong>registrar incidencias</strong>.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <div style={stat}><div style={{ fontSize: 20, fontWeight: 'bold', color: porComprar ? '#c0392b' : '#2e9e63' }}>{porComprar}</div><div style={{ fontSize: 11, color: '#888' }}>por comprar ya</div></div>
        <div style={stat}><div style={{ fontSize: 20, fontWeight: 'bold', color: ctrAlerta ? '#d9781f' : '#2e9e63' }}>{ctrAlerta}</div><div style={{ fontSize: 11, color: '#888' }}>contratos por vencer</div></div>
        <div style={stat}><div style={{ fontSize: 20, fontWeight: 'bold', color: riesgoUnico ? '#c0392b' : '#2e9e63' }}>{riesgoUnico}</div><div style={{ fontSize: 11, color: '#888' }}>únicos sin plan B</div></div>
        <div style={stat}><div style={{ fontSize: 20, fontWeight: 'bold', color: segHoy ? '#d9781f' : '#2e9e63' }}>{segHoy}</div><div style={{ fontSize: 11, color: '#888' }}>seguimientos hoy</div></div>
        <div style={stat}><div style={{ fontSize: 20, fontWeight: 'bold', color: '#6b5320' }}>{scorePromedio ?? '—'}</div><div style={{ fontSize: 11, color: '#888' }}>score prom. proveedores</div></div>
      </div>
      <ChatArquitecto
        conversar={(h) => conversarCentroAbastecimiento(h, proyectoId)}
        saludo={'Llevo tus compras y la relación con proveedores. Te digo qué comprar y a quién, cuido a cada proveedor con seguimiento (compremos o no), y escribo los correos yo mismo (cotizaciones, seguimientos, citas) de forma natural. Cuando me pases una respuesta de un proveedor, lleno sus datos solo. Prueba: “pide cotización de guantes a Insumos del Bajío y Distribuidora X”, o “¿a quién le toca seguimiento hoy?”.'}
        placeholder="Ej: pide cotización de X a estos proveedores…"
        cargarHistorial={() => cargarChatAbastecimiento(proyectoId)}
        historialKey={`abast:${proyectoId}`}
        onCambio={onCambio}
        altura={movil ? 340 : 480}
      />
    </div>
  );
}

// ===== ARRANQUE DEL NEGOCIO: checklist de apertura + generar órdenes iniciales =====
function ArranquePanel({ recs, prods, vinc, provNombre, onGenerar, onIrFlujo }: {
  recs: Recurso[]; prods: Producto[]; vinc: ProductoProveedor[]; provNombre: (id: string) => string;
  onGenerar: () => Promise<{ creados: number; omitidos: number }>; onIrFlujo: () => void;
}) {
  const [msg, setMsg] = useState('');
  const [gen, setGen] = useState(false);
  const plan = planArranque(recs, prods, vinc);
  const nItems = plan.activos.length + plan.insumos.length;

  async function generar() {
    if (!window.confirm(`¿Generar ${nItems} orden(es) de compra de arranque (etapa Solicitud)?`)) return;
    setGen(true);
    try { const r = await onGenerar(); setMsg(`✅ ${r.creados} orden(es) creadas${r.omitidos ? ` · ${r.omitidos} ya existían` : ''}. Míralas en 🛒 Flujo de compras.`); }
    finally { setGen(false); }
  }

  const stat: CSSProperties = { border: '1px solid #e0d3b0', borderRadius: 9, padding: '0.5rem 0.7rem', background: '#fff', textAlign: 'center' };
  const secc = (titulo: string, items: typeof plan.activos, total: number) => (
    <div style={{ marginBottom: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 'bold', color: '#6b5320', borderBottom: '2px solid #e0d3b0', padding: '2px 2px 3px' }}>
        <span>{titulo} <span style={{ color: '#aaa', fontWeight: 'normal' }}>({items.length})</span></span>
        <span>{formatoMoneda(total)}</span>
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0.4rem', borderBottom: '1px solid #f0ead9' }}>
          <span>{it.tipo === 'activo' ? '🛠️' : '🧴'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 'bold' }}>{it.nombre}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{it.cantidad} {it.unidad} · {it.grupo}{it.proveedorId ? ` · 🏭 ${provNombre(it.proveedorId)}` : it.proveedorNombre ? ` · 🏭 ${it.proveedorNombre}` : ''}</div>
          </div>
          <div style={{ fontSize: 12.5, color: '#6b5320', textAlign: 'right' }}>
            {it.costoUnit !== null ? <div>{formatoMoneda(it.costoUnit)}/{it.unidad}</div> : <div style={{ color: '#c60' }}>sin costo</div>}
            {it.subtotal !== null ? <div style={{ fontSize: 11, color: '#999' }}>= {formatoMoneda(it.subtotal)}</div> : null}
          </div>
        </div>
      ))}
      {items.length === 0 && <p style={{ fontSize: 12, color: '#999', margin: '4px 2px' }}>Nada pendiente aquí.</p>}
    </div>
  );

  return (
    <div>
      <p style={{ fontSize: 12, color: '#777', margin: '0 0 0.6rem' }}>
        Todo lo que hace falta <strong>adquirir para abrir</strong>: activos/equipo por comprar (Recursos marcados “por adquirir”) e <strong>inventario inicial</strong> (llenar cada Producto de su stock actual a su máximo). Con un clic genero las órdenes de compra.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <div style={stat}><div style={{ fontSize: 18, fontWeight: 'bold', color: '#6b5320' }}>{formatoMoneda(plan.totalActivos)}</div><div style={{ fontSize: 11, color: '#888' }}>activos/equipo</div></div>
        <div style={stat}><div style={{ fontSize: 18, fontWeight: 'bold', color: '#6b5320' }}>{formatoMoneda(plan.totalInsumos)}</div><div style={{ fontSize: 11, color: '#888' }}>inventario inicial</div></div>
        <div style={{ ...stat, background: '#fdf6e3', borderColor: '#a9720f' }}><div style={{ fontSize: 18, fontWeight: 'bold', color: '#a9720f' }}>{formatoMoneda(plan.total)}</div><div style={{ fontSize: 11, color: '#888' }}>💰 inversión de apertura</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
        <button style={{ ...btn, background: '#a9720f', color: '#fff', borderColor: '#a9720f', fontWeight: 'bold', opacity: nItems ? 1 : 0.5 }} disabled={!nItems || gen} onClick={() => void generar()}>{gen ? 'Generando…' : `🚀 Generar ${nItems} órdenes de arranque`}</button>
        {msg && <span style={{ fontSize: 12.5, color: '#2e7a4d' }}>{msg} <button style={{ ...btnSm, marginLeft: 4 }} onClick={onIrFlujo}>Ver flujo →</button></span>}
      </div>

      {nItems === 0 && <p style={{ color: '#2e9e63', fontSize: 13 }}>✅ No hay nada pendiente por adquirir para abrir. Marca activos como “por adquirir” (📦 Recursos) o define stock objetivo en 🏷️ Productos.</p>}
      {secc('🛠️ Activos y equipo por adquirir', plan.activos, plan.totalActivos)}
      {secc('🧴 Inventario inicial (insumos)', plan.insumos, plan.totalInsumos)}
    </div>
  );
}

// ===== COMPRAS: flujo por etapas (solicitud→…→cerrada) =====
function ComprasFlujo({ ocs, sel, onSel, provNombre, prodNombre, provs, prods, onPatch, onDelete, movil }: {
  ocs: OrdenCompra[]; sel: string | null; onSel: (id: string | null) => void; provNombre: (id: string) => string; prodNombre: (id: string) => string;
  provs: Proveedor[]; prods: Producto[]; onPatch: (o: OrdenCompra) => void; onDelete: (id: string) => void; movil: boolean;
}) {
  const oSel = ocs.find((o) => o.id === sel) ?? null;
  const abiertas = ocs.filter((o) => o.etapa !== 'cerrada');
  return (
    <>
      {ocs.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Aún no hay órdenes. Pulsa <strong>＋ Orden de compra</strong>, o genera solicitudes automáticas desde un producto bajo mínimo (pestaña Productos).</p>}
      <p style={{ fontSize: 12, color: '#777', margin: '0 0 0.5rem' }}>{abiertas.length} orden(es) en curso de {ocs.length}. El flujo va de <strong>Solicitud</strong> a <strong>Evaluación</strong>; avanza cada orden con “Avanzar etapa”.</p>
      <div style={{ display: 'grid', gridTemplateColumns: movil || !oSel ? '1fr' : 'minmax(0, 1fr) 380px', gap: '0.75rem', alignItems: 'start' }}>
        {/* Columnas por etapa (kanban) */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: 6 }}>
          {ETAPAS_COMPRA_INFO.map((e) => {
            const enEtapa = ocs.filter((o) => o.etapa === e.id);
            if (enEtapa.length === 0) return null;
            return (
              <div key={e.id} style={{ minWidth: 180, flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#6b5320', padding: '2px 4px', borderBottom: '2px solid #e0d3b0' }}>{e.emoji} {e.label} <span style={{ color: '#aaa' }}>({enEtapa.length})</span></div>
                {enEtapa.map((o) => {
                  const t = totalOrden(o);
                  return (
                    <div key={o.id} onClick={() => onSel(o.id)}
                      style={{ border: `1px solid ${sel === o.id ? '#a9720f' : '#e0d3b0'}`, borderRadius: 8, padding: '0.4rem 0.5rem', background: sel === o.id ? '#fdf6e3' : '#fff', cursor: 'pointer', marginTop: 5 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 'bold' }}>{o.descripcion || prodNombre(o.productoId) || '(sin descripción)'}</div>
                      <div style={{ fontSize: 10.5, color: '#888', marginTop: 2 }}>{o.proveedorId ? `🏭 ${provNombre(o.proveedorId)}` : 'sin proveedor'}{o.cantidad ? ` · ${o.cantidad} ${o.unidad}` : ''}</div>
                      {t !== null && <div style={{ fontSize: 11, color: '#6b5320' }}>{formatoMoneda(t)}{o.moneda ? ` ${o.moneda}` : ''}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        {oSel && <OrdenEditor o={oSel} provs={provs} prods={prods} onPatch={onPatch} onClose={() => onSel(null)} onDelete={onDelete} />}
      </div>
    </>
  );
}

// ===== Editor de una orden de compra + stepper de etapas =====
function OrdenEditor({ o, provs, prods, onPatch, onClose, onDelete }: {
  o: OrdenCompra; provs: Proveedor[]; prods: Producto[]; onPatch: (o: OrdenCompra) => void; onClose: () => void; onDelete: (id: string) => void;
}) {
  const set = (k: keyof OrdenCompra, val: string | boolean) => onPatch({ ...o, [k]: val });
  const F = (label: string, k: keyof OrdenCompra, ph = '') => (
    <div><label style={lbl}>{label}</label><input style={inp} defaultValue={String(o[k] ?? '')} key={`${String(k)}-${o.id}`} placeholder={ph} onBlur={(e) => { if (e.target.value !== o[k]) set(k, e.target.value); }} /></div>
  );
  const idx = ETAPAS_COMPRA_INFO.findIndex((e) => e.id === o.etapa);
  const t = totalOrden(o);
  return (
    <div style={{ border: '1px solid #e0d3b0', borderRadius: 10, background: '#fdf6e3', padding: '0.7rem', position: 'sticky', top: 8, maxHeight: '86vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>🛒 Orden de compra</strong>
        <button style={btnSm} onClick={onClose}>✕</button>
      </div>
      {/* Stepper */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, margin: '6px 0' }}>
        {ETAPAS_COMPRA_INFO.map((e, i) => (
          <span key={e.id} onClick={() => set('etapa', e.id)} title={e.label}
            style={{ fontSize: 10, cursor: 'pointer', padding: '1px 5px', borderRadius: 8, background: i <= idx ? '#a9720f' : '#efe6cf', color: i <= idx ? '#fff' : '#8a7a4a' }}>{e.emoji}</span>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#6b5320' }}>{etapaCompraInfo(o.etapa).emoji} {etapaCompraInfo(o.etapa).label}</div>
      {o.etapa !== 'cerrada' && <button style={{ ...btnSm, marginTop: 4, background: '#eef7ee', borderColor: '#bcd8bc', color: '#2e7a4d', fontWeight: 'bold' }} onClick={() => set('etapa', siguienteEtapaCompra(o.etapa))}>→ Avanzar a «{etapaCompraInfo(siguienteEtapaCompra(o.etapa)).label}»</button>}

      <label style={lbl}>Descripción</label>
      <input style={inp} defaultValue={o.descripcion} key={`d-${o.id}`} onBlur={(e) => { if (e.target.value !== o.descripcion) set('descripcion', e.target.value); }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        <div><label style={lbl}>Producto (catálogo)</label>
          <select style={inp} value={o.productoId} onChange={(e) => set('productoId', e.target.value)}>
            <option value="">— libre —</option>{prods.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select></div>
        <div><label style={lbl}>Proveedor</label>
          <select style={inp} value={o.proveedorId} onChange={(e) => set('proveedorId', e.target.value)}>
            <option value="">— sin asignar —</option>{provs.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
        {F('Cantidad', 'cantidad')}{F('Unidad', 'unidad')}{F('Precio unit.', 'precioUnitario')}
        {F('Moneda', 'moneda', 'MXN')}{F('Folio', 'folio')}
        <div><label style={lbl}>Total</label><input style={{ ...inp, background: '#f5efdd' }} value={t !== null ? formatoMoneda(t) : '—'} readOnly /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        {F('Fecha solicitud', 'fechaSolicitud')}{F('Fecha requerida', 'fechaRequerida')}
        {F('Aprobada por', 'aprobadaPor')}{F('Evaluación final', 'evaluacion')}
      </div>
      {/* Recepción parcial */}
      {(() => {
        const rec = estadoRecepcion(o);
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', alignItems: 'end', marginTop: '0.3rem' }}>
            {F('📥 Cantidad recibida', 'cantidadRecibida')}
            <div style={{ fontSize: 12, paddingBottom: 6 }}>
              {rec.estado === 'parcial' && <span style={{ color: '#c0392b', fontWeight: 'bold' }}>⚠ Parcial: faltan {rec.faltante} {o.unidad}</span>}
              {rec.estado === 'completa' && <span style={{ color: '#2e9e63', fontWeight: 'bold' }}>✅ Completa</span>}
              {rec.estado === 'sin-datos' && <span style={{ color: '#999' }}>—</span>}
            </div>
          </div>
        );
      })()}
      <label style={{ fontSize: 12, color: '#2e7a4d', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: '0.5rem' }}>
        <input type="checkbox" checked={o.recibidoOk} onChange={(e) => set('recibidoOk', e.target.checked)} /> 🔍 Pasó inspección
      </label>
      <label style={lbl}>Notas</label>
      <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={o.notas} key={`no-${o.id}`} onBlur={(e) => { if (e.target.value !== o.notas) set('notas', e.target.value); }} />
      <div style={{ borderTop: '1px solid #e0d3b0', marginTop: '0.6rem', paddingTop: '0.5rem' }}>
        <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={() => onDelete(o.id)}>🗑 Eliminar</button>
      </div>
    </div>
  );
}

// ===== LOGÍSTICA: embarques (consolidación + landed cost) =====
function EmbarquesLista({ embs, ocs, trps, sel, onSel, hoy, onPatch, onDelete, movil }: {
  embs: Embarque[]; ocs: OrdenCompra[]; trps: Transportista[]; sel: string | null; onSel: (id: string | null) => void; hoy: string;
  onPatch: (e: Embarque) => void; onDelete: (id: string) => void; movil: boolean;
}) {
  const eSel = embs.find((e) => e.id === sel) ?? null;
  const retrasados = embs.filter((e) => embarqueRetrasado(e, hoy));
  return (
    <>
      <p style={{ fontSize: 12, color: '#777', margin: '0 0 0.5rem' }}>
        Un <strong>embarque</strong> consolida órdenes de compra en un envío. El costo logístico (flete/seguro/aduana) se suma al valor de la mercancía = <strong>landed cost</strong> (costo puesto en tienda) y alimenta Financiero.
      </p>
      {retrasados.length > 0 && (
        <div style={{ background: '#fdecea', border: '1px solid #f0c9c2', borderRadius: 9, padding: '0.45rem 0.7rem', marginBottom: '0.5rem' }}>
          <strong style={{ fontSize: 12.5, color: '#c0392b' }}>⚠ {retrasados.length} embarque(s) retrasado(s):</strong>
          <span style={{ fontSize: 12, color: '#a33', marginLeft: 6 }}>{retrasados.map((e) => `${e.folio || e.destino || 'embarque'} (ETA ${e.fechaEstimada})`).join(' · ')}</span>
        </div>
      )}
      {embs.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Aún no hay embarques. Pulsa <strong>＋ Embarque</strong> para consolidar órdenes y calcular el landed cost.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: movil || !eSel ? '1fr' : 'minmax(0, 1fr) 420px', gap: '0.75rem', alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem', alignContent: 'start' }}>
          {embs.map((e) => {
            const inf = estadoEmbarqueInfo(e.estado); const lc = landedCostEmbarque(e, ocs); const ret = embarqueRetrasado(e, hoy);
            return (
              <div key={e.id} onClick={() => onSel(e.id)}
                style={{ border: `1px solid ${sel === e.id ? '#a9720f' : '#e0d3b0'}`, borderLeft: `4px solid ${ret ? '#c0392b' : '#3bb0c9'}`, borderRadius: 9, padding: '0.5rem 0.6rem', background: sel === e.id ? '#fdf6e3' : '#fff', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontWeight: 'bold', fontSize: 13.5, flex: 1 }}>{modalidadEnvioInfo(e.modalidad).emoji} {e.folio || e.destino || 'Embarque'}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 'bold', color: '#fff', background: ret ? '#c0392b' : '#3b9ec9', borderRadius: 8, padding: '0 6px' }}>{inf.emoji} {inf.label}</span>
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{modalidadEnvioInfo(e.modalidad).label}{e.importacion.esImportacion ? ' · 🛃 importación' : ''} · {e.transportista || 'sin transportista'}{e.tracking ? ` · guía ${e.tracking}` : ''}{e.fechaEstimada ? ` · ETA ${e.fechaEstimada}` : ''}</div>
                <div style={{ fontSize: 11.5, color: '#6b5320', marginTop: 2 }}>Landed <strong>{formatoMoneda(lc.total)}</strong> {lc.logistica > 0 ? <span style={{ color: '#999' }}>(+{formatoMoneda(lc.logistica)} log · ×{lc.factor.toFixed(2)})</span> : null}</div>
              </div>
            );
          })}
        </div>
        {eSel && <EmbarqueEditor e={eSel} ocs={ocs} trps={trps} onPatch={onPatch} onClose={() => onSel(null)} onDelete={onDelete} />}
      </div>
    </>
  );
}

function EmbarqueEditor({ e, ocs, trps, onPatch, onClose, onDelete }: {
  e: Embarque; ocs: OrdenCompra[]; trps: Transportista[]; onPatch: (e: Embarque) => void; onClose: () => void; onDelete: (id: string) => void;
}) {
  const set = (k: keyof Embarque, val: string | string[] | Importacion) => onPatch({ ...e, [k]: val });
  const setImp = (patch: Partial<Importacion>) => set('importacion', { ...e.importacion, ...patch });
  const imp = e.importacion;
  const desg = desgloseAduana(imp);
  const estimarFlete = () => {
    const t = trps.find((x) => x.nombre.trim().toLowerCase() === e.transportista.trim().toLowerCase());
    if (!t) { window.alert('Escribe un transportista que exista en el directorio (🚛 Transportistas) para estimar el flete.'); return; }
    const c = cotizarFlete(t, e.modalidad, e.destino || e.origen, numero(e.peso));
    if (c === null) { window.alert(`${t.nombre} no tiene tarifa para ${e.modalidad}${e.destino ? ` en ${e.destino}` : ''}.`); return; }
    set('flete', String(Math.round(c * 100) / 100));
  };
  const F = (label: string, k: keyof Embarque, ph = '', type = 'text') => (
    <div><label style={lbl}>{label}</label><input style={inp} type={type} defaultValue={String(e[k] ?? '')} key={`${String(k)}-${e.id}`} placeholder={ph} onBlur={(ev) => { if (ev.target.value !== e[k]) set(k, ev.target.value); }} /></div>
  );
  const idx = ESTADOS_EMBARQUE.findIndex((x) => x.id === e.estado);
  const lc = landedCostEmbarque(e, ocs);
  const prorr = prorrateoLanded(e, ocs);
  const incluidas = new Set(e.ordenIds);
  const toggleOrden = (id: string) => set('ordenIds', incluidas.has(id) ? e.ordenIds.filter((x) => x !== id) : [...e.ordenIds, id]);
  return (
    <div style={{ border: '1px solid #e0d3b0', borderRadius: 10, background: '#fdf6e3', padding: '0.7rem', position: 'sticky', top: 8, maxHeight: '86vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>🚚 Embarque</strong>
        <button style={btnSm} onClick={onClose}>✕</button>
      </div>
      {/* Stepper de estado */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, margin: '6px 0' }}>
        {ESTADOS_EMBARQUE.map((x, i) => (
          <span key={x.id} onClick={() => set('estado', x.id)} title={x.label}
            style={{ fontSize: 11, cursor: 'pointer', padding: '1px 6px', borderRadius: 8, background: i <= idx ? '#3b9ec9' : '#e6eef1', color: i <= idx ? '#fff' : '#68808a' }}>{x.emoji}</span>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#2b7a93' }}>{estadoEmbarqueInfo(e.estado).emoji} {estadoEmbarqueInfo(e.estado).label}</div>
      {e.estado !== 'entregado' && <button style={{ ...btnSm, marginTop: 4, background: '#eef7fb', borderColor: '#bcd8e6', color: '#2b7a93', fontWeight: 'bold' }} onClick={() => set('estado', siguienteEstadoEmbarque(e.estado))}>→ Avanzar a «{estadoEmbarqueInfo(siguienteEstadoEmbarque(e.estado)).label}»</button>}

      <label style={lbl}>Modalidad de envío</label>
      <select style={inp} value={e.modalidad} onChange={(ev) => set('modalidad', ev.target.value)}>
        {MODALIDADES_ENVIO.map((m) => <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>)}
      </select>
      {e.modalidad === 'paqueteria' && <p style={{ fontSize: 10.5, color: '#999', margin: '2px 0 0' }}>Courier (Estafeta/DHL/FedEx…): cobra por guía/peso/volumen. Suele ser 1 orden por guía; el flete es el costo de la guía.</p>}
      {e.modalidad === 'carga' && <p style={{ fontSize: 10.5, color: '#999', margin: '2px 0 0' }}>Flete/tráiler: aquí sí conviene consolidar varias órdenes en el mismo envío.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        {F('Folio', 'folio')}{F('Transportista', 'transportista', 'Estafeta, DHL…')}
        {F('Origen', 'origen')}{F('Destino', 'destino')}
        {F('Incoterm', 'incoterm', 'FOB / DAP…')}{F(e.modalidad === 'carga' ? 'Carta porte' : 'Guía / tracking', 'tracking')}
        {F('Peso (kg)', 'peso')}{F('Bultos', 'bultos')}
        {F('Recolección', 'fechaRecoleccion', '', 'date')}{F('ETA (estimada)', 'fechaEstimada', '', 'date')}
        {F('Entrega real', 'fechaEntrega', '', 'date')}
      </div>

      {/* Órdenes consolidadas */}
      <label style={lbl}>Órdenes consolidadas ({e.ordenIds.length})</label>
      <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid #e8dcc0', borderRadius: 7, padding: '0.3rem' }}>
        {ocs.filter((o) => o.etapa !== 'cerrada' || incluidas.has(o.id)).map((o) => (
          <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={incluidas.has(o.id)} onChange={() => toggleOrden(o.id)} />
            <span style={{ flex: 1 }}>{o.descripcion || '(orden)'} <span style={{ color: '#999' }}>{o.cantidad ? `· ${o.cantidad} ${o.unidad}` : ''}</span></span>
            <span style={{ color: '#6b5320' }}>{totalOrden(o) !== null ? formatoMoneda(totalOrden(o)!) : '—'}</span>
          </label>
        ))}
        {ocs.length === 0 && <span style={{ fontSize: 11, color: '#999' }}>No hay órdenes de compra. Créalas en 🛒 Compras.</span>}
      </div>

      {/* Costos logísticos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.5rem' }}>
        <label style={{ ...lbl, margin: 0, flex: 1 }}>Costos logísticos</label>
        {trps.length > 0 && <button style={{ ...btnSm, fontSize: 11 }} onClick={estimarFlete} title="Estima el flete con la tarifa del transportista, la modalidad, el destino y el peso">💡 Estimar flete</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
        {F('Flete', 'flete')}{F('Seguro', 'seguro')}{F('Aduana', 'aduana')}
        {F('Maniobras', 'maniobras')}{F('Otros', 'otros')}
      </div>

      {/* Aduana / importación */}
      <details open={imp.esImportacion} style={{ marginTop: '0.4rem' }}>
        <summary style={sum}>🛃 Aduana / importación</summary>
        <label style={{ fontSize: 12, color: '#b5651d', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 4 }}>
          <input type="checkbox" checked={imp.esImportacion} onChange={(ev) => setImp({ esImportacion: ev.target.checked })} /> Es importación (internacional)
        </label>
        {imp.esImportacion && (() => {
          const I = (label: string, k: keyof Importacion, ph = '') => (
            <div><label style={lbl}>{label}</label><input style={inp} defaultValue={String(imp[k] ?? '')} key={`imp-${String(k)}-${e.id}`} placeholder={ph} onBlur={(ev) => { if (ev.target.value !== imp[k]) setImp({ [k]: ev.target.value } as Partial<Importacion>); }} /></div>
          );
          return (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                {I('País de origen', 'paisOrigen')}{I('Fracción arancelaria (HS)', 'fraccionArancelaria')}
                {I('Pedimento', 'pedimento')}{I('Agente aduanal', 'agenteAduanal')}
                {I('Valor en aduana', 'valorAduana', '$')}{I('Arancel IGI (%)', 'arancelPct')}
                {I('IVA importación (%)', 'ivaPct', '16')}{I('DTA', 'dta')}
                {I('Honorarios agente', 'honorariosAgente')}{I('Otros gastos', 'otros')}
              </div>
              <div style={{ marginTop: 5, border: '1px solid #ecd9a0', borderRadius: 7, background: '#fffdf6', padding: '0.4rem 0.55rem', fontSize: 11.5, color: '#6b5320' }}>
                Arancel {formatoMoneda(desg.arancel)} + IVA {formatoMoneda(desg.iva)} + DTA {formatoMoneda(desg.dta)} + agente {formatoMoneda(desg.honorarios)} + otros {formatoMoneda(desg.otros)} = <strong>{formatoMoneda(desg.total)}</strong>
                <button style={{ ...btnSm, marginLeft: 8, fontSize: 11 }} onClick={() => set('aduana', String(Math.round(costoAduana(imp) * 100) / 100))}>💡 Pasar a “Aduana” ({formatoMoneda(desg.total)})</button>
              </div>
            </div>
          );
        })()}
      </details>

      {/* Panel landed cost */}
      <div style={{ marginTop: '0.5rem', border: '1px solid #bcd8e6', borderRadius: 8, background: '#f7fbfd', padding: '0.5rem 0.6rem' }}>
        <div style={{ fontSize: 12.5, fontWeight: 'bold', color: '#2b7a93' }}>📦 Landed cost</div>
        <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Mercancía {formatoMoneda(lc.valor)} + logística {formatoMoneda(lc.logistica)} = <strong>{formatoMoneda(lc.total)}</strong> <span style={{ color: '#888' }}>(×{lc.factor.toFixed(2)} sobre el precio)</span></div>
        {prorr.length > 0 && lc.logistica > 0 && (
          <div style={{ marginTop: 4 }}>
            {prorr.map((p) => (
              <div key={p.ordenId} style={{ fontSize: 11, color: '#666', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e6eef1', padding: '1px 0' }}>
                <span>{p.descripcion || '(orden)'}</span>
                <span>{formatoMoneda(p.valor)} + {formatoMoneda(p.logistica)} log = <strong>{formatoMoneda(p.landed)}</strong></span>
              </div>
            ))}
          </div>
        )}
      </div>

      <label style={lbl}>Notas</label>
      <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={e.notas} key={`eno-${e.id}`} onBlur={(ev) => { if (ev.target.value !== e.notas) set('notas', ev.target.value); }} />
      <div style={{ borderTop: '1px solid #e0d3b0', marginTop: '0.6rem', paddingTop: '0.5rem' }}>
        <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={() => onDelete(e.id)}>🗑 Eliminar</button>
      </div>
    </div>
  );
}

// ===== TRANSPORTISTAS: directorio de fletes + tarifas =====
function TransportistasLista({ trps, sel, onSel, onPatch, onDelete, movil }: {
  trps: Transportista[]; sel: string | null; onSel: (id: string | null) => void; onPatch: (t: Transportista) => void; onDelete: (id: string) => void; movil: boolean;
}) {
  const tSel = trps.find((t) => t.id === sel) ?? null;
  return (
    <>
      <p style={{ fontSize: 12, color: '#777', margin: '0 0 0.5rem' }}>Directorio de fletes. La <strong>paquetería</strong> cobra por <strong>base + $/kg</strong> por zona; la <strong>carga</strong> por <strong>$/viaje</strong>. El Centro IA y el botón “Estimar flete” usan estas tarifas.</p>
      {trps.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Aún no hay transportistas. Pulsa <strong>＋ Transportista</strong> (Estafeta, DHL, un flete local…).</p>}
      <div style={{ display: 'grid', gridTemplateColumns: movil || !tSel ? '1fr' : 'minmax(0, 1fr) 400px', gap: '0.75rem', alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem', alignContent: 'start' }}>
          {trps.map((t) => (
            <div key={t.id} onClick={() => onSel(t.id)}
              style={{ border: `1px solid ${sel === t.id ? '#a9720f' : '#e0d3b0'}`, borderLeft: '4px solid #3bb0c9', borderRadius: 9, padding: '0.5rem 0.6rem', background: sel === t.id ? '#fdf6e3' : '#fff', cursor: 'pointer' }}>
              <div style={{ fontWeight: 'bold', fontSize: 13.5 }}>🚛 {t.nombre || '(sin nombre)'}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{t.modalidades.map((m) => modalidadEnvioInfo(m).emoji).join(' ')} {t.modalidades.join(', ') || 'sin modalidad'}{t.tarifas.length ? ` · ${t.tarifas.length} tarifa(s)` : ''}</div>
              {t.zonas.length > 0 && <div style={{ fontSize: 10.5, color: '#999', marginTop: 1 }}>{t.zonas.join(' · ')}</div>}
            </div>
          ))}
        </div>
        {tSel && <TransportistaEditor t={tSel} onPatch={onPatch} onClose={() => onSel(null)} onDelete={onDelete} />}
      </div>
    </>
  );
}

function TransportistaEditor({ t, onPatch, onClose, onDelete }: {
  t: Transportista; onPatch: (t: Transportista) => void; onClose: () => void; onDelete: (id: string) => void;
}) {
  const set = (k: keyof Transportista, val: string | string[] | Tarifa[]) => onPatch({ ...t, [k]: val });
  const T = (label: string, k: keyof Transportista, ph = '') => (
    <div><label style={lbl}>{label}</label><input style={inp} defaultValue={String(t[k] ?? '')} key={`${String(k)}-${t.id}`} placeholder={ph} onBlur={(e) => { if (e.target.value !== t[k]) set(k, e.target.value); }} /></div>
  );
  const setTarifa = (i: number, patch: Partial<Tarifa>) => set('tarifas', t.tarifas.map((x, j) => j === i ? { ...x, ...patch } : x));
  const addTarifa = () => set('tarifas', [...t.tarifas, { modalidad: t.modalidades[0] || 'paqueteria', zona: '', base: '', porKg: '', porViaje: '', tiempoDias: '', notas: '' }]);
  const delTarifa = (i: number) => set('tarifas', t.tarifas.filter((_, j) => j !== i));
  const toggleMod = (m: string) => set('modalidades', t.modalidades.includes(m) ? t.modalidades.filter((x) => x !== m) : [...t.modalidades, m]);
  return (
    <div style={{ border: '1px solid #e0d3b0', borderRadius: 10, background: '#fdf6e3', padding: '0.7rem', position: 'sticky', top: 8, maxHeight: '86vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>🚛 Transportista</strong>
        <button style={btnSm} onClick={onClose}>✕</button>
      </div>
      <label style={lbl}>Nombre</label>
      <input style={inp} defaultValue={t.nombre} key={`tn-${t.id}`} onBlur={(e) => { if (e.target.value !== t.nombre) set('nombre', e.target.value); }} />
      <label style={lbl}>Modalidades que maneja</label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
        {MODALIDADES_ENVIO.filter((m) => m.id !== 'digital').map((m) => (
          <label key={m.id} style={{ fontSize: 12, color: '#555', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={t.modalidades.includes(m.id)} onChange={() => toggleMod(m.id)} /> {m.emoji} {m.label.split(' ')[0]}
          </label>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        {T('Contacto', 'contacto')}{T('Teléfono', 'telefono')}
        {T('Correo', 'email')}{T('Sitio web', 'sitioWeb', 'https://')}
      </div>
      <Chips label="Zonas que cubre" valores={t.zonas} onChange={(v) => set('zonas', v)} placeholder="Local, Bajío, Nacional…" />

      {/* Tarifas */}
      <div style={{ borderTop: '1px solid #e8dcc0', marginTop: '0.6rem', paddingTop: '0.4rem' }}>
        <div style={{ fontSize: 12.5, fontWeight: 'bold', color: '#6b5320' }}>💲 Tarifas ({t.tarifas.length})</div>
        {t.tarifas.map((x, i) => (
          <div key={i} style={{ border: '1px solid #e8dcc0', borderRadius: 7, padding: '0.35rem 0.45rem', marginTop: 4, background: '#fff' }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <select style={{ ...inp, width: 110, padding: '0.2rem' }} value={x.modalidad} onChange={(e) => setTarifa(i, { modalidad: e.target.value })}>
                <option value="paqueteria">📮 Paquetería</option><option value="carga">🚚 Carga</option><option value="mensajeria">🛵 Mensajería</option>
              </select>
              <input style={{ ...inp, flex: 1, padding: '0.2rem 0.35rem' }} placeholder="zona" defaultValue={x.zona} key={`z-${t.id}-${i}`} onBlur={(e) => { if (e.target.value !== x.zona) setTarifa(i, { zona: e.target.value }); }} />
              <span style={{ cursor: 'pointer', color: '#b33' }} onClick={() => delTarifa(i)}>×</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: x.modalidad === 'carga' ? '1fr 1fr' : '1fr 1fr 1fr', gap: 4, marginTop: 4 }}>
              <input style={{ ...inp, padding: '0.2rem 0.35rem' }} placeholder="base $" defaultValue={x.base} key={`b-${t.id}-${i}`} onBlur={(e) => { if (e.target.value !== x.base) setTarifa(i, { base: e.target.value }); }} />
              {x.modalidad === 'carga'
                ? <input style={{ ...inp, padding: '0.2rem 0.35rem' }} placeholder="$/viaje" defaultValue={x.porViaje} key={`v-${t.id}-${i}`} onBlur={(e) => { if (e.target.value !== x.porViaje) setTarifa(i, { porViaje: e.target.value }); }} />
                : <input style={{ ...inp, padding: '0.2rem 0.35rem' }} placeholder="$/kg" defaultValue={x.porKg} key={`k-${t.id}-${i}`} onBlur={(e) => { if (e.target.value !== x.porKg) setTarifa(i, { porKg: e.target.value }); }} />}
              <input style={{ ...inp, padding: '0.2rem 0.35rem' }} placeholder="días" defaultValue={x.tiempoDias} key={`d-${t.id}-${i}`} onBlur={(e) => { if (e.target.value !== x.tiempoDias) setTarifa(i, { tiempoDias: e.target.value }); }} />
            </div>
          </div>
        ))}
        <button style={{ ...btnSm, marginTop: 5 }} onClick={addTarifa}>＋ Agregar tarifa</button>
      </div>

      <label style={lbl}>Notas</label>
      <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={t.notas} key={`tno-${t.id}`} onBlur={(e) => { if (e.target.value !== t.notas) set('notas', e.target.value); }} />
      <div style={{ borderTop: '1px solid #e0d3b0', marginTop: '0.6rem', paddingTop: '0.5rem' }}>
        <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={() => onDelete(t.id)}>🗑 Eliminar</button>
      </div>
    </div>
  );
}

// ===== CONTRATOS: lista con alertas de vencimiento + editor =====
function ContratosLista({ ctrs, sel, onSel, provs, provNombre, hoy, onPatch, onDelete, movil }: {
  ctrs: Contrato[]; sel: string | null; onSel: (id: string | null) => void; provs: Proveedor[]; provNombre: (id: string) => string;
  hoy: string; onPatch: (c: Contrato) => void; onDelete: (id: string) => void; movil: boolean;
}) {
  const cSel = ctrs.find((c) => c.id === sel) ?? null;
  const infos = ctrs.map((c) => ({ c, info: estadoContrato(c, hoy) }));
  const alertas = infos.filter((x) => x.info.alerta);
  return (
    <>
      {alertas.length > 0 && (
        <div style={{ background: '#fdecea', border: '1px solid #f0c9c2', borderRadius: 9, padding: '0.45rem 0.7rem', marginBottom: '0.5rem' }}>
          <strong style={{ fontSize: 12.5, color: '#c0392b' }}>🔔 {alertas.length} contrato(s) requieren atención:</strong>
          <span style={{ fontSize: 12, color: '#a33', marginLeft: 6 }}>{alertas.map((x) => `${x.c.titulo || '(sin título)'} (${x.info.diasRestantes! < 0 ? 'vencido' : `${x.info.diasRestantes}d`})`).join(' · ')}</span>
        </div>
      )}
      {ctrs.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Aún no hay contratos. Pulsa <strong>＋ Contrato</strong> para registrar fechas, montos, cláusulas y alertas de vencimiento.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: movil || !cSel ? '1fr' : 'minmax(0, 1fr) 400px', gap: '0.75rem', alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.5rem', alignContent: 'start' }}>
          {infos.map(({ c, info }) => {
            const est = ESTADOS_CONTRATO[info.estado];
            return (
              <div key={c.id} onClick={() => onSel(c.id)}
                style={{ border: `1px solid ${sel === c.id ? '#a9720f' : '#e0d3b0'}`, borderLeft: `4px solid ${est.color}`, borderRadius: 9, padding: '0.5rem 0.6rem', background: sel === c.id ? '#fdf6e3' : '#fff', cursor: 'pointer' }}>
                <div style={{ fontWeight: 'bold', fontSize: 13.5 }}>📄 {c.titulo || '(sin título)'}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{c.proveedorId ? provNombre(c.proveedorId) : c.tipo || '—'}</div>
                <div style={{ fontSize: 11, color: est.color, marginTop: 2, fontWeight: 'bold' }}>
                  {est.emoji} {est.label}{info.diasRestantes !== null ? (info.diasRestantes < 0 ? ` (hace ${-info.diasRestantes}d)` : ` · ${info.diasRestantes}d`) : ''}{c.renovacionAutomatica ? ' · 🔄 auto' : ''}
                </div>
              </div>
            );
          })}
        </div>
        {cSel && <ContratoEditor c={cSel} provs={provs} info={estadoContrato(cSel, hoy)} onPatch={onPatch} onClose={() => onSel(null)} onDelete={onDelete} />}
      </div>
    </>
  );
}

function ContratoEditor({ c, provs, info, onPatch, onClose, onDelete }: {
  c: Contrato; provs: Proveedor[]; info: { estado: string; diasRestantes: number | null }; onPatch: (c: Contrato) => void; onClose: () => void; onDelete: (id: string) => void;
}) {
  const set = (k: keyof Contrato, val: string | boolean) => onPatch({ ...c, [k]: val });
  const F = (label: string, k: keyof Contrato, ph = '', type = 'text') => (
    <div><label style={lbl}>{label}</label><input style={inp} type={type} defaultValue={String(c[k] ?? '')} key={`${String(k)}-${c.id}`} placeholder={ph} onBlur={(e) => { if (e.target.value !== c[k]) set(k, e.target.value); }} /></div>
  );
  const est = ESTADOS_CONTRATO[info.estado as keyof typeof ESTADOS_CONTRATO];
  return (
    <div style={{ border: '1px solid #e0d3b0', borderRadius: 10, background: '#fdf6e3', padding: '0.7rem', position: 'sticky', top: 8, maxHeight: '86vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>📄 Contrato</strong>
        <button style={btnSm} onClick={onClose}>✕</button>
      </div>
      <div style={{ fontSize: 12, fontWeight: 'bold', color: est.color, margin: '4px 0' }}>{est.emoji} {est.label}{info.diasRestantes !== null ? (info.diasRestantes < 0 ? ` — venció hace ${-info.diasRestantes} días` : ` — vence en ${info.diasRestantes} días`) : ''}</div>
      <label style={lbl}>Título</label>
      <input style={inp} defaultValue={c.titulo} key={`t-${c.id}`} onBlur={(e) => { if (e.target.value !== c.titulo) set('titulo', e.target.value); }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        <div><label style={lbl}>Proveedor</label>
          <select style={inp} value={c.proveedorId} onChange={(e) => set('proveedorId', e.target.value)}>
            <option value="">— sin asignar —</option>{provs.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select></div>
        {F('Tipo', 'tipo', 'suministro / servicio…')}
        {F('Fecha inicio', 'fechaInicio', '', 'date')}{F('Fecha vencimiento', 'fechaVencimiento', '', 'date')}
        {F('Monto', 'monto')}{F('Moneda', 'moneda', 'MXN')}
        {F('Alertar (días antes)', 'alertaDias', '30')}{F('Responsables', 'responsables')}
      </div>
      <label style={{ fontSize: 12, color: '#2e7a4d', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: '0.5rem' }}>
        <input type="checkbox" checked={c.renovacionAutomatica} onChange={(e) => set('renovacionAutomatica', e.target.checked)} /> 🔄 Renovación automática
      </label>
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        <label style={{ fontSize: 12, color: '#555', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}><input type="checkbox" checked={c.exclusividad} onChange={(e) => set('exclusividad', e.target.checked)} /> Exclusividad</label>
        <label style={{ fontSize: 12, color: '#555', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}><input type="checkbox" checked={c.confidencialidad} onChange={(e) => set('confidencialidad', e.target.checked)} /> Confidencialidad</label>
      </div>
      <label style={lbl}>Cláusulas importantes</label>
      <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={c.clausulas} key={`cl-${c.id}`} onBlur={(e) => set('clausulas', e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        {F('Multas', 'multas')}{F('Garantías', 'garantias')}
      </div>
      <label style={lbl}>📎 Documento (URL del PDF)</label>
      <input style={inp} defaultValue={c.documento} key={`doc-${c.id}`} placeholder="https://…" onBlur={(e) => set('documento', e.target.value)} />
      <label style={lbl}>Notas</label>
      <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={c.notas} key={`cno-${c.id}`} onBlur={(e) => set('notas', e.target.value)} />
      <div style={{ borderTop: '1px solid #e0d3b0', marginTop: '0.6rem', paddingTop: '0.5rem' }}>
        <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={() => onDelete(c.id)}>🗑 Eliminar</button>
      </div>
    </div>
  );
}

// ===== Editor de PROVEEDOR (ficha rica) =====
function ProveedorEditor({ prov, incidencias, score, interacciones, ultContacto, onPatch, onClose, onDelete, onAddInc, onPatchInc, onBorrarInc, onAddInt, onPatchInt, onBorrarInt }: {
  prov: Proveedor; incidencias: Incidencia[]; score: ReturnType<typeof scoreProveedor>;
  interacciones: Interaccion[]; ultContacto: string;
  onPatch: (p: Partial<Proveedor>) => void; onClose: () => void; onDelete: () => void;
  onAddInc: () => void; onPatchInc: (i: Incidencia) => void; onBorrarInc: (id: string) => void;
  onAddInt: () => void; onPatchInt: (i: Interaccion) => void; onBorrarInt: (id: string) => void;
}) {
  const T = (label: string, k: keyof Proveedor, ph = '') => (
    <div><label style={lbl}>{label}</label><input style={inp} defaultValue={String(prov[k] ?? '')} key={`${String(k)}-${prov.id}`} placeholder={ph} onBlur={(e) => { if (e.target.value !== prov[k]) onPatch({ [k]: e.target.value } as Partial<Proveedor>); }} /></div>
  );
  const niv = NIVELES_SCORE[score.nivel];
  const setEval = (crit: string, val: number) => onPatch({ evaluacion: { ...prov.evaluacion, [crit]: val } });
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

      {/* ==== EVALUACIÓN Y SCORE ==== */}
      <div style={{ borderTop: '2px solid #e0d3b0', marginTop: '0.6rem', paddingTop: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 'bold', color: '#6b5320', flex: 1 }}>⭐ Evaluación</span>
          <span style={{ fontSize: 12, fontWeight: 'bold', color: '#fff', background: niv.color, borderRadius: 10, padding: '1px 10px' }}>
            {niv.emoji} {score.score !== null ? `Score ${score.score}` : 'Sin evaluar'}
          </span>
        </div>
        {score.score !== null && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{niv.label} · promedio {score.base} de {score.nCriterios} criterios{score.penalizacion ? ` − ${score.penalizacion} por ${score.incidencias} incidencia(s)` : ''}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem 0.6rem', marginTop: 4 }}>
          {CRITERIOS_EVAL.map((c) => {
            const val = prov.evaluacion[c.id] ?? 0;
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: '#666', flex: 1 }}>{c.label}</span>
                <input type="range" min={0} max={100} step={5} value={val} style={{ width: 70 }} onChange={(e) => setEval(c.id, Number(e.target.value))} />
                <span style={{ fontSize: 11, width: 24, textAlign: 'right', color: val ? '#6b5320' : '#bbb' }}>{val || '—'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==== RELACIÓN COMERCIAL / BITÁCORA ==== */}
      <details open>
        <summary style={sum}>🤝 Relación ({interacciones.length} interacción{interacciones.length !== 1 ? 'es' : ''})</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          <div><label style={lbl}>Estado de relación</label>
            <select style={inp} value={prov.estadoRelacion} onChange={(e) => onPatch({ estadoRelacion: e.target.value })}>
              <option value="">— sin definir —</option>{ESTADOS_RELACION.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
          <div><label style={lbl}>Próximo seguimiento</label><input style={inp} type="date" defaultValue={prov.proximoSeguimiento} key={`ps-${prov.id}`} onBlur={(e) => { if (e.target.value !== prov.proximoSeguimiento) onPatch({ proximoSeguimiento: e.target.value }); }} /></div>
        </div>
        {T('Responsable de la relación (firma correos)', 'responsable', 'nombre real')}
        <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>Último contacto: <strong>{ultContacto || 'nunca'}</strong>{prov.proximoSeguimiento && prov.proximoSeguimiento <= new Date().toISOString().slice(0, 10) ? ' · ⏰ seguimiento pendiente' : ''}</div>
        {interacciones.length > 0 && (
          <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 4, borderTop: '1px solid #f0ead9' }}>
            {interacciones.map((it) => (
              <div key={it.id} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #f5efdd' }}>
                <span title={it.direccion} style={{ color: it.direccion === 'entrante' ? '#2e7a4d' : '#6b5320' }}>{it.direccion === 'entrante' ? '⬅' : '➡'}</span>
                <input style={{ ...inp, width: 116, padding: '0.15rem 0.3rem' }} type="date" defaultValue={it.fecha} key={`itf-${it.id}`} onBlur={(e) => { if (e.target.value !== it.fecha) onPatchInt({ ...it, fecha: e.target.value }); }} />
                <select style={{ ...inp, width: 96, padding: '0.15rem' }} value={it.tipo} onChange={(e) => onPatchInt({ ...it, tipo: e.target.value })}>
                  {TIPOS_INTERACCION.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input style={{ ...inp, flex: 1, padding: '0.15rem 0.3rem' }} placeholder="resumen" defaultValue={it.resumen} key={`itr-${it.id}`} onBlur={(e) => { if (e.target.value !== it.resumen) onPatchInt({ ...it, resumen: e.target.value }); }} />
                <span style={{ cursor: 'pointer', color: '#b33' }} onClick={() => onBorrarInt(it.id)}>×</span>
              </div>
            ))}
          </div>
        )}
        <button style={{ ...btnSm, marginTop: 5 }} onClick={onAddInt}>＋ Anotar interacción</button>
      </details>

      {/* ==== CALIDAD / INCIDENCIAS ==== */}
      <details>
        <summary style={sum}>🧪 Calidad e incidencias ({incidencias.length})</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {T('% Cumplimiento', 'cumplimiento')}{T('Tiempo promedio', 'tiempoPromedio')}
        </div>
        {incidencias.map((i) => (
          <div key={i.id} style={{ border: '1px solid #e8dcc0', borderRadius: 7, padding: '0.35rem 0.45rem', marginTop: 4, background: '#fff' }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <select style={{ ...inp, width: 110, padding: '0.2rem' }} value={i.tipo} onChange={(e) => onPatchInc({ ...i, tipo: e.target.value })}>
                {TIPOS_INCIDENCIA.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select style={{ ...inp, width: 80, padding: '0.2rem' }} value={i.gravedad} onChange={(e) => onPatchInc({ ...i, gravedad: e.target.value as Incidencia['gravedad'] })}>
                <option value="leve">leve</option><option value="media">media</option><option value="grave">grave</option>
              </select>
              <input style={{ ...inp, width: 120, padding: '0.2rem' }} type="date" defaultValue={i.fecha} key={`if-${i.id}`} onBlur={(e) => { if (e.target.value !== i.fecha) onPatchInc({ ...i, fecha: e.target.value }); }} />
              <span style={{ cursor: 'pointer', color: '#b33', marginLeft: 'auto' }} onClick={() => onBorrarInc(i.id)}>×</span>
            </div>
            <input style={{ ...inp, marginTop: 3 }} placeholder="descripción" defaultValue={i.descripcion} key={`id-${i.id}`} onBlur={(e) => { if (e.target.value !== i.descripcion) onPatchInc({ ...i, descripcion: e.target.value }); }} />
            <input style={{ ...inp, marginTop: 3 }} placeholder="evidencia (URL)" defaultValue={i.evidencia} key={`ie-${i.id}`} onBlur={(e) => { if (e.target.value !== i.evidencia) onPatchInc({ ...i, evidencia: e.target.value }); }} />
          </div>
        ))}
        <button style={{ ...btnSm, marginTop: 5 }} onClick={onAddInc}>＋ Registrar incidencia</button>
      </details>

      {/* ==== RIESGO ==== */}
      <details>
        <summary style={sum}>⚠️ Riesgo</summary>
        <label style={{ fontSize: 12, color: '#c0392b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 4 }}>
          <input type="checkbox" checked={prov.proveedorUnico} onChange={(e) => onPatch({ proveedorUnico: e.target.checked })} /> Proveedor ÚNICO (riesgo de dependencia)
        </label>
        <label style={lbl}>Dependencia</label>
        <select style={inp} value={prov.dependencia} onChange={(e) => onPatch({ dependencia: e.target.value })}>
          <option value="">— sin definir —</option>{DEPENDENCIAS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <Chips label="Riesgos" valores={prov.riesgos} onChange={(v) => onPatch({ riesgos: v })} opciones={RIESGOS} placeholder="político, cambiario…" />
        {T('Plan B', 'planB')}
        {T('Proveedor alternativo', 'proveedorAlternativo')}
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
function ProductoEditor({ prod, provs, vinculos, provNombre, hoy, onPatch, onClose, onDelete, onAgregar, onGuardarVinculo, onBorrarVinculo, onSolicitud }: {
  prod: Producto; provs: Proveedor[]; vinculos: ProductoProveedor[]; provNombre: (id: string) => string; hoy: string;
  onPatch: (p: Partial<Producto>) => void; onClose: () => void; onDelete: () => void;
  onAgregar: (proveedorId: string) => void; onGuardarVinculo: (v: ProductoProveedor) => void; onBorrarVinculo: (id: string) => void;
  onSolicitud: () => void;
}) {
  const [addSel, setAddSel] = useState('');
  const T = (label: string, k: keyof Producto, ph = '') => (
    <div><label style={lbl}>{label}</label><input style={inp} defaultValue={String(prod[k] ?? '')} key={`${String(k)}-${prod.id}`} placeholder={ph} onBlur={(e) => { if (e.target.value !== prod[k]) onPatch({ [k]: e.target.value } as Partial<Producto>); }} /></div>
  );
  const yaVinculados = new Set(vinculos.map((v) => v.proveedorId));
  const disponibles = provs.filter((p) => !yaVinculados.has(p.id));
  const plan = planearCompra(prod, hoy);
  const ac = ACCIONES_COMPRA[plan.accion];

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

      {/* ==== INVENTARIO Y PLANEACIÓN ==== */}
      <div style={{ borderTop: '2px solid #e0d3b0', marginTop: '0.7rem', paddingTop: '0.4rem' }}>
        <div style={{ fontSize: 12.5, fontWeight: 'bold', color: '#6b5320' }}>📦 Inventario y planeación</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
          {T('Stock actual', 'stockActual')}{T('Stock mínimo', 'stockMinimo')}{T('Stock máximo', 'stockMaximo')}
          {T('Punto de reorden', 'puntoReorden')}{T('Stock de seguridad', 'stockSeguridad')}{T('Lead time (días)', 'leadTimeDias')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {T('Consumo mensual', 'consumoMensual', 'unid./mes')}{T('Frecuencia de compra', 'frecuenciaCompra', 'mensual…')}
        </div>
        {T('📍 Ubicación del inventario', 'ubicacion')}

        {/* Recomendación automática */}
        <div style={{ marginTop: '0.5rem', border: `1px solid ${ac.color}`, borderRadius: 8, background: '#fff', padding: '0.5rem 0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 'bold', color: '#fff', background: ac.color, borderRadius: 8, padding: '1px 8px' }}>{ac.emoji} {ac.label}</span>
            {plan.diasCobertura !== null && <span style={{ fontSize: 12, color: '#555' }}>~{plan.diasCobertura} días de cobertura</span>}
          </div>
          <div style={{ fontSize: 11.5, color: '#666', marginTop: 4 }}>{plan.motivo}</div>
          <div style={{ fontSize: 11.5, color: '#888', marginTop: 2 }}>
            {plan.seAgotaEn !== '—' ? `Se agota ~${plan.seAgotaEn}` : 'Sin pronóstico (falta consumo)'}
            {plan.cantidadSugerida !== null ? ` · sugerido pedir: ${plan.cantidadSugerida} ${prod.unidad}`.trimEnd() : ''}
          </div>
          {(plan.accion === 'comprar-urgente' || plan.accion === 'comprar-hoy' || plan.accion === 'comprar-pronto') && (
            <button style={{ ...btnSm, marginTop: 6, background: '#fff3e6', borderColor: ac.color, color: ac.color, fontWeight: 'bold' }} onClick={onSolicitud}>🛒 Generar solicitud de compra</button>
          )}
        </div>
      </div>

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
