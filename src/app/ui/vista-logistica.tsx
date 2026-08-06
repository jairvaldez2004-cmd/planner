'use client';

// LOGÍSTICA — nodo propio del grafo. 🛒 Compra/Abasto (embarques que consolidan órdenes de
// compra, con landed cost) · 🚛 Transportistas (directorio compartido) · 📮 Entrega (envío al
// cliente final) · 🔄 Interna y 👥 Capital Humano (vistas de SOLO LECTURA sobre Mapa Operativo
// y Personas & RH — ese dato vive allá; aquí solo se muestra, para no duplicarlo).

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  listarEmbarques, guardarEmbarque, eliminarEmbarque,
  listarTransportistas, guardarTransportista, eliminarTransportista,
  listarEntregas, guardarEntrega, eliminarEntrega,
} from '@/app/actions/logistica.actions';
import { listarOrdenes } from '@/app/actions/recursos.actions';
import { listarContingencias, listarProcesos } from '@/app/actions/mapa.actions';
import { listarEmpleados } from '@/app/actions/rh.actions';
import {
  ESTADOS_EMBARQUE, estadoEmbarqueInfo, siguienteEstadoEmbarque, embarqueVacio, landedCostEmbarque, prorrateoLanded, embarqueRetrasado,
  MODALIDADES_ENVIO, modalidadEnvioInfo, transportistaVacio, cotizarFlete, mejorTransportista,
  desgloseAduana, costoAduana,
  ESTADOS_ENTREGA, estadoEntregaInfo, siguienteEstadoEntrega, entregaVacia, entregaRetrasada,
} from '@/domain/logistica';
import type { Embarque, Transportista, Tarifa, Importacion, Entrega } from '@/domain/logistica';
import { formatoMoneda, numero, totalOrden } from '@/domain/recursos';
import type { OrdenCompra } from '@/domain/recursos';
import type { ProcesoNodo } from '@/domain/mapa';
import type { Contingencia } from '@/domain/contingencia';
import type { Empleado } from '@/domain/rh';
import { useEsMovil } from './use-movil';
import { enUC, ucIdsIniciales } from '@/domain/uc-scope';

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: 'var(--bp-panel)', cursor: 'pointer', fontSize: 13 };
const btnSm: CSSProperties = { ...btn, padding: '0.15rem 0.5rem', fontSize: 12 };
const inp: CSSProperties = { padding: '0.35rem 0.55rem', borderRadius: 6, border: '1px solid var(--bp-border)', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: 'var(--bp-muted)', marginTop: '0.5rem', fontWeight: 'bold' };
const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bp-panel-alt)', border: '1px solid #bcd8e6', borderRadius: 12, padding: '0.05rem 0.5rem', fontSize: 12, margin: '2px 3px 0 0' };
const sum: CSSProperties = { cursor: 'pointer', fontSize: 12, fontWeight: 'bold', color: 'var(--bp-text)', marginTop: '0.6rem' };

type Tab = 'compra' | 'transportistas' | 'entrega' | 'interna' | 'capital-humano';

