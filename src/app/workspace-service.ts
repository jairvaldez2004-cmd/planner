// Casos de uso: crear Workspace / Proyecto / Instancia (bloque 4, alpha).
// El servicio orquesta; la persistencia es por contrato (R5D). El OS gobierna el estado.

import type { Repository } from '@/adapters/persistence/repo.contract';
import type { ACL, Instancia, Proyecto, Workspace } from '@/domain/workspace';

let seq = 0;
function nextSeq(): string {
  seq += 1;
  return seq.toString().padStart(3, '0');
}

function slug(s: string): string {
  return s.replace(/\s+/g, '').toUpperCase();
}

export class WorkspaceService {
  constructor(
    private readonly workspaces: Repository<Workspace>,
    private readonly proyectos: Repository<Proyecto>,
    private readonly instancias: Repository<Instancia>,
  ) {}

  async crearWorkspace(nombre: string, tipo: TipoWorkspaceArg): Promise<Workspace> {
    return this.workspaces.save({ id: `WS-${tipo}-${nextSeq()}`, nombre, tipo });
  }

  async crearProyecto(workspaceId: string, nombre: string): Promise<Proyecto> {
    const ws = await this.workspaces.get(workspaceId);
    if (!ws) throw new Error(`Workspace inexistente: ${workspaceId}`);
    return this.proyectos.save({ id: `PROJ-${nextSeq()}`, workspaceId, nombre });
  }

  async crearInstancia(proyectoId: string, entidad: string, acl: ACL = 'N3'): Promise<Instancia> {
    const proj = await this.proyectos.get(proyectoId);
    if (!proj) throw new Error(`Proyecto inexistente: ${proyectoId}`);
    return this.instancias.save({
      id: `BP-${slug(entidad)}-COM-EXP-${nextSeq()}`,
      proyectoId,
      tipoPlano: 'COM-EXP',
      estado: 'SOLICITUD', // arranca en SOLICITUD; el OS avanza el ciclo
      acl,
      planoId: null,
    });
  }
}

type TipoWorkspaceArg = Workspace['tipo'];
