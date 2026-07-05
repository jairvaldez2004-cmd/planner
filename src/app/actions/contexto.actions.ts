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
