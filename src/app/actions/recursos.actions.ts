'use server';

// Server Actions de RECURSOS & PROVEEDORES (ADITIVO). Ambos viven como filas JSON en
// TablaProyecto ('recursos' y 'proveedores'), sin cambio de schema. Alimentan FIN/TEC/COM.

import { Prisma } from '@prisma/client';
import { prisma } from '@/adapters/persistence/prisma-client';
import { normalizarRecurso, normalizarProveedor, normalizarProducto, normalizarVinculo, normalizarOrden, normalizarContrato, normalizarIncidencia, normalizarInteraccion, normalizarEmbarque } from '@/domain/recursos';
import type { Recurso, Proveedor, Producto, ProductoProveedor, OrdenCompra, Contrato, Incidencia, Interaccion, Embarque } from '@/domain/recursos';
import {
  planearCompra, precioVigente, proveedorMasBarato, vinculosDeProducto, estadoContrato, scoreProveedor,
  solicitudDesdeProducto, incidenciaVacia, ordenVacia, redactarSolicitudCotizacion,
  interaccionVacia, vinculoVacio, registrarCambioPrecio, seguimientosPendientes, ultimoContacto,
  embarqueVacio, landedCostEmbarque, embarqueRetrasado, estadoEmbarqueInfo, modalidadEnvioInfo,
} from '@/domain/recursos';
import { enviarCorreo } from '@/adapters/email/enviar';
import { correrCentroAbastecimiento } from '@/adapters/ai/arquitecto-agent';
import type { EjecutorHerramienta, MensajeChat } from '@/adapters/ai/arquitecto-agent';
import { cargarConversacion, guardarConversacion } from '@/app/actions/contexto.actions';
import { modeloActual } from '@/app/actions/config.actions';

function toJson(v: unknown): Prisma.InputJsonValue { return v as unknown as Prisma.InputJsonValue; }
function nowISO(): string { return new Date().toISOString(); }
function nid(p: string): string { return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }

async function listar<T>(proyectoId: string, ref: string, norm: (v: unknown) => T): Promise<T[]> {
  const r = await prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef: ref } } });
  const filas = r && Array.isArray(r.filas) ? (r.filas as unknown[]) : [];
  return filas.map(norm);
}
async function guardarLista(proyectoId: string, ref: string, lista: unknown[]): Promise<void> {
  await prisma.tablaProyecto.upsert({
    where: { proyectoId_tablaRef: { proyectoId, tablaRef: ref } },
    create: { proyectoId, tablaRef: ref, filas: toJson(lista), actualizadoEn: nowISO() },
    update: { filas: toJson(lista), actualizadoEn: nowISO() },
  });
}

// --- Recursos ---
export async function listarRecursos(proyectoId: string): Promise<Recurso[]> { return listar(proyectoId, 'recursos', normalizarRecurso); }
export async function guardarRecurso(proyectoId: string, r: Recurso): Promise<Recurso> {
  const lista = await listarRecursos(proyectoId);
  const id = r.id?.trim() || nid('REC');
  const norm = normalizarRecurso({ ...r, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'recursos', lista);
  return norm;
}
export async function eliminarRecurso(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'recursos', (await listarRecursos(proyectoId)).filter((x) => x.id !== id));
}

// --- Proveedores ---
export async function listarProveedores(proyectoId: string): Promise<Proveedor[]> { return listar(proyectoId, 'proveedores_dir', normalizarProveedor); }
export async function guardarProveedor(proyectoId: string, p: Proveedor): Promise<Proveedor> {
  const lista = await listarProveedores(proyectoId);
  const id = p.id?.trim() || nid('PRV');
  const norm = normalizarProveedor({ ...p, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'proveedores_dir', lista);
  return norm;
}
export async function eliminarProveedor(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'proveedores_dir', (await listarProveedores(proyectoId)).filter((x) => x.id !== id));
  // Al borrar un proveedor, se quitan sus vínculos con productos (limpieza del muchos-a-muchos).
  await guardarLista(proyectoId, 'producto_proveedor', (await listarVinculos(proyectoId)).filter((v) => v.proveedorId !== id));
}

// --- Productos (maestro) ---
export async function listarProductos(proyectoId: string): Promise<Producto[]> { return listar(proyectoId, 'productos', normalizarProducto); }
export async function guardarProducto(proyectoId: string, p: Producto): Promise<Producto> {
  const lista = await listarProductos(proyectoId);
  const id = p.id?.trim() || nid('PROD');
  const norm = normalizarProducto({ ...p, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'productos', lista);
  return norm;
}
export async function eliminarProducto(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'productos', (await listarProductos(proyectoId)).filter((x) => x.id !== id));
  await guardarLista(proyectoId, 'producto_proveedor', (await listarVinculos(proyectoId)).filter((v) => v.productoId !== id));
}

