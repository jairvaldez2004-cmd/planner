// SIMULACIÓN EMPRESARIAL (pura, ADITIVO). Una "corrida" del negocio en papel para VALIDAR la
// lógica del diseño ANTES de publicar y generar el software operativo (ref manual PARTE II.5).
// Une lo que ya existe: la simulación de operación del Mapa (cuellos/recorrido), el inventario
// (consumo vs stock), el roster (nómina), los costos/ingresos y las contingencias. Marca lo que
// falta como PENDIENTE y devuelve HALLAZGOS (incoherencias/huecos) + un VEREDICTO de coherencia.
// No inventa cifras: donde no hay dato real, lo dice.

import type { ProcesoNodo } from './mapa';
import type { Producto, Proveedor } from './recursos';
import type { Empleado } from './rh';
import { numero } from './recursos';
import { simular } from './simulacion';

export interface SupuestosSim {
  serviciosPorDia: number;      // 0 = usar la capacidad máxima calculada
  diasPorMes: number;
  horasOperativas: number;      // horas de operación por día
  tiempoPorServicioMin: number; // duración de UN servicio típico (0 = estimar de los procesos)
}
export const SUPUESTOS_DEFAULT: SupuestosSim = { serviciosPorDia: 0, diasPorMes: 26, horasOperativas: 8, tiempoPorServicioMin: 40 };

export interface OfertaSim { nombre: string; precio: string }
export interface CostoSim { concepto: string; monto: string }

export interface EntradaSim {
  procesos: ProcesoNodo[];
  productos: Producto[];
  empleados: Empleado[];
  ofertas: OfertaSim[];
  costos: CostoSim[];
  proveedores: Proveedor[];
  contingencias: number; // # de manuales de contingencia definidos
}

export interface LineaConsumo { insumo: string; porServicio: number; porMes: number; unidad: string; stockActual: number | null; diasCobertura: number | null; enCatalogo: boolean; alerta: boolean }

export interface ReporteSimulacion {
  supuestos: SupuestosSim;
  capacidad: { tiempoPorServicioMin: number; tiempoTotalMapaMin: number; cabinas: number; serviciosPorDiaMax: number; cuelloEspacio: string; cuelloRol: string };
  produccion: { serviciosPorDia: number; serviciosPorMes: number };
  consumo: LineaConsumo[];
  nomina: { personasInternas: number; mensualConocido: number; personasSinCifra: number };
  costosMes: { total: number | null; lineas: number; pendientes: number };
  ingresos: { total: number | null; fuentes: number; sinPrecio: number };
  riesgos: { contingencias: number; proveedoresUnicosSinPlanB: number };
  hallazgos: string[];
  veredicto: 'coherente' | 'con-observaciones' | 'bloqueado';
}

// "2 pzas", "50 ml", "1 caja" → 2 / 50 / 1. Sin número → 1 (se asume una unidad).
function cantidadInsumo(txt: string | undefined): number {
  const n = numero(txt ?? '');
  return n !== null && n > 0 ? n : 1;
}

