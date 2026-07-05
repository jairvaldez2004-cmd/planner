// Validación HUMANA (bloque 7, alpha). Validación repartida:
// el humano aprueba (realidad/aprobación); el servicio chequea consistencia mínima (rol Curador).
// La IA NO valida ni aprueba (IAI-R6). Este servicio NO cambia estado ni publica (eso es el OS).

import type { PlanoComExp } from '@/domain/plano-com-exp';
import { esPendiente } from '@/domain/plano-com-exp';

export interface VerdictoHumano {
  aprobadoPorHumano: boolean; // decisión del humano responsable (no IA)
  validador: string;          // quién valida
  observaciones?: string[];
}

export interface ResultadoValidacion {
  aprobado: boolean;
  validador: string;
  observaciones: string[];
  consistenciaOk: boolean;    // chequeo estructural (Curador)
  pendientesContados: number; // los PENDIENTE (Nivel A) NO bloquean la aprobación
}

export class ValidacionService {
  validar(plano: PlanoComExp, verdicto: VerdictoHumano): ResultadoValidacion {
    const consistenciaOk = plano.entidad.trim().length > 0 && plano.productos.length > 0;
    const pendientesContados = this.contarPendientes(plano);
    const observaciones = verdicto.observaciones ?? [];
    // Aprobado solo si el humano aprueba Y hay consistencia estructural.
    // Los PENDIENTE (cifras/valores Nivel A) NO impiden aprobar el draft estructural.
    const aprobado = verdicto.aprobadoPorHumano && consistenciaOk;
    return { aprobado, validador: verdicto.validador, observaciones, consistenciaOk, pendientesContados };
  }

  private contarPendientes(plano: PlanoComExp): number {
    let n = 0;
    for (const pr of plano.productos) {
      if (esPendiente(pr.hsCode)) n += 1;
      if (esPendiente(pr.incotermSugerido)) n += 1;
      if (esPendiente(pr.puertoSalida)) n += 1;
      if (esPendiente(pr.certificadoOrigenRequerido)) n += 1;
      if (esPendiente(pr.precio)) n += 1;
    }
    return n;
  }
}
