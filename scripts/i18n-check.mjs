#!/usr/bin/env node
// Guardarraíl de i18n. Dos comprobaciones independientes:
//
//   1. PARIDAD de diccionarios (es.ts ↔ en.ts). Es un ERROR: rompe el build.
//      Una clave sobrante en `en.ts` ya no compila (está tipada contra ClaveI18n),
//      pero una clave FALTANTE sí compila —cae al español— y por eso hace falta esto.
//
//   2. COBERTURA de pantallas: cuánto texto en español sigue incrustado en el JSX.
//      Es un INFORME, no un error: quedan 35 pantallas por migrar y romper el build
//      por cada una sería un guardarraíl que todo el mundo aprende a ignorar.
//      Con `--strict` sí falla (útil el día que la cobertura llegue al 100%).
//
// Uso:  npm run i18n:check  [--strict]

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = process.cwd();
const ESTRICTO = process.argv.includes('--strict');

// ---------------------------------------------------------------- 1. paridad

// Se leen como texto (no `import`) para no arrastrar el pipeline de TS a un script de node.
function clavesDe(archivo) {
  const src = readFileSync(join(RAIZ, 'src/domain/i18n', archivo), 'utf8');
  const claves = new Set();
  for (const m of src.matchAll(/^\s*'([^']+)':\s*'/gm)) claves.add(m[1]);
  return claves;
}

const claveEs = clavesDe('es.ts');
const claveEn = clavesDe('en.ts');
const faltan = [...claveEs].filter((k) => !claveEn.has(k));
const sobran = [...claveEn].filter((k) => !claveEs.has(k));

console.log(`\n📚 Diccionarios · es: ${claveEs.size} claves · en: ${claveEn.size} claves`);
if (faltan.length) {
  console.log(`\n  ❌ ${faltan.length} clave(s) sin traducir al inglés (se verán en español):`);
  for (const k of faltan) console.log(`     · ${k}`);
}
if (sobran.length) {
  console.log(`\n  ❌ ${sobran.length} clave(s) en en.ts que no existen en es.ts (huérfanas):`);
  for (const k of sobran) console.log(`     · ${k}`);
}
if (!faltan.length && !sobran.length) console.log('  ✅ Paridad completa.');

// ------------------------------------------------------- 2. cobertura de UI

// Un literal "parece español" si trae acentos/ñ/signos invertidos, o alguna palabra
// funcional del castellano. Evita marcar como pendiente lo que es código, id o marca.
const PALABRAS = /\b(de|la|el|los|las|que|para|con|del|una|un|por|en|se|sin|sus|este|esta|cada|todo|todos|más|ya|aún|solo|desde|hasta|entre|sobre|como|cuando|donde|quién|qué)\b/i;
const ACENTOS = /[áéíóúÁÉÍÓÚñÑ¿¡]/;
const pareceEspanol = (s) => s.trim().length > 3 && (ACENTOS.test(s) || PALABRAS.test(s));

function archivosTsx(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) archivosTsx(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const informe = [];
for (const archivo of archivosTsx(join(RAIZ, 'src/app'))) {
  const src = readFileSync(archivo, 'utf8');
  const pendientes = [];

  // Nodos de texto JSX: >  texto  <   (descarta los que ya son {t('…')} o {expresión})
  for (const m of src.matchAll(/>([^<>{}\n]{4,})</g)) {
    if (pareceEspanol(m[1])) pendientes.push(m[1].trim());
  }
  // Atributos visibles al usuario.
  for (const m of src.matchAll(/\b(placeholder|title|aria-label|alt)=["']([^"']{4,})["']/g)) {
    if (pareceEspanol(m[2])) pendientes.push(`${m[1]}="${m[2].trim()}"`);
  }
  // Diálogos del navegador.
  for (const m of src.matchAll(/\b(confirm|alert|prompt)\(\s*[`'"]([^`'"]{4,})/g)) {
    if (pareceEspanol(m[2])) pendientes.push(`${m[1]}(): ${m[2].trim()}`);
  }

  if (pendientes.length) {
    informe.push({ archivo: relative(RAIZ, archivo).replace(/\\/g, '/'), n: pendientes.length, muestra: pendientes.slice(0, 2) });
  }
}

informe.sort((a, b) => b.n - a.n);
const total = informe.reduce((s, f) => s + f.n, 0);
const totalArchivos = archivosTsx(join(RAIZ, 'src/app')).length;

console.log(`\n🖥️  Pantallas · ${totalArchivos - informe.length}/${totalArchivos} sin español incrustado · ${total} literal(es) pendiente(s)\n`);
for (const f of informe.slice(0, 15)) {
  console.log(`  ${String(f.n).padStart(4)}  ${f.archivo}`);
  for (const s of f.muestra) console.log(`        ↳ ${s.slice(0, 70)}`);
}
if (informe.length > 15) console.log(`  … y ${informe.length - 15} archivo(s) más.`);

// ------------------------------------------------------------------ salida

const rotoParidad = faltan.length > 0 || sobran.length > 0;
if (rotoParidad) {
  console.log('\n❌ Paridad de diccionarios rota.\n');
  process.exit(1);
}
if (ESTRICTO && total > 0) {
  console.log(`\n❌ --strict: quedan ${total} literal(es) en español dentro del JSX.\n`);
  process.exit(1);
}
console.log('\n✅ Sin errores bloqueantes.\n');
