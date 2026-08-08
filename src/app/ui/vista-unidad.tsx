'use client';

// Detalle de una Unidad Comercial. Aquí se le da forma: datos, sus espacios,
// y (próximamente) sus planos por-UC. Se entra desde el nodo de la UC en el grafo del proyecto.

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { actualizarUnidad, espaciosDeUnidad } from '@/app/actions/espacios.actions';
import type { UnidadComercial } from '@/domain/espacios';
import { CatalogoUC } from './catalogo-uc';
import { FichaUC } from './ficha-uc';
import { MapaOperativo } from './mapa-operativo';
import { VistaPersonas } from './vista-personas';
import { VistaRecursos } from './vista-recursos';
import { VistaLogistica } from './vista-logistica';
import { useEsMovil } from './use-movil';
import { useT } from './i18n';
import { useTx } from './traduccion';

const btn: CSSProperties = { padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #999', background: 'var(--bp-panel)', cursor: 'pointer', fontSize: 14 };
const inp: CSSProperties = { padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--bp-border)', fontSize: 14, width: '100%' };
const card: CSSProperties = { border: '1px solid var(--bp-border)', borderRadius: 8, padding: '0.6rem 0.9rem', margin: '0.4rem 0', background: 'var(--bp-panel-alt)' };
const lbl: CSSProperties = { display: 'block', fontSize: 12, color: 'var(--bp-muted)', marginTop: '0.5rem' };

interface Props { proyectoId: string; uc: UnidadComercial; onVolver: () => void; onIrSedes: () => void }

type Superficie = 'mapa' | 'personas' | 'recursos' | 'logistica';

export function VistaUnidad({ proyectoId, uc, onVolver, onIrSedes }: Props) {
  const { t } = useT();
  const { tx } = useTx();
  const [espacios, setEspacios] = useState<{ id: string; nombre: string; tipo: string; sedeNombre: string }[]>([]);
  const [superficie, setSuperficie] = useState<Superficie | null>(null);
  const movil = useEsMovil();

  useEffect(() => { espaciosDeUnidad(proyectoId, uc.id).then(setEspacios).catch(() => {}); }, [proyectoId, uc.id]);

  // Superficies de captura SCOPEADAS a esta UC — mismos componentes de siempre, con ucId
  // puesto: solo ven/crean lo compartido + lo etiquetado a esta UC. Al volver, el proyecto
  // completo (Mapa/Personas/Recursos/Logística a nivel proyecto) ya ve todo lo capturado aquí.
  if (superficie === 'mapa') return (
    <MapaOperativo proyectoId={proyectoId} onVolver={() => setSuperficie(null)} onIrSedes={onIrSedes} nombreProyecto={uc.nombre} ucId={uc.id} ucNombre={uc.nombre} />
  );
  if (superficie === 'personas') return (
    <section>
      <button style={btn} onClick={() => setSuperficie(null)}>← {tx(uc.nombre)}</button>
      <div style={{ marginTop: '0.5rem' }}><VistaPersonas proyectoId={proyectoId} nombreProyecto={uc.nombre} ucId={uc.id} ucNombre={uc.nombre} /></div>
    </section>
  );
  if (superficie === 'recursos') return (
    <section>
      <button style={btn} onClick={() => setSuperficie(null)}>← {tx(uc.nombre)}</button>
      <div style={{ marginTop: '0.5rem' }}><VistaRecursos proyectoId={proyectoId} ucId={uc.id} ucNombre={uc.nombre} /></div>
    </section>
  );
  if (superficie === 'logistica') return (
    <section>
      <button style={btn} onClick={() => setSuperficie(null)}>← {tx(uc.nombre)}</button>
      <div style={{ marginTop: '0.5rem' }}><VistaLogistica proyectoId={proyectoId} ucId={uc.id} ucNombre={uc.nombre} /></div>
    </section>
  );

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>🟢 {tx(uc.nombre)} <span style={{ fontSize: 13, color: 'var(--bp-muted)' }}>· {t('uc.subtitulo')}</span></h2>
        <button style={btn} onClick={onVolver}>← {t('nav.proyecto')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : 'minmax(280px, 5fr) 7fr', gap: '1rem', alignItems: 'start', marginTop: '0.75rem' }}>
        {/* Datos de la UC */}
        <div style={card}>
          <strong style={{ fontSize: 14 }}>{t('comun.datos')}</strong>
          <label style={lbl}>{t('comun.nombre')}</label>
          <input style={inp} defaultValue={uc.nombre} onBlur={(e) => { if (e.target.value !== uc.nombre) void actualizarUnidad(uc.id, { nombre: e.target.value }); }} />
          <label style={lbl}>{t('comun.tipo')}</label>
          <input style={inp} defaultValue={uc.tipo ?? ''} placeholder={t('uc.tipoPlaceholder')} onBlur={(e) => void actualizarUnidad(uc.id, { tipo: e.target.value })} />
          <label style={lbl}>{t('comun.descripcion')}</label>
          <textarea style={{ ...inp, resize: 'vertical' }} rows={3} defaultValue={uc.descripcion ?? ''} onBlur={(e) => void actualizarUnidad(uc.id, { descripcion: e.target.value })} />
        </div>

        {/* Desarrollo de la UC */}
        <div>
          <div style={{ ...card, background: 'var(--bp-panel-alt)', borderColor: '#cdd8ef' }}>
            <strong style={{ fontSize: 14 }}>{t('uc.superficies')}</strong>
            <p style={{ fontSize: 12, color: 'var(--bp-muted)', margin: '0.25rem 0 0.5rem' }}>{t('uc.superficiesAyuda', { uc: tx(uc.nombre) })}</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button style={btn} onClick={() => setSuperficie('mapa')}>🗺️ {t('nodo.mapa')}</button>
              <button style={btn} onClick={() => setSuperficie('personas')}>👥 {t('nodo.personas')}</button>
              <button style={btn} onClick={() => setSuperficie('recursos')}>📦 {t('nodo.recursos')}</button>
              <button style={btn} onClick={() => setSuperficie('logistica')}>🚚 {t('nodo.logistica')}</button>
            </div>
          </div>

          <div style={{ ...card, background: 'var(--bp-panel-alt)', borderColor: '#cdd8ef' }}>
            <strong style={{ fontSize: 14 }}>{t('uc.espacios')}</strong>
            <p style={{ fontSize: 12, color: 'var(--bp-muted)', margin: '0.25rem 0' }}>{t('uc.espaciosAyuda', { uc: tx(uc.nombre) })}</p>
            {espacios.length === 0 && <p style={{ fontSize: 13, color: 'var(--bp-muted)' }}>{t('uc.espaciosVacio')}</p>}
            {espacios.map((e) => (
              <div key={e.id} style={{ fontSize: 13, padding: '0.2rem 0' }}>· <strong>{tx(e.nombre)}</strong> <span style={{ color: 'var(--bp-muted)' }}>({e.tipo} · {tx(e.sedeNombre)})</span></div>
            ))}
            <button style={{ ...btn, marginTop: '0.5rem' }} onClick={onIrSedes}>{t('uc.irSedes')}</button>
          </div>

          <div style={{ ...card }}>
            <FichaUC proyectoId={proyectoId} ucId={uc.id} ucNombre={uc.nombre} />
          </div>

          <div style={{ ...card }}>
            <CatalogoUC proyectoId={proyectoId} ucId={uc.id} ucNombre={uc.nombre} />
          </div>
        </div>
      </div>
    </section>
  );
}
