'use server';

// Contexto y MEMORIA del Curador (ADITIVO). Dos piezas:
//  1) SNAPSHOTS de estado (se reconstruyen desde la BD en cada turno → reflejan TODO
//     cambio: mapas, sedes, espacios, planos). `resumenWorkspace` (todo el workspace) y
//     `resumenProyecto` (solo ese proyecto, a fondo).
//  2) PERSISTENCIA de la conversación por alcance (clave "WS:<id>" | "PROJ:<id>").
// No toca FROZEN/OS. Solo lee estado y guarda historial.

import { Prisma } from '@prisma/client';
import { prisma } from '@/adapters/persistence/prisma-client';
import type { MensajeChat } from '@/adapters/ai/arquitecto-agent';
import type { Blueprint, Diagnostico } from '@/domain/diagnostico';
import {
  obtenerProyecto, obtenerProyectoBase, listarProyectosDeWorkspace, listarHijosDeProyecto,
  listarRelaciones, listarWorkspaces,
} from '@/app/actions/workspace.actions';
import { listarUnidades, listarSedes, listarEspacios } from '@/app/actions/espacios.actions';
import { listarDepartamentos, listarProcesos } from '@/app/actions/mapa.actions';
import { FASES_MAPA, nEtapa, vigenteEn } from '@/domain/mapa';
import { ETAPAS_OBJETIVO } from '@/domain/etapas';

function toJson(v: unknown): Prisma.InputJsonValue { return v as unknown as Prisma.InputJsonValue; }
function obj(v: unknown): Record<string, unknown> { return (v && typeof v === 'object') ? v as Record<string, unknown> : {}; }

// Cadena de ancestros (del contenedor inmediato hacia arriba) con su resumen si existe.
// Sirve para que un negocio herede a qué desarrollo/empresa pertenece y de qué trata.
async function ancestrosDe(proyectoId: string): Promise<{ nombre: string; resumen: string }[]> {
  const cadena: { nombre: string; resumen: string }[] = [];
  const vistos = new Set<string>([proyectoId]);
  let actual = await obtenerProyectoBase(proyectoId);
  while (actual?.padreId && !vistos.has(actual.padreId)) {
    vistos.add(actual.padreId);
    const padreBase = await obtenerProyectoBase(actual.padreId);
    if (!padreBase) break;
    const padreDiag = await obtenerProyecto(actual.padreId);
    cadena.push({ nombre: padreBase.nombre, resumen: padreDiag?.diagnostico?.resumen ?? '' });
    actual = padreBase;
  }
  return cadena;
}

