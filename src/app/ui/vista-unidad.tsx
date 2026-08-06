'use client';

// Detalle de una Unidad Comercial. Aquí se le da forma: datos, sus espacios,
// y (próximamente) sus planos por-UC. Se entra desde el nodo de la UC en el grafo del proyecto.

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { actualizarUnidad, espaciosDeUnidad } from '@/app/actions/espacios.actions';
import type { UnidadComercial } from '@/domain/espacios';
import { CatalogoUC } from './catalogo-uc';
import { MapaOperativo } from './mapa-operativo';
import { VistaPersonas } from './vista-personas';
import { VistaRecursos } from './vista-recursos';
import { VistaLogistica } from './vista-logistica';
import { useEsMovil } from './use-movil';

const btn: CSSProperties = { padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #999', background: 'var(--bp-panel)', cursor: 'pointer', fontSize: 14 };
const inp: CSSProperties = { padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--bp-border)', fontSize: 14, width: '100%' };
const card: CSSProperties = { border: '1px solid var(--bp-border)', borderRadius: 8, padding: '0.6rem 0.9rem', margin: '0.4rem 0', background: 'var(--bp-panel-alt)' };
const lbl: CSSProperties = { display: 'block', fontSize: 12, color: 'var(--bp-muted)', marginTop: '0.5rem' };

interface Props { proyectoId: string; uc: UnidadComercial; onVolver: () => void; onIrSedes: () => void }

type Superficie = 'mapa' | 'personas' | 'recursos' | 'logistica';

export function VistaUnidad({ proyectoId, uc, onVolver, onIrSedes }: Props) {
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
      <button style={btn} onClick={() => setSuperficie(null)}>← {uc.nombre}</button>
      <div style={{ marginTop: '0.5rem' }}><VistaPersonas proyectoId={proyectoId} nombreProyecto={uc.nombre} ucId={uc.id} ucNombre={uc.nombre} /></div>
    </section>
  );
  if (superficie === 'recursos') return (
    <section>
      <button style={btn} onClick={() => setSuperficie(null)}>← {uc.nombre}</button>
      <div style={{ marginTop: '0.5rem' }}><VistaRecursos proyectoId={proyectoId} ucId={uc.id} ucNombre={uc.nombre} /></div>
    </section>
  );
  if (superficie === 'logistica') return (
    <section>
      <button style={btn} onClick={() => setSuperficie(null)}>← {uc.nombre}</button>
      <div style={{ marginTop: '0.5rem' }}><VistaLogistica proyectoId={proyectoId} ucId={uc.id} ucNombre={uc.nombre} /></div>
    </section>
  );

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>🟢 {uc.nombre} <span style={{ fontSize: 13, color: 'var(--bp-muted)' }}>· Unidad Comercial</span></h2>
        <button style={btn} onClick={onVolver}>← Proyecto</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : 'minmax(280px, 5fr) 7fr', gap: '1rem', alignItems: 'start', marginTop: '0.75rem' }}>
        {/* Datos de la UC */}
        <div style={card}>
          <strong style={{ fontSize: 14 }}>Datos</strong>
          <label style={lbl}>Nombre</label>
          <input style={inp} defaultValue={uc.nombre} onBlur={(e) => { if (e.target.value !== uc.nombre) void actualizarUnidad(uc.id, { nombre: e.target.value }); }} />
          <label style={lbl}>Tipo</label>
          <input style={inp} defaultValue={uc.tipo ?? ''} placeholder="servicio · producto · e-commerce…" onBlur={(e) => void actualizarUnidad(uc.id, { tipo: e.target.value })} />
          <label style={lbl}>Descripción</label>
          <textarea style={{ ...inp, resize: 'vertical' }} rows={3} defaultValue={uc.descripcion ?? ''} onBlur={(e) => void actualizarUnidad(uc.id, { descripcion: e.target.value })} />
        </div>

        {/* Desarrollo de la UC */}
        <div>
          <div style={{ ...card, background: 'var(--bp-panel-alt)', borderColor: '#cdd8ef' }}>
            <strong style={{ fontSize: 14 }}>Superficies de esta unidad</strong>
            <p style={{ fontSize: 12, color: 'var(--bp-muted)', margin: '0.25rem 0 0.5rem' }}>Captura solo para "{uc.nombre}". Lo compartido (sin UC asignada) y lo que captures aquí conviven; al volver al proyecto se ve todo junto.</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button style={btn} onClick={() => setSuperficie('mapa')}>🗺️ Mapa</button>
              <button style={btn} onClick={() => setSuperficie('personas')}>👥 Personas</button>
              <button style={btn} onClick={() => setSuperficie('recursos')}>📦 Recursos</button>
              <button style={btn} onClick={() => setSuperficie('logistica')}>🚚 Logística</button>
            </div>
          </div>

          <div style={{ ...card, background: 'var(--bp-panel-alt)', borderColor: '#cdd8ef' }}>
            <strong style={{ fontSize: 14 }}>Espacios de esta unidad</strong>
            <p style={{ fontSize: 12, color: 'var(--bp-muted)', margin: '0.25rem 0' }}>Habitaciones/áreas asignadas a "{uc.nombre}" en las sedes.</p>
            {espacios.length === 0 && <p style={{ fontSize: 13, color: 'var(--bp-muted)' }}>Aún sin espacios. Ve a Sedes & Espacios y asígnale áreas a esta UC.</p>}
            {espacios.map((e) => (
              <div key={e.id} style={{ fontSize: 13, padding: '0.2rem 0' }}>· <strong>{e.nombre}</strong> <span style={{ color: 'var(--bp-muted)' }}>({e.tipo} · {e.sedeNombre})</span></div>
            ))}
            <button style={{ ...btn, marginTop: '0.5rem' }} onClick={onIrSedes}>Ir a Sedes & Espacios →</button>
          </div>

          <div style={{ ...card }}>
            <CatalogoUC proyectoId={proyectoId} ucId={uc.id} ucNombre={uc.nombre} />
          </div>
        </div>
      </div>
    </section>
  );
}
