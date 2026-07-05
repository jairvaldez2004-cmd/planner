'use client';

// Editor de planes COM-EXP (bloques 9.1–9.3 + Fase Utilidad Operativa).
// Conectado a PostgreSQL vía Server Actions. Sigue los invariantes del alpha:
// OS único publicador · Agente⇏Runtime · no inventar (PENDIENTE) · snapshots inmutables.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type {
  CommissionPayer, Cotizacion, Incoterm, PlanoComExp, PuertoMX, RestriccionCarga,
} from '@/domain/plano-com-exp';
import { esPendiente } from '@/domain/plano-com-exp';
import type { CapturaComExp, CapturaProducto, ResultadoValidacion as ResValCaptura } from '@/app/captura/form-com-exp';
import { construirPlanoDraft, validarCaptura } from '@/app/captura/form-engine';
import { aplicarSugerencias, sugerirParaProducto } from '@/app/captura/sugerencias';
import { componerPlano } from '@/app/plano/compositor';
import { renderMarkdown } from '@/app/plano/renderer';
import { ValidacionService } from '@/app/validacion/validacion-service';
import type { ResultadoValidacion as ResValHumana } from '@/app/validacion/validacion-service';
import type { ResultadoPublicacion } from '@/app/publicacion/os-publicador';
import type { VersionSnapshot } from '@/domain/version';
import { transicionar } from '@/domain/states';
import type { Instancia } from '@/domain/workspace';
import type { Sugerencia } from '@/adapters/agent/agent.contract';
import {
  guardarDraft as guardarDraftAction,
  publicarPlano as publicarPlanoAction,
  listarHistorial as listarHistorialAction,
} from '@/app/actions/plano.actions';

const INCOTERMS: Incoterm[] = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const PUERTOS: PuertoMX[] = ['MXLZC', 'MXVER', 'MXMZT', 'MXPBC', 'MXNLD', 'MXCDJ'];
const RESTRICCIONES: RestriccionCarga[] = ['general', 'hazmat', 'perecedero', 'automotriz', 'ganado', 'granel'];
const PAYERS: CommissionPayer[] = ['CLIENT', 'PROVIDER', 'INCLUDED_IN_PRICE', 'SPLIT'];

interface UIProducto {
  sku: string; nombre: string; categoria: string; restriccion: RestriccionCarga;
  destino: string; hsCode: string; incoterm: Incoterm | ''; puerto: PuertoMX | '';
  certificado: '' | 'requerido' | 'no'; precioMonto: string; precioMoneda: string;
}
interface UICotizacion {
  productoSku: string; incoterm: Incoterm | ''; puerto: PuertoMX | ''; comisionPayer: CommissionPayer | '';
}

const card: CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem 1rem', margin: '0.75rem 0', background: '#fafafa' };
const row: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '0.35rem 0', flexWrap: 'wrap' };
const lbl: CSSProperties = { minWidth: 130, fontSize: 14, color: '#333' };
const btn: CSSProperties = { padding: '0.4rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer' };

function productoVacio(): UIProducto {
  return { sku: '', nombre: '', categoria: '', restriccion: 'general', destino: '', hsCode: '', incoterm: '', puerto: '', certificado: '', precioMonto: '', precioMoneda: '' };
}
function cotizacionVacia(): UICotizacion {
  return { productoSku: '', incoterm: '', puerto: '', comisionPayer: '' };
}

function planoToUIProductos(plano: PlanoComExp): UIProducto[] {
  return plano.productos.map((p): UIProducto => {
    const hsCode = esPendiente(p.hsCode) ? '' : p.hsCode;
    const incoterm: Incoterm | '' = esPendiente(p.incotermSugerido) ? '' : p.incotermSugerido;
    const puerto: PuertoMX | '' = esPendiente(p.puertoSalida) ? '' : p.puertoSalida;
    const certificado: '' | 'requerido' | 'no' = esPendiente(p.certificadoOrigenRequerido) ? '' : (p.certificadoOrigenRequerido ? 'requerido' : 'no');
    const precioMonto = !esPendiente(p.precio) ? String(p.precio.monto) : '';
    const precioMoneda = !esPendiente(p.precio) ? p.precio.moneda : '';
    return { sku: p.sku, nombre: p.nombre, categoria: p.categoria, restriccion: p.restriccion, destino: '', hsCode, incoterm, puerto, certificado, precioMonto, precioMoneda };
  });
}

