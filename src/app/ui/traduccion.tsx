'use client';

// Capa de traducción de TUS datos. Complementa al diccionario estático:
//
//   useT().t('nav.proyecto')   → texto de la APP    · instantáneo, gratis, siempre disponible
//   useTx().tx(negocio.nombre) → texto TUYO         · traducido bajo demanda, cacheado para siempre
//
// El interruptor de idioma cambia las pantallas al instante y SIN COSTO. Solo tus datos
// cuestan, y por eso nunca se traducen sin preguntar: se muestra el número de textos, los
// caracteres y el costo estimado, y no se llama a la API hasta que confirmes.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useT } from './i18n';
import { LOCALE_BASE } from '@/domain/i18n';
import {
  recolectarTextos, estimarTraduccion, ejecutarTraduccion, leerCacheCompleta,
} from '@/app/actions/traduccion.actions';
import type { Estimacion } from '@/app/actions/traduccion.actions';

interface CtxTx {
  /** Traducción cacheada de un texto tuyo; si no existe, devuelve el original. Nunca vacío. */
  tx: (texto: string | null | undefined) => string;
  pendientes: number;
  abrirAviso: () => void;
  traduciendo: boolean;
}

const TxCtx = createContext<CtxTx | null>(null);

/** Fuera del Provider (o en español) devuelve el original: la app funciona igual. */
export function useTx(): CtxTx {
  return useContext(TxCtx) ?? {
    tx: (texto) => texto ?? '',
    pendientes: 0,
    abrirAviso: () => {},
    traduciendo: false,
  };
}

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
};
const panel: CSSProperties = {
  background: 'var(--bp-panel)', border: '1px solid var(--bp-gold)', borderRadius: 12,
  padding: '1.25rem', maxWidth: 520, width: '100%', fontSize: 14,
};
const btn: CSSProperties = {
  padding: '0.45rem 1rem', borderRadius: 6, border: '1px solid var(--bp-border)',
  background: 'var(--bp-panel-alt)', cursor: 'pointer', fontSize: 14,
};
const btnPrimario: CSSProperties = {
  ...btn, background: 'var(--bp-gold)', color: '#1E1E25', fontWeight: 'bold',
  border: '1px solid var(--bp-gold)',
};

export function TraduccionProvider({ proyectoId, children }: { proyectoId: string | null; children: ReactNode }) {
  const { locale, t } = useT();
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [textos, setTextos] = useState<string[]>([]);
  const [est, setEst] = useState<Estimacion | null>(null);
  const [visible, setVisible] = useState(false);
  const [traduciendo, setTraduciendo] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Combinaciones (idioma + proyecto) en las que ya se avisó. Evita que el aviso reaparezca
  // cada vez que navegas: avisar es útil una vez, insistir es una molestia.
  const avisado = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelado = false;
    setResultado(null);
    setError(null);

    if (locale === LOCALE_BASE) {
      // El español es el dato real: no hay nada que traducir ni que consultar.
      setMapa({}); setTextos([]); setEst(null); setVisible(false);
      return;
    }

    (async () => {
      try {
        // 1. Lo ya pagado se pinta de inmediato, sin preguntar ni gastar.
        const cache = await leerCacheCompleta(locale);
        if (cancelado) return;
        setMapa(cache);

        if (!proyectoId) { setTextos([]); setEst(null); return; }

        // 2. Solo entonces se calcula qué falta, y se avisa del costo.
        const tx = await recolectarTextos(proyectoId);
        if (cancelado) return;
        setTextos(tx);
        const e = await estimarTraduccion(tx, locale);
        if (cancelado) return;
        setEst(e);

        const clave = `${locale}:${proyectoId}`;
        if (e.pendientes > 0 && !avisado.current.has(clave)) {
          avisado.current.add(clave);
          setVisible(true);
        }
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => { cancelado = true; };
  }, [locale, proyectoId]);

  const tx = useCallback((texto: string | null | undefined): string => {
    if (!texto) return texto ?? '';
    return mapa[texto.trim()] ?? texto;
  }, [mapa]);

  async function confirmar() {
    setTraduciendo(true);
    setError(null);
    try {
      const r = await ejecutarTraduccion(textos, locale);
      setMapa((prev) => ({ ...prev, ...r.traducciones }));
      setEst((prev) => (prev ? { ...prev, pendientes: 0 } : prev));
      setResultado(
        t('traducir.listo', { n: r.traducidos, usd: r.costoRealUSD.toFixed(4) }) +
        (r.fallidos > 0 ? ` ${t('traducir.fallidos', { n: r.fallidos })}` : ''),
      );
      setVisible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTraduciendo(false);
    }
  }

  const pendientes = est?.pendientes ?? 0;

  return (
    <TxCtx.Provider value={{ tx, pendientes, abrirAviso: () => setVisible(true), traduciendo }}>
      {children}

      {resultado && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000, background: 'var(--bp-panel)', border: '1px solid #5bbf8a', borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: 13, maxWidth: 420 }}>
          {resultado}
          <button style={{ ...btn, marginLeft: '0.6rem', padding: '0.1rem 0.5rem', fontSize: 12 }} onClick={() => setResultado(null)}>✕</button>
        </div>
      )}

      {visible && est && (
        <div style={overlay} onClick={() => !traduciendo && setVisible(false)}>
          <div style={panel} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.5rem' }}>🌐 {t('traducir.titulo')}</h3>
            <p style={{ margin: '0 0 0.75rem', color: 'var(--bp-muted)', lineHeight: 1.5 }}>
              {t('traducir.explicacion')}
            </p>

            <div style={{ border: '1px solid var(--bp-border)', borderRadius: 8, padding: '0.7rem', marginBottom: '0.75rem' }}>
              <div>{t('traducir.pendientes', { n: est.pendientes, chars: est.caracteres.toLocaleString() })}</div>
              {est.yaEnCache > 0 && (
                <div style={{ color: '#5bbf8a', fontSize: 13 }}>{t('traducir.yaPagado', { n: est.yaEnCache })}</div>
              )}
              <div style={{ marginTop: '0.4rem', fontSize: 17, fontWeight: 'bold', color: 'var(--bp-gold)' }}>
                {t('traducir.costo', { usd: est.costoUSD.toFixed(2) })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--bp-muted)', marginTop: '0.3rem' }}>
                {t('traducir.modelo', { modelo: est.modelo })}
              </div>
            </div>

            <p style={{ margin: '0 0 0.4rem', fontSize: 13 }}>💾 {t('traducir.unaVez')}</p>
            <p style={{ margin: '0 0 1rem', fontSize: 13, color: 'var(--bp-muted)' }}>🔒 {t('traducir.original')}</p>

            {error && <p style={{ color: '#e0795b', fontSize: 13 }}>{t('traducir.error', { msg: error })}</p>}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button style={btn} onClick={() => setVisible(false)} disabled={traduciendo}>
                {t('traducir.ahoraNo')}
              </button>
              <button style={btnPrimario} onClick={confirmar} disabled={traduciendo}>
                {traduciendo ? t('traducir.trabajando', { n: est.pendientes }) : t('traducir.confirmar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </TxCtx.Provider>
  );
}

/** Atajo para pintar un dato del usuario ya traducido: `<Tx>{negocio.nombre}</Tx>`. */
export function Tx({ children }: { children: string | null | undefined }) {
  const { tx } = useTx();
  return <>{tx(children)}</>;
}