// --- Vínculos producto ↔ proveedor (muchos-a-muchos + info comercial + historial de precios) ---
export async function listarVinculos(proyectoId: string): Promise<ProductoProveedor[]> { return listar(proyectoId, 'producto_proveedor', normalizarVinculo); }
export async function guardarVinculo(proyectoId: string, v: ProductoProveedor): Promise<ProductoProveedor> {
  const lista = await listarVinculos(proyectoId);
  const id = v.id?.trim() || nid('PP');
  const norm = normalizarVinculo({ ...v, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'producto_proveedor', lista);
  return norm;
}
export async function eliminarVinculo(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'producto_proveedor', (await listarVinculos(proyectoId)).filter((x) => x.id !== id));
}

// --- Órdenes de compra (flujo de compras, Sección 13) ---
export async function listarOrdenes(proyectoId: string): Promise<OrdenCompra[]> { return listar(proyectoId, 'ordenes_compra', normalizarOrden); }
export async function guardarOrden(proyectoId: string, o: OrdenCompra): Promise<OrdenCompra> {
  const lista = await listarOrdenes(proyectoId);
  const id = o.id?.trim() || nid('OC');
  const norm = normalizarOrden({ ...o, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'ordenes_compra', lista);
  return norm;
}
export async function eliminarOrden(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'ordenes_compra', (await listarOrdenes(proyectoId)).filter((x) => x.id !== id));
}

// --- Contratos (Sección 7) ---
export async function listarContratos(proyectoId: string): Promise<Contrato[]> { return listar(proyectoId, 'contratos', normalizarContrato); }
export async function guardarContrato(proyectoId: string, c: Contrato): Promise<Contrato> {
  const lista = await listarContratos(proyectoId);
  const id = c.id?.trim() || nid('CTR');
  const norm = normalizarContrato({ ...c, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'contratos', lista);
  return norm;
}
export async function eliminarContrato(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'contratos', (await listarContratos(proyectoId)).filter((x) => x.id !== id));
}

// --- Incidencias de calidad (Sección 8) ---
export async function listarIncidencias(proyectoId: string): Promise<Incidencia[]> { return listar(proyectoId, 'incidencias', normalizarIncidencia); }
export async function guardarIncidencia(proyectoId: string, inc: Incidencia): Promise<Incidencia> {
  const lista = await listarIncidencias(proyectoId);
  const id = inc.id?.trim() || nid('INC');
  const norm = normalizarIncidencia({ ...inc, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'incidencias', lista);
  return norm;
}
export async function eliminarIncidencia(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'incidencias', (await listarIncidencias(proyectoId)).filter((x) => x.id !== id));
}

// --- Embarques (logística: consolidación + landed cost) ---
export async function listarEmbarques(proyectoId: string): Promise<Embarque[]> { return listar(proyectoId, 'embarques', normalizarEmbarque); }
export async function guardarEmbarque(proyectoId: string, e: Embarque): Promise<Embarque> {
  const lista = await listarEmbarques(proyectoId);
  const id = e.id?.trim() || nid('EMB');
  const norm = normalizarEmbarque({ ...e, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'embarques', lista);
  return norm;
}
export async function eliminarEmbarque(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'embarques', (await listarEmbarques(proyectoId)).filter((x) => x.id !== id));
}

// --- Bitácora de interacciones con proveedores (CRM / relación comercial) ---
export async function listarInteracciones(proyectoId: string): Promise<Interaccion[]> { return listar(proyectoId, 'interacciones_prov', normalizarInteraccion); }
export async function guardarInteraccion(proyectoId: string, inc: Interaccion): Promise<Interaccion> {
  const lista = await listarInteracciones(proyectoId);
  const id = inc.id?.trim() || nid('INT');
  const norm = normalizarInteraccion({ ...inc, id });
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, 'interacciones_prov', lista);
  return norm;
}
export async function eliminarInteraccion(proyectoId: string, id: string): Promise<void> {
  await guardarLista(proyectoId, 'interacciones_prov', (await listarInteracciones(proyectoId)).filter((x) => x.id !== id));
}

