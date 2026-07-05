// Plantilla piloto: Resumen Comercial derivado de un Plano COM-EXP.
// Si el plano cambia, el documento se puede regenerar sin perder el historial anterior.
// NO inventa: campos sin dato en el plano → "⚠ PENDIENTE".

import type { PlanoComExp } from '@/domain/plano-com-exp';
import { esPendiente } from '@/domain/plano-com-exp';

export interface ContenidoResumenComercial {
  entidad: string;
  totalProductos: number;
  totalCotizaciones: number;
  productos: Array<{
    sku: string;
    nombre: string;
    incoterm: string;
    puerto: string;
    precio: string;
  }>;
  cotizaciones: Array<{
    skus: string;
    incoterm: string;
    puerto: string;
    comision: string;
  }>;
}

export function generarResumenComercial(plano: PlanoComExp): {
  contenido: ContenidoResumenComercial;
  markup: string;
  pendientes: number;
} {
  let pendientes = 0;

  const productos = plano.productos.map((p) => {
    let incoterm: string;
    if (esPendiente(p.incotermSugerido)) { pendientes++; incoterm = '⚠ PENDIENTE'; }
    else { incoterm = p.incotermSugerido; }

    let puerto: string;
    if (esPendiente(p.puertoSalida)) { pendientes++; puerto = '⚠ PENDIENTE'; }
    else { puerto = p.puertoSalida; }

    let precio: string;
    if (esPendiente(p.precio)) { pendientes++; precio = '⚠ PENDIENTE'; }
    else { precio = `${p.precio.monto} ${p.precio.moneda}`; }

    return { sku: p.sku, nombre: p.nombre, incoterm, puerto, precio };
  });

  const cotizaciones = plano.cotizaciones.map((c) => ({
    skus: c.productoIds.join(', '),
    incoterm: c.incoterm,
    puerto: c.puerto,
    comision: c.comisionPayer,
  }));

  const contenido: ContenidoResumenComercial = {
    entidad: plano.entidad,
    totalProductos: plano.productos.length,
    totalCotizaciones: plano.cotizaciones.length,
    productos,
    cotizaciones,
  };

  return { contenido, markup: renderResumen(contenido), pendientes };
}

function renderResumen(c: ContenidoResumenComercial): string {
  const lines: string[] = [
    '# Resumen Comercial',
    '',
    `**Entidad:** ${c.entidad}`,
    `**Productos:** ${c.totalProductos}`,
    `**Cotizaciones:** ${c.totalCotizaciones}`,
    '',
    '## Productos',
    '',
  ];

  for (const p of c.productos) {
    lines.push(`### ${p.sku} — ${p.nombre}`);
    lines.push(`- Incoterm: ${p.incoterm}`);
    lines.push(`- Puerto de salida: ${p.puerto}`);
    lines.push(`- Precio unitario: ${p.precio}`);
    lines.push('');
  }

  if (c.cotizaciones.length > 0) {
    lines.push('## Cotizaciones');
    lines.push('');
    for (const cot of c.cotizaciones) {
      lines.push(`- SKUs: ${cot.skus} | ${cot.incoterm} | ${cot.puerto} | Payer: ${cot.comision}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generado por Business Planner — motor genérico de documentos.*');
  return lines.join('\n');
}
