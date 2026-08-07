'use server';

// Traducción de TUS datos al cambiar de idioma, con caché permanente y aviso de costo.
//
// Contrato con el usuario (esto es lo que pidió, literal):
//   · "Todo de golpe al cambiar el interruptor"  → `recolectarTextos` barre el proyecto entero.
//   · "Que me avise cuando vaya a gastar dinero" → `estimarTraduccion` devuelve el costo ANTES
//     de llamar a la API. Nada se traduce hasta que el usuario confirme.
//   · El original NUNCA se sobrescribe: la traducción vive en `TraduccionCache`, indexada por
//     el hash del texto origen. Volver a español es instantáneo porque el español es el dato real.
//
// Economía: el volumen de texto es FIJO. Cada texto se traduce una vez y queda cacheado para
// siempre → el segundo cambio de idioma cuesta $0. Solo el texto NUEVO vuelve a costar.

import { createHash } from 'node:crypto';
import { prisma } from '@/adapters/persistence/prisma-client';
import { traducirLote } from '@/adapters/ai/traductor';
import { modeloActual } from './config.actions';
import { PRECIO_POR_MTOK } from '@/config/modelos';
import { LOCALE_BASE, esLocale } from '@/domain/i18n/locales';
import type { Locale } from '@/domain/i18n/locales';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

// Textos por petición. 40 mantiene cada respuesta bien por debajo de `max_tokens: 8000`
// y hace que un fallo puntual solo cueste un lote, no la corrida entera.
const POR_LOTE = 40;

// ---------------------------------------------------------------- recolección

/**
 * ¿Este string es texto humano que valga la pena traducir?
 * Descarta ids, slugs, fechas, números, colores, URLs y JSON incrustado — traducirlos
 * costaría dinero y además rompería referencias.
 */
