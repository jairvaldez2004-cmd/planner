'use client';

// INSTRUCTIVO IMPRIMIBLE del mapa operativo (ADITIVO). Ref: domain/mapa.ts.
// Convierte el canvas en un DOCUMENTO para imprimir y colgar en la operación:
// los procesos vigentes de una etapa, en orden cronológico (siguiendo las flechas),
// agrupados por fase, con quién lo hace, dónde, con qué, cuánto tarda, qué recibe,
// qué produce, el paso a paso y qué disparador lleva al siguiente.
// El @media print oculta la UI de la app y deja solo el documento.

import type { CSSProperties } from 'react';
import { FASES_MAPA, ordenCronologico, procesosDeEtapa, nEtapa, vigenteEn, naceEn } from '@/domain/mapa';
import type { Departamento, FaseMapa, ProcesoNodo } from '@/domain/mapa';
import { etapaInfo } from '@/domain/etapas';
import type { EtapaObjetivo } from '@/domain/etapas';

const btn: CSSProperties = { padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };

interface Props {
  procesos: ProcesoNodo[];
  deptos: Departamento[];
  etapa: EtapaObjetivo;
  nombreProyecto?: string | undefined;
  soloFase?: FaseMapa | undefined;   // si se pide una sola página
  onCerrar: () => void;
}

