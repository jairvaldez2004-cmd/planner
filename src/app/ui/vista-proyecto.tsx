'use client';

// Vista de Proyecto = GRAFO FRACTAL con JERARQUÍA.
// Nodo central = este proyecto (un desarrollo/empresa o un negocio). Alrededor:
//   · Administración (planos)  · Sedes & Espacios
//   · NEGOCIOS que contiene (sub-empresas → se abren de forma anidada, recursiva)
//   · UNIDADES COMERCIALES (líneas de venta directa de este proyecto)
// Ej.: "Girly Zone" (desarrollo) contiene los negocios "Altercing Studio" y "Macao Pilates";
// al entrar a un negocio, este mismo componente lo muestra con SUS unidades comerciales.

import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { listarUnidades, crearUnidad } from '@/app/actions/espacios.actions';
import { obtenerGrafoPlanos } from '@/app/actions/especialista.actions';
import { conversarCuradorProyecto } from '@/app/actions/arquitecto.actions';
import { cargarConversacionProyecto } from '@/app/actions/contexto.actions';
import { listarHijosDeProyecto, crearNegocioHijo, obtenerProyectoBase, fijarEtapaObjetivo, fijarTaxonomiaEntidad } from '@/app/actions/workspace.actions';
import { TIPOS_ENTIDAD, ESTADOS_ENTIDAD, infoTipoEntidad, infoEstadoEntidad, validarJerarquia, esEntidadReal } from '@/domain/taxonomia-entidad';
import type { TipoEntidad, EstadoEntidad } from '@/domain/taxonomia-entidad';
import { useT } from './i18n';
import { useTx } from './traduccion';
import { etiqueta } from '@/domain/i18n';
import type { GrafoPlanos } from '@/app/actions/especialista.actions';
import type { ProyectoNodo } from '@/app/actions/workspace.actions';
import type { UnidadComercial } from '@/domain/espacios';
import { ETAPAS_OBJETIVO, etapaInfo } from '@/domain/etapas';
import type { EtapaObjetivo } from '@/domain/etapas';
import { ENRIQUECE } from '@/domain/proyeccion';
import type { Superficie } from '@/domain/proyeccion';
import { PLANOS_MAESTROS } from '@/domain/diagnostico';
import { ChatArquitecto } from './chat-arquitecto';
import { MapaOperativo } from './mapa-operativo';
import { useEsMovil } from './use-movil';
import { VistaPlanos } from './vista-planos';
import { VistaSedes } from './vista-sedes';
import { VistaUnidad } from './vista-unidad';
import { VistaPersonas } from './vista-personas';
import { VistaRecursos } from './vista-recursos';
import { VistaLogistica } from './vista-logistica';
import { VistaMarketing } from './vista-marketing';

