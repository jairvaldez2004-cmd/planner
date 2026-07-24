// FLUJO POR PERSONA (ADITIVO, puro). Dado un empleado, calcula SUS procesos del Mapa
// Operativo (los que hace por rol o por asignación directa) y, para cada uno, los
// DISPARADORES que lo inician y QUIÉN se los entrega (el proceso anterior y la persona
// que lo ejecuta), más lo que él dispara al terminar y hacia quién. Es la vista n8n
// personal: "cuando pasa X (me lo entrega Fulano), yo hago Y, y disparo Z hacia Mengano".

import type { ProcesoNodo, FaseMapa } from './mapa';
import { ordenFaseMapa } from './mapa';
import type { Empleado } from './rh';

// ¿Esta persona ejecuta este proceso? Por rol (rol del proceso ∈ roles de la persona)
// o por asignación directa (nombre del proceso ∈ sus procesos). Solo procesos de nivel raíz.
export function personaHaceProceso(emp: Empleado, proc: ProcesoNodo): boolean {
  const roles = emp.roles.map((r) => r.toLowerCase());
  if (proc.roles.some((r) => roles.includes(r.toLowerCase()))) return true;
  return emp.procesos.some((n) => n.toLowerCase() === proc.nombre.toLowerCase());
}

// Quiénes (nombres) ejecutan un proceso, según el roster.
export function quienesHacen(proc: ProcesoNodo, empleados: Empleado[]): string[] {
  return empleados.filter((e) => personaHaceProceso(e, proc)).map((e) => e.nombre).filter(Boolean);
}

export interface EnlaceDisparador {
  evento: string;        // el disparador (ej. "Consentimiento firmado")
  proceso: string;       // el otro proceso (origen si entra, destino si sale)
  procesoId: string;
  departamento: string;  // departamento de ese proceso
  quien: string[];       // personas que ejecutan ese proceso (quién entrega / quién recibe)
}

export interface PasoFlujoPersona {
  id: string; nombre: string; fase: FaseMapa; departamento: string; roles: string[];
  recibeDe: EnlaceDisparador[];  // disparadores que INICIAN este paso (y quién los entrega)
  entregaA: EnlaceDisparador[];  // lo que dispara al TERMINAR (y hacia quién)
}

// ¿Este ROL ejecuta el proceso?
export function rolHaceProceso(rol: string, proc: ProcesoNodo): boolean {
  return proc.roles.some((r) => r.toLowerCase() === rol.toLowerCase());
}

// Núcleo: dado un conjunto de procesos "propios", arma el flujo (entrantes/salientes).
function construirFlujo(propios: ProcesoNodo[], top: ProcesoNodo[], empleados: Empleado[], nombreDepto: (id: string) => string): PasoFlujoPersona[] {
  const byId = new Map(top.map((p) => [p.id, p]));
  const suyos = [...propios].sort((a, b) => ordenFaseMapa(a.fase) - ordenFaseMapa(b.fase) || a.orden - b.orden);
  return suyos.map((P): PasoFlujoPersona => {
    const recibeDe: EnlaceDisparador[] = [];
    for (const U of top) {
      if (U.id === P.id) continue;
      for (const r of U.ramas) {
        if (r.destinoProcesoId === P.id) {
          recibeDe.push({ evento: r.evento, proceso: U.nombre, procesoId: U.id, departamento: nombreDepto(U.departamentoId), quien: quienesHacen(U, empleados) });
        }
      }
    }
    const entregaA: EnlaceDisparador[] = P.ramas
      .filter((r) => r.destinoProcesoId && byId.has(r.destinoProcesoId))
      .map((r) => {
        const d = byId.get(r.destinoProcesoId!)!;
        return { evento: r.evento, proceso: d.nombre, procesoId: d.id, departamento: nombreDepto(d.departamentoId), quien: quienesHacen(d, empleados) };
      });
    return { id: P.id, nombre: P.nombre, fase: P.fase, departamento: nombreDepto(P.departamentoId), roles: P.roles, recibeDe, entregaA };
  });
}

// Flujo completo de una PERSONA (solo procesos de nivel raíz).
export function flujoDePersona(emp: Empleado, procesos: ProcesoNodo[], empleados: Empleado[], nombreDepto: (id: string) => string): PasoFlujoPersona[] {
  const top = procesos.filter((p) => !p.padreProcesoId);
  return construirFlujo(top.filter((p) => personaHaceProceso(emp, p)), top, empleados, nombreDepto);
}

// Flujo de un ROL (solo lo que involucra ese rol).
export function flujoDeRol(rol: string, procesos: ProcesoNodo[], empleados: Empleado[], nombreDepto: (id: string) => string): PasoFlujoPersona[] {
  const top = procesos.filter((p) => !p.padreProcesoId);
  return construirFlujo(top.filter((p) => rolHaceProceso(rol, p)), top, empleados, nombreDepto);
}

