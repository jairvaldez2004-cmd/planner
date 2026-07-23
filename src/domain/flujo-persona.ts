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

// Flujo completo de una persona (solo procesos de nivel raíz). `nombreDepto` resuelve
// el id de departamento a su etiqueta.
export function flujoDePersona(
  emp: Empleado,
  procesos: ProcesoNodo[],
  empleados: Empleado[],
  nombreDepto: (id: string) => string,
): PasoFlujoPersona[] {
  const top = procesos.filter((p) => !p.padreProcesoId);
  const byId = new Map(top.map((p) => [p.id, p]));
  const suyos = top.filter((p) => personaHaceProceso(emp, p))
    .sort((a, b) => ordenFaseMapa(a.fase) - ordenFaseMapa(b.fase) || a.orden - b.orden);

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
