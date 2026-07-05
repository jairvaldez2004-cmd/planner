'use server';

// Server Actions de la cabeza del Planner (ADITIVO). Conecta el Agente Arquitecto (IA)
// y el Motor de Selección determinista. Persiste diagnóstico + blueprint por proyecto.
// No toca FROZEN/COM-EXP/OS. La IA solo conduce el intake; el blueprint es de reglas.

import { Prisma } from '@prisma/client';
import { prisma } from '@/adapters/persistence/prisma-client';
import { turnoArquitecto, correrCurador, correrCuradorProyecto } from '@/adapters/ai/arquitecto-agent';
import type { ContextoProyecto, ContextoWorkspace, EjecutorHerramienta, MensajeChat, ResultadoArquitecto } from '@/adapters/ai/arquitecto-agent';
import { construirBlueprint } from '@/app/seleccion/selection-engine';
import { asegurarWorkspace, asegurarProyecto } from '@/app/actions/plano.actions';
import {
  listarWorkspaces, crearWorkspace, listarProyectosDeWorkspace, guardarDiagnosticoEnWorkspace,
  relacionarProyectos, renombrarProyecto, archivarProyecto, moverProyecto, obtenerProyectoBase,
  anidarProyecto, desanidarProyecto, crearNegocioHijo,
} from '@/app/actions/workspace.actions';
import { listarUnidades, crearUnidad, actualizarUnidad, eliminarUnidad } from '@/app/actions/espacios.actions';
import { resumenWorkspace, contextoCuradorProyecto, guardarConversacion } from '@/app/actions/contexto.actions';
import type { ProyectoNodo } from '@/app/actions/workspace.actions';
import type { Blueprint, Diagnostico, ProyectoDiagnostico } from '@/domain/diagnostico';
import { modeloActual } from '@/app/actions/config.actions';

function toJson(v: unknown): Prisma.InputJsonValue {
  return v as unknown as Prisma.InputJsonValue;
}

// Turno conversacional del Curador. Devuelve pregunta o diagnóstico estructurado.
export async function conversarArquitecto(
  historial: MensajeChat[],
  contexto?: ContextoWorkspace,
): Promise<ResultadoArquitecto> {
  try {
    return await turnoArquitecto(historial, contexto, await modeloActual('curador'));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const falta = /api[_ -]?key|authentication|x-api-key/i.test(msg)
      ? 'Falta ANTHROPIC_API_KEY. Agrégala en business-planner-alpha/.env.local y reinicia npm run dev.'
      : msg;
    return { tipo: 'pregunta', texto: `⚠ No pude consultar al Arquitecto (IA): ${falta}` };
  }
}

// Construye el blueprint (motor determinista, sin IA) a partir del diagnóstico.
export async function generarBlueprint(diagnostico: Diagnostico): Promise<Blueprint> {
  return construirBlueprint(diagnostico);
}

