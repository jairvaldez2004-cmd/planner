// Generador GENÉRICO de documentos de plano (ADITIVO). El motor de documentos legacy
// (documento-service.ts) solo cubría COM-EXP; los planos de la capa de especialistas no
// producían un documento renderizable, solo readiness. Este módulo cierra ese hueco:
// convierte la config del especialista (bloques/campos/tablas) + lo capturado
// (ProyectoPlanoEstado.campos + TablaProyecto.filas) en Markdown.
//
// INVARIANTE (igual que el compositor FROZEN): el motor NO inventa. Un campo/tabla
// requerido al nivel del proyecto y vacío se marca ⚠ PENDIENTE y se cuenta. Así el
// documento es honesto y trazable, y el mismo dato (una fila de tabla maestra) puede
// alimentar varios planos sin recapturarse (cada plano lo lee con sus columnas de vista).

import type { EspecialistaConfig, Nivel } from './especialistas';
import type { Profundidad } from './diagnostico';
import { tablaBase } from './tablas';
import type { Columna } from './tablas';

export type Fila = Record<string, string>;

export interface CapturaPlano {
  campos: Record<string, string>;      // campoId -> valor
  tablas: Record<string, Fila[]>;      // tablaRef -> filas capturadas
}

export interface ItemDoc {
  bloque: string;
  etiqueta: string;
  requerido: boolean;   // ¿requerido al nivel del proyecto?
  pendiente: boolean;   // requerido y vacío
}

export interface DocumentoPlano {
  planoId: string;
  titulo: string;
  markup: string;
  pendientes: number;   // requeridos al nivel del proyecto que faltan
  totalRequerido: number;
  items: ItemDoc[];
}

const RANK: Record<Nivel, number> = { esencial: 0, estandar: 1, completo: 2 };

function tieneValor(v: string | undefined): boolean {
  return !!v && v.trim().length > 0;
}

// Columnas efectivas de la vista de un especialista sobre una tabla: base + contexto
// (dedup por id, el contexto no re-declara una base). Local para mantener el módulo puro.
function columnasVista(tablaRef: string, contexto: Columna[]): Columna[] {
  const base = tablaBase(tablaRef)?.columnas ?? [];
  const vistas = new Set(base.map((c) => c.id));
  const extra = contexto.filter((c) => !vistas.has(c.id));
  return [...base, ...extra];
}

function tablaMarkdown(columnas: Columna[], filas: Fila[]): string {
  if (columnas.length === 0) return '';
  const head = `| ${columnas.map((c) => c.etiqueta).join(' | ')} |`;
  const sep = `| ${columnas.map(() => '---').join(' | ')} |`;
  const body = filas.map((f) => `| ${columnas.map((c) => (f[c.id] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}`;
}

// Genera el documento de un plano a partir de su config y lo capturado.
export function generarDocumentoPlano(
  cfg: EspecialistaConfig,
  proyectoProf: Profundidad,
  captura: CapturaPlano,
): DocumentoPlano {
  const nivelProyecto = RANK[proyectoProf];
  const requeridoAlNivel = (n: Nivel) => RANK[n] <= nivelProyecto;

  const items: ItemDoc[] = [];
  const partes: string[] = [];
  const pendientesLista: string[] = [];

  partes.push(`# ${cfg.nombre}`);
  partes.push(`> ${cfg.contratoEntrega.descripcion}`);

  for (const b of cfg.bloques) {
    partes.push(`\n## ${b.titulo}`);

    for (const c of b.campos ?? []) {
      const valor = captura.campos[c.id];
      const req = requeridoAlNivel(c.requeridoEn);
      const ok = tieneValor(valor);
      items.push({ bloque: b.titulo, etiqueta: c.pregunta, requerido: req, pendiente: req && !ok });
      if (ok) {
        partes.push(`**${c.pregunta}**\n\n${valor!.trim()}`);
      } else if (req) {
        partes.push(`**${c.pregunta}**\n\n⚠ PENDIENTE`);
        pendientesLista.push(`${b.titulo} · ${c.pregunta}`);
      } else {
        partes.push(`**${c.pregunta}**\n\n_(opcional — sin capturar)_`);
      }
    }

    if (b.tabla) {
      const ref = b.tabla.tablaRef;
      const filas = captura.tablas[ref] ?? [];
      const columnas = columnasVista(ref, b.tabla.columnasContexto ?? []);
      const req = requeridoAlNivel(b.tabla.requeridoEn);
      const ok = filas.length > 0;
      const etiqueta = b.tabla.etiqueta ?? tablaBase(ref)?.nombre ?? ref;
      items.push({ bloque: b.titulo, etiqueta, requerido: req, pendiente: req && !ok });
      if (ok) {
        partes.push(`_${etiqueta} (${filas.length})_\n\n${tablaMarkdown(columnas, filas)}`);
      } else if (req) {
        partes.push(`_${etiqueta}_: ⚠ PENDIENTE — faltan filas (≥1).`);
        pendientesLista.push(`${b.titulo} · ${etiqueta} (tabla)`);
      } else {
        partes.push(`_${etiqueta}_: (opcional — sin filas)`);
      }
    }
  }

  const totalRequerido = items.filter((it) => it.requerido).length;
  const pendientes = pendientesLista.length;
  if (pendientes > 0) {
    partes.push(`\n## ⚠ Pendientes (${pendientes})`);
    partes.push(pendientesLista.map((p) => `- ${p}`).join('\n'));
  } else {
    partes.push(`\n## ✅ Sin pendientes al nivel del proyecto`);
  }

  return {
    planoId: cfg.planoId,
    titulo: cfg.nombre,
    markup: partes.join('\n\n'),
    pendientes,
    totalRequerido,
    items,
  };
}
