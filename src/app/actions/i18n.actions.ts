'use server';

// Idioma de la app persistido en DB (ADITIVO). Mismo patrón que `config.actions.ts` usa
// para el modelo por agente: tabla `Ajuste` (clave/valor), sin cambio de schema.
//
// Se guarda en servidor —además del localStorage del cliente— para que las acciones que
// GENERAN texto (documentos de plano, paquetes de entregables) sepan en qué idioma emitir
// sin depender del navegador.

import { prisma } from '@/adapters/persistence/prisma-client';
import { LOCALE_BASE, esLocale } from '@/domain/i18n/locales';
import type { Locale } from '@/domain/i18n/locales';

const CLAVE = 'ui.locale';

export async function obtenerLocale(): Promise<Locale> {
  const fila = await prisma.ajuste.findUnique({ where: { clave: CLAVE } });
  return esLocale(fila?.valor) ? fila.valor : LOCALE_BASE;
}

export async function guardarLocale(locale: Locale): Promise<void> {
  if (!esLocale(locale)) throw new Error(`Idioma no permitido: ${locale}`);
  await prisma.ajuste.upsert({
    where: { clave: CLAVE },
    create: { clave: CLAVE, valor: locale },
    update: { valor: locale },
  });
}
