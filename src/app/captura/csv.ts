// Utilidades CSV (Decisión 4) — plantilla, parseo y serialización para tablas maestras.
// Sin dependencias externas. Maneja comillas y comas dentro de campos.

import type { Columna } from '@/domain/tablas';

export type Fila = Record<string, string>;

function escapar(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

// Columnas efectivas de una vista de especialista = base + contexto.
export function columnasEfectivas(base: Columna[], contexto?: Columna[]): Columna[] {
  const map = new Map<string, Columna>();
  for (const c of base) map.set(c.id, c);
  for (const c of contexto ?? []) if (!map.has(c.id)) map.set(c.id, c);
  return Array.from(map.values());
}

// Genera la plantilla CSV (encabezados) + filas existentes para round-trip editable.
export function aCSV(columnas: Columna[], filas: Fila[]): string {
  const head = columnas.map((c) => escapar(c.etiqueta)).join(',');
  const body = filas.map((f) => columnas.map((c) => escapar(f[c.id] ?? '')).join(',')).join('\n');
  return body ? `${head}\n${body}` : head;
}

// Parsea una línea CSV respetando comillas.
function parsearLinea(linea: string): string[] {
  const out: string[] = [];
  let cur = '';
  let enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (enComillas) {
      if (ch === '"') {
        if (linea[i + 1] === '"') { cur += '"'; i++; } else enComillas = false;
      } else cur += ch;
    } else if (ch === '"') enComillas = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export interface ResultadoImport {
  filas: Fila[];
  errores: string[];
  pendientes: string[]; // columnas requeridas vacías → PENDIENTE (no bloquea)
}

// Parsea CSV → filas mapeadas por id de columna (encabezado por etiqueta O por id).
export function desdeCSV(columnas: Columna[], texto: string): ResultadoImport {
  const errores: string[] = [];
  const pendientes: string[] = [];
  const lineas = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lineas.length === 0) return { filas: [], errores: ['CSV vacío.'], pendientes: [] };

  const headers = parsearLinea(lineas[0]!).map((h) => h.trim());
  // mapea cada encabezado a una columna (por etiqueta o por id, sin distinguir mayúsculas)
  const idxToCol = headers.map((h) => {
    const lc = h.toLowerCase();
    return columnas.find((c) => c.etiqueta.toLowerCase() === lc || c.id.toLowerCase() === lc);
  });
  if (idxToCol.every((c) => !c)) errores.push('Ningún encabezado coincide con la plantilla.');

  const filas: Fila[] = [];
  for (let i = 1; i < lineas.length; i++) {
    const celdas = parsearLinea(lineas[i]!);
    const fila: Fila = {};
    idxToCol.forEach((col, j) => { if (col) fila[col.id] = (celdas[j] ?? '').trim(); });
    // requeridos vacíos → pendiente (no bloquea)
    for (const c of columnas) {
      if (c.requerido && !(fila[c.id] && fila[c.id]!.trim())) pendientes.push(`fila ${i}: "${c.etiqueta}"`);
    }
    filas.push(fila);
  }
  return { filas, errores, pendientes };
}

// Upsert por llave (round-trip): las filas nuevas reemplazan/añaden por su llave.
export function upsertPorLlave(actuales: Fila[], nuevas: Fila[], llave: string): Fila[] {
  const map = new Map<string, Fila>();
  for (const f of actuales) map.set((f[llave] ?? '').trim().toLowerCase(), f);
  for (const f of nuevas) {
    const k = (f[llave] ?? '').trim().toLowerCase();
    if (k) map.set(k, f); else map.set(`__sinllave_${map.size}`, f);
  }
  return Array.from(map.values());
}