// =================== SNAPSHOT DE PROYECTO (para el Curador del proyecto) ===================
// Todo lo que existe DENTRO del proyecto: diagnóstico, blueprint, planos capturados,
// unidades comerciales, sedes (con ubicación/huella en mapa) y espacios.
export async function resumenProyecto(proyectoId: string): Promise<string> {
  const [detalle, base, hijos, ucs, sedes, planoEstados] = await Promise.all([
    obtenerProyecto(proyectoId),
    obtenerProyectoBase(proyectoId),
    listarHijosDeProyecto(proyectoId),
    listarUnidades(proyectoId),
    listarSedes(proyectoId),
    prisma.proyectoPlanoEstado.findMany({ where: { proyectoId } }),
  ]);

  const nombre = detalle?.nombre ?? base?.nombre ?? 'proyecto';
  const ancestros = await ancestrosDe(proyectoId);
  const L: string[] = [];
  L.push(`# Estado actual del proyecto (memoria viva — se actualiza en cada turno)`);

  // Pertenencia jerárquica: a qué desarrollo/empresa pertenece y de qué trata.
  if (ancestros.length) {
    L.push(`Pertenece a (del contenedor inmediato hacia arriba): ${ancestros.map((a) => a.resumen ? `"${a.nombre}" (${a.resumen})` : `"${a.nombre}"`).join(' › ')}. Este proyecto es un negocio dentro de "${ancestros[0]!.nombre}".`);
  }

  // Negocios (proyectos hijos) que este proyecto contiene.
  if (hijos.length) {
    L.push(`Este proyecto CONTIENE ${hijos.length} negocio(s) (cada uno es una empresa con sus propias unidades comerciales): ${hijos.map((h) => `"${h.nombre}"`).join(', ')}.`);
  }

  if (detalle) {
    const d: Diagnostico = detalle.diagnostico;
    L.push(`Empresa: "${nombre}". ${d?.resumen ?? ''}`);
    if (d) L.push(`Diagnóstico: tipo=${d.tipoNegocio} · industria=${d.industria} · etapa=${d.etapa} · objetivo=${d.objetivo} · escala=${d.escala} · presupuesto=${d.presupuesto}${d.recursos ? ` · recursos=${d.recursos}` : ''}${d.urgencia ? ` · urgencia=${d.urgencia}` : ''}.`);
    const bp: Blueprint | undefined = detalle.blueprint;
    if (bp) {
      L.push(`Clasificación: ${bp.clasificacion.join(', ') || '—'} · profundidad=${bp.profundidadProyecto}.`);
      const activos = bp.modulos.filter((m) => m.activo).map((m) => m.modulo);
      L.push(`Planos del blueprint (${bp.planos.length}): ${bp.planos.map((p) => `${p.id}${p.minOperable ? '*' : ''}`).join(', ') || '—'} (con * = debe llegar a mínimo operable). Módulos activos: ${activos.join(', ') || 'ninguno'}.`);
    }
  } else {
    L.push(`Empresa/negocio: "${nombre}". (Aún sin diagnóstico/blueprint registrado.)`);
  }

  // Planos con captura avanzada
  const conCampos = planoEstados
    .map((e) => ({ planoId: e.planoId, n: Object.keys(obj(e.campos)).length }))
    .filter((x) => x.n > 0);
  L.push(`Captura de planos: ${conCampos.length ? conCampos.map((x) => `${x.planoId} (${x.n} campos)`).join(', ') : 'sin campos capturados todavía'}.`);

  // Unidades comerciales
  if (ucs.length) {
    L.push(`Unidades comerciales (${ucs.length}):`);
    for (const u of ucs) L.push(`  · ${u.nombre}${u.tipo ? ` [${u.tipo}]` : ''}${u.descripcion ? ` — ${u.descripcion}` : ''}`);
  } else {
    L.push(`Unidades comerciales: ninguna todavía.`);
  }

  // Sedes + espacios (mapa/arquitectura)
  if (sedes.length) {
    L.push(`Sedes (${sedes.length}):`);
    for (const s of sedes) {
      const espacios = await listarEspacios(s.id);
      const ubic = (s.lat != null && s.lng != null) ? `ubicada en mapa (${s.lat.toFixed(5)}, ${s.lng.toFixed(5)})` : 'sin ubicar en mapa';
      const huella = s.poligono?.length ? `huella poligonal (${s.poligono.length} vértices)` : (s.footAncho && s.footAlto ? `huella ${s.footAncho}×${s.footAlto} m` : 'sin huella');
      const nombres = espacios.slice(0, 12).map((e) => `${e.nombre}(${e.tipo})`).join(', ');
      L.push(`  · ${s.nombre}${s.direccion ? ` — ${s.direccion}` : ''} — ${ubic} — ${huella} — ${espacios.length} espacios${nombres ? `: ${nombres}${espacios.length > 12 ? '…' : ''}` : ''}${s.rentaMensual ? ` — renta ${s.rentaMensual}` : ''}.`);
    }
  } else {
    L.push(`Sedes: ninguna todavía.`);
  }

  // Ruta de etapas: hacia dónde trabaja el negocio.
  if (base?.etapaObjetivo) {
    const et = ETAPAS_OBJETIVO.find((x) => x.id === base.etapaObjetivo);
    if (et) L.push(`Etapa objetivo de la ruta: ${et.n}. ${et.label} — ${et.descripcion}`);
  } else {
    L.push(`Etapa objetivo de la ruta: sin fijar (puedes fijarla con fijar_etapa).`);
  }

  // Mapa operativo completo (procesos, disparadores y etapas).
  L.push('');
  L.push(await resumenMapa(proyectoId));

  return L.join('\n');
}