// `ucId`: si se pasa, Compra/Entrega quedan SCOPEADAS a esa Unidad Comercial — solo ven
// embarques/entregas compartidos (sin ucIds) o etiquetados con esa UC, y lo que se da de
// alta aquí queda etiquetado a ella. Interna/Capital Humano siguen siendo lentes de solo
// lectura a nivel proyecto (no se acotan: son enlaces al Mapa/Personas, no captura).
export function VistaLogistica({ proyectoId, onIrMapa, onIrPersonas, ucId, ucNombre }: { proyectoId: string; onIrMapa?: () => void; onIrPersonas?: () => void; ucId?: string; ucNombre?: string }) {
  const [embs, setEmbs] = useState<Embarque[]>([]);
  const [ocs, setOcs] = useState<OrdenCompra[]>([]);
  const [selEmb, setSelEmb] = useState<string | null>(null);
  const [trps, setTrps] = useState<Transportista[]>([]);
  const [selTrp, setSelTrp] = useState<string | null>(null);
  const [ents, setEnts] = useState<Entrega[]>([]);
  const [selEnt, setSelEnt] = useState<string | null>(null);
  const [contingencias, setContingencias] = useState<Contingencia[]>([]);
  const [procesos, setProcesos] = useState<ProcesoNodo[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [tab, setTab] = useState<Tab>('compra');
  const [loading, setLoading] = useState(true);
  const movil = useEsMovil();
  const hoy = new Date().toISOString().slice(0, 10);

  const cargar = () => {
    setLoading(true);
    Promise.all([
      listarEmbarques(proyectoId), listarOrdenes(proyectoId), listarTransportistas(proyectoId), listarEntregas(proyectoId),
      listarContingencias(proyectoId), listarProcesos(proyectoId), listarEmpleados(proyectoId),
    ])
      .then(([emb, o, trp, ent, cont, proc, emp]) => { setEmbs(emb); setOcs(o); setTrps(trp); setEnts(ent); setContingencias(cont); setProcesos(proc); setEmpleados(emp); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);

  // Embarques (compra/abasto)
  async function nuevoEmb() { const n = await guardarEmbarque(proyectoId, { ...embarqueVacio(''), fechaRecoleccion: hoy, ucIds: ucIdsIniciales(ucId) }); setEmbs((l) => [...l, n]); setSelEmb(n.id); }
  async function patchEmb(e: Embarque) { setEmbs((l) => l.map((x) => x.id === e.id ? e : x)); await guardarEmbarque(proyectoId, e); }
  async function borrarEmb(id: string) { if (!window.confirm('¿Eliminar este embarque?')) return; setEmbs((l) => l.filter((x) => x.id !== id)); setSelEmb(null); await eliminarEmbarque(proyectoId, id); }
  // Transportistas
  async function nuevoTrp() { const n = await guardarTransportista(proyectoId, { ...transportistaVacio(''), nombre: 'Nuevo transportista' }); setTrps((l) => [...l, n]); setSelTrp(n.id); }
  async function patchTrp(t: Transportista) { setTrps((l) => l.map((x) => x.id === t.id ? t : x)); await guardarTransportista(proyectoId, t); }
  async function borrarTrp(id: string) { if (!window.confirm('¿Eliminar este transportista?')) return; setTrps((l) => l.filter((x) => x.id !== id)); setSelTrp(null); await eliminarTransportista(proyectoId, id); }
  // Entregas
  async function nuevaEnt() { const n = await guardarEntrega(proyectoId, { ...entregaVacia(''), ucIds: ucIdsIniciales(ucId) }); setEnts((l) => [...l, n]); setSelEnt(n.id); }
  async function patchEnt(e: Entrega) { setEnts((l) => l.map((x) => x.id === e.id ? e : x)); await guardarEntrega(proyectoId, e); }
  async function borrarEnt(id: string) { if (!window.confirm('¿Eliminar esta entrega?')) return; setEnts((l) => l.filter((x) => x.id !== id)); setSelEnt(null); await eliminarEntrega(proyectoId, id); }

  const contingenciasLogistica = contingencias.filter((c) => c.categoria === 'logística');
  const empleadosLogistica = empleados.filter((e) => /log[íi]stica/i.test(e.departamento));

  // Alcance por UC: sin ucId (nivel proyecto) ve todo; con ucId, solo lo compartido + lo de esta UC.
  const embsEnUC = ucId ? embs.filter((e) => enUC(e.ucIds, ucId)) : embs;
  const entsEnUC = ucId ? ents.filter((e) => enUC(e.ucIds, ucId)) : ents;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>🚚 Logística <span style={{ fontSize: 13, color: 'var(--bp-muted)' }}>· compra, entrega y su gente{ucId ? ` · dentro de ${ucNombre ?? 'esta UC'}` : ''}</span></h2>
        {tab === 'compra' && <button style={btn} onClick={() => void nuevoEmb()}>＋ Embarque</button>}
        {tab === 'transportistas' && <button style={btn} onClick={() => void nuevoTrp()}>＋ Transportista</button>}
        {tab === 'entrega' && <button style={btn} onClick={() => void nuevaEnt()}>＋ Entrega</button>}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', margin: '0.5rem 0 0.4rem', flexWrap: 'wrap' }}>
        {([['compra', '🛒 Compra/Abasto'], ['transportistas', '🚛 Transportistas'], ['entrega', '📮 Entrega'], ['interna', '🔄 Interna'], ['capital-humano', '👥 Capital Humano']] as const).map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setSelEmb(null); setSelTrp(null); setSelEnt(null); }}
            style={{ ...btn, background: tab === id ? '#2f8f8f' : '#fff', color: tab === id ? '#fff' : '#1f6b6b', borderColor: tab === id ? '#2f8f8f' : '#bcd8e6', fontWeight: 'bold' }}>{label}</button>
        ))}
      </div>

      {loading && <p style={{ color: 'var(--bp-muted)' }}>Cargando…</p>}

      {!loading && tab === 'compra' && <EmbarquesLista embs={embsEnUC} ocs={ocs} trps={trps} sel={selEmb} onSel={setSelEmb} hoy={hoy} onPatch={patchEmb} onDelete={borrarEmb} movil={movil} />}
      {!loading && tab === 'transportistas' && <TransportistasLista trps={trps} sel={selTrp} onSel={setSelTrp} onPatch={patchTrp} onDelete={borrarTrp} movil={movil} />}
      {!loading && tab === 'entrega' && <EntregasLista ents={entsEnUC} trps={trps} sel={selEnt} onSel={setSelEnt} hoy={hoy} onPatch={patchEnt} onDelete={borrarEnt} movil={movil} />}
      {!loading && tab === 'interna' && <PanelInterna contingencias={contingenciasLogistica} procesos={procesos} onIrMapa={onIrMapa ?? (() => {})} />}
      {!loading && tab === 'capital-humano' && <PanelCapitalHumano empleados={empleadosLogistica} onIrPersonas={onIrPersonas ?? (() => {})} />}
    </section>
  );
}

