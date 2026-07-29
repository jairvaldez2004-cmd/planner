'use server';

// Server Actions de PERSONAS / RH (ADITIVO). El roster de empleados vive como filas JSON
// en TablaProyecto ref 'empleados' (sin cambio de schema). Es una superficie de captura:
// alimenta el plano RH (puestos) y ORG/OPE (personas) por proyección.

import { Prisma } from '@prisma/client';
import { prisma } from '@/adapters/persistence/prisma-client';
import { normalizarEmpleado, empleadoVacio } from '@/domain/rh';
import type { Empleado } from '@/domain/rh';
import type { ProcesoNodo, ModoAutomatizacion } from '@/domain/mapa';
import { correrOrganizadorRH } from '@/adapters/ai/arquitecto-agent';
import type { EjecutorHerramienta, MensajeChat } from '@/adapters/ai/arquitecto-agent';
import { listarProcesos, actualizarProceso, listarDepartamentos } from '@/app/actions/mapa.actions';
import { cargarConversacion, guardarConversacion } from '@/app/actions/contexto.actions';
import { modeloActual } from '@/app/actions/config.actions';

const REF = 'empleados';
function toJson(v: unknown): Prisma.InputJsonValue { return v as unknown as Prisma.InputJsonValue; }
function nowISO(): string { return new Date().toISOString(); }
function nid(): string { return `EMP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }

export async function listarEmpleados(proyectoId: string): Promise<Empleado[]> {
  const r = await prisma.tablaProyecto.findUnique({ where: { proyectoId_tablaRef: { proyectoId, tablaRef: REF } } });
  const filas = r && Array.isArray(r.filas) ? (r.filas as unknown[]) : [];
  return filas.map(normalizarEmpleado);
}

async function guardarLista(proyectoId: string, lista: Empleado[]): Promise<void> {
  await prisma.tablaProyecto.upsert({
    where: { proyectoId_tablaRef: { proyectoId, tablaRef: REF } },
    create: { proyectoId, tablaRef: REF, filas: toJson(lista), actualizadoEn: nowISO() },
    update: { filas: toJson(lista), actualizadoEn: nowISO() },
  });
}

export async function guardarEmpleado(proyectoId: string, emp: Empleado): Promise<Empleado> {
  const lista = await listarEmpleados(proyectoId);
  const id = emp.id?.trim() || nid();
  const norm = normalizarEmpleado({ ...emp, id });
  const i = lista.findIndex((e) => e.id === id);
  if (i >= 0) lista[i] = norm; else lista.push(norm);
  await guardarLista(proyectoId, lista);
  return norm;
}

export async function eliminarEmpleado(proyectoId: string, id: string): Promise<void> {
  const lista = (await listarEmpleados(proyectoId)).filter((e) => e.id !== id);
  await guardarLista(proyectoId, lista);
}

// =================== ORGANIZADOR DE EQUIPO (IA) ===================
// La IA arma la plantilla más eficiente: asigna procesos a personas, crea vacantes donde
// falta gente y decide qué automatizar (IA/n8n/software). Las automatizaciones se marcan en
// el proceso del Mapa y alimentan el plano de software (IA → agentes; n8n/software → componentes).

// ¿Quién ejecuta un proceso? Su nombre está en los procesos de la persona, o su rol coincide.
function ejecutaProceso(emp: Empleado, p: ProcesoNodo): boolean {
  const nom = p.nombre.trim().toLowerCase();
  if (emp.procesos.some((x) => x.trim().toLowerCase() === nom)) return true;
  const roles = new Set(emp.roles.map((r) => r.trim().toLowerCase()));
  return p.roles.some((r) => roles.has(r.trim().toLowerCase()));
}

// Snapshot que ve la IA cada turno: personas con su carga (min) + procesos con estado.
async function snapshotRH(proyectoId: string): Promise<string> {
  const [emps, procesos, deptos] = await Promise.all([
    listarEmpleados(proyectoId), listarProcesos(proyectoId), listarDepartamentos(proyectoId),
  ]);
  const raiz = procesos.filter((p) => !p.padreProcesoId);
  const deptoNombre = new Map(deptos.map((d) => [d.id, d.nombre]));
  const cargaDe = (e: Empleado) => raiz.filter((p) => !p.automatizacion && ejecutaProceso(e, p)).reduce((s, p) => s + (p.tiempoMin ?? 0), 0);
  const L: string[] = [];
  L.push('# Estado de Recursos Humanos — se actualiza cada turno');
  L.push(`Personas (${emps.length}):`);
  for (const e of emps) {
    const carga = cargaDe(e);
    L.push(`  · "${e.nombre || '(sin nombre)'}" [${e.estado}]${e.externo ? ' 🏢 externo' : ''} — depto: ${e.departamento || '—'} · roles: ${e.roles.join(', ') || '—'} · procesos: ${e.procesos.join(', ') || '—'} · nómina: ${e.nomina || 'PENDIENTE'} · carga ~${carga} min`);
  }
  if (!emps.length) L.push('  (nadie dado de alta todavía)');
  L.push(`Procesos del mapa (${raiz.length}):`);
  for (const p of raiz) {
    const quien = emps.filter((e) => ejecutaProceso(e, p)).map((e) => e.nombre).filter(Boolean);
    const auto = p.automatizacion ? `🤖 automatizado (${p.automatizacion.con}${p.automatizacion.herramienta ? `: ${p.automatizacion.herramienta}` : ''})` : 'manual';
    L.push(`  · "${p.nombre}" — ${deptoNombre.get(p.departamentoId) ?? '?'} · fase ${p.fase} · roles: ${p.roles.join(', ') || '—'} · ${p.tiempoMin ? `~${p.tiempoMin} min` : 'sin tiempo'} · ${auto} · lo hacen: ${quien.join(', ') || 'NADIE'}`);
  }
  if (!raiz.length) L.push('  (el Mapa Operativo aún no tiene procesos)');
  L.push(`Departamentos: ${deptos.map((d) => d.nombre).join(', ') || '—'}.`);
  return L.join('\n');
}

export async function conversarOrganizadorRH(
  historial: MensajeChat[],
  proyectoId: string,
): Promise<{ reply: string; refrescar: boolean }> {
  const porNombre = <T extends { nombre: string }>(xs: T[], n: string): T | undefined => {
    const k = n.trim().toLowerCase();
    return xs.find((x) => x.nombre.trim().toLowerCase() === k) ?? xs.find((x) => x.nombre.toLowerCase().includes(k));
  };
  const strArr = (v: unknown): string[] => Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

  const ejecutar: EjecutorHerramienta = async (nombre, input) => {
    try {
      const [emps, procesos] = await Promise.all([listarEmpleados(proyectoId), listarProcesos(proyectoId)]);
      const raiz = procesos.filter((p) => !p.padreProcesoId);

      if (nombre === 'asignar_proceso' || nombre === 'quitar_proceso') {
        const e = porNombre(emps, String(input.persona ?? ''));
        if (!e) return `No encontré a "${String(input.persona ?? '')}". Personas: ${emps.map((x) => x.nombre).join(', ') || 'ninguna'}.`;
        const p = porNombre(raiz, String(input.proceso ?? ''));
        if (!p) return `No encontré el proceso "${String(input.proceso ?? '')}".`;
        const tiene = e.procesos.some((x) => x.trim().toLowerCase() === p.nombre.trim().toLowerCase());
        if (nombre === 'asignar_proceso') {
          if (tiene) return `"${e.nombre}" ya tenía "${p.nombre}".`;
          await guardarEmpleado(proyectoId, { ...e, procesos: [...e.procesos, p.nombre] });
          return `Asigné "${p.nombre}" a ${e.nombre}.`;
        }
        await guardarEmpleado(proyectoId, { ...e, procesos: e.procesos.filter((x) => x.trim().toLowerCase() !== p.nombre.trim().toLowerCase()) });
        return `Quité "${p.nombre}" de ${e.nombre}.`;
      }

      if (nombre === 'asignar_rol') {
        const e = porNombre(emps, String(input.persona ?? ''));
        if (!e) return `No encontré a "${String(input.persona ?? '')}".`;
        const rol = String(input.rol ?? '').trim();
        if (!rol) return 'Falta el rol.';
        if (e.roles.some((r) => r.toLowerCase() === rol.toLowerCase())) return `"${e.nombre}" ya tenía el rol "${rol}".`;
        await guardarEmpleado(proyectoId, { ...e, roles: [...e.roles, rol] });
        return `Le di el rol "${rol}" a ${e.nombre}.`;
      }

      if (nombre === 'crear_vacante') {
        const puesto = String(input.puesto ?? '').trim();
        if (!puesto) return 'Falta el puesto de la vacante.';
        const nueva: Empleado = {
          ...empleadoVacio(''), nombre: `Vacante: ${puesto}`, puesto, estado: 'candidato',
          departamento: String(input.departamento ?? '').trim(),
          roles: strArr(input.roles), procesos: strArr(input.procesos),
        };
        const g = await guardarEmpleado(proyectoId, nueva);
        return `Creé la vacante "${g.nombre}"${g.departamento ? ` en ${g.departamento}` : ''}${g.procesos.length ? ` (cubriría: ${g.procesos.join(', ')})` : ''}.`;
      }

      if (nombre === 'automatizar_proceso') {
        const p = porNombre(raiz, String(input.proceso ?? ''));
        if (!p) return `No encontré el proceso "${String(input.proceso ?? '')}".`;
        const con = String(input.con ?? '');
        if (!['ia', 'n8n', 'software'].includes(con)) return 'El modo debe ser ia, n8n o software.';
        const herramienta = String(input.herramienta ?? '').trim();
        const nota = String(input.nota ?? '').trim();
        const ahorro = typeof input.ahorroMin === 'number' ? input.ahorroMin : undefined;
        await actualizarProceso(p.id, { automatizacion: {
          con: con as ModoAutomatizacion,
          ...(herramienta ? { herramienta } : {}),
          ...(nota ? { nota } : {}),
          ...(ahorro !== undefined ? { ahorroMin: ahorro } : {}),
        } });
        const destino = con === 'ia' ? 'ficha de agente en el plano IA' : 'componente en el plano Tecnológico';
        return `Automaticé "${p.nombre}" con ${con}${herramienta ? ` (${herramienta})` : ''} → aparece como ${destino}.`;
      }

      if (nombre === 'quitar_automatizacion') {
        const p = porNombre(raiz, String(input.proceso ?? ''));
        if (!p) return `No encontré el proceso "${String(input.proceso ?? '')}".`;
        if (!p.automatizacion) return `"${p.nombre}" no estaba automatizado.`;
        await actualizarProceso(p.id, { automatizacion: null });
        return `"${p.nombre}" vuelve a ser manual.`;
      }

      return `Herramienta desconocida: ${nombre}`;
    } catch (e) {
      return `Error al ejecutar ${nombre}: ${e instanceof Error ? e.message : String(e)}`;
    }
  };

  try {
    const estado = await snapshotRH(proyectoId);
    const r = await correrOrganizadorRH(historial, estado, ejecutar, await modeloActual('curador'));
    await guardarConversacion(`RH-IA:${proyectoId}`, [...historial, { role: 'assistant', content: r.reply }]);
    return { reply: r.reply, refrescar: r.huboCambios };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const falta = /api[_ -]?key|authentication|x-api-key/i.test(msg) ? 'Falta ANTHROPIC_API_KEY.' : msg;
    return { reply: `⚠ No pude consultar al Organizador (IA): ${falta}`, refrescar: false };
  }
}

export async function cargarChatOrganizadorRH(proyectoId: string): Promise<MensajeChat[]> {
  return cargarConversacion(`RH-IA:${proyectoId}`);
}
