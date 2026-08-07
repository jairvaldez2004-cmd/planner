// Núcleo de traducción (puro, sin IO — usable en cliente y en server actions).
//
// Cadena de resolución: idioma pedido → español (base) → la propia clave.
// Nunca lanza ni deja un hueco: si algo falta, en el peor caso se ve la clave, lo que hace
// el hueco evidente en desarrollo sin romper la pantalla en producción.

import { es } from './es';
import { en } from './en';
import { LOCALE_BASE } from './locales';
import type { Locale } from './locales';
import type { ClaveI18n } from './es';

export type { Locale } from './locales';
export type { ClaveI18n } from './es';
export { LOCALES, LOCALE_BASE, esLocale, localeInfo } from './locales';

// Tipado laxo hacia adentro (las claves de dominio se arman en runtime: `columna.${id}`),
// estricto hacia afuera (la firma de `t` exige ClaveI18n).
type Diccionario = Record<string, string | undefined>;
const DICCIONARIOS: Record<Locale, Diccionario> = { es, en };

/** Todas las traducciones conocidas de una clave (para emparejar encabezados CSV en cualquier idioma). */
export function todasLasTraducciones(clave: string): string[] {
  const out: string[] = [];
  for (const d of Object.values(DICCIONARIOS)) { const v = d[clave]; if (v) out.push(v); }
  return out;
}

/**
 * Traduce `clave` al `locale`, interpolando `{param}`.
 * Los parámetros ausentes se dejan como `{param}` en vez de imprimir "undefined".
 */
export function t(locale: Locale, clave: ClaveI18n, params?: Record<string, string | number>): string {
  const base = DICCIONARIOS[locale]?.[clave] ?? DICCIONARIOS[LOCALE_BASE][clave] ?? clave;
  if (!params) return base;
  return base.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/**
 * Traduce una etiqueta de dominio identificada por su id estable, con *fallback* al texto
 * español que ya vive en la config (`label`, `nombre`…). Así una superficie puede adoptar
 * i18n sin que haya que traducir de golpe las 161 etiquetas del dominio.
 *
 *   etiqueta(locale, 'tipoEntidad', 'empresa_operativa', info.label)
 */
export function etiqueta(locale: Locale, ambito: string, id: string, fallback: string): string {
  const clave = `${ambito}.${id}`;
  const dic = DICCIONARIOS[locale] ?? DICCIONARIOS[LOCALE_BASE];
  return dic[clave] ?? DICCIONARIOS[LOCALE_BASE][clave] ?? fallback;
}

/** Nombre del plano (META, EST…) en el idioma activo, con fallback al de `PLANOS_MAESTROS`. */
export function nombrePlano(locale: Locale, planoId: string, fallback: string): string {
  return etiqueta(locale, 'plano', planoId, fallback);
}
