// IDIOMAS de la app (ADITIVO). El español es el idioma base: todo el texto original del
// sistema está escrito en español, y el inglés se resuelve por diccionario. Si una clave
// falta en inglés, cae al español — nunca queda un hueco ni una clave cruda en pantalla.

export type Locale = 'es' | 'en';

export const LOCALE_BASE: Locale = 'es';

export const LOCALES: { id: Locale; label: string; bandera: string; htmlLang: string }[] = [
  { id: 'es', label: 'Español', bandera: '🇲🇽', htmlLang: 'es' },
  { id: 'en', label: 'English', bandera: '🇺🇸', htmlLang: 'en' },
];

export function esLocale(v: unknown): v is Locale {
  return v === 'es' || v === 'en';
}

export function localeInfo(id: Locale) {
  return LOCALES.find((l) => l.id === id) ?? LOCALES[0]!;
}