function planoToUICotizaciones(plano: PlanoComExp): UICotizacion[] {
  return plano.cotizaciones.map((c): UICotizacion => ({
    productoSku: c.productoIds.at(0) ?? '',
    incoterm: c.incoterm,
    puerto: c.puerto,
    comisionPayer: c.comisionPayer,
  }));
}

function toCapturaProducto(p: UIProducto): CapturaProducto {
  return {
    sku: p.sku.trim(), nombre: p.nombre.trim(), categoria: p.categoria.trim(), restriccion: p.restriccion,
    ...(p.hsCode.trim() ? { hsCode: p.hsCode.trim() } : {}),
    ...(p.incoterm ? { incotermSugerido: p.incoterm } : {}),
    ...(p.puerto ? { puertoSalida: p.puerto } : {}),
    ...(p.certificado !== '' ? { certificadoOrigenRequerido: p.certificado === 'requerido' } : {}),
    ...(p.precioMonto.trim() && p.precioMoneda.trim() ? { precio: { monto: Number(p.precioMonto), moneda: p.precioMoneda.trim() } } : {}),
  };
}
function pendientesDe(p: UIProducto): string[] {
  const out: string[] = [];
  if (!p.hsCode.trim()) out.push('hsCode');
  if (p.incoterm === '') out.push('incoterm');
  if (p.puerto === '') out.push('puerto');
  if (p.certificado === '') out.push('certificado');
  if (!(p.precioMonto.trim() && p.precioMoneda.trim())) out.push('precio');
  return out;
}

interface Props {
  planoCargado: PlanoComExp | null;
  instanciaCargada: Instancia | null;
}

