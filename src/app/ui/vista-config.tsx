'use client';

// Configuración superadmin: modelo de IA por agente. Cambios se guardan en la DB y
// aplican de inmediato (las actions resuelven el modelo desde aquí en cada llamada).

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { MODELOS_DISPONIBLES, ETIQUETA_ROL } from '@/config/modelos';
import type { ModeloClaude, RolAgente } from '@/config/modelos';
import { obtenerModelosAgentes, guardarModeloAgente, restablecerModelos } from '@/app/actions/config.actions';

const btn: CSSProperties = { padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 14 };
const card: CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem 1rem', margin: '0.5rem 0', background: '#fafafa' };
const ROLES: RolAgente[] = ['curador', 'coordinador', 'especialista'];

interface Props { onVolver: () => void }

export function VistaConfig({ onVolver }: Props) {
  const [modelos, setModelos] = useState<Record<RolAgente, ModeloClaude> | null>(null);
  const [guardando, setGuardando] = useState<RolAgente | null>(null);
  const [aviso, setAviso] = useState('');

  const cargar = () => { obtenerModelosAgentes().then(setModelos).catch(() => {}); };
  useEffect(() => { cargar(); }, []);

  async function cambiar(rol: RolAgente, modelo: ModeloClaude) {
    setGuardando(rol);
    try {
      await guardarModeloAgente(rol, modelo);
      setModelos((m) => (m ? { ...m, [rol]: modelo } : m));
      setAviso(`✅ ${ETIQUETA_ROL[rol].nombre} → ${modelo}`);
    } catch (e) {
      setAviso(`❌ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGuardando(null);
    }
  }

  async function restablecer() {
    const def = await restablecerModelos();
    setModelos(def);
    setAviso('↩ Restablecido a los valores por defecto.');
  }

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>⚙ Configuración · Modelo por agente</h2>
        <button style={btn} onClick={onVolver}>← Volver</button>
      </div>
      <p style={{ fontSize: 13, color: '#555' }}>
        Elige el modelo de IA de cada agente. Empezar barato (Sonnet/Haiku) y subir a Opus solo donde la calidad lo exija.
        Los cambios aplican de inmediato.
      </p>
      {aviso && <p style={{ fontSize: 13, color: aviso.startsWith('❌') ? '#a00' : '#06c' }}>{aviso}</p>}

      {!modelos && <p style={{ color: '#666' }}>Cargando…</p>}
      {modelos && ROLES.map((rol) => (
        <div key={rol} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <strong>{ETIQUETA_ROL[rol].nombre}</strong>
            <div style={{ fontSize: 12, color: '#777' }}>{ETIQUETA_ROL[rol].nota}</div>
          </div>
          <select
            value={modelos[rol]}
            disabled={guardando === rol}
            onChange={(e) => void cambiar(rol, e.target.value as ModeloClaude)}
            style={{ padding: '0.4rem', borderRadius: 6, border: '1px solid #ccc', fontSize: 14, minWidth: 280 }}
          >
            {MODELOS_DISPONIBLES.map((m) => (
              <option key={m.id} value={m.id} disabled={!m.habilitado}>{m.etiqueta}</option>
            ))}
          </select>
        </div>
      ))}

      <button style={{ ...btn, marginTop: '0.75rem' }} onClick={() => void restablecer()}>Restablecer a valores por defecto</button>
    </section>
  );
}
