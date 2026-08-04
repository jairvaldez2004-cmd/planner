'use client';

// PANEL DE CONTINGENCIAS del Mapa Operativo: manuales de emergencia por riesgo ("¿qué hacer
// si el pedido no llega, roban la mercancía, viene sin seguro…?"). Se crean desde plantillas
// o libres, se anclan a un proceso del workflow, y se agrupan por categoría.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { RIESGOS_LOGISTICA, contingenciaDesdePlantilla, GRAVEDADES_CONTINGENCIA, gravedadContingencia, CATEGORIAS_CONTINGENCIA } from '@/domain/contingencia';
import type { Contingencia } from '@/domain/contingencia';
import type { ProcesoNodo } from '@/domain/mapa';

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: 'var(--bp-panel)', cursor: 'pointer', fontSize: 13 };
const btnSm: CSSProperties = { ...btn, padding: '0.15rem 0.5rem', fontSize: 12 };
const inp: CSSProperties = { padding: '0.35rem 0.55rem', borderRadius: 6, border: '1px solid var(--bp-border)', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: 'var(--bp-muted)', marginTop: '0.4rem', fontWeight: 'bold' };

export function VistaContingencias({ contingencias, procesos, onGuardar, onBorrar, onCerrar, onIrProceso }: {
  contingencias: Contingencia[]; procesos: ProcesoNodo[];
  onGuardar: (c: Contingencia) => void; onBorrar: (id: string) => void; onCerrar: () => void; onIrProceso: (id: string) => void;
}) {
  const [plantilla, setPlantilla] = useState('');
  const procNombre = (id: string) => procesos.find((p) => p.id === id)?.nombre ?? '';

  // Agrupar por categoría.
  const grupos = new Map<string, Contingencia[]>();
  for (const c of contingencias) { const k = c.categoria || 'otros'; grupos.set(k, [...(grupos.get(k) ?? []), c]); }

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>⚠️ Contingencias <span style={{ fontSize: 13, color: 'var(--bp-muted)' }}>· manuales de emergencia por riesgo</span></h2>
        <button style={btn} onClick={onCerrar}>← Mapa</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--bp-muted)', margin: '0.3rem 0 0.7rem' }}>
        Qué hacer si algo sale mal: el pedido no llega, roban la mercancía, viene sin seguro, se daña, la detiene aduana… Cada protocolo se ancla a un paso del workflow para que la operación sepa reaccionar.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.8rem' }}>
        <select style={{ ...inp, width: 'auto', maxWidth: 320 }} value={plantilla} onChange={(e) => { const pl = RIESGOS_LOGISTICA.find((x) => x.id === e.target.value); if (pl) { onGuardar(contingenciaDesdePlantilla('', pl, '')); setPlantilla(''); } }}>
          <option value="">＋ Agregar riesgo desde plantilla…</option>
          {RIESGOS_LOGISTICA.map((r) => <option key={r.id} value={r.id}>{r.titulo}</option>)}
        </select>
        <button style={btn} onClick={() => onGuardar({ id: '', titulo: 'Nueva contingencia', disparador: '', categoria: 'operación', gravedad: 'media', pasos: '', responsable: '', prevencion: '', procesoId: '' })}>＋ Libre</button>
      </div>

      {contingencias.length === 0 && <p style={{ color: 'var(--bp-muted)', fontSize: 13 }}>Aún no hay manuales de emergencia. Agrega los riesgos comunes desde la plantilla (pedido tarde, robo, sin seguro, daño, aduana, proveedor que falla, faltante).</p>}

      {Array.from(grupos.entries()).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#a03e2c', textTransform: 'capitalize', borderBottom: '2px solid #f0c9c2', padding: '2px 0 3px' }}>{cat} <span style={{ color: '#aaa', fontWeight: 'normal' }}>({items.length})</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.6rem', marginTop: '0.5rem' }}>
            {items.map((c) => {
              const g = gravedadContingencia(c.gravedad);
              return (
                <div key={c.id} style={{ border: `1px solid ${g.color}55`, borderLeft: `4px solid ${g.color}`, borderRadius: 9, padding: '0.6rem 0.7rem', background: 'var(--bp-panel)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input style={{ ...inp, fontWeight: 'bold', flex: 1 }} defaultValue={c.titulo} key={`t-${c.id}`} onBlur={(e) => { if (e.target.value !== c.titulo) onGuardar({ ...c, titulo: e.target.value }); }} />
                    <span style={{ cursor: 'pointer', color: '#b33' }} onClick={() => onBorrar(c.id)}>🗑</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: 4 }}>
                    <div><label style={lbl}>Gravedad</label>
                      <select style={inp} value={c.gravedad} onChange={(e) => onGuardar({ ...c, gravedad: e.target.value as Contingencia['gravedad'] })}>
                        {GRAVEDADES_CONTINGENCIA.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                      </select></div>
                    <div><label style={lbl}>Categoría</label>
                      <input style={inp} list="cat-cont-dl" defaultValue={c.categoria} key={`ct-${c.id}`} onBlur={(e) => { if (e.target.value !== c.categoria) onGuardar({ ...c, categoria: e.target.value }); }} />
                      <datalist id="cat-cont-dl">{CATEGORIAS_CONTINGENCIA.map((x) => <option key={x} value={x} />)}</datalist></div>
                  </div>
                  <label style={lbl}>⚡ Disparador (qué lo activa)</label>
                  <input style={inp} defaultValue={c.disparador} key={`d-${c.id}`} onBlur={(e) => { if (e.target.value !== c.disparador) onGuardar({ ...c, disparador: e.target.value }); }} />
                  <label style={lbl}>Pasos del protocolo</label>
                  <textarea style={{ ...inp, resize: 'vertical' }} rows={5} defaultValue={c.pasos} key={`p-${c.id}`} onBlur={(e) => { if (e.target.value !== c.pasos) onGuardar({ ...c, pasos: e.target.value }); }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    <div><label style={lbl}>Responsable</label><input style={inp} defaultValue={c.responsable} key={`r-${c.id}`} onBlur={(e) => { if (e.target.value !== c.responsable) onGuardar({ ...c, responsable: e.target.value }); }} /></div>
                    <div><label style={lbl}>Anclar a proceso</label>
                      <select style={inp} value={c.procesoId} onChange={(e) => onGuardar({ ...c, procesoId: e.target.value })}>
                        <option value="">— general —</option>
                        {procesos.filter((p) => !p.padreProcesoId).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select></div>
                  </div>
                  <label style={lbl}>🛡️ Prevención</label>
                  <textarea style={{ ...inp, resize: 'vertical' }} rows={2} defaultValue={c.prevencion} key={`pv-${c.id}`} onBlur={(e) => { if (e.target.value !== c.prevencion) onGuardar({ ...c, prevencion: e.target.value }); }} />
                  {c.procesoId && <button style={{ ...btnSm, marginTop: 5, background: 'var(--bp-panel-alt)', borderColor: '#cdd8ef', color: 'var(--bp-gold)' }} onClick={() => onIrProceso(c.procesoId)}>↗ Ir al proceso «{procNombre(c.procesoId)}»</button>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