export function CapturaInteractiva({ planoCargado, instanciaCargada }: Props) {
  const initProductos = planoCargado ? planoToUIProductos(planoCargado) : [productoVacio()];
  const initCotizaciones = planoCargado ? planoToUICotizaciones(planoCargado) : [];
  const initEntidad = planoCargado?.entidad ?? '';

  const [entidad, setEntidad] = useState(initEntidad);
  const [productos, setProductos] = useState<UIProducto[]>(initProductos);
  const [cotizaciones, setCotizaciones] = useState<UICotizacion[]>(initCotizaciones);
  const [validador, setValidador] = useState('humano-local');
  const [aprobado, setAprobado] = useState(true);

  const [draft, setDraft] = useState<PlanoComExp | null>(planoCargado ?? null);
  const [markdown, setMarkdown] = useState(() => planoCargado ? renderMarkdown(componerPlano(planoCargado)) : '');
  const [valCaptura, setValCaptura] = useState<ResValCaptura | null>(null);
  const [validacion, setValidacion] = useState<ResValHumana | null>(null);
  const [instancia, setInstancia] = useState<Instancia | null>(instanciaCargada ?? null);
  const [pub, setPub] = useState<ResultadoPublicacion | null>(null);
  const [historial, setHistorial] = useState<readonly VersionSnapshot[]>([]);
  const [msg, setMsg] = useState(planoCargado ? `Plano cargado desde DB: ${planoCargado.id}` : '');
  const [isPersisting, setIsPersisting] = useState(false);

  function updProducto(i: number, patch: Partial<UIProducto>) {
    setProductos((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function updCot(i: number, patch: Partial<UICotizacion>) {
    setCotizaciones((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function buildCaptura(): CapturaComExp {
    const prods = productos.map(toCapturaProducto);
    const cots: Cotizacion[] = cotizaciones.flatMap((c, i) => {
      if (c.incoterm === '' || c.puerto === '' || c.comisionPayer === '' || !c.productoSku.trim()) return [];
      return [{ id: `COT-${i + 1}`, productoIds: [c.productoSku.trim()], incoterm: c.incoterm, puerto: c.puerto, comisionPayer: c.comisionPayer }];
    });
    return { entidad: entidad.trim(), productos: prods, cotizaciones: cots };
  }

  async function sugerirProducto(i: number) {
    const p = productos[i];
    if (!p) return;
    const s: Sugerencia[] = await sugerirParaProducto(p.destino.trim() || 'asia');
    const aplicado = aplicarSugerencias(toCapturaProducto(p), s);
    const patch: Partial<UIProducto> = {};
    if (p.incoterm === '' && aplicado.incotermSugerido) patch.incoterm = aplicado.incotermSugerido;
    if (p.puerto === '' && aplicado.puertoSalida) patch.puerto = aplicado.puertoSalida;
    updProducto(i, patch);
    setMsg(`Sugerencias mock aplicadas al producto ${i + 1} (solo campos vacíos).`);
  }

  async function onGenerarDraft() {
    const captura = buildCaptura();
    const vc = validarCaptura(captura);
    setValCaptura(vc);
    if (!vc.ok) { setMsg('Captura incompleta: ' + vc.errores.join(' · ')); return; }

    const d = construirPlanoDraft(captura);
    setDraft(d);
    setMarkdown(renderMarkdown(componerPlano(d)));

    let estado: Instancia['estado'] = 'SOLICITUD';
    estado = transicionar(estado, 'CAPTURA');
    estado = transicionar(estado, 'DISENO');
    estado = transicionar(estado, 'VALIDACION');
    const inst: Instancia = {
      id: `BP-${(entidad.trim() || 'ENTIDAD').replace(/\s+/g, '').toUpperCase()}-COM-EXP-${Date.now()}`,
      proyectoId: 'PROJ-DEFAULT',
      tipoPlano: 'COM-EXP',
      estado,
      acl: 'N3',
      planoId: null,
    };
    setInstancia(inst);
    setValidacion(null); setPub(null); setHistorial([]);

    setIsPersisting(true);
    try {
      await guardarDraftAction(d, inst);
      setMsg(`Draft generado y guardado en DB · ID: ${d.id}`);
    } catch {
      setMsg(`Draft generado (solo en memoria — no se pudo guardar en DB) · ID: ${d.id}`);
    } finally {
      setIsPersisting(false);
    }
  }

  async function onGuardarDraft() {
    if (!draft || !instancia) { setMsg('Genera el draft primero.'); return; }
    setIsPersisting(true);
    try {
      await guardarDraftAction(draft, instancia);
      setMsg(`Guardado en DB: ${draft.id}`);
    } catch {
      setMsg('Error al guardar en DB.');
    } finally {
      setIsPersisting(false);
    }
  }

  function onValidar() {
    if (!draft) { setMsg('Genera el draft primero.'); return; }
    const v = new ValidacionService().validar(draft, { aprobadoPorHumano: aprobado, validador: validador.trim() || 'humano-local' });
    setValidacion(v);
    setMsg(v.aprobado ? 'Validado y aprobado.' : 'No aprobado (desmarcaste el checkbox).');
  }

  async function onPublicar() {
    if (!draft || !instancia) { setMsg('Genera el draft primero.'); return; }
    if (!validacion || !validacion.aprobado) { setMsg('Valida y aprueba primero.'); return; }
    if (instancia.estado !== 'VALIDACION') { setMsg('La instancia ya no está en VALIDACION.'); return; }
    setIsPersisting(true);
    try {
      const result = await publicarPlanoAction(draft, instancia, validador.trim() || 'humano-local', aprobado);
      setPub(result);
      setInstancia(result.instancia);
      setMarkdown(renderMarkdown(componerPlano(result.plano)));
      const hist = await listarHistorialAction(result.plano.id);
      setHistorial(hist);
      setMsg('Publicado por OS + snapshot inmutable guardado en PostgreSQL.');
    } catch (e) {
      setMsg('Error al publicar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsPersisting(false);
    }
  }

  function onCargarDemo() {
    setEntidad('Entidad demo (COM-EXP)');
    setProductos([{ ...productoVacio(), sku: 'DEMO-001', nombre: 'Producto demo', categoria: 'demo', destino: 'asia' }]);
    setCotizaciones([]);
    setMsg('Datos DEMO cargados (valores de negocio quedan PENDIENTE).');
  }

  const skusDisponibles = productos.map((p) => p.sku.trim()).filter((s) => s !== '');
  const estaPublicado = pub !== null || planoCargado?.publicado === true;

  return (
    <section>
      {/* Banner si es un plan cargado */}
      {planoCargado && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '0.5rem 1rem', marginBottom: '0.75rem', fontSize: 13 }}>
          Editando plano cargado: <strong>{planoCargado.id}</strong> · {planoCargado.publicado ? '✓ Publicado' : 'Draft'}
        </div>
      )}

      <div style={row}>
        <span style={lbl}>Entidad *</span>
        <input value={entidad} onChange={(e) => setEntidad(e.target.value)} placeholder="entidad" style={{ flex: 1, minWidth: 180 }} />
        <button style={btn} onClick={onCargarDemo}>Cargar datos demo</button>
      </div>

      <h2>Productos ({productos.length})</h2>
      {productos.map((p, i) => {
        const pend = pendientesDe(p);
        return (
          <div key={i} style={card}>
            <div style={row}>
              <strong>Producto {i + 1}</strong>
              <button style={btn} onClick={() => void sugerirProducto(i)}>Sugerir (mock)</button>
              <button style={btn} onClick={() => setProductos((prev) => prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i))} disabled={productos.length <= 1}>Eliminar</button>
            </div>
            <div style={row}>
              <span style={lbl}>SKU *</span><input value={p.sku} onChange={(e) => updProducto(i, { sku: e.target.value })} />
              <span style={lbl}>Nombre *</span><input value={p.nombre} onChange={(e) => updProducto(i, { nombre: e.target.value })} />
            </div>
            <div style={row}>
              <span style={lbl}>Categoría *</span><input value={p.categoria} onChange={(e) => updProducto(i, { categoria: e.target.value })} />
              <span style={lbl}>Restricción *</span>
              <select value={p.restriccion} onChange={(e) => updProducto(i, { restriccion: e.target.value as RestriccionCarga })}>
                {RESTRICCIONES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <span style={lbl}>Destino (mock)</span>
              <input value={p.destino} onChange={(e) => updProducto(i, { destino: e.target.value })} placeholder="asia / europa…" />
            </div>
            <div style={row}>
              <span style={lbl}>HS code</span>
              <input value={p.hsCode} onChange={(e) => updProducto(i, { hsCode: e.target.value })} placeholder="(vacío → PENDIENTE)" />
              <span style={lbl}>Incoterm</span>
              <select value={p.incoterm} onChange={(e) => updProducto(i, { incoterm: e.target.value as Incoterm | '' })}>
                <option value="">(PENDIENTE)</option>
                {INCOTERMS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <span style={lbl}>Puerto</span>
              <select value={p.puerto} onChange={(e) => updProducto(i, { puerto: e.target.value as PuertoMX | '' })}>
                <option value="">(PENDIENTE)</option>
                {PUERTOS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div style={row}>
              <span style={lbl}>Certificado</span>
              <select value={p.certificado} onChange={(e) => updProducto(i, { certificado: e.target.value as '' | 'requerido' | 'no' })}>
                <option value="">(PENDIENTE)</option>
                <option value="requerido">requerido</option>
                <option value="no">no</option>
              </select>
              <span style={lbl}>Precio</span>
              <input value={p.precioMonto} onChange={(e) => updProducto(i, { precioMonto: e.target.value })} placeholder="monto" style={{ width: 110 }} />
              <input value={p.precioMoneda} onChange={(e) => updProducto(i, { precioMoneda: e.target.value })} placeholder="moneda" style={{ width: 90 }} />
            </div>
            <p style={{ color: pend.length ? '#a60' : '#0a5', fontSize: 13 }}>
              Pendientes: {pend.length === 0 ? 'ninguno' : pend.join(' · ')}
            </p>
          </div>
        );
      })}
      <button style={btn} onClick={() => setProductos((prev) => [...prev, productoVacio()])}>+ Agregar producto</button>

      <h2>Cotizaciones ({cotizaciones.length})</h2>
      {cotizaciones.map((c, i) => (
        <div key={i} style={card}>
          <div style={row}>
            <strong>Cotización {i + 1}</strong>
            <button style={btn} onClick={() => setCotizaciones((prev) => prev.filter((_, idx) => idx !== i))}>Eliminar</button>
          </div>
          <div style={row}>
            <span style={lbl}>Producto (SKU)</span>
            <select value={c.productoSku} onChange={(e) => updCot(i, { productoSku: e.target.value })}>
              <option value="">(elegir)</option>
              {skusDisponibles.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={lbl}>Incoterm</span>
            <select value={c.incoterm} onChange={(e) => updCot(i, { incoterm: e.target.value as Incoterm | '' })}>
              <option value="">(requerido)</option>
              {INCOTERMS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <span style={lbl}>Puerto</span>
            <select value={c.puerto} onChange={(e) => updCot(i, { puerto: e.target.value as PuertoMX | '' })}>
              <option value="">(requerido)</option>
              {PUERTOS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <span style={lbl}>Comisión payer</span>
            <select value={c.comisionPayer} onChange={(e) => updCot(i, { comisionPayer: e.target.value as CommissionPayer | '' })}>
              <option value="">(requerido)</option>
              {PAYERS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>
      ))}
      <button style={btn} onClick={() => setCotizaciones((prev) => [...prev, cotizacionVacia()])}>+ Agregar cotización</button>

      <h2 style={{ marginTop: '1.5rem' }}>Acciones</h2>
      <div style={row}>
        <button style={btn} onClick={() => void onGenerarDraft()} disabled={isPersisting}>
          {isPersisting ? 'Guardando…' : 'Generar draft'}
        </button>
        <button style={btn} onClick={() => void onGuardarDraft()} disabled={!draft || isPersisting}>
          Guardar en DB
        </button>
        <button style={btn} onClick={onValidar} disabled={!draft}>Validar</button>
        <button
          style={{ ...btn, background: !estaPublicado && validacion?.aprobado ? '#e8f5e9' : '#fff' }}
          onClick={() => void onPublicar()}
          disabled={!validacion?.aprobado || isPersisting || estaPublicado}
        >
          {estaPublicado ? 'Publicado ✓' : 'Publicar (OS)'}
        </button>
        <span style={lbl}>Validador</span>
        <input value={validador} onChange={(e) => setValidador(e.target.value)} style={{ width: 140 }} />
        <label><input type="checkbox" checked={aprobado} onChange={(e) => setAprobado(e.target.checked)} /> aprobar como humano</label>
      </div>
      {msg && <p style={{ color: isPersisting ? '#06c' : '#0a5' }}>{msg}</p>}

      {valCaptura && (
        <div style={card}>
          <strong>Validación de captura:</strong> {valCaptura.ok ? 'OK' : 'Incompleta'}
          {valCaptura.errores.length > 0 && <p style={{ color: '#c00' }}>Errores: {valCaptura.errores.join(' · ')}</p>}
        </div>
      )}
      {markdown && (
        <>
          <h2>Plano (Markdown)</h2>
          <pre style={{ ...card, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{markdown}</pre>
        </>
      )}
      {validacion && (
        <div style={card}>
          <strong>Validación humana:</strong> aprobado={validacion.aprobado ? 'sí' : 'no'} · validador={validacion.validador} · consistencia={validacion.consistenciaOk ? 'ok' : 'falla'} · pendientes={validacion.pendientesContados}
        </div>
      )}
      {instancia && (
        <div style={card}>
          <strong>Instancia:</strong> {instancia.id} · estado=<strong>{instancia.estado}</strong>
        </div>
      )}
      {pub && (
        <div style={{ ...card, background: '#e8f5e9' }}>
          <strong>Publicación (OS):</strong> publicado={pub.plano.publicado ? 'sí' : 'no'} · versión={pub.version}
          <br/><span style={{ fontSize: 12, color: '#555' }}>ID: {pub.plano.id}</span>
        </div>
      )}
      {historial.length > 0 && (
        <div style={card}>
          <strong>Historial (PostgreSQL):</strong>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.2rem' }}>
            {historial.map((s) => (
              <li key={`${s.planoId}-${s.version}`} style={{ fontSize: 13 }}>
                v{s.version} · {s.publicado ? 'publicado' : 'draft'} · {s.timestamp.slice(0, 19).replace('T', ' ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