// Conversación con el CURADOR: identifica proyectos y CURA el grafo (renombrar/relacionar/
// archivar/mover) ejecutando acciones reales. Devuelve la respuesta y si el grafo cambió.
export async function conversarCurador(
  historial: MensajeChat[],
  workspaceId: string,
): Promise<{ reply: string; refrescar: boolean }> {
  const workspaces = await listarWorkspaces();
  const ws = workspaces.find((w) => w.id === workspaceId);
  let nodos = await listarProyectosDeWorkspace(workspaceId);

  const resolver = (nombre: string): ProyectoNodo | undefined => {
    const n = nombre.trim().toLowerCase();
    return nodos.find((p) => p.nombre.trim().toLowerCase() === n) ?? nodos.find((p) => p.nombre.toLowerCase().includes(n));
  };

  const ejecutar: EjecutorHerramienta = async (nombre, input) => {
    try {
      if (nombre === 'registrar_diagnostico') {
        const d = input as unknown as Diagnostico;
        const bp = construirBlueprint(d);
        await guardarDiagnosticoEnWorkspace(workspaceId, d, bp);
        nodos = await listarProyectosDeWorkspace(workspaceId);
        const comExp = bp.modulos.find((m) => m.modulo === 'COM-EXP')?.activo;
        return `Proyecto "${d.nombreEntidad}" acomodado (${bp.planos.length} planos${comExp ? ', COM-EXP activado' : ''}).`;
      }
      if (nombre === 'renombrar_proyecto') {
        const p = resolver(String(input.proyecto));
        if (!p) return `No encontré el proyecto "${String(input.proyecto)}".`;
        await renombrarProyecto(p.proyectoId, String(input.nuevoNombre));
        nodos = await listarProyectosDeWorkspace(workspaceId);
        return `Renombrado "${p.nombre}" → "${String(input.nuevoNombre)}".`;
      }
      if (nombre === 'relacionar_proyectos') {
        const a = resolver(String(input.proyectoA));
        const b = resolver(String(input.proyectoB));
        if (!a || !b) return `No encontré ${!a ? `"${String(input.proyectoA)}"` : `"${String(input.proyectoB)}"`}.`;
        await relacionarProyectos(workspaceId, a.proyectoId, b.proyectoId, input.etiqueta ? String(input.etiqueta) : undefined);
        return `Relacionados "${a.nombre}" ↔ "${b.nombre}".`;
      }
      if (nombre === 'archivar_proyecto') {
        const p = resolver(String(input.proyecto));
        if (!p) return `No encontré el proyecto "${String(input.proyecto)}".`;
        await archivarProyecto(p.proyectoId);
        nodos = await listarProyectosDeWorkspace(workspaceId);
        return `Archivado "${p.nombre}".`;
      }
      if (nombre === 'mover_proyecto') {
        const p = resolver(String(input.proyecto));
        if (!p) return `No encontré el proyecto "${String(input.proyecto)}".`;
        const destNombre = String(input.workspaceDestino).trim();
        const destExist = workspaces.find((w) => w.nombre.trim().toLowerCase() === destNombre.toLowerCase());
        const dest = destExist ?? (await crearWorkspace(destNombre));
        await moverProyecto(p.proyectoId, dest.id);
        nodos = await listarProyectosDeWorkspace(workspaceId);
        return `Movido "${p.nombre}" → workspace "${dest.nombre}".`;
      }
      if (nombre === 'anidar_proyecto') {
        const h = resolver(String(input.hijo));
        const p = resolver(String(input.padre));
        if (!h || !p) return `No encontré ${!h ? `"${String(input.hijo)}"` : `"${String(input.padre)}"`}.`;
        const ok = await anidarProyecto(h.proyectoId, p.proyectoId);
        nodos = await listarProyectosDeWorkspace(workspaceId);
        return ok ? `Metí "${h.nombre}" dentro de "${p.nombre}".` : `No pude anidar "${h.nombre}" en "${p.nombre}" (mismo proyecto o ciclo).`;
      }
      if (nombre === 'desanidar_proyecto') {
        const p = resolver(String(input.proyecto));
        if (!p) return `No encontré el proyecto "${String(input.proyecto)}".`;
        await desanidarProyecto(p.proyectoId);
        nodos = await listarProyectosDeWorkspace(workspaceId);
        return `Saqué "${p.nombre}" al nivel superior del workspace.`;
      }
      return `Herramienta desconocida: ${nombre}`;
    } catch (e) {
      return `Error al ejecutar ${nombre}: ${e instanceof Error ? e.message : String(e)}`;
    }
  };

  try {
    const contexto: ContextoWorkspace = { proyectos: nodos.map((n) => n.nombre), estado: await resumenWorkspace(workspaceId) };
    if (ws?.nombre) contexto.workspace = ws.nombre;
    const r = await correrCurador(historial, contexto, ejecutar, await modeloActual('curador'));
    await guardarConversacion(`WS:${workspaceId}`, [...historial, { role: 'assistant', content: r.reply }]);
    return { reply: r.reply, refrescar: r.huboCambios };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const falta = /api[_ -]?key|authentication|x-api-key/i.test(msg)
      ? 'Falta ANTHROPIC_API_KEY en business-planner-alpha/.env.local.' : msg;
    return { reply: `⚠ No pude consultar al Curador (IA): ${falta}`, refrescar: false };
  }
}

