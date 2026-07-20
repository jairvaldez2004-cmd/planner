// AGENDA DE RECURSOS COMPARTIDOS (ADITIVO). Ref: domain/mapa.ts.
// Un mismo espacio o herramienta puede compartirse entre departamentos/procesos EN
// TIEMPOS DISTINTOS. Hasta ahora el horario era texto libre ("L-V 9-14"), así que no
// se podía ver el choque. Aquí se interpreta ese texto y se detectan los CRUCES:
// dos usos del mismo recurso que se pisan en el mismo día y hora.
// Funciones puras (sin IO) para poder probarlas.

export interface FranjaHoraria {
  dias: number[];   // 0=lunes … 6=domingo
  desde: number;    // minutos desde medianoche
  hasta: number;
}

export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Abreviaturas y nombres aceptados. X y Mi = miércoles (uso común en México).
const DIA_TOKEN: Record<string, number> = {
  l: 0, lu: 0, lun: 0, lunes: 0,
  m: 1, ma: 1, mar: 1, martes: 1,   // con X para miércoles, "M" suelto = martes
  x: 2, mi: 2, mie: 2, mier: 2, miercoles: 2,
  j: 3, ju: 3, jue: 3, jueves: 3,
  v: 4, vi: 4, vie: 4, viernes: 4,
  s: 5, sa: 5, sab: 5, sabado: 5,
  d: 6, do: 6, dom: 6, domingo: 6,
};

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// "9" → 540 · "9:30" → 570 · "14.5" no se acepta · admite "9am"/"2pm".
function aMinutos(txt: string): number | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(txt.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const sufijo = m[3];
  if (h > 24 || min > 59) return null;
  if (sufijo === 'pm' && h < 12) h += 12;
  if (sufijo === 'am' && h === 12) h = 0;
  return h * 60 + min;
}

// Interpreta el horario en texto libre. Devuelve null si no se entiende
// (entonces la UI lo muestra como "sin horario definido", no como choque).
export function parseHorario(texto: string | undefined): FranjaHoraria | null {
  if (!texto) return null;
  const t = sinAcentos(texto).replace(/\s+/g, ' ').trim();
  if (!t) return null;

  // --- rango de horas: "9-14", "9:00 a 14:00", "de 9 a 14" ---
  const rango = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|–|—|a(?:\s+las)?|hasta)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/.exec(t);
  if (!rango) return null;
  const desde = aMinutos(rango[1]!);
  let hasta = aMinutos(rango[2]!);
  if (desde === null || hasta === null) return null;
  // "9-2" en contexto de tarde: si el fin es menor, se asume pasado el mediodía.
  if (hasta <= desde && hasta + 12 * 60 > desde) hasta += 12 * 60;
  if (hasta <= desde) return null;

  // --- días: lo que está ANTES del rango horario ---
  const cabecera = t.slice(0, rango.index).trim();
  const dias = parseDias(cabecera);
  return { dias: dias.length ? dias : [0, 1, 2, 3, 4, 5, 6], desde, hasta };
}

function parseDias(cabecera: string): number[] {
  if (!cabecera) return [];
  if (/todos los dias|diario|a diario|todos/.test(cabecera)) return [0, 1, 2, 3, 4, 5, 6];
  if (/entre semana|habiles|laborales/.test(cabecera)) return [0, 1, 2, 3, 4];
  if (/fin(es)? de semana/.test(cabecera)) return [5, 6];

  const dias = new Set<number>();
  // Rangos "L-V", "lun a vie" (el guion aquí une días, no horas).
  const rangoDias = /([a-z]+)\s*(?:-|–|a)\s*([a-z]+)/g;
  let m: RegExpExecArray | null;
  let huboRango = false;
  while ((m = rangoDias.exec(cabecera))) {
    const a = DIA_TOKEN[m[1]!], b = DIA_TOKEN[m[2]!];
    if (a === undefined || b === undefined) continue;
    huboRango = true;
    for (let i = a; ; i = (i + 1) % 7) { dias.add(i); if (i === b) break; }
  }
  if (huboRango) return [...dias].sort((x, y) => x - y);

  // Lista suelta: "L, M, X" · "sab y dom" · "sabado".
  for (const tok of cabecera.split(/[\s,;/+]+|\by\b/).filter(Boolean)) {
    const d = DIA_TOKEN[tok];
    if (d !== undefined) dias.add(d);
  }
  return [...dias].sort((x, y) => x - y);
}

// ---------- USOS Y CRUCES ----------

// Un uso concreto de un recurso: quién lo ocupa y cuándo.
export interface UsoRecurso {
  recurso: string;              // nombre normalizado del espacio/herramienta
  titular: string;              // departamento o proceso que lo usa
  origen: 'departamento' | 'proceso';
  horarioTexto: string;
  franja: FranjaHoraria | null; // null = no se pudo interpretar
}

export interface CruceAgenda {
  recurso: string;
  dia: number;
  a: UsoRecurso;
  b: UsoRecurso;
  desde: number;  // inicio del solape
  hasta: number;
}

export function normalizarRecurso(nombre: string): string {
  return sinAcentos(nombre).trim();
}

// Dos usos del MISMO recurso que se pisan el mismo día. Distinto titular = choque real
// (el mismo titular usándolo dos veces no es un conflicto entre áreas).
export function detectarCruces(usos: UsoRecurso[]): CruceAgenda[] {
  const cruces: CruceAgenda[] = [];
  for (let i = 0; i < usos.length; i++) {
    for (let j = i + 1; j < usos.length; j++) {
      const a = usos[i]!, b = usos[j]!;
      if (a.franja === null || b.franja === null) continue;
      if (normalizarRecurso(a.recurso) !== normalizarRecurso(b.recurso)) continue;
      if (a.titular === b.titular) continue;
      const desde = Math.max(a.franja.desde, b.franja.desde);
      const hasta = Math.min(a.franja.hasta, b.franja.hasta);
      if (desde >= hasta) continue;
      for (const d of a.franja.dias) {
        if (b.franja.dias.includes(d)) cruces.push({ recurso: a.recurso, dia: d, a, b, desde, hasta });
      }
    }
  }
  return cruces;
}

export function hhmm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Rango horario que debe abarcar la agenda (con margen), según lo que haya cargado.
export function ventanaDelDia(usos: UsoRecurso[]): { desde: number; hasta: number } {
  const fr = usos.map((u) => u.franja).filter((f): f is FranjaHoraria => f !== null);
  if (!fr.length) return { desde: 8 * 60, hasta: 20 * 60 };
  const desde = Math.min(...fr.map((f) => f.desde));
  const hasta = Math.max(...fr.map((f) => f.hasta));
  return { desde: Math.max(0, Math.floor(desde / 60) * 60), hasta: Math.min(24 * 60, Math.ceil(hasta / 60) * 60) };
}