export function InstructivoMapa({ procesos, deptos, etapa, nombreProyecto, soloFase, onCerrar }: Props) {
  const vigentes = procesosDeEtapa(procesos, etapa);
  const numeracion = ordenCronologico(vigentes);
  const byId = new Map(procesos.map((p) => [p.id, p]));
  const deptoDe = (id: string) => deptos.find((d) => d.id === id);
  const info = etapaInfo(etapa);
  const fases = soloFase ? FASES_MAPA.filter((f) => f.id === soloFase) : FASES_MAPA;

  // Dentro de cada fase, el orden es el cronológico global (el que siguen las flechas).
  const deFase = (f: FaseMapa) => vigentes
    .filter((p) => p.fase === f)
    .sort((a, b) => (numeracion.get(a.id) ?? 999) - (numeracion.get(b.id) ?? 999));

  const total = fases.reduce((n, f) => n + deFase(f.id).length, 0);

  return (
    <div className="instructivo-raiz">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .instructivo-raiz, .instructivo-raiz * { visibility: visible !important; }
          .instructivo-raiz { position: absolute !important; left: 0; top: 0; width: 100%; padding: 0 !important; }
          .no-imprimir { display: none !important; }
          .proceso-ficha { break-inside: avoid; page-break-inside: avoid; }
          .fase-bloque { break-before: page; page-break-before: always; }
          .fase-bloque:first-of-type { break-before: auto; page-break-before: auto; }
        }
        @page { margin: 14mm; }
      `}</style>

      <div className="no-imprimir" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
        <button style={btn} onClick={onCerrar}>← Volver al mapa</button>
        <button style={{ ...btn, background: '#33415c', color: '#fff', borderColor: '#33415c', fontWeight: 'bold' }} onClick={() => window.print()}>🖨️ Imprimir</button>
        <span style={{ fontSize: 12, color: '#888' }}>
          {total} procesos · imprime en el orden real de trabajo. Consejo: en el diálogo de impresión activa &quot;Gráficos de fondo&quot; para conservar los colores.
        </span>
      </div>

      {/* ===== ENCABEZADO DEL DOCUMENTO ===== */}
      <header style={{ borderBottom: '2px solid #33415c', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Instructivo de operación{nombreProyecto ? ` · ${nombreProyecto}` : ''}</h1>
        {info && <p style={{ margin: '0.25rem 0 0', fontSize: 13, color: '#555' }}><strong>Etapa {info.n} · {info.label}</strong> — {info.descripcion}</p>}
        <p style={{ margin: '0.2rem 0 0', fontSize: 11.5, color: '#888' }}>
          {total} procesos vigentes{soloFase ? ` de la fase ${FASES_MAPA.find((f) => f.id === soloFase)?.label}` : ''} · numerados en el orden real en que ocurren.
        </p>
      </header>

      {total === 0 && <p style={{ color: '#888' }}>No hay procesos vigentes en esta etapa todavía.</p>}

      {fases.map((f) => {
        const lista = deFase(f.id);
        if (!lista.length) return null;
        return (
          <section key={f.id} className="fase-bloque" style={{ marginBottom: '1.4rem' }}>
            <h2 style={{ fontSize: 16, background: '#eef1f7', padding: '0.35rem 0.6rem', borderRadius: 6, margin: '0 0 0.6rem' }}>
              {f.label} <span style={{ fontWeight: 'normal', color: '#777', fontSize: 13 }}>({lista.length} procesos)</span>
            </h2>

            {lista.map((p) => {
              const d = deptoDe(p.departamentoId);
              const n = numeracion.get(p.id);
              const pasos = (p.instructivo ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
              return (
                <article key={p.id} className="proceso-ficha" style={{ border: '1px solid #d5d9e2', borderRadius: 8, padding: '0.6rem 0.75rem', marginBottom: '0.6rem', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ background: '#33415c', color: '#fff', borderRadius: 12, padding: '0.05rem 0.5rem', fontSize: 12, fontWeight: 'bold' }}>{n}</span>
                    <strong style={{ fontSize: 15 }}>{p.nombre}</strong>
                    <span style={{ fontSize: 11.5, color: '#666' }}>· {d?.nombre ?? '—'}</span>
                    {!naceEn(p, etapa) && <span style={{ fontSize: 10.5, color: '#999' }}>(desde la etapa {nEtapa(p.etapaDesde)})</span>}
                    {p.etapaHasta === etapa && <span style={{ fontSize: 10.5, color: '#c0392b', fontWeight: 'bold' }}>· último uso en esta etapa</span>}
                  </div>

                  {p.descripcion && <p style={{ margin: '0.3rem 0 0', fontSize: 12.5, color: '#444' }}>{p.descripcion}</p>}

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: '0.4rem' }}>
                    <tbody>
                      <Fila etiqueta="Quién lo hace" valor={p.roles.join(' · ')} />
                      <Fila etiqueta="Dónde" valor={p.espacios.map((e) => e.nombre + (e.horario ? ` (${e.horario})` : '')).join(' · ')} />
                      <Fila etiqueta="Con qué" valor={p.herramientas.join(' · ')} />
                      <Fila etiqueta="Consume" valor={p.insumos.join(' · ')} />
                      <Fila etiqueta="Cuánto tarda" valor={p.tiempoMin ? `${p.tiempoMin} min` : ''} />
                      <Fila etiqueta="Recibe" valor={p.entrada ?? ''} />
                      <Fila etiqueta="Produce" valor={p.salida ?? ''} />
                    </tbody>
                  </table>

                  {pasos.length > 0 && (
                    <div style={{ marginTop: '0.4rem' }}>
                      <div style={{ fontSize: 11, fontWeight: 'bold', color: '#666', textTransform: 'uppercase', letterSpacing: 0.3 }}>Paso a paso</div>
                      <ol style={{ margin: '0.2rem 0 0', paddingLeft: '1.2rem', fontSize: 12.5 }}>
                        {pasos.map((x, i) => <li key={i} style={{ marginBottom: 2 }}>{x.replace(/^[-·*\d.)\s]+/, '')}</li>)}
                      </ol>
                    </div>
                  )}

                  {/* Qué sigue: el disparador es la instrucción operativa clave. */}
                  <div style={{ marginTop: '0.45rem', borderTop: '1px dashed #dfe3ea', paddingTop: '0.35rem' }}>
                    <div style={{ fontSize: 11, fontWeight: 'bold', color: '#666', textTransform: 'uppercase', letterSpacing: 0.3 }}>Qué sigue</div>
                    {p.ramas.filter((r) => r.destinoProcesoId).length === 0 && (
                      <p style={{ margin: '0.15rem 0 0', fontSize: 12.5, color: '#888' }}>Aquí termina este camino.</p>
                    )}
                    {p.ramas.filter((r) => r.destinoProcesoId).map((r) => {
                      const dest = byId.get(r.destinoProcesoId!);
                      if (!dest) return null;
                      const futuro = !vigenteEn(dest, etapa);
                      return (
                        <p key={r.id} style={{ margin: '0.15rem 0 0', fontSize: 12.5 }}>
                          <strong style={{ color: '#7a4fbf' }}>Si {r.evento && r.evento !== 'continúa' ? `«${r.evento}»` : 'termina bien'}</strong>
                          {' → '}
                          {futuro
                            ? <span style={{ color: '#888' }}>se guarda para <strong>{dest.nombre}</strong>, que arranca en la etapa {nEtapa(dest.etapaDesde)} ({etapaInfo(dest.etapaDesde)?.label}).</span>
                            : <>paso <strong>{numeracion.get(dest.id)}</strong> · {dest.nombre} <span style={{ color: '#888' }}>({deptoDe(dest.departamentoId)?.nombre ?? '—'})</span></>}
                        </p>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </section>
        );
      })}

      <footer style={{ borderTop: '1px solid #ddd', marginTop: '1rem', paddingTop: '0.4rem', fontSize: 10.5, color: '#999' }}>
        Business Planner · instructivo generado del mapa operativo. Los pasos marcados &quot;desde la etapa N&quot; se heredaron de una etapa anterior.
      </footer>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  if (!valor.trim()) return null;
  return (
    <tr>
      <td style={{ padding: '0.12rem 0.5rem 0.12rem 0', color: '#777', whiteSpace: 'nowrap', verticalAlign: 'top', width: 110 }}>{etiqueta}</td>
      <td style={{ padding: '0.12rem 0' }}>{valor}</td>
    </tr>
  );
}
