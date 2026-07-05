// Snapshot de versión (bloque 8, alpha). Inmutable: una versión nunca se sobrescribe.

import type { PlanoComExp } from './plano-com-exp';

export interface VersionSnapshot {
  planoId: string;
  version: number;
  timestamp: string; // ISO real (no inventado)
  publicado: boolean;
  plano: PlanoComExp; // copia del plano en esa versión (el caller provee objeto fresco)
}