export function simularEmpresa(input: EntradaSim, sup: SupuestosSim = SUPUESTOS_DEFAULT): ReporteSimulacion {
  const raiz = input.procesos.filter((p) => !p.padreProcesoId);
  const hallazgos: string[] = [];

  // 1) OPERACIÓN — reusa la simulación del Mapa: cuellos por espacio/rol y el tiempo TOTAL de
  //    todos los procesos del mapa (no es "un servicio": el mapa tiene varios flujos + admin).
  const op = simular(raiz);
  const tiempoTotalMapa = op.totalMin;

  // 2) CAPACIDAD — cuántos servicios/día caben. El tiempo de UN servicio típico es un SUPUESTO
  //    (no la suma de todo el mapa); si no se da, se estima con el promedio de los procesos con tiempo.
  const conTiempo = raiz.map((p) => p.tiempoMin).filter((t): t is number => !!t);
  const estimado = conTiempo.length ? Math.round(conTiempo.reduce((s, t) => s + t, 0) / conTiempo.length) : 0;
  const tiempoPorServicio = sup.tiempoPorServicioMin > 0 ? sup.tiempoPorServicioMin : estimado;
  const cabinasSet = new Set<string>();
  for (const p of raiz) for (const e of p.espacios) if (/cabina/i.test(e.nombre)) cabinasSet.add(e.nombre.toLowerCase());
  const cabinas = Math.max(1, cabinasSet.size);
  const serviciosPorDiaMax = tiempoPorServicio > 0 ? Math.floor((sup.horasOperativas * 60 * cabinas) / tiempoPorServicio) : 0;
  const serviciosPorDia = sup.serviciosPorDia > 0 ? sup.serviciosPorDia : serviciosPorDiaMax;
  const serviciosPorMes = serviciosPorDia * sup.diasPorMes;

  // 3) CONSUMO — insumos consumidos por servicio × volumen del mes; ¿aguanta el stock?
  const prodPorNombre = new Map(input.productos.map((p) => [p.nombre.trim().toLowerCase(), p]));
  const porServicio = new Map<string, { qty: number; unidad: string }>();
  for (const p of raiz) for (const ins of p.insumos) {
    const k = ins.trim().toLowerCase(); if (!k) continue;
    const prev = porServicio.get(k) ?? { qty: 0, unidad: prodPorNombre.get(k)?.unidad ?? '' };
    prev.qty += cantidadInsumo(p.cantidades?.[ins]);
    porServicio.set(k, prev);
  }
  const consumo: LineaConsumo[] = Array.from(porServicio.entries()).map(([k, v]) => {
    const prod = prodPorNombre.get(k);
    const porMes = v.qty * serviciosPorMes;
    const stock = prod ? numero(prod.stockActual) : null;
    const consumoDia = porMes / Math.max(1, sup.diasPorMes);
    const diasCobertura = stock !== null && consumoDia > 0 ? Math.round((stock / consumoDia) * 10) / 10 : null;
    const reorden = prod ? numero(prod.puntoReorden) : null;
    const alerta = (stock !== null && reorden !== null && stock <= reorden) || (diasCobertura !== null && diasCobertura < sup.diasPorMes);
    return { insumo: prod?.nombre ?? k, porServicio: v.qty, porMes, unidad: v.unidad, stockActual: stock, diasCobertura, enCatalogo: !!prod, alerta };
  }).sort((a, b) => Number(b.alerta) - Number(a.alerta));

  // 4) NÓMINA — personas internas activas; cifras conocidas vs PENDIENTE.
  const internos = input.empleados.filter((e) => !e.externo && e.estado !== 'baja' && (e.nombre.trim() || e.puesto.trim()));
  const nominas = internos.map((e) => numero(e.nomina));
  const mensualConocido = nominas.reduce<number>((s, n) => s + (n ?? 0), 0);
  const personasSinCifra = nominas.filter((n) => n === null).length;

  // 5) COSTOS e INGRESOS mensuales — suman lo que tenga cifra; el resto PENDIENTE.
  const costosNum = input.costos.map((c) => numero(c.monto));
  const costosConocidos = costosNum.filter((n): n is number => n !== null);
  const costosMes = { total: costosConocidos.length ? costosConocidos.reduce((s, n) => s + n, 0) : null, lineas: input.costos.length, pendientes: costosNum.filter((n) => n === null).length };
  const ingresosNum = input.ofertas.map((o) => numero(o.precio));
  const ingresosConocidos = ingresosNum.filter((n): n is number => n !== null);
  const ingresos = { total: ingresosConocidos.length ? ingresosConocidos.reduce((s, n) => s + n, 0) : null, fuentes: input.ofertas.length, sinPrecio: ingresosNum.filter((n) => n === null).length };

  // 6) RIESGOS
  const proveedoresUnicosSinPlanB = input.proveedores.filter((p) => p.proveedorUnico && !p.planB && !p.proveedorAlternativo).length;

  // 7) HALLAZGOS (incoherencias / huecos que hay que resolver antes de publicar)
  if (raiz.length === 0) hallazgos.push('No hay procesos en el Mapa Operativo: no se puede simular la operación.');
  if (tiempoPorServicio === 0) hallazgos.push('Sin tiempos en los procesos y sin supuesto de duración: no se puede calcular capacidad. Define el "tiempo por servicio".');
  const sinResp = raiz.filter((p) => p.roles.length === 0);
  if (sinResp.length) hallazgos.push(`${sinResp.length} proceso(s) sin responsable (rol): "${sinResp.slice(0, 3).map((p) => p.nombre).join('", "')}".`);
  const sinCatalogo = consumo.filter((c) => !c.enCatalogo);
  if (sinCatalogo.length) hallazgos.push(`${sinCatalogo.length} insumo(s) que se consumen NO están en el catálogo (sin costo ni stock): "${sinCatalogo.slice(0, 3).map((c) => c.insumo).join('", "')}".`);
  const seAgotan = consumo.filter((c) => c.enCatalogo && c.alerta);
  if (seAgotan.length) hallazgos.push(`${seAgotan.length} insumo(s) se agotarían al ritmo simulado (${serviciosPorDia}/día): "${seAgotan.slice(0, 3).map((c) => c.insumo).join('", "')}".`);
  if (ingresos.sinPrecio) hallazgos.push(`${ingresos.sinPrecio} de ${ingresos.fuentes} fuente(s) de ingreso SIN precio: no se puede proyectar la venta.`);
  if (personasSinCifra) hallazgos.push(`${personasSinCifra} persona(s) sin cifra de nómina: no se puede proyectar el costo de personal.`);
  if (costosMes.pendientes) hallazgos.push(`${costosMes.pendientes} de ${costosMes.lineas} costo(s) sin monto: el costo mensual queda incompleto.`);
  if (proveedoresUnicosSinPlanB) hallazgos.push(`${proveedoresUnicosSinPlanB} proveedor(es) ÚNICO(S) sin plan B: riesgo de paro de operación.`);
  if (input.contingencias === 0) hallazgos.push('No hay manuales de contingencia definidos para los riesgos de la operación.');
  if (op.cuelloEspacio) hallazgos.push(`Cuello de botella de espacio: "${op.cuelloEspacio.nombre}" es el que más carga acumula (${op.cuelloEspacio.minutos} min sumando sus procesos).`);

  // 8) VEREDICTO
  const bloqueante = raiz.length === 0 || tiempoPorServicio === 0;
  const veredicto: ReporteSimulacion['veredicto'] = bloqueante ? 'bloqueado' : (hallazgos.length ? 'con-observaciones' : 'coherente');

  return {
    supuestos: { ...sup, serviciosPorDia },
    capacidad: { tiempoPorServicioMin: tiempoPorServicio, tiempoTotalMapaMin: tiempoTotalMapa, cabinas, serviciosPorDiaMax, cuelloEspacio: op.cuelloEspacio?.nombre ?? '—', cuelloRol: op.cuelloRol?.nombre ?? '—' },
    produccion: { serviciosPorDia, serviciosPorMes },
    consumo, nomina: { personasInternas: internos.length, mensualConocido, personasSinCifra },
    costosMes, ingresos, riesgos: { contingencias: input.contingencias, proveedoresUnicosSinPlanB },
    hallazgos, veredicto,
  };
}