function esTraducible(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (s.length < 2 || s.length > 2000) return false;
  if (!/[a-záéíóúñA-ZÁÉÍÓÚÑ]/.test(s)) return false;        // sin letras: número, fecha, símbolo
  if (/^[a-z0-9_-]+$/.test(s)) return false;                 // slug/id: 'empresa_operativa', 'uc-1'
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return false;           // color
  if (/^https?:\/\//i.test(s)) return false;                 // URL
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return false;            // fecha ISO
  if (/^[{[]/.test(s)) return false;                         // JSON serializado
  return true;
}

/** Recorre un JSON arbitrario y junta los strings humanos que encuentre. */
function recorrer(valor: unknown, out: Set<string>, prof = 0): void {
  if (prof > 8) return;
  if (esTraducible(valor)) { out.add(valor.trim()); return; }
  if (Array.isArray(valor)) { for (const v of valor) recorrer(v, out, prof + 1); return; }
  if (valor && typeof valor === 'object') {
    for (const v of Object.values(valor)) recorrer(v, out, prof + 1);
  }
}

/**
 * Todo el texto que TÚ escribiste en un proyecto: estructura, catálogo, mapa operativo,
 * respuestas de planos y filas de tablas. Devuelve textos únicos (un texto repetido en
 * 40 sitios se traduce una sola vez).
 */
export async function recolectarTextos(proyectoId: string): Promise<string[]> {
  const set = new Set<string>();
  const p = { proyectoId };

  const [ucs, sedes, espacios, ofertas, presentaciones, deptos, procesos, planos, tablas, diag] =
    await Promise.all([
      prisma.unidadComercial.findMany({ where: p }),
      prisma.sede.findMany({ where: p }),
      prisma.espacio.findMany({ where: p }),
      prisma.oferta.findMany({ where: p }),
      prisma.presentacion.findMany({ where: p }),
      prisma.departamento.findMany({ where: p }),
      prisma.proceso.findMany({ where: p }),
      prisma.proyectoPlanoEstado.findMany({ where: p }),
      prisma.tablaProyecto.findMany({ where: p }),
      prisma.proyectoDiagnostico.findUnique({ where: { proyectoId } }),
    ]);

  for (const r of [...ucs, ...sedes, ...ofertas, ...presentaciones, ...deptos, ...procesos]) {
    if (esTraducible(r.nombre)) set.add(r.nombre.trim());
    recorrer(r.data, set);
  }
  for (const e of espacios) if (esTraducible(e.nombre)) set.add(e.nombre.trim());
  for (const pe of planos) recorrer(pe.campos, set);       // respuestas de los 18 planos
  for (const tb of tablas) recorrer(tb.filas, set);        // filas de las tablas maestras
  if (diag) recorrer(diag.diagnostico, set);

  return [...set];
}

// --------------------------------------------------------------------- caché

/** Traducciones YA pagadas para estos textos. No llama a la API ni cuesta nada. */
export async function leerCache(textos: string[], locale: Locale): Promise<Record<string, string>> {
  if (locale === LOCALE_BASE || textos.length === 0) return {};
  const hashes = textos.map(hash);
  const filas = await prisma.traduccionCache.findMany({
    where: { locale, hash: { in: hashes } },
    select: { origen: true, destino: true },
  });
  return Object.fromEntries(filas.map((f) => [f.origen, f.destino]));
}

/** Todo lo traducido a `locale`, para hidratar la app de una vez al cambiar el interruptor. */
export async function leerCacheCompleta(locale: Locale): Promise<Record<string, string>> {
  if (locale === LOCALE_BASE) return {};
  const filas = await prisma.traduccionCache.findMany({
    where: { locale },
    select: { origen: true, destino: true },
  });
  return Object.fromEntries(filas.map((f) => [f.origen, f.destino]));
}

// ----------------------------------------------------------------- estimación

export interface Estimacion {
  pendientes: number;   // textos que aún no están en caché
  yaEnCache: number;    // textos que no cuestan nada
  caracteres: number;
  costoUSD: number;     // techo estimado, redondeado hacia arriba
  modelo: string;
  lotes: number;
}

/**
 * Cuánto costaría traducir. **No llama a la API** — solo cuenta y multiplica por la tarifa.
 * Es lo que se muestra en el aviso antes de gastar.
 */
export async function estimarTraduccion(textos: string[], locale: Locale): Promise<Estimacion> {
  const modelo = await modeloActual('traductor');
  const precio = PRECIO_POR_MTOK[modelo];

  if (locale === LOCALE_BASE) {
    return { pendientes: 0, yaEnCache: textos.length, caracteres: 0, costoUSD: 0, modelo, lotes: 0 };
  }

  const cache = await leerCache(textos, locale);
  const pendientes = textos.filter((tx) => !(tx in cache));
  const caracteres = pendientes.reduce((s, tx) => s + tx.length, 0);
  const lotes = Math.ceil(pendientes.length / POR_LOTE);

  // ~3.3 caracteres por token en español; +400 tokens de system prompt por lote.
  // Se estima al alza a propósito: el aviso debe ser un techo, no una sorpresa.
  const tokensEntrada = caracteres / 3.3 + lotes * 400;
  const tokensSalida = (caracteres / 3.3) * 1.1;
  const costo = (tokensEntrada / 1e6) * precio.entrada + (tokensSalida / 1e6) * precio.salida;

  return {
    pendientes: pendientes.length,
    yaEnCache: textos.length - pendientes.length,
    caracteres,
    costoUSD: Math.ceil(costo * 100) / 100,
    modelo,
    lotes,
  };
}

// ------------------------------------------------------------------ ejecución

export interface ResultadoEjecucion {
  traducidos: number;
  fallidos: number;
  costoRealUSD: number;
  traducciones: Record<string, string>; // origen → destino, para pintar sin recargar
}

/**
 * Traduce lo que falte y lo guarda en caché. Idempotente: llamarla dos veces con los mismos
 * textos no vuelve a cobrar, porque la segunda vez ya están todos en caché.
 *
 * Solo debe invocarse DESPUÉS de que el usuario confirme la estimación.
 */
export async function ejecutarTraduccion(textos: string[], locale: Locale): Promise<ResultadoEjecucion> {
  if (!esLocale(locale)) throw new Error(`Idioma no permitido: ${locale}`);
  if (locale === LOCALE_BASE) {
    return { traducidos: 0, fallidos: 0, costoRealUSD: 0, traducciones: {} };
  }

  const modelo = await modeloActual('traductor');
  const precio = PRECIO_POR_MTOK[modelo];
  const cache = await leerCache(textos, locale);
  const pendientes = textos.filter((tx) => !(tx in cache));

  const traducciones: Record<string, string> = { ...cache };
  let tokensEntrada = 0, tokensSalida = 0, fallidos = 0, traducidos = 0;
  const ahora = new Date().toISOString();

  for (let i = 0; i < pendientes.length; i += POR_LOTE) {
    const lote = pendientes.slice(i, i + POR_LOTE);
    const r = await traducirLote(lote, locale, modelo);
    tokensEntrada += r.tokensEntrada;
    tokensSalida += r.tokensSalida;
    fallidos += r.fallidos;

    // Se persiste lote a lote: si el siguiente falla, lo ya pagado no se pierde.
    const nuevas = lote
      .map((origen, j) => ({ origen, destino: r.traducciones[j]! }))
      .filter((x) => x.destino !== x.origen); // un "no cambió" no vale la fila ni el reintento

    await prisma.$transaction(
      nuevas.map((x) =>
        prisma.traduccionCache.upsert({
          where: { hash_locale: { hash: hash(x.origen), locale } },
          create: { hash: hash(x.origen), locale, origen: x.origen, destino: x.destino, creadoEn: ahora },
          update: { destino: x.destino, creadoEn: ahora },
        }),
      ),
    );

    for (const x of nuevas) traducciones[x.origen] = x.destino;
    traducidos += nuevas.length;
  }

  const costoRealUSD =
    (tokensEntrada / 1e6) * precio.entrada + (tokensSalida / 1e6) * precio.salida;

  return { traducidos, fallidos, costoRealUSD: Math.round(costoRealUSD * 10000) / 10000, traducciones };
}
