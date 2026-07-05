// Compositor del plano COM-EXP (bloque 6, alpha).
// Compone un PlanoComExp (dominio) en un modelo de vista por secciones/filas (4E.9-T composición).
// NO publica (eso es el OS, bloque 7). NO inventa: PENDIENTE se rinde como tal.

import type { ConPendiente, PlanoComExp } from '@/domain/plano-com-exp';
import { esPendiente, visibilidadComisionCliente } from '@/domain/plano-com-exp';

export interface FilaPlano {
  etiqueta: string;
  valor: string;
  pendiente?: 'DATO_REAL' | 'DECISION_PROPIETARIO';
}
export interface SeccionPlano {
  titulo: string;
  filas: FilaPlano[];
}
export interface PlanoView {
  titulo: string;
  estado: string;
  secciones: SeccionPlano[];
}

function filaDe<T>(
  etiqueta: string,
  v: ConPendiente<T>,
  fmt: (t: T) => string = (t) => String(t),
): FilaPlano {
  if (esPendiente(v)) {
    return { etiqueta, valor: `⚠ PENDIENTE_${v.__pendiente}`, pendiente: v.__pendiente };
  }
  return { etiqueta, valor: fmt(v) };
}

export function componerPlano(p: PlanoComExp): PlanoView {
  const identidad: SeccionPlano = {
    titulo: 'Identidad',
    filas: [
      { etiqueta: 'Entidad', valor: p.entidad },
      { etiqueta: 'Tipo de plano', valor: 'Comercial · Especialización Exportación (COM-EXP)' },
      { etiqueta: 'Versión', valor: String(p.version) },
      { etiqueta: 'Estado', valor: p.publicado ? 'PUBLICADO' : 'DRAFT (no publicado)' },
    ],
  };

  const productos: SeccionPlano = {
    titulo: 'Productos',
    filas: p.productos.map((pr) => ({
      etiqueta: pr.sku,
      valor: `${pr.nombre} · ${pr.categoria} · carga: ${pr.restriccion}`,
    })),
  };

  const exportacion: SeccionPlano = {
    titulo: 'Exportación',
    filas: p.productos.flatMap((pr) => [
      filaDe(`${pr.sku} · HS code`, pr.hsCode),
      filaDe(`${pr.sku} · Incoterm`, pr.incotermSugerido),
      filaDe(`${pr.sku} · Puerto`, pr.puertoSalida),
      filaDe(`${pr.sku} · Certificado origen`, pr.certificadoOrigenRequerido, (b) => (b ? 'requerido' : 'no')),
      filaDe(`${pr.sku} · Precio`, pr.precio, (x) => `${x.monto} ${x.moneda}`),
    ]),
  };

  const comision: SeccionPlano = {
    titulo: 'Comisión ALV',
    filas:
      p.cotizaciones.length === 0
        ? [{ etiqueta: 'Cotizaciones', valor: '— (sin cotizaciones en el draft)' }]
        : p.cotizaciones.map((c) => ({
            etiqueta: `Cotización ${c.id}`,
            valor: `payer=${c.comisionPayer} · visibilidad cliente=${visibilidadComisionCliente(c.comisionPayer)}`,
          })),
  };

  const baseSecciones: SeccionPlano[] = [identidad, productos, exportacion, comision];

  // Consolidar pendientes desde las filas marcadas.
  const filasPendientes: FilaPlano[] = baseSecciones
    .flatMap((s) => s.filas)
    .filter((f) => f.pendiente !== undefined)
    .map((f) => ({ etiqueta: f.etiqueta, valor: `PENDIENTE_${f.pendiente ?? 'DATO_REAL'}` }));

  const pendientes: SeccionPlano = {
    titulo: 'Pendientes',
    filas: filasPendientes.length === 0 ? [{ etiqueta: 'Pendientes', valor: 'ninguno' }] : filasPendientes,
  };

  return {
    titulo: `Plano Comercial-EXP — ${p.entidad}`,
    estado: p.publicado ? 'PUBLICADO' : 'DRAFT',
    secciones: [...baseSecciones, pendientes],
  };
}
