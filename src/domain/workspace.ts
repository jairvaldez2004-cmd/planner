// Jerarquía de trabajo (alpha): Workspace → Proyecto → Instancia.
// Fuente: Sistema_Operativo_BP.md (jerarquía + tipos de workspace). Multi-tenant simplificado.

import type { EstadoInstancia } from './states';

export type ACL = 'N2' | 'N3' | 'N4' | 'N5' | 'N6';
export type TipoWorkspace = 'INT' | 'CLT' | 'GLOB';

export interface Workspace {
  id: string;
  nombre: string;
  tipo: TipoWorkspace;
}

export interface Proyecto {
  id: string;
  workspaceId: string;
  nombre: string;
  padreId?: string; // jerarquía: proyecto padre (un desarrollo/empresa que contiene negocios). undefined = nivel superior del workspace.
}

export interface Instancia {
  id: string; // BP-[ENTIDAD]-COM-EXP-[N]
  proyectoId: string;
  tipoPlano: 'COM-EXP'; // alpha: solo COM-EXP
  estado: EstadoInstancia;
  acl: ACL;
  planoId: string | null; // referencia al plano producido (null hasta producir)
}
