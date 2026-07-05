// Documento genérico del Business Planner.
// Funciona para cualquier tipo de plano (COM-EXP, EST, ORG, etc.).
// El motor genera el contenido; el markup es el texto final renderizado.
// Invariante: el motor no inventa — campos faltantes del plano se marcan PENDIENTE.

export interface Documento {
  id: string;
  planoId: string;
  tipoPlano: string;        // 'COM-EXP' | 'EST' | etc.
  tipoDocumento: string;    // 'RESUMEN_COMERCIAL' | etc.
  version: number;          // empieza en 1; incrementa al editar o regenerar
  contenido: Record<string, unknown>;
  markup: string;           // Markdown generado
  pendientes: number;       // conteo de campos PENDIENTE en el plano origen
  publicado: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface VersionDocumento {
  documentoId: string;
  version: number;
  markup: string;
  pendientes: number;
  publicado: boolean;
  timestamp: string;
  contenido: Record<string, unknown>;
}

// Puerto de persistencia (R5D): intercambiable (en memoria o Prisma).
export interface DocumentoRepository {
  save(d: Documento): Promise<Documento>;
  get(id: string): Promise<Documento | null>;
  listarPorPlano(planoId: string): Promise<Documento[]>;
  listar(): Promise<Documento[]>;
  guardarVersion(v: VersionDocumento): Promise<VersionDocumento>;
  listarVersiones(documentoId: string): Promise<VersionDocumento[]>;
}
