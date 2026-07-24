'use client';

// REPORTE DE MEDIDAS estilo MAKE.PLAN. Presenta la geometría real de la sede como el
// entregable de una app de escaneo: m² totales, cuartos con dimensiones y área, muros/
// puertas/ventanas y objetos. Imprimible.

import type { CSSProperties } from 'react';
import type { Espacio, ObjetoFisico, ElementoArq } from '@/domain/espacios';
import { etiquetaNivel } from '@/domain/espacios';
import { reporteEscaneo, m2, metros } from '@/domain/escaneo';

const card: CSSProperties = { border: '1px solid #dde', borderRadius: 10, padding: '0.6rem 0.8rem', background: '#fff', minWidth: 110 };
const num: CSSProperties = { fontSize: 20, fontWeight: 'bold', color: '#2b5a97' };
const cap: CSSProperties = { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.3 };
const th: CSSProperties = { textAlign: 'left', borderBottom: '2px solid #dde', padding: '4px 8px', fontSize: 12, color: '#666' };
const td: CSSProperties = { borderBottom: '1px solid #eef', padding: '4px 8px', fontSize: 13 };

export function VistaReporteMedidas({ sedeNombre, espacios, objetos, elementos, onCerrar }: {
  sedeNombre: string; espacios: Espacio[]; objetos: ObjetoFisico[]; elementos: ElementoArq[]; onCerrar?: () => void;
}) {
  const r = reporteEscaneo(espacios, objetos, elementos);
  const capas = Array.from(new Set(r.cuartos.map((c) => c.capa))).sort((a, b) => a - b);

  return (
    <div className="reporte-medidas">
      <style>{`@media print {
        body * { visibility: hidden; }
        .reporte-medidas, .reporte-medidas * { visibility: visible; }
        .reporte-medidas { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
      }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>📐 Reporte de medidas <span style={{ fontSize: 13, color: '#888' }}>· {sedeNombre}</span></h2>
        <div className="no-print" style={{ display: 'flex', gap: '0.4rem' }}>
          <button style={{ padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 }} onClick={() => window.print()}>🖨 Imprimir / PDF</button>
          {onCerrar && <button style={{ padding: '0.35rem 0.8rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 }} onClick={onCerrar}>← Volver</button>}
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#888', margin: '0.2rem 0 0.8rem' }}>Medidas reales del plano (mismo entregable que un escaneo LiDAR). El escaneo se hace en el teléfono (MAKE.PLAN / Polycam / Scaniverse) y se sube como .glb; aquí se reporta lo medido.</p>

      {/* Tarjetas resumen */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={card}><div style={cap}>Área total</div><div style={num}>{m2(r.totalM2)}</div></div>
        <div style={card}><div style={cap}>Cuartos</div><div style={num}>{r.nCuartos}</div></div>
        <div style={card}><div style={cap}>Niveles</div><div style={num}>{r.niveles}</div></div>
        <div style={card}><div style={cap}>Muros</div><div style={num}>{metros(r.muros.longitudTotal)}</div></div>
        <div style={card}><div style={cap}>Puertas / Ventanas</div><div style={num}>{r.muros.nPuertas} / {r.muros.nVentanas}</div></div>
        <div style={card}><div style={cap}>Objetos</div><div style={num}>{r.nObjetos}</div></div>
      </div>

      {r.nCuartos === 0 && <p style={{ color: '#999', fontSize: 13 }}>Aún no hay cuartos/áreas dibujados en esta sede. Créalos en el editor 2D o sube un escaneo.</p>}

      {capas.map((capa) => {
        const cuartos = r.cuartos.filter((c) => c.capa === capa);
        const totalCapa = cuartos.reduce((s, c) => s + c.m2, 0);
        return (
          <div key={capa} style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#33415c', borderBottom: '2px solid #33415c', paddingBottom: 3, marginBottom: 4 }}>
              <span>🏢 {etiquetaNivel(capa)}</span><span>{m2(totalCapa)}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Cuarto</th><th style={th}>Tipo</th><th style={th}>Dimensiones</th><th style={{ ...th, textAlign: 'right' }}>Área</th><th style={{ ...th, textAlign: 'right' }}>Perímetro</th><th style={{ ...th, textAlign: 'right' }}>Objetos</th>
                </tr></thead>
                <tbody>
                  {cuartos.map((c) => (
                    <tr key={c.id}>
                      <td style={{ ...td, fontWeight: 'bold' }}>{c.nombre}</td>
                      <td style={{ ...td, color: '#888' }}>{c.tipo === 'habitacion' ? 'Habitación' : 'Área'}</td>
                      <td style={td}>{c.ancho.toFixed(2)} × {c.alto.toFixed(2)} m</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{m2(c.m2)}</td>
                      <td style={{ ...td, textAlign: 'right', color: '#888', fontVariantNumeric: 'tabular-nums' }}>{metros(c.perimetro)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{c.objetos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