// =================== CENTRO DE ABASTECIMIENTO INTELIGENTE (IA) ===================
function sumarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
// Snapshot que ve la IA cada turno: productos con plan de compra, proveedores con score/riesgo,
// órdenes abiertas y contratos con estado. Es la base sobre la que razona y actúa.
async function snapshotAbastecimiento(proyectoId: string): Promise<string> {
  const [prods, vinc, provs, ocs, ctrs, incs, ints, embs] = await Promise.all([
    listarProductos(proyectoId), listarVinculos(proyectoId), listarProveedores(proyectoId),
    listarOrdenes(proyectoId), listarContratos(proyectoId), listarIncidencias(proyectoId), listarInteracciones(proyectoId), listarEmbarques(proyectoId),
  ]);
  const hoy = new Date().toISOString().slice(0, 10);
  const provById = new Map(provs.map((p) => [p.id, p]));
  const nom = (id: string) => provById.get(id)?.nombre ?? '?';
  const L: string[] = [];
  L.push(`# Estado de abastecimiento — se actualiza cada turno. Hoy: ${hoy}`);
  const pend = seguimientosPendientes(provs, hoy);
  if (pend.length) L.push(`⏰ SEGUIMIENTOS PENDIENTES HOY (${pend.length}): ${pend.map((p) => `${p.nombre} (desde ${p.proximoSeguimiento})`).join(' · ')}`);
  L.push(`Productos (${prods.length}):`);
  for (const p of prods) {
    const plan = planearCompra(p, hoy);
    const barato = proveedorMasBarato(vinc, p.id);
    const nProv = vinculosDeProducto(vinc, p.id).length;
    L.push(`  · "${p.nombre}" [${p.categoria}] — stock ${p.stockActual || '?'}/${p.stockMaximo || '?'} · ${plan.diasCobertura !== null ? `${plan.diasCobertura}d cobertura` : 'sin consumo'} · PLAN: ${plan.accion.toUpperCase()} (${plan.motivo})${plan.cantidadSugerida !== null ? ` · sugerido pedir ${plan.cantidadSugerida}` : ''} · ${nProv} proveedor(es)${barato ? `, + barato: ${nom(barato.proveedorId)} a ${precioVigente(barato)} ${barato.moneda}` : ''}`);
  }
  if (!prods.length) L.push('  (sin productos capturados)');
  L.push(`Proveedores (${provs.length}):`);
  for (const p of provs) {
    const sc = scoreProveedor(p, incs);
    const uc = ultimoContacto(p.id, ints);
    const rel = `relación ${p.estadoRelacion || 's/def'}${uc ? ` · últ. contacto ${uc}` : ' · sin contacto'}${p.proximoSeguimiento ? ` · próx. seguimiento ${p.proximoSeguimiento}` : ''}`;
    L.push(`  · "${p.nombre}"${p.contacto ? ` (contacto: ${p.contacto})` : ''}${p.email ? ` <${p.email}>` : ' [SIN correo]'} — score ${sc.score ?? 's/e'} (${sc.nivel})${p.proveedorUnico ? ' · ÚNICO' : ''}${p.planB ? ` · planB: ${p.planB}` : (p.proveedorUnico ? ' · SIN plan B' : '')} · ${sc.incidencias} incidencia(s) · ${rel} · categorías: ${p.categorias.join(', ') || '—'}`);
  }
  const abiertas = ocs.filter((o) => o.etapa !== 'cerrada');
  L.push(`Órdenes de compra abiertas (${abiertas.length} de ${ocs.length}):`);
  for (const o of abiertas) L.push(`  · "${o.descripcion || '(compra)'}" — etapa ${o.etapa}${o.proveedorId ? ` · ${nom(o.proveedorId)}` : ''}${o.cantidad ? ` · ${o.cantidad} ${o.unidad}` : ''}`);
  L.push(`Contratos (${ctrs.length}):`);
  for (const c of ctrs) {
    const info = estadoContrato(c, hoy);
    L.push(`  · "${c.titulo || '(sin título)'}" — ${info.estado}${info.diasRestantes !== null ? ` (${info.diasRestantes}d)` : ''}${c.proveedorId ? ` · ${nom(c.proveedorId)}` : ''}${c.renovacionAutomatica ? ' · renovación auto' : ''}`);
  }
  const retrasados = embs.filter((e) => embarqueRetrasado(e, hoy));
  L.push(`Embarques (${embs.length}${retrasados.length ? `, ${retrasados.length} RETRASADO(S)` : ''}):`);
  for (const e of embs) {
    const lc = landedCostEmbarque(e, ocs);
    L.push(`  · "${e.folio || e.destino || 'embarque'}" — ${modalidadEnvioInfo(e.modalidad).label} · ${estadoEmbarqueInfo(e.estado).label}${e.transportista ? ` · ${e.transportista}` : ''}${e.tracking ? ` · guía ${e.tracking}` : ''}${e.fechaEstimada ? ` · ETA ${e.fechaEstimada}${embarqueRetrasado(e, hoy) ? ' ⚠RETRASADO' : ''}` : ''} · ${e.ordenIds.length} orden(es) · landed ${lc.total.toFixed(2)} (log ${lc.logistica.toFixed(2)}, ×${lc.factor.toFixed(2)})`);
  }
  return L.join('\n');
}