// Conversación con el CURADOR DENTRO de un proyecto: crea/ajusta/elimina Unidades
// Comerciales ejecutando acciones reales. Devuelve la respuesta y si el grafo del proyecto
// cambió (para que la vista recargue las UCs).
export async function conversarCuradorProyecto(
  historial: MensajeChat[],
  proyectoId: string,
): Promise<{ reply: string; refrescar: boolean }> {
  let unidades = await listarUnidades(proyectoId);
  const base = await obtenerProyectoBase(proyectoId);

  const resolver = (nombre: string) => {
    const n = nombre.trim().toLowerCase();
    return unidades.find((u) => u.nombre.trim().toLowerCase() === n) ?? unidades.find((u) => u.nombre.toLowerCase().includes(n));
  };

  const ejecutar: EjecutorHerramienta = async (nombre, input) => {
    try {
      if (nombre === 'crear_negocio') {
        const nom = String(input.nombre ?? '').trim();
        if (!nom) return 'Falta el nombre del negocio.';
        const hijo = await crearNegocioHijo(proyectoId, nom);
        if (!hijo) return 'No pude crear el negocio (no encontré el proyecto contenedor).';
        return `Negocio "${hijo.nombre}" creado dentro de este proyecto. Ábrelo (clic en su nodo) para darle sus unidades comerciales, sedes y planos.`;
      }
      if (nombre === 'crear_unidad') {
        const nom = String(input.nombre ?? '').trim();
        if (!nom) return 'Falta el nombre de la unidad comercial.';
        if (resolver(nom)) return `La unidad "${nom}" ya existe; no la dupliqué.`;
        const uc = await crearUnidad(proyectoId, nom, input.tipo ? String(input.tipo) : undefined);
        if (input.descripcion) await actualizarUnidad(uc.id, { descripcion: String(input.descripcion) });
        unidades = await listarUnidades(proyectoId);
        return `Unidad comercial "${uc.nombre}" creada${input.tipo ? ` (tipo: ${String(input.tipo)})` : ''}.`;
      }
      if (nombre === 'actualizar_unidad') {
        const u = resolver(String(input.unidad));
        if (!u) return `No encontré la unidad "${String(input.unidad)}".`;
        const patch: { nombre?: string; tipo?: string; descripcion?: string } = {};
        if (input.nuevoNombre) patch.nombre = String(input.nuevoNombre);
        if (input.tipo !== undefined) patch.tipo = String(input.tipo);
        if (input.descripcion !== undefined) patch.descripcion = String(input.descripcion);
        if (Object.keys(patch).length === 0) return 'No indicaste qué actualizar de la unidad.';
        await actualizarUnidad(u.id, patch);
        unidades = await listarUnidades(proyectoId);
        return `Unidad "${u.nombre}" actualizada${patch.nombre ? ` → "${patch.nombre}"` : ''}.`;
      }
      if (nombre === 'eliminar_unidad') {
        const u = resolver(String(input.unidad));
        if (!u) return `No encontré la unidad "${String(input.unidad)}".`;
        await eliminarUnidad(u.id);
        unidades = await listarUnidades(proyectoId);
        return `Unidad "${u.nombre}" eliminada.`;
      }
      return `Herramienta desconocida: ${nombre}`;
    } catch (e) {
      return `Error al ejecutar ${nombre}: ${e instanceof Error ? e.message : String(e)}`;
    }
  };

  try {
    const contexto: ContextoProyecto = { unidades: unidades.map((u) => u.nombre), estado: await contextoCuradorProyecto(proyectoId) };
    if (base?.nombre) contexto.proyecto = base.nombre;
    const r = await correrCuradorProyecto(historial, contexto, ejecutar, await modeloActual('curador'));
    await guardarConversacion(`PROJ:${proyectoId}`, [...historial, { role: 'assistant', content: r.reply }]);
    return { reply: r.reply, refrescar: r.huboCambios };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const falta = /api[_ -]?key|authentication|x-api-key/i.test(msg)
      ? 'Falta ANTHROPIC_API_KEY en business-planner-alpha/.env.local.' : msg;
    return { reply: `⚠ No pude consultar al Curador (IA): ${falta}`, refrescar: false };
  }
}

// Persiste diagnóstico + blueprint en un proyecto del workspace (organiza el proyecto).
export async function guardarProyectoDiagnostico(
  workspaceNombre: string,
  proyectoNombre: string,
  diagnostico: Diagnostico,
  blueprint: Blueprint,
): Promise<{ proyectoId: string }> {
  const wsId = `WS-${workspaceNombre.trim().replace(/\s+/g, '').toUpperCase() || 'DIAG'}`;
  const projId = `PROJ-${proyectoNombre.trim().replace(/\s+/g, '').toUpperCase() || 'SINNOMBRE'}`;
  await asegurarWorkspace({ id: wsId, nombre: workspaceNombre.trim() || 'Diagnóstico', tipo: 'INT' });
  await asegurarProyecto({ id: projId, workspaceId: wsId, nombre: proyectoNombre.trim() || 'Sin nombre' });

  const now = new Date().toISOString();
  await prisma.proyectoDiagnostico.upsert({
    where: { proyectoId: projId },
    create: { proyectoId: projId, diagnostico: toJson(diagnostico), blueprint: toJson(blueprint), actualizadoEn: now },
    update: { diagnostico: toJson(diagnostico), blueprint: toJson(blueprint), actualizadoEn: now },
  });
  return { proyectoId: projId };
}

export async function listarProyectosDiagnostico(): Promise<ProyectoDiagnostico[]> {
  const rs = await prisma.proyectoDiagnostico.findMany({ orderBy: { actualizadoEn: 'desc' } });
  return rs.map((r) => ({
    proyectoId: r.proyectoId,
    diagnostico: r.diagnostico as unknown as Diagnostico,
    blueprint: r.blueprint as unknown as Blueprint,
    actualizadoEn: r.actualizadoEn,
  }));
}
