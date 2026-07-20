'use client';

// AGENDA VISUAL DE RECURSOS COMPARTIDOS (ADITIVO). Ref: domain/agenda.ts.
// El horario de espacios y herramientas se capturaba como texto libre, así que un mismo
// recurso podía estar asignado a dos departamentos a la misma hora sin que se notara.
// Aquí se interpreta ese texto y se dibuja la semana por recurso, marcando los CHOQUES.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { DIAS, detectarCruces, hhmm, normalizarRecurso, parseHorario, ventanaDelDia } from '@/domain/agenda';
import type { UsoRecurso } from '@/domain/agenda';
import { colorDepto, procesosDeEtapa } from '@/domain/mapa';
import type { Departamento, ProcesoNodo } from '@/domain/mapa';
import type { EtapaObjetivo } from '@/domain/etapas';
import { etapaInfo } from '@/domain/etapas';

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };

interface Props {
  procesos: ProcesoNodo[];
  deptos: Departamento[];
  etapa: EtapaObjetivo;
  onCerrar: () => void;
  onIrProceso: (id: string) => void;
}

export function AgendaRecursos({ procesos, deptos, etapa, onCerrar, onIrProceso }: Props) {
  const [dia, setDia] = useState(0);
  const vigentes = procesosDeEtapa(procesos, etapa);

  // Reúne TODOS los usos declarados: los del departamento (espacios/herramientas
  // asignados con horario) y los de cada proceso (dónde ocurre, con qué horario).
  const usos: (UsoRecurso & { procesoId?: string; color: string })[] = [];
  deptos.forEach((d, i) => {
    const color = colorDepto(d, i);
    for (const r of [...d.espacios, ...d.herramientas]) {
      if (!r.horario) continue;
      usos.push({ recurso: r.nombre, titular: d.nombre, origen: 'departamento', horarioTexto: r.horario, franja: parseHorario(r.horario), color });
    }
  });
  for (const p of vigentes) {
    const i = deptos.findIndex((d) => d.id === p.departamentoId);
    const color = i >= 0 ? colorDepto(deptos[i]!, i) : '#888';
    const titular = deptos[i]?.nombre ?? '—';
    for (const e of p.espacios) {
      if (!e.horario) continue;
      usos.push({ recurso: e.nombre, titular, origen: 'proceso', horarioTexto: e.horario, franja: parseHorario(e.horario), color, procesoId: p.id });
    }
  }

  const cruces = detectarCruces(usos);
  const sinInterpretar = usos.filter((u) => u.franja === null);
  const ventana = ventanaDelDia(usos);
  const horas: number[] = [];
  for (let h = ventana.desde; h <= ventana.hasta; h += 60) horas.push(h);

  // Recursos con al menos un uso interpretable, en orden alfabético.
  const recursos = [...new Map(usos.filter((u) => u.franja).map((u) => [normalizarRecurso(u.recurso), u.recurso])).values()]
    .sort((a, b) => a.localeCompare(b));

  const delDia = (recurso: string) => usos.filter((u) => u.franja?.dias.includes(dia) && normalizarRecurso(u.recurso) === normalizarRecurso(recurso));
  const chocaEnDia = (recurso: string) => cruces.some((c) => c.dia === dia && normalizarRecurso(c.recurso) === normalizarRecurso(recurso));
  const span = Math.max(60, ventana.hasta - ventana.desde);
  const pct = (min: number) => ((min - ventana.desde) / span) * 100;

  const info = etapaInfo(etapa);
  const crucesDelDia = cruces.filter((c) => c.dia === dia);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>🗓️ Agenda de recursos compartidos <span style={{ fontSize: 12.5, color: '#888' }}>· etapa {info?.n} · {info?.label}</span></h2>
        <button style={btn} onClick={onCerrar}>← Volver al mapa</button>
      </div>
      <p style={{ fontSize: 12, color: '#666', margin: '0.35rem 0 0.6rem' }}>
        Un mismo espacio o herramienta puede usarse en varios departamentos <strong>en horarios distintos</strong>. Aquí se ve la semana real y se marcan en rojo los <strong>choques</strong>: dos áreas ocupando el mismo recurso a la misma hora.
      </p>

      {/* días */}
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        {DIAS.map((d, i) => {
          const n = cruces.filter((c) => c.dia === i).length;
          return (
            <button key={d} onClick={() => setDia(i)}
              style={{ ...btn, padding: '0.3rem 0.7rem', background: dia === i ? '#33415c' : '#fff', color: dia === i ? '#fff' : '#333', borderColor: dia === i ? '#33415c' : '#ccc' }}>
              {d}{n > 0 && <span style={{ marginLeft: 4, background: '#c0392b', color: '#fff', borderRadius: 8, fontSize: 10, padding: '0 4px' }}>{n}</span>}
            </button>
          );
        })}
      </div>

      {recursos.length === 0 ? (
        <p style={{ color: '#888', fontSize: 13, border: '1px dashed #ddd', borderRadius: 8, padding: '1rem' }}>
          Todavía no hay recursos con horario. Asigna espacios o herramientas con horario (ej. <code>L-V 9-14</code>) en el panel de un proceso o de un departamento y aparecerán aquí.
        </p>
      ) : (
        <div style={{ border: '1px solid #ddd', borderRadius: 10, overflow: 'hidden' }}>
          {/* regla de horas */}
          <div style={{ display: 'flex', borderBottom: '1px solid #eee', background: '#fafbfc' }}>
            <div style={{ width: 140, flexShrink: 0, borderRight: '1px solid #eee' }} />
            <div style={{ flex: 1, position: 'relative', height: 22 }}>
              {horas.map((h) => (
                <span key={h} style={{ position: 'absolute', left: `${pct(h)}%`, fontSize: 10, color: '#999', transform: 'translateX(-50%)', top: 4 }}>{hhmm(h)}</span>
              ))}
            </div>
          </div>

          {recursos.map((r) => {
            const bloques = delDia(r);
            const choca = chocaEnDia(r);
            return (
              <div key={r} style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', minHeight: 38, background: choca ? '#fdf3f2' : '#fff' }}>
                <div style={{ width: 140, flexShrink: 0, borderRight: '1px solid #eee', padding: '0.4rem 0.5rem', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: choca ? 'bold' : 'normal' }}>{r}</span>
                  {choca && <span title="Hay un choque este día" style={{ color: '#c0392b' }}>⚠</span>}
                </div>
                <div style={{ flex: 1, position: 'relative', padding: '0.3rem 0' }}>
                  {/* líneas de hora */}
                  {horas.map((h) => (
                    <div key={h} style={{ position: 'absolute', left: `${pct(h)}%`, top: 0, bottom: 0, width: 1, background: '#f2f4f7' }} />
                  ))}
                  {bloques.length === 0 && <span style={{ fontSize: 11, color: '#ccc', paddingLeft: 8 }}>libre</span>}
                  {bloques.map((b, i) => {
                    const f = b.franja!;
                    const enCruce = cruces.some((c) => c.dia === dia && (c.a === b || c.b === b));
                    return (
                      <div key={i}
                        onClick={() => { if (b.procesoId) onIrProceso(b.procesoId); }}
                        title={`${b.titular} · ${hhmm(f.desde)}–${hhmm(f.hasta)} · "${b.horarioTexto}"${b.procesoId ? ' · clic para abrir el proceso' : ''}`}
                        style={{ position: 'absolute', left: `${pct(f.desde)}%`, width: `${Math.max(2, pct(f.hasta) - pct(f.desde))}%`,
                          top: 4 + i * 15, height: 13, borderRadius: 4, background: b.color, opacity: 0.9,
                          border: enCruce ? '2px solid #c0392b' : 'none', boxSizing: 'border-box',
                          color: '#fff', fontSize: 9, lineHeight: '13px', paddingLeft: 4, overflow: 'hidden', whiteSpace: 'nowrap',
                          cursor: b.procesoId ? 'pointer' : 'default' }}>
                        {b.titular}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CHOQUES del día */}
      {crucesDelDia.length > 0 && (
        <div style={{ marginTop: '0.8rem', border: '1px solid #f0c6c1', background: '#fdf3f2', borderRadius: 9, padding: '0.6rem 0.75rem' }}>
          <strong style={{ fontSize: 13, color: '#c0392b' }}>⚠ {crucesDelDia.length} choque{crucesDelDia.length > 1 ? 's' : ''} el {DIAS[dia]}</strong>
          <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem', fontSize: 12.5 }}>
            {crucesDelDia.map((c, i) => (
              <li key={i} style={{ marginBottom: 2 }}>
                <strong>{c.recurso}</strong>: <span style={{ color: '#555' }}>{c.a.titular}</span> y <span style={{ color: '#555' }}>{c.b.titular}</span> lo ocupan de <strong>{hhmm(c.desde)} a {hhmm(c.hasta)}</strong>.
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 11, color: '#8a5b55', margin: '0.4rem 0 0' }}>Ajusta el horario de uno de los dos en el panel del proceso o del departamento.</p>
        </div>
      )}

      {sinInterpretar.length > 0 && (
        <div style={{ marginTop: '0.6rem', fontSize: 11.5, color: '#8a6d3b', background: '#fcf8e3', border: '1px solid #f2e3b8', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
          <strong>{sinInterpretar.length} horario{sinInterpretar.length > 1 ? 's' : ''} sin interpretar</strong> (no entran en la agenda):{' '}
          {sinInterpretar.slice(0, 6).map((u) => `${u.recurso} — "${u.horarioTexto}"`).join(' · ')}{sinInterpretar.length > 6 ? '…' : ''}.
          <br />Escríbelos como <code>L-V 9-14</code>, <code>sáb 10-13</code>, <code>lunes a viernes 9:00-14:00</code> o <code>todos los días 9-18</code>.
        </div>
      )}
    </section>
  );
}
