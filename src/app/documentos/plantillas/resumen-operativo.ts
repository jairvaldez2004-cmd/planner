// INC-2 · Plantilla Resumen Operativo de Exportación.
// Deriva de un Plano COM-EXP + atributos operativos del CATÁLOGO (por SKU).
// NO inventa: cada atributo operativo ausente → "⚠ PENDIENTE".
// El plano (snapshot FROZEN) no cambia; los atributos vienen del catálogo como contexto.

import type { PlanoComExp } from '@/domain/plano-com-exp';
import type { AtributosOperativos } from '@/domain/catalogo';

export interface ContenidoResumenOperativo {
  entidad: string;
  totalProductos: number;
  productos: Array<{
    sku: string;
    nombre: string;
    unidad: string;
    empaque: string;
    presentacion: string;
    cantidadMinima: string;
  }>;
}

const PEND = '⚠ PENDIENTE';

export function generarResumenOperativo(
  plano: PlanoComExp,
  atributosPorSku: Record<string, AtributosOperativos>,
): { contenido: ContenidoResumenOperativo; markup: string; pendientes: number } {
  let pendientes = 0;
  const val = (v: string | undefined): string => {
    if (v === undefined || v.trim() === '') { pendientes++; return PEND; }
    return v;
  };

  const productos = plano.productos.map((p) => {
    const a = atributosPorSku[p.sku] ?? {};
    return {
      sku: p.sku,
      nombre: p.nombre,
      unidad: val(a.unidad),
      empaque: val(a.empaque),
      presentacion: val(a.presentacion),
      cantidadMinima: val(a.cantidadMinima),
    };
  });

  const contenido: ContenidoResumenOperativo = {
    entidad: plano.entidad,
    totalProductos: plano.productos.length,
    productos,
  };

  return { contenido, markup: render(contenido), pendientes };
}

function render(c: ContenidoResumenOperativo): string {
  const lines: string[] = [
    '# Resumen Operativo de Exportación',
    '',
    `**Entidad:** ${c.entidad}`,
    `**Productos:** ${c.totalProductos}`,
    '',
    '## Atributos operativos por producto',
    '',
  ];
  for (const p of c.productos) {
    lines.push(`### ${p.sku} — ${p.nombre}`);
    lines.push(`- Unidad de medida: ${p.unidad}`);
    lines.push(`- Empaque: ${p.empaque}`);
    lines.push(`- Presentación: ${p.presentacion}`);
    lines.push(`- Cantidad mínima / formato comercial: ${p.cantidadMinima}`);
    lines.push('');
  }
  lines.push('---');
  lines.push('*Generado por Business Planner — atributos operativos desde el catálogo maestro (INC-2).*');
  return lines.join('\n');
}