// Flujo DENTRO de un paso: sus subprocesos como su propio flujo (para el drill-down).
export function flujoDeSubprocesos(padreId: string, procesos: ProcesoNodo[], empleados: Empleado[], nombreDepto: (id: string) => string): PasoFlujoPersona[] {
  const hijos = procesos.filter((p) => p.padreProcesoId === padreId);
  return construirFlujo(hijos, hijos, empleados, nombreDepto);
}

// Índice de roles: todos los roles conocidos (de los procesos del Mapa + del roster), con
// cuántos procesos y cuántas personas los tienen. Para la vista de Roles y el buscador.
export interface RolResumen { rol: string; procesos: number; personas: number }
export function indiceRoles(procesos: ProcesoNodo[], empleados: Empleado[]): RolResumen[] {
  const top = procesos.filter((p) => !p.padreProcesoId);
  const map = new Map<string, { rol: string; procesos: Set<string>; personas: Set<string> }>();
  const key = (r: string) => r.trim().toLowerCase();
  const ver = (r: string) => { const k = key(r); if (r.trim() && !map.has(k)) map.set(k, { rol: r.trim(), procesos: new Set(), personas: new Set() }); return map.get(k); };
  for (const p of top) for (const r of p.roles) ver(r)?.procesos.add(p.id);
  for (const e of empleados) for (const r of e.roles) ver(r)?.personas.add(e.id);
  return Array.from(map.values())
    .map((v) => ({ rol: v.rol, procesos: v.procesos.size, personas: v.personas.size }))
    .sort((a, b) => a.rol.localeCompare(b.rol));
}

// Nombres de rol para el autocompletado (del Mapa + del roster).
export function rolesConocidos(procesos: ProcesoNodo[], empleados: Empleado[]): string[] {
  return indiceRoles(procesos, empleados).map((r) => r.rol);
}

// ===== FLUJO INTER-EMPRESA (tercerización) =====
// Cada rol marcado como externo define un intercambio con un tercero (Girly Zone hacia
// arriba u otra empresa): lo que ENTREGAMOS (datos de salida) ↔ lo que RECIBIMOS a cambio.
// Se agrupan por proveedor para dibujar el grafo empresa ↔ terceros.
export interface Intercambio { rol: string; procesos: string[]; entregamos: string; recibimos: string; disparaEntrada: string[]; disparaSalida: string[] }
// disparaEntrada = eventos que INICIAN el trabajo del tercero (lo que dispara que le entreguemos)
// disparaSalida  = eventos que produce al DEVOLVER (lo que su resultado dispara en nosotros)
export interface ProveedorFlujo { proveedor: string; roles: string[]; procesos: string[]; entrada: string[]; salida: string[]; intercambios: Intercambio[] }

function addUniq(arr: string[], v: string) { if (v && !arr.includes(v)) arr.push(v); }

export function flujoInterEmpresa(empleados: Empleado[], procesos: ProcesoNodo[]): ProveedorFlujo[] {
  const top = procesos.filter((p) => !p.padreProcesoId);
  const map = new Map<string, ProveedorFlujo>();
  for (const e of empleados) {
    if (!e.externo) continue;
    const prov = (e.proveedor || 'Externo').trim();
    const key = prov.toLowerCase();
    let g = map.get(key);
    if (!g) { g = { proveedor: prov, roles: [], procesos: [], entrada: [], salida: [], intercambios: [] }; map.set(key, g); }
    const rolesE = e.roles.length ? e.roles : (e.puesto ? [e.puesto] : []);
    const procObjs = top.filter((p) => p.roles.some((r) => rolesE.some((re) => re.toLowerCase() === r.toLowerCase())));
    const idset = new Set(procObjs.map((p) => p.id));
    const entrada: string[] = [], salida: string[] = [];
    for (const p of procObjs) {
      for (const U of top) if (!idset.has(U.id)) for (const r of U.ramas) if (r.destinoProcesoId === p.id) addUniq(entrada, r.evento);
      for (const r of p.ramas) addUniq(salida, r.evento);
    }
    const procs = procObjs.map((p) => p.nombre);
    for (const r of rolesE) if (!g.roles.some((x) => x.toLowerCase() === r.toLowerCase())) g.roles.push(r);
    for (const pn of procs) if (!g.procesos.includes(pn)) g.procesos.push(pn);
    for (const ev of entrada) addUniq(g.entrada, ev);
    for (const ev of salida) addUniq(g.salida, ev);
    g.intercambios.push({ rol: e.puesto || rolesE.join(', '), procesos: procs, entregamos: e.entregamos, recibimos: e.recibimos, disparaEntrada: entrada, disparaSalida: salida });
  }
  return Array.from(map.values());
}
