'use client';

// Contexto de idioma de la UI. Los 41 componentes son 'use client' bajo un único <AppShell>,
// así que un Context basta — no hacen falta rutas [locale] ni una librería de i18n.
//
// Persistencia en dos sitios, a propósito:
//   · localStorage → instantáneo al recargar, sin parpadeo ni viaje al servidor.
//   · tabla Ajuste → para que las server actions que generan documentos sepan el idioma.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { t as traducir, LOCALE_BASE, esLocale, localeInfo } from '@/domain/i18n';
import type { Locale } from '@/domain/i18n';
import { guardarLocale } from '@/app/actions/i18n.actions';

const CLAVE_LS = 'bp.locale';

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (clave: string, params?: Record<string, string | number>) => string;
}

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children, inicial }: { children: ReactNode; inicial?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(inicial ?? LOCALE_BASE);

  // Rehidrata del navegador tras montar (evita desajuste servidor/cliente en el primer render).
  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(CLAVE_LS);
      if (esLocale(guardado) && guardado !== locale) setLocaleState(guardado);
    } catch { /* localStorage bloqueado: se queda con el idioma base */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantiene <html lang> en sincronía: importa para accesibilidad y para el corrector del navegador.
  useEffect(() => { document.documentElement.lang = localeInfo(locale).htmlLang; }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { window.localStorage.setItem(CLAVE_LS, l); } catch { /* no bloquea el cambio */ }
    // El guardado en DB es best-effort: si falla, la UI ya cambió y localStorage lo recuerda.
    void guardarLocale(l).catch(() => {});
  }, []);

  const t = useCallback(
    (clave: string, params?: Record<string, string | number>) => traducir(locale, clave, params),
    [locale],
  );

  return <I18nCtx.Provider value={{ locale, setLocale, t }}>{children}</I18nCtx.Provider>;
}

/**
 * Hook de traducción. Fuera del Provider degrada al idioma base en vez de lanzar, para que
 * un componente montado aislado (o un test) no reviente.
 */
export function useT(): Ctx {
  const ctx = useContext(I18nCtx);
  if (ctx) return ctx;
  return {
    locale: LOCALE_BASE,
    setLocale: () => {},
    t: (clave, params) => traducir(LOCALE_BASE, clave, params),
  };
}
