'use client';

// Exportación a PDF por librería (html2pdf.js = html2canvas + jsPDF), carga diferida en el
// navegador. Sirve para descargar CUALQUIER sección indexada (un nodo) o el documento completo
// en cascada. Se ignoran los controles marcados con .no-pdf (botones) para que no salgan en el PDF.

function nombreArchivo(base: string): string {
  const limpio = base.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 80);
  return `${limpio || 'documento'}.pdf`;
}

export async function exportarElementoPDF(el: HTMLElement | null, titulo: string): Promise<void> {
  if (!el) return;
  const mod = await import('html2pdf.js');
  const html2pdf = (mod as { default: () => any }).default ?? (mod as unknown as () => any);
  const opt = {
    margin: [10, 10, 12, 10] as [number, number, number, number],
    filename: nombreArchivo(titulo),
    image: { type: 'jpeg', quality: 0.96 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0B0B0E', // fondo oscuro de marca (los entregables son tema oscuro)
      // No incluir en el PDF los botones/controles (evita que salga "⬇ PDF" dentro del PDF).
      ignoreElements: (node: Element) => node.classList?.contains('no-pdf'),
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    // 'avoid-all' empuja el bloque completo a la siguiente página en vez de cortarlo a media
    // línea; así ningún campo/entrada/ficha queda partido entre páginas.
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'], avoid: ['.pdf-keep', 'tr', 'dl', 'section', 'li'] },
  };
  await html2pdf().set(opt).from(el).save();
}