// =================== SNAPSHOT DEL MAPA OPERATIVO ===================
// Rinde el mapa como texto para que el Curador lo CONOZCA: departamentos (etiquetas),
// procesos agrupados por ETAPA de la ruta y por fase, con sus disparadores y los enlaces
// que cruzan a etapas futuras. Compacto a propósito (se reinyecta en cada turno).
export async function resumenMapa(proyectoId: string): Promise<string> {
  const [deptos, procesos] = await Promise.all([listarDepartamentos(proyectoId), listarProcesos(proyectoId)]);
  const L: string[] = [];
  L.push(`## Mapa operativo (procesos, disparadores y ruta de etapas)`);
  L.push(`Departamentos disponibles como ETIQUETA (id → nombre): ${deptos.map((d) => `${d.id}→"${d.nombre}"${d.tipo === 'uc' ? ' [unidad comercial]' : ''}`).join(', ') || 'ninguno'}.`);

  if (!procesos.length) {
    L.push(`Procesos: NINGUNO todavía. El mapa está vacío — puedes crearlo tú con crear_proceso.`);
    return L.join('\n');
  }

  const nombreDepto = new Map(deptos.map((d) => [d.id, d.nombre]));
  const byId = new Map(procesos.map((p) => [p.id, p]));
  const faseLabel = (f: string) => FASES_MAPA.find((x) => x.id === f)?.label.split(' ·')[0] ?? f;

  for (const et of ETAPAS_OBJETIVO) {
    const nacen = procesos.filter((p) => p.etapaDesde === et.id);
    const vigentes = procesos.filter((p) => vigenteEn(p, et.id));
    if (!vigentes.length) continue;
    L.push(`### Etapa ${et.n} · ${et.label} — ${vigentes.length} procesos vigentes (${nacen.length} nacen aquí, el resto se hereda de etapas anteriores)`);
    for (const p of nacen) {
      const partes: string[] = [];
      partes.push(`[${nombreDepto.get(p.departamentoId) ?? '?'}]`);
      partes.push(faseLabel(p.fase));
      if (p.roles.length) partes.push(`roles: ${p.roles.join('/')}`);
      if (p.espacios.length) partes.push(`en: ${p.espacios.map((e) => e.nombre + (e.horario ? ` (${e.horario})` : '')).join(', ')}`);
      if (p.herramientas.length) partes.push(`usa: ${p.herramientas.join(', ')}`);
      if (p.insumos.length) partes.push(`consume: ${p.insumos.join(', ')}`);
      if (p.tiempoMin) partes.push(`${p.tiempoMin} min`);
      if (p.entrada || p.salida) partes.push(`${p.entrada ?? '—'} → ${p.salida ?? '—'}`);
      if (p.etapaHasta) partes.push(`SE JUBILA al terminar la etapa ${nEtapa(p.etapaHasta)}`);
      L.push(`  · "${p.nombre}" (id ${p.id}) — ${partes.join(' · ')}`);
      if (!p.ramas.some((r) => r.destinoProcesoId)) L.push(`      (SIN conexión de salida: hoy el flujo se corta aquí)`);
      for (const r of p.ramas) {
        const d = r.destinoProcesoId ? byId.get(r.destinoProcesoId) : undefined;
        if (!d) { L.push(`      ⑂ disparador "${r.evento || '(sin nombre)'}" → (sin destino asignado)`); continue; }
        const salto = nEtapa(d.etapaDesde) > nEtapa(p.etapaDesde) ? ` [ALIMENTA LA ETAPA ${nEtapa(d.etapaDesde)}]` : '';
        L.push(`      ⑂ "${r.evento || 'continúa'}" → "${d.nombre}" (${faseLabel(d.fase)})${salto}`);
      }
    }
  }
  // HUECOS: lo que el Curador debería ofrecer completar. Explícito para que no dé por
  // supuestas conexiones que no existen.
  const conDestino = new Set(procesos.flatMap((p) => p.ramas.map((r) => r.destinoProcesoId).filter(Boolean)));
  const sueltos = procesos.filter((p) => !p.ramas.some((r) => r.destinoProcesoId) && !conDestino.has(p.id));
  const sinEntrada = procesos.filter((p) => !conDestino.has(p.id) && p.ramas.some((r) => r.destinoProcesoId));
  const huecos: string[] = [];
  if (sueltos.length) huecos.push(`procesos AISLADOS (sin entrada ni salida): ${sueltos.map((p) => `"${p.nombre}"`).join(', ')}`);
  if (sinEntrada.length > 1) huecos.push(`procesos sin nada que los dispare (posibles inicios; solo uno debería serlo): ${sinEntrada.map((p) => `"${p.nombre}"`).join(', ')}`);
  const futurosSinSemilla = procesos.filter((p) => nEtapa(p.etapaDesde) > 1 && !conDestino.has(p.id));
  if (futurosSinSemilla.length) huecos.push(`procesos de etapas futuras que NADA alimenta desde hoy: ${futurosSinSemilla.map((p) => `"${p.nombre}" (E${nEtapa(p.etapaDesde)})`).join(', ')} — pregunta al usuario qué proceso de hoy debería prepararlos`);
  L.push(huecos.length
    ? `HUECOS del mapa (ofrécete a completarlos, pero NO inventes conexiones que no estén listadas arriba): ${huecos.join(' · ')}.`
    : `El mapa no tiene huecos evidentes: todo proceso está conectado al flujo.`);

  L.push(`Reglas del mapa: un proceso NACE en una etapa y se hereda a todas las siguientes; "etapaHasta" lo jubila. Una rama puede apuntar a un proceso que nace en una etapa posterior — así se declara el trabajo que se hace hoy para habilitar el mañana (ej. guardar la factura hoy para que Contabilidad la use en la etapa 2).`);
  return L.join('\n');
}

