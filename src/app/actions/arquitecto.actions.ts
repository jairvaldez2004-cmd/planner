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
  anidarProyecto, desanidarProyecto, crearNegocioHijo, fijarEtapaObjetivo,
} from '@/app/actions/workspace.actions';
import type { EtapaObjetivo } from '@/domain/etapas';
import { listarUnidades, crearUnidad, actualizarUnidad, eliminarUnidad } from '@/app/actions/espacios.actions';
import {
  listarDepartamentos, crearDepartamento, listarProcesos, crearProceso, actualizarProceso, eliminarProceso,
} from '@/app/actions/mapa.actions';
import type { ProcesoPatch } from '@/app/actions/mapa.actions';
import type { FaseMapa } from '@/domain/mapa';
import { nEtapa } from '@/domain/mapa';
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

  // --- resolución por nombre para el mapa operativo (el Curador refiere por nombre) ---
  const porNombre = <T extends { nombre: string }>(xs: T[], nombre: string): T | undefined => {
    const n = nombre.trim().toLowerCase();
    if (!n) return undefined;
    return xs.find((x) => x.nombre.trim().toLowerCase() === n) ?? xs.find((x) => x.nombre.toLowerCase().includes(n));
  };
  const buscarDepto = async (nombre: string) => porNombre(await listarDepartamentos(proyectoId), nombre);
  const deptoAdmin = async () => (await listarDepartamentos(proyectoId)).find((d) => d.tipo === 'admin');
  const buscarProceso = async (nombre: string) => porNombre(await listarProcesos(proyectoId), nombre);
  const faseValida = (v: unknown): FaseMapa => (['antes', 'durante', 'despues'].includes(String(v)) ? String(v) : 'durante') as FaseMapa;
  const etapaValida = (v: unknown): EtapaObjetivo | undefined => {
    const validas: EtapaObjetivo[] = ['arrancar', 'expandir', 'replicar', 'automatizar', 'vender'];
    return validas.includes(String(v) as EtapaObjetivo) ? String(v) as EtapaObjetivo : undefined;
  };
  const listaStr = (v: unknown): string[] | undefined =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : undefined;

  // Campos comunes de crear/actualizar proceso → ProcesoPatch.
  const patchDesdeInput = (input: Record<string, unknown>): ProcesoPatch => {
    const p: ProcesoPatch = {};
    if (input.descripcion !== undefined) p.descripcion = String(input.descripcion);
    if (input.entrada !== undefined) p.entrada = String(input.entrada);
    if (input.salida !== undefined) p.salida = String(input.salida);
    if (input.instructivo !== undefined) p.instructivo = String(input.instructivo);
    if (typeof input.tiempoMin === 'number') p.tiempoMin = input.tiempoMin;
    const roles = listaStr(input.roles); if (roles) p.roles = roles;
    const herr = listaStr(input.herramientas); if (herr) p.herramientas = herr;
    const esp = listaStr(input.espacios); if (esp) p.espacios = esp.map((nombre) => ({ nombre }));
    return p;
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
      if (nombre === 'fijar_etapa') {
        const et = String(input.etapa ?? '').trim();
        const validas: EtapaObjetivo[] = ['arrancar', 'expandir', 'replicar', 'automatizar', 'vender'];
        if (!validas.includes(et as EtapaObjetivo)) return `Etapa no válida: "${et}".`;
        await fijarEtapaObjetivo(proyectoId, et as EtapaObjetivo);
        return `Etapa objetivo del negocio fijada: "${et}". Esto define el foco de planos y sus % objetivo.`;
      }

      // ---------- MAPA OPERATIVO ----------
      if (nombre === 'crear_departamento') {
        const nom = String(input.nombre ?? '').trim();
        if (!nom) return 'Falta el nombre del departamento.';
        if (await buscarDepto(nom)) return `El departamento "${nom}" ya existe; no lo dupliqué.`;
        const d = await crearDepartamento(proyectoId, nom);
        return `Departamento "${d.nombre}" creado como etiqueta del mapa.`;
      }
      if (nombre === 'crear_proceso') {
        const nom = String(input.nombre ?? '').trim();
        if (!nom) return 'Falta el nombre del proceso.';
        if (await buscarProceso(nom)) return `El proceso "${nom}" ya existe en el mapa; no lo dupliqué. Usa actualizar_proceso si quieres cambiarlo.`;
        const depto = await buscarDepto(String(input.departamento ?? '')) ?? await deptoAdmin();
        if (!depto) return 'No hay departamentos en el proyecto; crea uno primero con crear_departamento.';
        const fase = faseValida(input.fase);
        const et = etapaValida(input.etapa) ?? 'arrancar';
        const p = await crearProceso(proyectoId, depto.id, nom, fase, undefined, et);
        const patch = patchDesdeInput(input);
        if (Object.keys(patch).length) await actualizarProceso(p.id, patch);
        return `Proceso "${p.nombre}" creado · etiqueta ${depto.nombre} · fase ${fase} · nace en la etapa ${nEtapa(et)} (${et}). Conéctalo con conectar_procesos para que forme parte del flujo.`;
      }
      if (nombre === 'actualizar_proceso') {
        const p = await buscarProceso(String(input.proceso ?? ''));
        if (!p) return `No encontré el proceso "${String(input.proceso ?? '')}" en el mapa.`;
        const patch = patchDesdeInput(input);
        if (input.nuevoNombre) patch.nombre = String(input.nuevoNombre);
        if (input.fase !== undefined) patch.fase = faseValida(input.fase);
        if (input.etapa !== undefined) { const e = etapaValida(input.etapa); if (e) patch.etapaDesde = e; }
        if (input.etapaHasta !== undefined) {
          patch.etapaHasta = String(input.etapaHasta) === 'siempre' ? null : (etapaValida(input.etapaHasta) ?? null);
        }
        if (input.departamento !== undefined) {
          const d = await buscarDepto(String(input.departamento));
          if (!d) return `No encontré el departamento "${String(input.departamento)}". Créalo con crear_departamento.`;
          patch.departamentoId = d.id;
        }
        if (Object.keys(patch).length === 0) return 'No indicaste qué actualizar del proceso.';
        await actualizarProceso(p.id, patch);
        return `Proceso "${p.nombre}" actualizado.`;
      }
      if (nombre === 'conectar_procesos') {
        const a = await buscarProceso(String(input.desde ?? ''));
        const b = await buscarProceso(String(input.hasta ?? ''));
        if (!a) return `No encontré el proceso de origen "${String(input.desde ?? '')}".`;
        if (!b) return `No encontré el proceso de destino "${String(input.hasta ?? '')}".`;
        if (a.id === b.id) return 'No puedo conectar un proceso consigo mismo.';
        const evento = String(input.disparador ?? '').trim() || 'continúa';
        if (a.ramas.some((r) => r.destinoProcesoId === b.id && r.evento === evento)) {
          return `"${a.nombre}" ya estaba conectado a "${b.nombre}" con el disparador "${evento}".`;
        }
        const rama = { id: `RAMA-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, evento, destinoProcesoId: b.id };
        await actualizarProceso(a.id, { ramas: [...a.ramas, rama] });
        const salto = nEtapa(b.etapaDesde) > nEtapa(a.etapaDesde)
          ? ` Este enlace CRUZA A LA ETAPA ${nEtapa(b.etapaDesde)}: en el mapa se verá como "⏭ alimenta E${nEtapa(b.etapaDesde)}".` : '';
        return `Conectado: "${a.nombre}" —[${evento}]→ "${b.nombre}".${salto}`;
      }
      if (nombre === 'eliminar_proceso') {
        const p = await buscarProceso(String(input.proceso ?? ''));
        if (!p) return `No encontré el proceso "${String(input.proceso ?? '')}".`;
        await eliminarProceso(p.id);
        return `Proceso "${p.nombre}" eliminado del mapa.`;
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
