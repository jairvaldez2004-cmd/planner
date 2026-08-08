'use client';

// Ficha estructural de una Unidad Comercial: la misma para todas, para que sean comparables.
//
// Dos clases de campo, visualmente distintas a propósito:
//   · CAPTURADO — fondo normal, editable. La UC es dueña del dato.
//   · DERIVADO  — fondo tenue y sin editar, con el origen a la vista. El dueño es el mapa
//                 operativo. Se muestra aquí para leer la unidad completa de un vistazo,
//                 pero editarlo aquí crearía una segunda copia que se desincroniza.

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { CAMPOS_FICHA_UC, GRUPOS_FICHA_UC } from '@/domain/uc-ficha';
import type { CampoFichaUC } from '@/domain/uc-ficha';
import { obtenerFichaUC, guardarCampoFichaUC } from '@/app/actions/uc-ficha.actions';
import type { FichaUCCompleta } from '@/app/actions/uc-ficha.actions';

const card: CSSProperties = { border: '1px solid var(--bp-border)', borderRadius: 8, padding: '0.6rem 0.9rem', margin: '0.4rem 0', background: 'var(--bp-panel-alt)' };
const inp: CSSProperties = { padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid var(--bp-border)', fontSize: 13, width: '100%', background: 'var(--bp-panel)', color: 'var(--bp-text)', resize: 'vertical' };
const lbl: CSSProperties = { fontSize: 12, fontWeight: 'bold', display: 'block', marginTop: '0.6rem' };
const ayudaSt: CSSProperties = { fontSize: 11, color: 'var(--bp-muted)', margin: '0.15rem 0 0.25rem' };

function CampoDerivado({ campo, valores }: { campo: CampoFichaUC; valores: string[] }) {
  return (
    <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.6rem', borderRadius: 6, border: '1px dashed var(--bp-border)', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 12 }}>{campo.label}</strong>
        <span style={{ fontSize: 10, color: 'var(--bp-muted)' }}>🔗 derivado · {campo.fuente}</span>
      </div>
      {valores.length === 0 ? (
        <p style={{ ...ayudaSt, fontStyle: 'italic' }}>Vacío: aún no hay nada de esto en el mapa operativo de la unidad.</p>
      ) : (
        <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem', fontSize: 12.5, lineHeight: 1.5 }}>
          {valores.map((v, i) => <li key={i}>{v}</li>)}
        </ul>
      )}
    </div>
  );
}

function CampoCapturado({ campo, valor, onGuardar }: { campo: CampoFichaUC; valor: string; onGuardar: (v: string) => void }) {
  const filas = campo.lista ? Math.min(8, Math.max(3, valor.split('\n').length + 1)) : 3;
  return (
    <div>
      <label style={lbl}>{campo.label}{campo.lista && <span style={{ fontWeight: 'normal', color: 'var(--bp-muted)' }}> · uno por línea</span>}</label>
      <p style={ayudaSt}>{campo.ayuda}</p>
      <textarea
        style={inp} rows={filas} defaultValue={valor}
        onBlur={(e) => { if (e.target.value !== valor) onGuardar(e.target.value); }}
      />
    </div>
  );
}

export function FichaUC({ proyectoId, ucId, ucNombre }: { proyectoId: string; ucId: string; ucNombre: string }) {
  const [ficha, setFicha] = useState<FichaUCCompleta | null>(null);
  const [abierto, setAbierto] = useState<string | null>(GRUPOS_FICHA_UC[0] ?? null);
  const [guardando, setGuardando] = useState(false);

  const cargar = () => { void obtenerFichaUC(proyectoId, ucId).then(setFicha).catch(() => {}); };
  useEffect(cargar, [proyectoId, ucId]);

  if (!ficha) return <p style={{ fontSize: 13, color: 'var(--bp-muted)' }}>Cargando ficha…</p>;

  const { completitud } = ficha;

  async function guardar(campoId: string, valor: string) {
    setGuardando(true);
    try {
      await guardarCampoFichaUC(ucId, campoId, valor);
      setFicha((prev) => prev ? { ...prev, capturado: { ...prev.capturado, [campoId]: valor } } : prev);
      // Recarga para refrescar el % de completitud sin recalcularlo en cliente.
      cargar();
    } finally { setGuardando(false); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>📋 Ficha estructural</strong>
        <span style={{ fontSize: 12, color: 'var(--bp-muted)' }}>
          {completitud.llenos}/{completitud.total} campos capturados · {completitud.pct}%
          {guardando && ' · guardando…'}
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--bp-border)', borderRadius: 2, margin: '0.4rem 0 0.2rem' }}>
        <div style={{ height: '100%', width: `${completitud.pct}%`, background: 'var(--bp-gold)', borderRadius: 2 }} />
      </div>
      <p style={ayudaSt}>
        Todas las unidades usan esta misma ficha, para poder compararlas. Los campos con borde punteado
        son <strong>derivados del mapa operativo</strong>: se leen aquí pero se editan allá.
      </p>

      {ficha.sinMapa && (
        <p style={{ fontSize: 12, color: '#d9a23b', margin: '0.4rem 0' }}>
          ⚠ Esta unidad todavía no tiene mapa operativo, por eso los campos derivados salen vacíos.
        </p>
      )}

      {GRUPOS_FICHA_UC.map((grupo) => {
        const campos = CAMPOS_FICHA_UC.filter((c) => c.grupo === grupo);
        const nCap = campos.filter((c) => c.clase === 'capturado').length;
        const nLlenos = campos.filter((c) => c.clase === 'capturado' && (ficha.capturado[c.id] ?? '').trim()).length;
        const esta = abierto === grupo;
        return (
          <div key={grupo} style={card}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: '0.5rem' }}
              onClick={() => setAbierto(esta ? null : grupo)}
            >
              <strong style={{ fontSize: 13 }}>{esta ? '▾' : '▸'} {grupo}</strong>
              <span style={{ fontSize: 11, color: nCap > 0 && nLlenos === nCap ? '#5bbf8a' : 'var(--bp-muted)' }}>
                {nCap > 0 ? `${nLlenos}/${nCap}` : 'derivado'}
              </span>
            </div>
            {esta && campos.map((c) => (
              c.clase === 'derivado'
                ? <CampoDerivado key={c.id} campo={c} valores={ficha.derivado[c.id] ?? []} />
                : <CampoCapturado key={c.id} campo={c} valor={ficha.capturado[c.id] ?? ''} onGuardar={(v) => void guardar(c.id, v)} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