// ===== COMPRA/ABASTO: embarques (consolidación + landed cost) =====
function EmbarquesLista({ embs, ocs, trps, sel, onSel, hoy, onPatch, onDelete, movil }: {
  embs: Embarque[]; ocs: OrdenCompra[]; trps: Transportista[]; sel: string | null; onSel: (id: string | null) => void; hoy: string;
  onPatch: (e: Embarque) => void; onDelete: (id: string) => void; movil: boolean;
}) {
  const eSel = embs.find((e) => e.id === sel) ?? null;
  const retrasados = embs.filter((e) => embarqueRetrasado(e, hoy));
  return (
    <>
      <p style={{ fontSize: 12, color: 'var(--bp-muted)', margin: '0 0 0.5rem' }}>
        Un <strong>embarque</strong> consolida órdenes de compra en un envío. El costo logístico (flete/seguro/aduana) se suma al valor de la mercancía = <strong>landed cost</strong> (costo puesto en tienda) y alimenta Financiero.
      </p>
      {retrasados.length > 0 && (
        <div style={{ background: 'var(--bp-panel-alt)', border: '1px solid #f0c9c2', borderRadius: 9, padding: '0.45rem 0.7rem', marginBottom: '0.5rem' }}>
          <strong style={{ fontSize: 12.5, color: '#c0392b' }}>⚠ {retrasados.length} embarque(s) retrasado(s):</strong>
          <span style={{ fontSize: 12, color: '#a33', marginLeft: 6 }}>{retrasados.map((e) => `${e.folio || e.destino || 'embarque'} (ETA ${e.fechaEstimada})`).join(' · ')}</span>
        </div>
      )}
      {embs.length === 0 && <p style={{ color: 'var(--bp-muted)', fontSize: 13 }}>Aún no hay embarques. Pulsa <strong>＋ Embarque</strong> para consolidar órdenes y calcular el landed cost.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: movil || !eSel ? '1fr' : 'minmax(0, 1fr) 420px', gap: '0.75rem', alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem', alignContent: 'start' }}>
          {embs.map((e) => {
            const inf = estadoEmbarqueInfo(e.estado); const lc = landedCostEmbarque(e, ocs); const ret = embarqueRetrasado(e, hoy);
            return (
              <div key={e.id} onClick={() => onSel(e.id)}
                style={{ border: `1px solid ${sel === e.id ? '#2f8f8f' : '#bcd8e6'}`, borderLeft: `4px solid ${ret ? '#c0392b' : '#2f8f8f'}`, borderRadius: 9, padding: '0.5rem 0.6rem', background: sel === e.id ? '#eaf4f4' : '#fff', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontWeight: 'bold', fontSize: 13.5, flex: 1 }}>{modalidadEnvioInfo(e.modalidad).emoji} {e.folio || e.destino || 'Embarque'}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 'bold', color: '#fff', background: ret ? '#c0392b' : '#2f8f8f', borderRadius: 8, padding: '0 6px' }}>{inf.emoji} {inf.label}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--bp-muted)', marginTop: 2 }}>{modalidadEnvioInfo(e.modalidad).label}{e.importacion.esImportacion ? ' · 🛃 importación' : ''} · {e.transportista || 'sin transportista'}{e.tracking ? ` · guía ${e.tracking}` : ''}{e.fechaEstimada ? ` · ETA ${e.fechaEstimada}` : ''}</div>
                <div style={{ fontSize: 11.5, color: 'var(--bp-text)', marginTop: 2 }}>Landed <strong>{formatoMoneda(lc.total)}</strong> {lc.logistica > 0 ? <span style={{ color: 'var(--bp-muted)' }}>(+{formatoMoneda(lc.logistica)} log · ×{lc.factor.toFixed(2)})</span> : null}</div>
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
    <div style={{ border: '1px solid #bcd8e6', borderRadius: 10, background: 'var(--bp-panel-alt)', padding: '0.7rem', position: 'sticky', top: 8, maxHeight: '86vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>🚚 Embarque</strong>
        <button style={btnSm} onClick={onClose}>✕</button>
      </div>
      {/* Stepper de estado */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, margin: '6px 0' }}>
        {ESTADOS_EMBARQUE.map((x, i) => (
          <span key={x.id} onClick={() => set('estado', x.id)} title={x.label}
            style={{ fontSize: 11, cursor: 'pointer', padding: '1px 6px', borderRadius: 8, background: i <= idx ? '#2f8f8f' : '#e6eef1', color: i <= idx ? '#fff' : '#68808a' }}>{x.emoji}</span>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#1f6b6b' }}>{estadoEmbarqueInfo(e.estado).emoji} {estadoEmbarqueInfo(e.estado).label}</div>
      {e.estado !== 'entregado' && <button style={{ ...btnSm, marginTop: 4, background: 'var(--bp-panel-alt)', borderColor: '#bcd8e6', color: '#1f6b6b', fontWeight: 'bold' }} onClick={() => set('estado', siguienteEstadoEmbarque(e.estado))}>→ Avanzar a «{estadoEmbarqueInfo(siguienteEstadoEmbarque(e.estado)).label}»</button>}

      <label style={lbl}>Modalidad de envío</label>
      <select style={inp} value={e.modalidad} onChange={(ev) => set('modalidad', ev.target.value)}>
        {MODALIDADES_ENVIO.map((m) => <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>)}
      </select>
      {e.modalidad === 'paqueteria' && <p style={{ fontSize: 10.5, color: 'var(--bp-muted)', margin: '2px 0 0' }}>Courier (Estafeta/DHL/FedEx…): cobra por guía/peso/volumen. Suele ser 1 orden por guía; el flete es el costo de la guía.</p>}
      {e.modalidad === 'carga' && <p style={{ fontSize: 10.5, color: 'var(--bp-muted)', margin: '2px 0 0' }}>Flete/tráiler: aquí sí conviene consolidar varias órdenes en el mismo envío.</p>}
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
      <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid #cfe2ea', borderRadius: 7, padding: '0.3rem' }}>
        {ocs.filter((o) => o.etapa !== 'cerrada' || incluidas.has(o.id)).map((o) => (
          <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={incluidas.has(o.id)} onChange={() => toggleOrden(o.id)} />
            <span style={{ flex: 1 }}>{o.descripcion || '(orden)'} <span style={{ color: 'var(--bp-muted)' }}>{o.cantidad ? `· ${o.cantidad} ${o.unidad}` : ''}</span></span>
            <span style={{ color: 'var(--bp-text)' }}>{totalOrden(o) !== null ? formatoMoneda(totalOrden(o)!) : '—'}</span>
          </label>
        ))}
        {ocs.length === 0 && <span style={{ fontSize: 11, color: 'var(--bp-muted)' }}>No hay órdenes de compra. Créalas en 📦 Recursos & Proveedores → 🛒 Compras.</span>}
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
              <div style={{ marginTop: 5, border: '1px solid #bcd8e6', borderRadius: 7, background: 'var(--bp-panel-alt)', padding: '0.4rem 0.55rem', fontSize: 11.5, color: 'var(--bp-text)' }}>
                Arancel {formatoMoneda(desg.arancel)} + IVA {formatoMoneda(desg.iva)} + DTA {formatoMoneda(desg.dta)} + agente {formatoMoneda(desg.honorarios)} + otros {formatoMoneda(desg.otros)} = <strong>{formatoMoneda(desg.total)}</strong>
                <button style={{ ...btnSm, marginLeft: 8, fontSize: 11 }} onClick={() => set('aduana', String(Math.round(costoAduana(imp) * 100) / 100))}>💡 Pasar a “Aduana” ({formatoMoneda(desg.total)})</button>
              </div>
            </div>
          );
        })()}
      </details>

      {/* Panel landed cost */}
      <div style={{ marginTop: '0.5rem', border: '1px solid #bcd8e6', borderRadius: 8, background: 'var(--bp-panel-alt)', padding: '0.5rem 0.6rem' }}>
        <div style={{ fontSize: 12.5, fontWeight: 'bold', color: '#1f6b6b' }}>📦 Landed cost</div>
        <div style={{ fontSize: 12, color: 'var(--bp-muted)', marginTop: 2 }}>Mercancía {formatoMoneda(lc.valor)} + logística {formatoMoneda(lc.logistica)} = <strong>{formatoMoneda(lc.total)}</strong> <span style={{ color: 'var(--bp-muted)' }}>(×{lc.factor.toFixed(2)} sobre el precio)</span></div>
        {prorr.length > 0 && lc.logistica > 0 && (
          <div style={{ marginTop: 4 }}>
            {prorr.map((p) => (
              <div key={p.ordenId} style={{ fontSize: 11, color: 'var(--bp-muted)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e6eef1', padding: '1px 0' }}>
                <span>{p.descripcion || '(orden)'}</span>
                <span>{formatoMoneda(p.valor)} + {formatoMoneda(p.logistica)} log = <strong>{formatoMoneda(p.landed)}</strong></span>
              </div>
            ))}
          </div>
        )}
      </div>

      <label style={lbl}>Notas</label>
      <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={e.notas} key={`eno-${e.id}`} onBlur={(ev) => { if (ev.target.value !== e.notas) set('notas', ev.target.value); }} />
      <div style={{ borderTop: '1px solid #bcd8e6', marginTop: '0.6rem', paddingTop: '0.5rem' }}>
        <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={() => onDelete(e.id)}>🗑 Eliminar</button>
      </div>
    </div>
  );
}

// ===== TRANSPORTISTAS: directorio de fletes + tarifas (compartido por Compra y Entrega) =====
function TransportistasLista({ trps, sel, onSel, onPatch, onDelete, movil }: {
  trps: Transportista[]; sel: string | null; onSel: (id: string | null) => void; onPatch: (t: Transportista) => void; onDelete: (id: string) => void; movil: boolean;
}) {
  const tSel = trps.find((t) => t.id === sel) ?? null;
  return (
    <>
      <p style={{ fontSize: 12, color: 'var(--bp-muted)', margin: '0 0 0.5rem' }}>Directorio de fletes, usado tanto por 🛒 Compra/Abasto como por 📮 Entrega. La <strong>paquetería</strong> cobra por <strong>base + $/kg</strong> por zona; la <strong>carga</strong> por <strong>$/viaje</strong>.</p>
      {trps.length === 0 && <p style={{ color: 'var(--bp-muted)', fontSize: 13 }}>Aún no hay transportistas. Pulsa <strong>＋ Transportista</strong> (Estafeta, DHL, un flete local…).</p>}
      <div style={{ display: 'grid', gridTemplateColumns: movil || !tSel ? '1fr' : 'minmax(0, 1fr) 400px', gap: '0.75rem', alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem', alignContent: 'start' }}>
          {trps.map((t) => (
            <div key={t.id} onClick={() => onSel(t.id)}
              style={{ border: `1px solid ${sel === t.id ? '#2f8f8f' : '#bcd8e6'}`, borderLeft: '4px solid #2f8f8f', borderRadius: 9, padding: '0.5rem 0.6rem', background: sel === t.id ? '#eaf4f4' : '#fff', cursor: 'pointer' }}>
              <div style={{ fontWeight: 'bold', fontSize: 13.5 }}>🚛 {t.nombre || '(sin nombre)'}</div>
              <div style={{ fontSize: 11, color: 'var(--bp-muted)', marginTop: 2 }}>{t.modalidades.map((m) => modalidadEnvioInfo(m).emoji).join(' ')} {t.modalidades.join(', ') || 'sin modalidad'}{t.tarifas.length ? ` · ${t.tarifas.length} tarifa(s)` : ''}</div>
              {t.zonas.length > 0 && <div style={{ fontSize: 10.5, color: 'var(--bp-muted)', marginTop: 1 }}>{t.zonas.join(' · ')}</div>}
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
    <div style={{ border: '1px solid #bcd8e6', borderRadius: 10, background: 'var(--bp-panel-alt)', padding: '0.7rem', position: 'sticky', top: 8, maxHeight: '86vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>🚛 Transportista</strong>
        <button style={btnSm} onClick={onClose}>✕</button>
      </div>
      <label style={lbl}>Nombre</label>
      <input style={inp} defaultValue={t.nombre} key={`tn-${t.id}`} onBlur={(e) => { if (e.target.value !== t.nombre) set('nombre', e.target.value); }} />
      <label style={lbl}>Modalidades que maneja</label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
        {MODALIDADES_ENVIO.filter((m) => m.id !== 'digital').map((m) => (
          <label key={m.id} style={{ fontSize: 12, color: 'var(--bp-muted)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
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
      <div style={{ borderTop: '1px solid #cfe2ea', marginTop: '0.6rem', paddingTop: '0.4rem' }}>
        <div style={{ fontSize: 12.5, fontWeight: 'bold', color: 'var(--bp-text)' }}>💲 Tarifas ({t.tarifas.length})</div>
        {t.tarifas.map((x, i) => (
          <div key={i} style={{ border: '1px solid #cfe2ea', borderRadius: 7, padding: '0.35rem 0.45rem', marginTop: 4, background: 'var(--bp-panel)' }}>
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
      <div style={{ borderTop: '1px solid #bcd8e6', marginTop: '0.6rem', paddingTop: '0.5rem' }}>
        <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={() => onDelete(t.id)}>🗑 Eliminar</button>
      </div>
    </div>
  );
}

// ===== ENTREGA: envío/despacho al cliente final (espejo simplificado de Embarque) =====
function EntregasLista({ ents, trps, sel, onSel, hoy, onPatch, onDelete, movil }: {
  ents: Entrega[]; trps: Transportista[]; sel: string | null; onSel: (id: string | null) => void; hoy: string;
  onPatch: (e: Entrega) => void; onDelete: (id: string) => void; movil: boolean;
}) {
  const eSel = ents.find((e) => e.id === sel) ?? null;
  const retrasadas = ents.filter((e) => entregaRetrasada(e, hoy));
  return (
    <>
      <p style={{ fontSize: 12, color: 'var(--bp-muted)', margin: '0 0 0.5rem' }}>
        Una <strong>entrega</strong> es el envío/despacho de producto físico al cliente final. Si el negocio es 100% servicio en persona, esta pestaña se queda vacía sin problema.
      </p>
      {retrasadas.length > 0 && (
        <div style={{ background: 'var(--bp-panel-alt)', border: '1px solid #f0c9c2', borderRadius: 9, padding: '0.45rem 0.7rem', marginBottom: '0.5rem' }}>
          <strong style={{ fontSize: 12.5, color: '#c0392b' }}>⚠ {retrasadas.length} entrega(s) retrasada(s):</strong>
          <span style={{ fontSize: 12, color: '#a33', marginLeft: 6 }}>{retrasadas.map((e) => `${e.destinatario || e.referencia || 'entrega'} (compromiso ${e.fechaCompromiso})`).join(' · ')}</span>
        </div>
      )}
      {ents.length === 0 && <p style={{ color: 'var(--bp-muted)', fontSize: 13 }}>Aún no hay entregas. Pulsa <strong>＋ Entrega</strong> cuando el negocio despache producto físico a un cliente.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: movil || !eSel ? '1fr' : 'minmax(0, 1fr) 380px', gap: '0.75rem', alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.5rem', alignContent: 'start' }}>
          {ents.map((e) => {
            const inf = estadoEntregaInfo(e.estado); const ret = entregaRetrasada(e, hoy);
            return (
              <div key={e.id} onClick={() => onSel(e.id)}
                style={{ border: `1px solid ${sel === e.id ? '#2f8f8f' : '#bcd8e6'}`, borderLeft: `4px solid ${ret ? '#c0392b' : '#2f8f8f'}`, borderRadius: 9, padding: '0.5rem 0.6rem', background: sel === e.id ? '#eaf4f4' : '#fff', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontWeight: 'bold', fontSize: 13.5, flex: 1 }}>{modalidadEnvioInfo(e.modalidad).emoji} {e.destinatario || '(destinatario)'}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 'bold', color: '#fff', background: ret ? '#c0392b' : '#2f8f8f', borderRadius: 8, padding: '0 6px' }}>{inf.emoji} {inf.label}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--bp-muted)', marginTop: 2 }}>{e.referencia || 'sin referencia'} · {e.transportista || 'sin transportista'}{e.fechaCompromiso ? ` · compromiso ${e.fechaCompromiso}` : ''}</div>
                {e.costoEnvio && <div style={{ fontSize: 11.5, color: 'var(--bp-text)', marginTop: 2 }}>Envío: <strong>{formatoMoneda(numero(e.costoEnvio) ?? 0)}</strong></div>}
              </div>
            );
          })}
        </div>
        {eSel && <EntregaEditor e={eSel} trps={trps} onPatch={onPatch} onClose={() => onSel(null)} onDelete={onDelete} />}
      </div>
    </>
  );
}

function EntregaEditor({ e, trps, onPatch, onClose, onDelete }: {
  e: Entrega; trps: Transportista[]; onPatch: (e: Entrega) => void; onClose: () => void; onDelete: (id: string) => void;
}) {
  const set = (k: keyof Entrega, val: string) => onPatch({ ...e, [k]: val });
  const estimarFlete = () => {
    const t = trps.find((x) => x.nombre.trim().toLowerCase() === e.transportista.trim().toLowerCase());
    if (!t) { window.alert('Escribe un transportista que exista en el directorio (🚛 Transportistas) para estimar el costo.'); return; }
    const c = cotizarFlete(t, e.modalidad, e.direccion, null);
    if (c === null) { window.alert(`${t.nombre} no tiene tarifa para ${e.modalidad}.`); return; }
    set('costoEnvio', String(Math.round(c * 100) / 100));
  };
  const F = (label: string, k: keyof Entrega, ph = '', type = 'text') => (
    <div><label style={lbl}>{label}</label><input style={inp} type={type} defaultValue={String(e[k] ?? '')} key={`${String(k)}-${e.id}`} placeholder={ph} onBlur={(ev) => { if (ev.target.value !== e[k]) set(k, ev.target.value); }} /></div>
  );
  const idx = ESTADOS_ENTREGA.findIndex((x) => x.id === e.estado);
  return (
    <div style={{ border: '1px solid #bcd8e6', borderRadius: 10, background: 'var(--bp-panel-alt)', padding: '0.7rem', position: 'sticky', top: 8, maxHeight: '86vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>📮 Entrega</strong>
        <button style={btnSm} onClick={onClose}>✕</button>
      </div>
      {/* Stepper de estado */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, margin: '6px 0' }}>
        {ESTADOS_ENTREGA.map((x, i) => (
          <span key={x.id} onClick={() => set('estado', x.id)} title={x.label}
            style={{ fontSize: 11, cursor: 'pointer', padding: '1px 6px', borderRadius: 8, background: i <= idx ? '#2f8f8f' : '#e6eef1', color: i <= idx ? '#fff' : '#68808a' }}>{x.emoji}</span>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#1f6b6b' }}>{estadoEntregaInfo(e.estado).emoji} {estadoEntregaInfo(e.estado).label}</div>
      {e.estado !== 'entregado' && e.estado !== 'incidencia' && <button style={{ ...btnSm, marginTop: 4, background: 'var(--bp-panel-alt)', borderColor: '#bcd8e6', color: '#1f6b6b', fontWeight: 'bold' }} onClick={() => set('estado', siguienteEstadoEntrega(e.estado))}>→ Avanzar a «{estadoEntregaInfo(siguienteEstadoEntrega(e.estado)).label}»</button>}

      {F('Destinatario / cliente', 'destinatario')}
      {F('Qué se entrega (oferta, pedido…)', 'referencia')}
      {F('Dirección de entrega', 'direccion')}
      <label style={lbl}>Modalidad de envío</label>
      <select style={inp} value={e.modalidad} onChange={(ev) => set('modalidad', ev.target.value)}>
        {MODALIDADES_ENVIO.map((m) => <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>)}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        {F('Transportista', 'transportista', 'Estafeta, DHL, propio…')}{F('Guía / tracking', 'tracking')}
        {F('Compromiso (ETA)', 'fechaCompromiso', '', 'date')}{F('Entrega real', 'fechaEntrega', '', 'date')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.4rem' }}>
        <div style={{ flex: 1 }}>{F('Costo de envío', 'costoEnvio', '$')}</div>
        {trps.length > 0 && <button style={{ ...btnSm, fontSize: 11, alignSelf: 'flex-end', marginBottom: 2 }} onClick={estimarFlete} title="Estima el costo con la tarifa del transportista">💡 Estimar</button>}
      </div>
      <label style={lbl}>Notas</label>
      <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={e.notas} key={`ento-${e.id}`} onBlur={(ev) => { if (ev.target.value !== e.notas) set('notas', ev.target.value); }} />
      <div style={{ borderTop: '1px solid #bcd8e6', marginTop: '0.6rem', paddingTop: '0.5rem' }}>
        <button style={{ ...btnSm, color: '#b33', borderColor: '#d99' }} onClick={() => onDelete(e.id)}>🗑 Eliminar</button>
      </div>
    </div>
  );
}

// ===== INTERNA (solo lectura): contingencias de categoría "logística" ancladas al Mapa Operativo =====
function PanelInterna({ contingencias, procesos, onIrMapa }: { contingencias: Contingencia[]; procesos: ProcesoNodo[]; onIrMapa: () => void }) {
  const procNombre = (id: string) => procesos.find((p) => p.id === id)?.nombre ?? '';
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--bp-muted)', margin: '0 0 0.5rem' }}>
        Movimiento de insumos/materiales <strong>dentro</strong> de la operación. Esto ya vive en el <strong>Mapa Operativo</strong> como contingencias ancladas a un proceso (categoría "logística") — aquí solo se muestran, sin duplicar el dato.
      </p>
      {contingencias.length === 0 && (
        <p style={{ color: 'var(--bp-muted)', fontSize: 13 }}>
          Aún no hay contingencias de logística interna. Ancla una (retraso, faltante, robo…) a un proceso en el <strong>Mapa Operativo</strong> y aparecerá aquí. <button style={btnSm} onClick={onIrMapa}>→ Ir al Mapa Operativo</button>
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem' }}>
        {contingencias.map((c) => (
          <div key={c.id} style={{ border: '1px solid #bcd8e6', borderLeft: `4px solid ${c.gravedad === 'alta' ? '#c0392b' : c.gravedad === 'media' ? '#d9781f' : '#8a93a8'}`, borderRadius: 9, padding: '0.5rem 0.6rem', background: '#fff' }}>
            <div style={{ fontWeight: 'bold', fontSize: 13.5 }}>⚠️ {c.titulo || '(sin título)'}</div>
            <div style={{ fontSize: 11, color: 'var(--bp-muted)', marginTop: 2 }}>{c.procesoId ? `Proceso: ${procNombre(c.procesoId) || c.procesoId}` : 'General (sin proceso anclado)'}{c.responsable ? ` · ${c.responsable}` : ''}</div>
            {c.disparador && <div style={{ fontSize: 11.5, color: 'var(--bp-text)', marginTop: 3 }}>{c.disparador}</div>}
          </div>
        ))}
      </div>
      {contingencias.length > 0 && <button style={{ ...btnSm, marginTop: 10 }} onClick={onIrMapa}>→ Ir al Mapa Operativo</button>}
    </div>
  );
}

// ===== CAPITAL HUMANO (solo lectura): empleados con departamento "Logística" en Personas & RH =====
function PanelCapitalHumano({ empleados, onIrPersonas }: { empleados: Empleado[]; onIrPersonas: () => void }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--bp-muted)', margin: '0 0 0.5rem' }}>
        Quién ejecuta la logística. Esto ya vive en <strong>Personas & RH</strong> como el roster con departamento "Logística" — aquí solo se muestra, sin duplicar el dato.
      </p>
      {empleados.length === 0 && (
        <p style={{ color: 'var(--bp-muted)', fontSize: 13 }}>
          Aún nadie tiene el departamento "Logística" asignado. Asígnalo a un empleado en <strong>Personas & RH</strong> y aparecerá aquí. <button style={btnSm} onClick={onIrPersonas}>→ Ir a Personas & RH</button>
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
        {empleados.map((e) => (
          <div key={e.nombre + e.puesto} style={{ border: '1px solid #bcd8e6', borderLeft: '4px solid #2f8f8f', borderRadius: 9, padding: '0.5rem 0.6rem', background: '#fff' }}>
            <div style={{ fontWeight: 'bold', fontSize: 13.5 }}>👤 {e.nombre || '(sin nombre)'}</div>
            <div style={{ fontSize: 11, color: 'var(--bp-muted)', marginTop: 2 }}>{e.puesto || '(sin puesto)'}{e.estado ? ` · ${e.estado}` : ''}</div>
            {e.roles.length > 0 && <div style={{ marginTop: 3 }}>{e.roles.map((r) => <span key={r} style={chip}>{r}</span>)}</div>}
          </div>
        ))}
      </div>
      {empleados.length > 0 && <button style={{ ...btnSm, marginTop: 10 }} onClick={onIrPersonas}>→ Ir a Personas & RH</button>}
    </div>
  );
}

// ===== Chips (lista editable pequeña) — copia local, igual a la de vista-recursos.tsx =====
function Chips({ label, valores, onChange, placeholder, opciones }: {
  label: string; valores: string[]; onChange: (v: string[]) => void; placeholder?: string; opciones?: string[];
}) {
  const [nuevo, setNuevo] = useState('');
  const id = `dl-log-${label.replace(/\W/g, '')}`;
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
