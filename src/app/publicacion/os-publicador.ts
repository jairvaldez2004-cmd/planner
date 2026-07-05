// Publicación controlada por el OS (bloques 7–8, alpha).
// El OS es el ÚNICO que cambia estado y publica. Solo publica con aprobación humana.
// Registra un snapshot de versión inmutable al publicar (append-only). Mock/renderer NO publican.

import type { Repository } from '@/adapters/persistence/repo.contract';
import type { PlanoComExp } from '@/domain/plano-com-exp';
import type { Instancia } from '@/domain/workspace';
import { transicionar } from '@/domain/states';
import type { ResultadoValidacion } from '@/app/validacion/validacion-service';
import type { RegistroVersiones } from '@/app/versionado/version-store';

export interface ResultadoPublicacion {
  plano: PlanoComExp;
  instancia: Instancia;
  version: number;
}

export class OSPublicador {
  constructor(
    private readonly planos: Repository<PlanoComExp>,
    private readonly instancias: Repository<Instancia>,
    private readonly versiones?: RegistroVersiones,
  ) {}

  /** Publica el plano SOLO si la validación humana fue aprobada. La instancia debe estar en VALIDACION. */
  async publicar(
    plano: PlanoComExp,
    instancia: Instancia,
    validacion: ResultadoValidacion,
  ): Promise<ResultadoPublicacion> {
    if (!validacion.aprobado) {
      throw new Error('OS: no se puede publicar sin aprobación humana.');
    }
    // Transición controlada por el OS (lanza si la instancia no está en VALIDACION).
    const estado = transicionar(instancia.estado, 'APROBADO');

    // Snapshot inmutable: nueva versión sin sobrescribir (R5C/R5D).
    const version = await this.planos.snapshot(plano.id);
    const planoPublicado: PlanoComExp = { ...plano, publicado: true, version };
    await this.planos.save(planoPublicado);

    const instanciaActualizada: Instancia = { ...instancia, estado, planoId: plano.id };
    await this.instancias.save(instanciaActualizada);

    // El OS registra la versión publicada (append-only). No sobrescribe versiones previas.
    if (this.versiones) {
      await this.versiones.guardar({
        planoId: planoPublicado.id,
        version,
        timestamp: new Date().toISOString(),
        publicado: true,
        plano: planoPublicado,
      });
    }

    return { plano: planoPublicado, instancia: instanciaActualizada, version };
  }
}