export async function conversarCentroAbastecimiento(
  historial: MensajeChat[],
  proyectoId: string,
): Promise<{ reply: string; refrescar: boolean }> {
  const porNombre = <T extends { nombre: string }>(xs: T[], n: string): T | undefined => {
    const k = n.trim().toLowerCase();
    return xs.find((x) => x.nombre.trim().toLowerCase() === k) ?? xs.find((x) => x.nombre.toLowerCase().includes(k));
  };
  const hoy = new Date().toISOString().slice(0, 10);

  const bitacora = async (proveedorId: string, tipo: string, resumen: string, direccion: 'saliente' | 'entrante', canal: string, ordenId = '') => {
    await guardarInteraccion(proyectoId, { ...interaccionVacia('', proveedorId), tipo, resumen, direccion, canal, fecha: hoy, ordenId });
  };

  const ejecutar: EjecutorHerramienta = async (nombre, input) => {
    try {
      if (nombre === 'enviar_correo') {
        const provs = await listarProveedores(proyectoId);
        const prov = porNombre(provs, String(input.proveedor ?? ''));
        if (!prov) return `No encontré el proveedor "${String(input.proveedor ?? '')}".`;
        const asunto = String(input.asunto ?? '').trim();
        const cuerpo = String(input.cuerpo ?? '').trim();
        if (!asunto || !cuerpo) return 'Faltan asunto o cuerpo del correo.';
        const dias = typeof input.proximoSeguimientoDias === 'number' ? input.proximoSeguimientoDias : null;
        if (dias !== null) await guardarProveedor(proyectoId, { ...prov, proximoSeguimiento: sumarDias(hoy, dias) });
        if (!prov.email) { await bitacora(prov.id, 'correo enviado', `(SIN correo) ${asunto}`, 'saliente', 'correo'); return `⚠ ${prov.nombre} no tiene correo registrado. Redacté el correo pero no se envió; registré la gestión y ${dias !== null ? `programé seguimiento en ${dias}d` : 'sin seguimiento'}.`; }
        const r = await enviarCorreo(prov.email, asunto, cuerpo);
        await bitacora(prov.id, 'correo enviado', `${r.enviado ? '[enviado]' : '[borrador]'} ${asunto}`, 'saliente', 'correo');
        return `${prov.nombre} (${prov.email}): ${r.enviado ? '✅ correo enviado' : `📝 borrador (${r.motivo})`}${dias !== null ? ` · seguimiento en ${dias}d` : ''}.`;
      }

      if (nombre === 'registrar_respuesta') {
        const [provs, prods, vincs] = await Promise.all([listarProveedores(proyectoId), listarProductos(proyectoId), listarVinculos(proyectoId)]);
        const prov = porNombre(provs, String(input.proveedor ?? ''));
        if (!prov) return `No encontré el proveedor "${String(input.proveedor ?? '')}".`;
        const resumen = String(input.resumen ?? 'Respuesta del proveedor');
        await bitacora(prov.id, 'respuesta', resumen, 'entrante', 'correo');
        let detalle = '';
        const precio = String(input.precio ?? '').trim();
        const prod = input.producto ? porNombre(prods, String(input.producto)) : undefined;
        if (prod) {
          let v = vincs.find((x) => x.productoId === prod.id && x.proveedorId === prov.id);
          if (!v) v = await guardarVinculo(proyectoId, { ...vinculoVacio('', prod.id, prov.id) });
          const patch = { ...v,
            ...(input.moneda ? { moneda: String(input.moneda) } : {}),
            ...(input.tiempoEntrega ? { tiempoEntrega: String(input.tiempoEntrega) } : {}),
            ...(input.cantidadMinima ? { cantidadMinima: String(input.cantidadMinima) } : {}),
          };
          const conPrecio = precio ? registrarCambioPrecio(patch, { fecha: hoy, precio, moneda: String(input.moneda ?? patch.moneda), quien: 'proveedor', motivo: 'cotización recibida', documento: '' }) : patch;
          await guardarVinculo(proyectoId, conPrecio);
          detalle = ` Actualicé el vínculo de "${prod.nombre}"${precio ? ` (precio ${precio}, al historial)` : ''}.`;
        }
        return `Registré la respuesta de ${prov.nombre}.${detalle}`;
      }

      if (nombre === 'registrar_interaccion') {
        const provs = await listarProveedores(proyectoId);
        const prov = porNombre(provs, String(input.proveedor ?? ''));
        if (!prov) return `No encontré el proveedor "${String(input.proveedor ?? '')}".`;
        const tipo = String(input.tipo ?? 'nota');
        const dir = tipo === 'respuesta' ? 'entrante' : 'saliente';
        await bitacora(prov.id, tipo, String(input.resumen ?? ''), dir, String(input.canal ?? ''));
        const dias = typeof input.proximoSeguimientoDias === 'number' ? input.proximoSeguimientoDias : null;
        const estado = input.estadoRelacion ? String(input.estadoRelacion) : '';
        if (dias !== null || estado) {
          await guardarProveedor(proyectoId, { ...prov, ...(dias !== null ? { proximoSeguimiento: sumarDias(hoy, dias) } : {}), ...(estado ? { estadoRelacion: estado } : {}) });
        }
        return `Anoté "${tipo}" en la bitácora de ${prov.nombre}${dias !== null ? ` · próximo seguimiento en ${dias}d` : ''}${estado ? ` · relación: ${estado}` : ''}.`;
      }

      if (nombre === 'solicitar_cotizaciones') {
        const [prods, provs] = await Promise.all([listarProductos(proyectoId), listarProveedores(proyectoId)]);
        const prod = porNombre(prods, String(input.producto ?? ''));
        if (!prod) return `No encontré el producto "${String(input.producto ?? '')}".`;
        const nombres = Array.isArray(input.proveedores) ? input.proveedores.map((x) => String(x)) : [];
        if (!nombres.length) return 'Indica al menos un proveedor.';
        const cantidad = typeof input.cantidad === 'number' ? input.cantidad : null;
        const extra = String(input.mensaje ?? '');
        const lineas: string[] = [];
        for (const n of nombres) {
          const prov = porNombre(provs, n);
          if (!prov) { lineas.push(`• "${n}": no encontrado en el directorio.`); continue; }
          const { asunto, cuerpo } = redactarSolicitudCotizacion(prod, prov.nombre, cantidad, '', extra);
          // Deja constancia: una orden en etapa "cotizacion" por proveedor (proceso de compra).
          await guardarOrden(proyectoId, { ...ordenVacia(''), etapa: 'cotizacion', productoId: prod.id, proveedorId: prov.id, descripcion: prod.nombre, cantidad: cantidad !== null ? String(cantidad) : '', unidad: prod.unidad, fechaSolicitud: hoy, notas: `RFQ enviada a ${prov.email || 'sin correo'}: ${asunto}` });
          // Relación: bitácora + seguimiento automático a 3 días (por si no responden).
          await bitacora(prov.id, 'cotización', `RFQ de "${prod.nombre}": ${asunto}`, 'saliente', 'correo');
          await guardarProveedor(proyectoId, { ...prov, proximoSeguimiento: sumarDias(hoy, 3) });
          if (!prov.email) { lineas.push(`• ${prov.nombre}: ⚠ sin correo registrado (RFQ redactada, no enviada; captura su correo).`); continue; }
          const r = await enviarCorreo(prov.email, asunto, cuerpo);
          lineas.push(`• ${prov.nombre} (${prov.email}): ${r.enviado ? '✅ correo enviado' : `📝 borrador (${r.motivo})`}.`);
        }
        return `Solicitud de cotización de "${prod.nombre}"${cantidad !== null ? ` (${cantidad} ${prod.unidad})` : ''}:\n${lineas.join('\n')}\nSe registró una orden en etapa Cotización por proveedor.`;
      }

      if (nombre === 'generar_solicitud') {
        const [prods, vinc] = await Promise.all([listarProductos(proyectoId), listarVinculos(proyectoId)]);
        const prod = porNombre(prods, String(input.producto ?? ''));
        if (!prod) return `No encontré el producto "${String(input.producto ?? '')}". Productos: ${prods.map((p) => p.nombre).join(', ') || 'ninguno'}.`;
        const plan = planearCompra(prod, hoy);
        const cantidad = typeof input.cantidad === 'number' ? input.cantidad : plan.cantidadSugerida;
        let proveedorId = '';
        if (input.proveedor) { const provs = await listarProveedores(proyectoId); proveedorId = porNombre(provs, String(input.proveedor))?.id ?? ''; }
        if (!proveedorId) proveedorId = proveedorMasBarato(vinc, prod.id)?.proveedorId ?? '';
        const oc = await guardarOrden(proyectoId, solicitudDesdeProducto('', prod, cantidad, proveedorId, hoy));
        return `Solicitud creada para "${prod.nombre}"${cantidad !== null ? ` (${cantidad} ${prod.unidad})` : ''}${proveedorId ? ` con proveedor sugerido` : ' (sin proveedor)'} — etapa Solicitud, folio interno ${oc.id}.`;
      }
      if (nombre === 'crear_embarque') {
        const ocs = await listarOrdenes(proyectoId);
        const refs = Array.isArray(input.ordenes) ? input.ordenes.map((x) => String(x).trim().toLowerCase()) : [];
        if (!refs.length) return 'Indica al menos una orden a consolidar (por folio o descripción).';
        const incluidas = ocs.filter((o) => refs.some((r) => o.folio.toLowerCase() === r || o.descripcion.toLowerCase().includes(r)));
        if (!incluidas.length) return `No encontré órdenes que coincidan con: ${refs.join(', ')}.`;
        const modalidad = (['paqueteria', 'carga', 'mensajeria', 'recoleccion', 'digital'].includes(String(input.modalidad)) ? String(input.modalidad) : 'paqueteria') as Embarque['modalidad'];
        const emb = await guardarEmbarque(proyectoId, {
          ...embarqueVacio(''), modalidad, ordenIds: incluidas.map((o) => o.id),
          transportista: String(input.transportista ?? ''), origen: String(input.origen ?? ''), destino: String(input.destino ?? ''),
          incoterm: String(input.incoterm ?? ''), fechaRecoleccion: hoy,
          flete: String(input.flete ?? ''), seguro: String(input.seguro ?? ''), aduana: String(input.aduana ?? ''),
        });
        const lc = landedCostEmbarque(emb, ocs);
        return `Embarque creado consolidando ${incluidas.length} orden(es): ${incluidas.map((o) => o.descripcion).join(', ')}.${emb.transportista ? ` Transportista: ${emb.transportista}.` : ''} Valor mercancía ${lc.valor.toFixed(2)} + logística ${lc.logistica.toFixed(2)} = landed ${lc.total.toFixed(2)} (×${lc.factor.toFixed(2)}).`;
      }

      if (nombre === 'registrar_incidencia') {
        const provs = await listarProveedores(proyectoId);
        const prov = porNombre(provs, String(input.proveedor ?? ''));
        if (!prov) return `No encontré el proveedor "${String(input.proveedor ?? '')}".`;
        const gravedad = (['leve', 'media', 'grave'].includes(String(input.gravedad)) ? String(input.gravedad) : 'media') as Incidencia['gravedad'];
        await guardarIncidencia(proyectoId, { ...incidenciaVacia('', prov.id), tipo: String(input.tipo ?? 'incidencia'), gravedad, descripcion: String(input.descripcion ?? ''), fecha: hoy });
        return `Incidencia (${gravedad}) registrada a "${prov.nombre}". Su score bajará.`;
      }
      return `Herramienta desconocida: ${nombre}`;
    } catch (e) {
      return `Error al ejecutar ${nombre}: ${e instanceof Error ? e.message : String(e)}`;
    }
  };

  try {
    const estado = await snapshotAbastecimiento(proyectoId);
    const r = await correrCentroAbastecimiento(historial, estado, ejecutar, await modeloActual('curador'));
    await guardarConversacion(`ABAST-IA:${proyectoId}`, [...historial, { role: 'assistant', content: r.reply }]);
    return { reply: r.reply, refrescar: r.huboCambios };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const falta = /api[_ -]?key|authentication|x-api-key/i.test(msg) ? 'Falta ANTHROPIC_API_KEY.' : msg;
    return { reply: `⚠ No pude consultar al Centro de Abastecimiento (IA): ${falta}`, refrescar: false };
  }
}

export async function cargarChatAbastecimiento(proyectoId: string): Promise<MensajeChat[]> {
  return cargarConversacion(`ABAST-IA:${proyectoId}`);
}