const btn: CSSProperties = { padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #999', background: 'var(--bp-panel)', cursor: 'pointer', fontSize: 14 };
const inp: CSSProperties = { padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--bp-border)', fontSize: 14 };

// Banner "lo que captures aquí enriquece estos planos" — hace visible el flujo de datos.
// Renderiza una frase traducida que lleva markup en medio: los `{param}` se sustituyen por
// nodos React. Se traduce la frase ENTERA (una sola clave), así otro idioma puede reordenar
// las piezas libremente — que es justo lo que se rompe al concatenar fragmentos sueltos.
function Frase({ texto, partes }: { texto: string; partes: Record<string, ReactNode> }) {
  const trozos = texto.split(/(\{\w+\})/g);
  return <>{trozos.map((tz, i) => {
    const m = /^\{(\w+)\}$/.exec(tz);
    if (m && m[1] && m[1] in partes) return <span key={i}>{partes[m[1]]}</span>;
    return <span key={i}>{tz}</span>;
  })}</>;
}

function BannerEnriquece({ superficie }: { superficie: Superficie }) {
  const { t, locale } = useT();
  const { tx } = useTx();
  // La frase lleva markup en medio, así que se parte en dos claves en vez de concatenar
  // fragmentos traducidos (que rompería el orden en otros idiomas).
  const [antes, despues] = t('enriquece.prefijo').split('{enriquece}');
  return (
    <div style={{ fontSize: 12.5, color: 'var(--bp-text)', background: 'var(--bp-panel-alt)', border: '1px solid #ecd9a0', borderRadius: 8, padding: '0.45rem 0.7rem', margin: '0.4rem 0' }}>
      {antes}<strong>{t('enriquece.verbo')}</strong>{despues}{' '}
      {ENRIQUECE[superficie].map((a, i) => (
        <span key={a.planoId}>{i > 0 ? ' · ' : ''}<strong>{etiqueta(locale, 'plano', a.planoId, PLANOS_MAESTROS[a.planoId] ?? a.planoId)}</strong> ({a.nota})</span>
      ))}
    </div>
  );
}

type Nodo = { tipo: 'admin' | 'sedes' | 'mapa' | 'personas' | 'recursos' | 'logistica' | 'marketing' | 'uc'; id?: string } | null;
type NodoGrafo = {
  key: string;
  tipo: 'admin' | 'sedes' | 'mapa' | 'personas' | 'recursos' | 'logistica' | 'marketing' | 'uc' | 'negocio';
  id?: string; label: string; color: string;
  // Taxonomía del nodo (solo negocios): define su abreviatura y si es una entidad real o solo objetivo.
  tipoEntidad?: TipoEntidad | undefined;
  estadoEntidad?: EstadoEntidad | undefined;
};

export function VistaProyecto({ proyectoId, onVolver, volverLabel }: { proyectoId: string; onVolver: () => void; volverLabel?: string }) {
  const { t, locale } = useT();
  const { tx } = useTx();
  const [nombre, setNombre] = useState('');
  const [etapa, setEtapa] = useState<EtapaObjetivo | ''>('');
  const [tipoEnt, setTipoEnt] = useState<TipoEntidad | ''>('');
  const [estadoEnt, setEstadoEnt] = useState<EstadoEntidad | ''>('');
  const [ucs, setUcs] = useState<UnidadComercial[]>([]);
  const [hijos, setHijos] = useState<ProyectoNodo[]>([]);
  const [grafo, setGrafo] = useState<GrafoPlanos | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodo, setNodo] = useState<Nodo>(null);
  const [hijoAbierto, setHijoAbierto] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [nuevaUC, setNuevaUC] = useState('');
  const [nuevoNegocio, setNuevoNegocio] = useState('');
  const movil = useEsMovil();

  const cargar = () => {
    setLoading(true);
    Promise.all([listarUnidades(proyectoId), obtenerGrafoPlanos(proyectoId), listarHijosDeProyecto(proyectoId), obtenerProyectoBase(proyectoId)])
      .then(([u, g, h, base]) => { setUcs(u); setGrafo(g); setHijos(h); setNombre(base?.nombre ?? ''); setEtapa(base?.etapaObjetivo ?? ''); setTipoEnt(base?.tipoEntidad ?? ''); setEstadoEnt(base?.estadoEntidad ?? ''); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [proyectoId]);

  // --- negocio hijo abierto (navegación jerárquica, recursiva) ---
  if (hijoAbierto) {
    return <VistaProyecto proyectoId={hijoAbierto} onVolver={() => { setHijoAbierto(null); cargar(); }} volverLabel={`← ${nombre || 'Contenedor'}`} />;
  }

  // --- sub-vistas por nodo ---
  if (nodo?.tipo === 'admin') return <VistaPlanos proyectoId={proyectoId} onVolver={() => { setNodo(null); cargar(); }} />;
  if (nodo?.tipo === 'sedes') return (
    <section>
      <button style={btn} onClick={() => { setNodo(null); cargar(); }}>← {nombre || 'Proyecto'}</button>
      <BannerEnriquece superficie="sedes" />
      <div style={{ marginTop: '0.25rem' }}><VistaSedes proyectoId={proyectoId} /></div>
    </section>
  );
  if (nodo?.tipo === 'mapa') return (
    <section>
      <BannerEnriquece superficie="mapa" />
      <MapaOperativo proyectoId={proyectoId} nombreProyecto={nombre}
        onVolver={() => { setNodo(null); cargar(); }}
        onIrSedes={() => setNodo({ tipo: 'sedes' })} />
    </section>
  );
  if (nodo?.tipo === 'personas') return (
    <section>
      <button style={btn} onClick={() => { setNodo(null); cargar(); }}>← {nombre || 'Proyecto'}</button>
      <BannerEnriquece superficie="personas" />
      <div style={{ marginTop: '0.25rem' }}><VistaPersonas proyectoId={proyectoId} nombreProyecto={nombre} /></div>
    </section>
  );
  if (nodo?.tipo === 'recursos') return (
    <section>
      <button style={btn} onClick={() => { setNodo(null); cargar(); }}>← {nombre || 'Proyecto'}</button>
      <BannerEnriquece superficie="recursos" />
      <div style={{ marginTop: '0.25rem' }}><VistaRecursos proyectoId={proyectoId} /></div>
    </section>
  );
  if (nodo?.tipo === 'logistica') return (
    <section>
      <button style={btn} onClick={() => { setNodo(null); cargar(); }}>← {nombre || 'Proyecto'}</button>
      <BannerEnriquece superficie="logistica" />
      <div style={{ marginTop: '0.25rem' }}>
        <VistaLogistica proyectoId={proyectoId} onIrMapa={() => setNodo({ tipo: 'mapa' })} onIrPersonas={() => setNodo({ tipo: 'personas' })} />
      </div>
    </section>
  );
  if (nodo?.tipo === 'marketing') return (
    <section>
      <button style={btn} onClick={() => { setNodo(null); cargar(); }}>← {nombre || 'Proyecto'}</button>
      <div style={{ marginTop: '0.4rem' }}><VistaMarketing proyectoId={proyectoId} /></div>
    </section>
  );
  if (nodo?.tipo === 'uc') {
    const uc = ucs.find((u) => u.id === nodo.id);
    if (uc) return (
      <section>
        <BannerEnriquece superficie="uc" />
        <VistaUnidad proyectoId={proyectoId} uc={uc} onVolver={() => { setNodo(null); cargar(); }} onIrSedes={() => setNodo({ tipo: 'sedes' })} />
      </section>
    );
  }

  // --- grafo del proyecto ---
  const nodos: NodoGrafo[] = [
    { key: 'admin', tipo: 'admin', label: t('nodo.planos'), color: '#4A4F5C' },
    { key: 'sedes', tipo: 'sedes', label: t('nodo.sedes'), color: '#e0795b' },
    { key: 'mapa', tipo: 'mapa', label: t('nodo.mapa'), color: '#d9a23b' },
    { key: 'personas', tipo: 'personas', label: t('nodo.personas'), color: '#8a4fbf' },
    { key: 'recursos', tipo: 'recursos', label: t('nodo.recursos'), color: '#a9720f' },
    { key: 'logistica', tipo: 'logistica', label: t('nodo.logistica'), color: '#2f8f8f' },
    { key: 'marketing', tipo: 'marketing', label: t('nodo.marketing'), color: '#c95b7c' },
    ...hijos.map((h): NodoGrafo => ({
      key: h.proyectoId, tipo: 'negocio', id: h.proyectoId, label: tx(h.nombre),
      // Los holdings se pintan en dorado; el resto conserva el morado de negocio.
      color: h.tipoEntidad === 'holding_matriz' || h.tipoEntidad === 'holding_sectorial' ? '#c9922b' : '#b06be0',
      tipoEntidad: h.tipoEntidad, estadoEntidad: h.estadoEntidad,
    })),
    ...ucs.map((u): NodoGrafo => ({ key: u.id, tipo: 'uc', id: u.id, label: tx(u.nombre), color: '#3b9e63' })),
  ];

  const W = 780, H = 560, cx = W / 2, cy = H / 2;
  const R = Math.min(220, 120 + nodos.length * 10);
  const posOf = (i: number, n: number) => { const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2; return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; };
  // Abreviatura del nodo. Los negocios muestran el emoji de su TIPO DE ENTIDAD si está
  // declarado (holding/empresa/unidad/marca/producto…); si no, caen a "NEG".
  const abrev = (n: NodoGrafo) => {
    const t = n.tipo;
    if (t === 'negocio') return infoTipoEntidad(n.tipoEntidad)?.emoji ?? 'NEG';
    return t === 'uc' ? 'UC' : t === 'admin' ? '📄' : t === 'sedes' ? 'SED' : t === 'mapa' ? 'MAP' : t === 'personas' ? '👥' : t === 'recursos' ? '📦' : t === 'logistica' ? '🚚' : t === 'marketing' ? '📣' : 'NEG';
  };

  // Forma del nodo: UC = círculo · Planos = cuadrado · Negocio = hexágono · el resto
  // (sedes/mapa/personas/recursos/logística/marketing) = triángulo.
  function poligono(x: number, y: number, r: number, angulosDeg: number[]) {
    return angulosDeg.map((deg) => {
      const a = (deg * Math.PI) / 180;
      return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`;
    }).join(' ');
  }
  function formaNodo(n: NodoGrafo, x: number, y: number, r: number, fill: string) {
    // Las entidades no constituidas (objetivo/propuesta) se dibujan con borde punteado:
    // se ven, pero se distinguen de las que operan de verdad.
    const real = !n.estadoEntidad || esEntidadReal(n.estadoEntidad);
    const comun = { fill, stroke: '#fff', strokeWidth: 2, ...(real ? {} : { strokeDasharray: '5 4', fillOpacity: 0.55 }) };
    if (n.tipo === 'admin') {
      const lado = r * Math.SQRT2;
      return <rect x={x - lado / 2} y={y - lado / 2} width={lado} height={lado} rx={5} {...comun} />;
    }
    if (n.tipo === 'uc') return <circle cx={x} cy={y} r={r} {...comun} />;
    if (n.tipo === 'negocio') {
      // Un holding es un contenedor, no un negocio: se dibuja como rombo para distinguirlo.
      const esHolding = n.tipoEntidad === 'holding_matriz' || n.tipoEntidad === 'holding_sectorial';
      if (esHolding) return <polygon points={poligono(x, y, r * 1.2, [-90, 0, 90, 180])} {...comun} />;
      return <polygon points={poligono(x, y, r * 1.05, [-90, -30, 30, 90, 150, 210])} {...comun} />;
    }
    return <polygon points={poligono(x, y, r * 1.15, [-90, 150, 30])} {...comun} />;
  }

  function abrirNodo(n: NodoGrafo) {
    if (n.tipo === 'negocio' && n.id) { setHijoAbierto(n.id); return; }
    if (n.tipo === 'uc' && n.id) { setNodo({ tipo: 'uc', id: n.id }); return; }
    if (n.tipo === 'admin' || n.tipo === 'sedes' || n.tipo === 'mapa' || n.tipo === 'personas' || n.tipo === 'recursos' || n.tipo === 'logistica' || n.tipo === 'marketing') setNodo({ tipo: n.tipo });
  }

  async function crearUC() { if (!nuevaUC.trim()) return; await crearUnidad(proyectoId, nuevaUC.trim()); setNuevaUC(''); cargar(); }
  async function crearNeg() { if (!nuevoNegocio.trim()) return; await crearNegocioHijo(proyectoId, nuevoNegocio.trim()); setNuevoNegocio(''); cargar(); }
  async function cambiarEtapa(e: EtapaObjetivo | '') { setEtapa(e); if (e) await fijarEtapaObjetivo(proyectoId, e); }
  async function cambiarTipoEnt(t: TipoEntidad | '') { setTipoEnt(t); if (t) await fijarTaxonomiaEntidad(proyectoId, { tipoEntidad: t }); }
  async function cambiarEstadoEnt(e: EstadoEntidad | '') { setEstadoEnt(e); if (e) await fijarTaxonomiaEntidad(proyectoId, { estadoEntidad: e }); }
  const etapaSel = etapaInfo(etapa || undefined);
  const tipoSel = infoTipoEntidad(tipoEnt || undefined);

  // Conflictos de jerarquía: hijos cuyo tipo NO puede colgar del tipo de este proyecto.
  // Hace visible el error antes de que se propague al grafo del cerebro.
  const conflictos = hijos
    .filter((h) => h.tipoEntidad && tipoEnt)
    .map((h) => ({ key: h.proyectoId, label: tx(h.nombre), ...validarJerarquia(tipoEnt, h.tipoEntidad) }))
    .filter((v) => !v.valido);

  const seleccionados = grafo?.nodos.filter((n) => n.seleccionado).length ?? 0;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>{nombre || t('nav.proyecto')} <span style={{ fontSize: 13, color: 'var(--bp-muted)' }}>· {t('proyecto.subtitulo')}</span></h2>
        <button style={btn} onClick={onVolver}>{volverLabel ?? t('proyecto.volverGrafo')}</button>
      </div>

      {loading && <p style={{ color: 'var(--bp-muted)' }}>{t('comun.cargando')}</p>}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : 'minmax(280px, 4fr) 8fr', gap: '1rem', alignItems: 'start', marginTop: '0.75rem' }}>
          {/* Panel */}
          <div style={{ border: '1px solid #cdd8ef', borderRadius: 10, padding: '0.75rem', background: 'var(--bp-panel-alt)' }}>
            <strong style={{ fontSize: 14 }}>{t('proyecto.estructura')}</strong>
            <p style={{ margin: '0.25rem 0 0.5rem', fontSize: 12, color: 'var(--bp-muted)' }}>
              <Frase texto={t('proyecto.explicacion')} partes={{
                planos: <strong>📄 {t('nodo.planos')}</strong>,
                ves: <strong>{t('proyecto.explicacion.ves')}</strong>,
                sedes: <strong>{t('nodo.sedes')}</strong>,
                mapa: <strong>{t('nodo.mapa')}</strong>,
                unidades: <strong>{t('proyecto.leyenda.uc')}</strong>,
                capturas: <strong>{t('proyecto.explicacion.capturas')}</strong>,
                negocios: <strong>{t('nodo.negocio')}</strong>,
              }} />
            </p>
            <div style={{ fontSize: 12, color: 'var(--bp-muted)', marginBottom: '0.5rem' }}>
              {t('proyecto.resumen', { planos: '📄', n: seleccionados, negocios: hijos.length, ucs: ucs.length })}
            </div>

            {/* Etapa objetivo del negocio (la ruta de 5 fases) */}
            <div style={{ border: '1px solid #cdd8ef', borderRadius: 8, padding: '0.5rem 0.6rem', background: 'var(--bp-panel-alt)', marginBottom: '0.6rem' }}>
              <label style={{ fontSize: 11, color: 'var(--bp-gold)', fontWeight: 'bold', display: 'block', marginBottom: 3 }}>{t('proyecto.etapaLabel')}</label>
              <select style={{ ...inp, width: '100%', fontSize: 13 }} value={etapa} onChange={(e) => void cambiarEtapa(e.target.value as EtapaObjetivo | '')}>
                <option value="">{t('proyecto.etapaSinDefinir')}</option>
                {ETAPAS_OBJETIVO.map((et) => <option key={et.id} value={et.id}>{et.n}. {etiqueta(locale, 'etapa', et.id, et.label)}</option>)}
              </select>
              {etapaSel && <div style={{ fontSize: 11, color: 'var(--bp-muted)', marginTop: 4 }}>{etiqueta(locale, 'etapa', `${etapaSel.id}.desc`, etapaSel.descripcion)} <span style={{ color: 'var(--bp-gold)' }}>{t('proyecto.etapaFoco', { foco: etapaSel.foco.join(' · ') })}</span></div>}
            </div>

            {/* TAXONOMÍA: qué ES esta entidad dentro del ecosistema */}
            <div style={{ border: '1px solid #cdd8ef', borderRadius: 8, padding: '0.5rem 0.6rem', background: 'var(--bp-panel-alt)', marginBottom: '0.6rem' }}>
              <label style={{ fontSize: 11, color: 'var(--bp-gold)', fontWeight: 'bold', display: 'block', marginBottom: 3 }}>{t('proyecto.tipoEntidadLabel')}</label>
              <select style={{ ...inp, width: '100%', fontSize: 13 }} value={tipoEnt} onChange={(e) => void cambiarTipoEnt(e.target.value as TipoEntidad | '')}>
                <option value="">{t('proyecto.sinDeclarar')}</option>
                {TIPOS_ENTIDAD.map((ti) => <option key={ti.id} value={ti.id}>{ti.emoji} {etiqueta(locale, 'tipoEntidad', ti.id, ti.label)}</option>)}
              </select>
              {tipoSel && <div style={{ fontSize: 11, color: 'var(--bp-muted)', marginTop: 4 }}>{tipoSel.descripcion}</div>}
              <label style={{ fontSize: 11, color: 'var(--bp-gold)', fontWeight: 'bold', display: 'block', margin: '0.5rem 0 3px' }}>{t('proyecto.estadoLabel')}</label>
              <select style={{ ...inp, width: '100%', fontSize: 13 }} value={estadoEnt} onChange={(e) => void cambiarEstadoEnt(e.target.value as EstadoEntidad | '')}>
                <option value="">{t('proyecto.sinDeclarar')}</option>
                {ESTADOS_ENTIDAD.map((e) => <option key={e.id} value={e.id}>{e.emoji} {etiqueta(locale, 'estadoEntidad', e.id, e.label)}</option>)}
              </select>
              {estadoEnt && !esEntidadReal(estadoEnt) && (
                <div style={{ fontSize: 11, color: '#d9781f', marginTop: 4, fontWeight: 'bold' }}>{t('proyecto.noConstituida')}</div>
              )}
              {conflictos.length > 0 && (
                <div style={{ marginTop: 6, border: '1px solid #f0c9c2', borderRadius: 7, background: 'var(--bp-panel)', padding: '0.35rem 0.5rem' }}>
                  <strong style={{ fontSize: 11.5, color: '#c0392b' }}>{t('proyecto.conflictos', { n: conflictos.length })}</strong>
                  {conflictos.map((c) => <div key={c.key} style={{ fontSize: 11, color: '#a33', marginTop: 2 }}>· <strong>{c.label}</strong>: {c.motivo}</div>)}
                </div>
              )}
            </div>

            {/* Crear negocio (sub-empresa) */}
            <label style={{ fontSize: 11, color: '#8a4fbf', fontWeight: 'bold' }}>{t('proyecto.negocioDentro')}</label>
            <div style={{ display: 'flex', gap: '0.4rem', margin: '0.2rem 0 0.5rem' }}>
              <input style={{ ...inp, flex: 1 }} placeholder={t('proyecto.negocioPlaceholder')} value={nuevoNegocio} onChange={(e) => setNuevoNegocio(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void crearNeg(); }} />
              <button style={btn} onClick={() => void crearNeg()} disabled={!nuevoNegocio.trim()}>＋</button>
            </div>

            {/* Crear unidad comercial */}
            <label style={{ fontSize: 11, color: 'var(--bp-text)', fontWeight: 'bold' }}>{t('proyecto.ucDeEsteProyecto')}</label>
            <div style={{ display: 'flex', gap: '0.4rem', margin: '0.2rem 0 0.5rem' }}>
              <input style={{ ...inp, flex: 1 }} placeholder={t('proyecto.ucPlaceholder')} value={nuevaUC} onChange={(e) => setNuevaUC(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void crearUC(); }} />
              <button style={btn} onClick={() => void crearUC()} disabled={!nuevaUC.trim()}>＋</button>
            </div>

            <div style={{ marginTop: '0.6rem', borderTop: '1px solid #dde6fb', paddingTop: '0.5rem' }}>
              <strong style={{ fontSize: 13 }}>🟢 {t('proyecto.curador')}</strong>
              <p style={{ fontSize: 11, color: 'var(--bp-muted)', margin: '0.2rem 0 0.4rem' }}>{t('proyecto.curadorAyuda')}</p>
              {/* El saludo y el placeholder del chat siguen en español a propósito: el agente
                  responde en español hasta la Fase 3 (idioma de los agentes). */}
              <ChatArquitecto
                conversar={(h) => conversarCuradorProyecto(h, proyectoId)}
                cargarHistorial={() => cargarConversacionProyecto(proyectoId)}
                historialKey={proyectoId}
                saludo="Soy el Curador de este proyecto. Si es un desarrollo o empresa que agrupa varios negocios (ej. Girly Zone → Altercing, Macao Pilates), dime cuáles son y los creo dentro. Si es un negocio, definimos sus unidades comerciales. Recuerdo todo y veo el estado del proyecto."
                placeholder="Ej: dentro de Girly Zone están Altercing Studio y Macao Pilates…"
                onCambio={cargar}
                altura={280}
              />
            </div>
          </div>

          {/* Grafo */}
          <div style={{ border: '1px solid var(--bp-border)', borderRadius: 10, background: 'var(--bp-panel-alt)' }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              {nodos.map((n, i) => { const p = posOf(i, nodos.length); return <line key={`e-${n.key}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={hover === n.key ? '#E8A93C' : '#3A3A45'} strokeWidth={hover === n.key ? 2 : 1} />; })}
              {/* centro */}
              <circle cx={cx} cy={cy} r={48} fill="#1E1E25" stroke="#E8A93C" strokeWidth={2} />
              <text x={cx} y={cy + 4} textAnchor="middle" fill="#F4F4F6" fontSize={12} fontWeight="bold">{(nombre || 'Proyecto').slice(0, 14)}</text>
              {/* nodos */}
              {nodos.map((n, i) => {
                const p = posOf(i, nodos.length); const activo = hover === n.key;
                return (
                  <g key={n.key} style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHover(n.key)} onMouseLeave={() => setHover(null)}
                    onClick={() => abrirNodo(n)}>
                    {formaNodo(n, p.x, p.y, activo ? 40 : 34, n.color)}
                    <text x={p.x} y={p.y + 4} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="bold">{abrev(n)}</text>
                    <text x={p.x} y={p.y + 52} textAnchor="middle" fill="#EDEDED" fontSize={12}>{n.label.slice(0, 18)}</text>
                    {n.tipoEntidad && (
                      <text x={p.x} y={p.y + 66} textAnchor="middle" fill="#9A9AA5" fontSize={10}>
                        {infoTipoEntidad(n.tipoEntidad)?.label}{n.estadoEntidad && !esEntidadReal(n.estadoEntidad) ? ` · ${infoEstadoEntidad(n.estadoEntidad).label}` : ''}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <p style={{ fontSize: 12, color: 'var(--bp-muted)', padding: '0 0.75rem 0.5rem' }}>
              <span style={{ color: 'var(--bp-text)' }}>{t('proyecto.leyenda.planos')}</span> · SED = {t('nodo.sedes')} · <span style={{ color: '#b8860b' }}>MAP = {t('nodo.mapa')}</span> · <span style={{ color: '#8a4fbf' }}>👥 {t('nodo.personas')}</span> · <span style={{ color: '#a9720f' }}>📦 {t('nodo.recursos')}</span> · <span style={{ color: '#2f8f8f' }}>🚚 {t('nodo.logistica')}</span> · <span style={{ color: '#c95b7c' }}>📣 {t('nodo.marketing')}</span> · <span style={{ color: '#8a4fbf' }}>NEG = {t('nodo.negocio')}</span> · {t('proyecto.leyenda.uc')}.{' '}
              <Frase texto={t('proyecto.leyenda.alimentan')} partes={{ alimentan: <strong>{t('enriquece.verbo')}</strong> }} /><br />
              <span style={{ color: 'var(--bp-text)' }}>{t('proyecto.leyenda.formas')}</span>{' '}
              <Frase texto={t('proyecto.leyenda.formasDetalle')} partes={{
                punteado: <strong>{t('proyecto.leyenda.punteado')}</strong>,
                noConstituida: <strong>{t('proyecto.leyenda.noConstituida')}</strong>,
              }} />
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