// Contexto COMPLETO para el Curador del proyecto = estado del proyecto (con su pertenencia
// jerárquica) + MEMORIA COMPARTIDA con el Curador del workspace (lo que se habló "arriba").
// Así el conocimiento fluye hacia abajo: si el usuario ya describió este negocio o sus
// unidades comerciales al Curador del workspace, el Curador del proyecto ya lo sabe.
export async function contextoCuradorProyecto(proyectoId: string): Promise<string> {
  const [estado, base] = await Promise.all([resumenProyecto(proyectoId), obtenerProyectoBase(proyectoId)]);
  let out = estado;
  if (base?.workspaceId) {
    const wsConv = await cargarConversacion(`WS:${base.workspaceId}`);
    if (wsConv.length) {
      const transcript = wsConv.slice(-40)
        .map((m) => `${m.role === 'user' ? 'Usuario' : 'Curador-workspace'}: ${m.content.slice(0, 600)}`)
        .join('\n');
      out += `\n\n## Memoria compartida con el Curador del workspace (lo que se conversó "arriba"; usa lo que aplique a este negocio y NO vuelvas a preguntar lo que el usuario ya explicó):\n${transcript}`;
    }
  }
  return out;
}

// =================== SNAPSHOT DE WORKSPACE (para el Curador del workspace) ===================
// Todo el workspace: cada proyecto con su estado interno resumido + las relaciones del grafo.
export async function resumenWorkspace(workspaceId: string): Promise<string> {
  const [nodos, relaciones, workspaces] = await Promise.all([
    listarProyectosDeWorkspace(workspaceId),
    listarRelaciones(workspaceId),
    listarWorkspaces(),
  ]);
  const wsNombre = workspaces.find((w) => w.id === workspaceId)?.nombre ?? workspaceId;

  const L: string[] = [];
  L.push(`# Estado actual del workspace "${wsNombre}" (memoria viva — se actualiza en cada turno)`);

  // Línea descriptiva por proyecto (con conteos de su contenido).
  const linea = async (n: typeof nodos[number], prefijo: string): Promise<string> => {
    const [ucs, sedes, espacios] = await Promise.all([
      prisma.unidadComercial.count({ where: { proyectoId: n.proyectoId } }),
      prisma.sede.count({ where: { proyectoId: n.proyectoId } }),
      prisma.espacio.count({ where: { proyectoId: n.proyectoId } }),
    ]);
    const clase = n.clasificacion.join('/') || 'sin clasificar';
    return `${prefijo}"${n.nombre}" — ${clase} — ${n.totalPlanos} planos${n.comExp ? ' (COM-EXP activo)' : ''} — ${ucs} UCs · ${sedes} sedes · ${espacios} espacios.`;
  };

  const raiz = nodos.filter((n) => !n.padreId);
  const hijosDe = (id: string) => nodos.filter((n) => n.padreId === id);
  L.push(`Proyectos de nivel superior (${raiz.length}) — la jerarquía es: desarrollo/empresa → negocios que contiene → unidades comerciales:`);
  if (raiz.length === 0) {
    L.push(`  (ninguno todavía)`);
  } else {
    for (const n of raiz) {
      L.push(await linea(n, '  · '));
      for (const h of hijosDe(n.proyectoId)) {
        L.push(await linea(h, '      ↳ (negocio dentro de "' + n.nombre + '") '));
      }
    }
  }

  if (relaciones.length) {
    const nombre = new Map(nodos.map((n) => [n.proyectoId, n.nombre]));
    L.push(`Relaciones del grafo (${relaciones.length}):`);
    for (const r of relaciones) L.push(`  · ${nombre.get(r.aId) ?? r.aId} ↔ ${nombre.get(r.bId) ?? r.bId}${r.etiqueta ? ` (${r.etiqueta})` : ''}`);
  }

  return L.join('\n');
}

// =================== MEMORIA / PERSISTENCIA DE CONVERSACIÓN ===================
export async function cargarConversacion(clave: string): Promise<MensajeChat[]> {
  const r = await prisma.conversacion.findUnique({ where: { clave } });
  if (!r) return [];
  const m = r.mensajes;
  return Array.isArray(m) ? (m as unknown as MensajeChat[]) : [];
}

export async function guardarConversacion(clave: string, mensajes: MensajeChat[]): Promise<void> {
  const now = new Date().toISOString();
  await prisma.conversacion.upsert({
    where: { clave },
    create: { clave, mensajes: toJson(mensajes), actualizadoEn: now },
    update: { mensajes: toJson(mensajes), actualizadoEn: now },
  });
}

// Cargadores por alcance (para que la UI recupere el historial al montar).
export async function cargarConversacionWorkspace(workspaceId: string): Promise<MensajeChat[]> {
  return cargarConversacion(`WS:${workspaceId}`);
}
export async function cargarConversacionProyecto(proyectoId: string): Promise<MensajeChat[]> {
  return cargarConversacion(`PROJ:${proyectoId}`);
}
