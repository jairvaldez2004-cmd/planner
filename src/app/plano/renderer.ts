// Renderer del plano a Markdown/ASCII (bloque 6, alpha).
// Render puro de un PlanoView; no calcula nada (KPI-1) ni publica. Solo presenta.

import type { PlanoView } from './compositor';

export function renderMarkdown(v: PlanoView): string {
  const out: string[] = [];
  out.push(`# ${v.titulo}`);
  out.push(`> Estado: **${v.estado}** · documento compuesto (lo publica el OS, bloque 7)`);
  for (const sec of v.secciones) {
    out.push('');
    out.push(`## ${sec.titulo}`);
    for (const f of sec.filas) {
      out.push(`- **${f.etiqueta}:** ${f.valor}`);
    }
  }
  return out.join('\n');
}
