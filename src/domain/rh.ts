// Dominio de PERSONAS / RH (ADITIVO). Un roster de empleados/colaboradores que es una
// SUPERFICIE de captura más: cada persona se da de alta una vez con su puesto, departamento,
// roles, procesos, responsabilidades, nómina, KPIs y competencias — y desde ahí alimenta el
// plano de Recursos Humanos (puestos) y los planos Organizacional/Operativo (roles).
// Se guarda como filas JSON en TablaProyecto ref 'empleados' (sin cambio de schema).

export type EstadoEmpleado = 'candidato' | 'entrevista' | 'prueba' | 'onboarding' | 'activo' | 'baja';

export const ESTADOS_EMPLEADO: { id: EstadoEmpleado; label: string; color: string }[] = [
  { id: 'candidato', label: 'Candidato', color: '#8a93a8' },
  { id: 'entrevista', label: 'Entrevista', color: '#c97a3b' },
  { id: 'prueba', label: 'Periodo de prueba', color: '#c9a13b' },
  { id: 'onboarding', label: 'Onboarding', color: '#3b86c9' },
  { id: 'activo', label: 'Activo', color: '#2e9e63' },
  { id: 'baja', label: 'Baja', color: '#c0392b' },
];

export function estadoEmpleado(id: string): { id: EstadoEmpleado; label: string; color: string } {
  return ESTADOS_EMPLEADO.find((e) => e.id === id) ?? ESTADOS_EMPLEADO[0]!;
}

export interface Empleado {
  id: string;
  nombre: string;            // persona real (o "Vacante" si aún no se contrata)
  puesto: string;            // descripción de puesto
  departamento: string;      // etiqueta de departamento (del Mapa Operativo)
  estado: EstadoEmpleado;    // ciclo de vida: candidato→…→activo→baja
  roles: string[];           // roles que desempeña (se reusan en el Mapa)
  procesos: string[];        // procesos que ejecuta (nombres del Mapa)
  responsabilidades: string; // qué es suyo
  competencias: string[];    // habilidades clave
  nomina: string;            // sueldo / esquema (texto; cifra puede ser PENDIENTE)
  kpis: string;              // cómo se mide su desempeño
  notas: string;             // contratación, entrevistas, pruebas, evaluación, carrera…
  // Datos personales / fiscales (alimentan planos Jurídico y Financiero; son PII: opcionales).
  email: string;
  telefono: string;
  rfc: string;               // RFC (fiscal MX)
  curp: string;              // CURP (identidad MX)
  nss: string;               // Núm. de Seguridad Social
  direccion: string;
  nacimiento: string;        // fecha de nacimiento
  emergencia: string;        // contacto de emergencia
  // TERCERIZACIÓN: si este "quién" no es interno sino un tercero (Girly Zone hacia arriba,
  // o una empresa externa) que ejecuta el rol. El flujo se define por lo que entregamos y
  // lo que recibimos a cambio.
  externo: boolean;
  proveedor: string;         // quién lo ejecuta (ej. "Girly Zone", "Despacho contable X")
  entregamos: string;        // datos/insumos de SALIDA que le damos
  recibimos: string;         // lo que recibimos a cambio
}

// Empleado vacío para el formulario de alta.
export function empleadoVacio(id: string): Empleado {
  return { id, nombre: '', puesto: '', departamento: '', estado: 'candidato', roles: [], procesos: [], responsabilidades: '', competencias: [], nomina: '', kpis: '', notas: '', email: '', telefono: '', rfc: '', curp: '', nss: '', direccion: '', nacimiento: '', emergencia: '', externo: false, proveedor: '', entregamos: '', recibimos: '' };
}

// Normaliza una fila JSON cualquiera a un Empleado (retrocompatible/defensivo).
export function normalizarEmpleado(v: unknown): Empleado {
  const d = (v && typeof v === 'object') ? v as Record<string, unknown> : {};
  const s = (x: unknown) => typeof x === 'string' ? x : '';
  const a = (x: unknown) => Array.isArray(x) ? x.map(s).filter(Boolean) : [];
  const estado = ESTADOS_EMPLEADO.some((e) => e.id === d.estado) ? d.estado as EstadoEmpleado : 'candidato';
  return {
    id: s(d.id) || `EMP-${s(d.nombre).slice(0, 6)}`,
    nombre: s(d.nombre), puesto: s(d.puesto), departamento: s(d.departamento), estado,
    roles: a(d.roles), procesos: a(d.procesos), responsabilidades: s(d.responsabilidades),
    competencias: a(d.competencias), nomina: s(d.nomina), kpis: s(d.kpis), notas: s(d.notas),
    email: s(d.email), telefono: s(d.telefono), rfc: s(d.rfc), curp: s(d.curp), nss: s(d.nss),
    direccion: s(d.direccion), nacimiento: s(d.nacimiento), emergencia: s(d.emergencia),
    externo: d.externo === true, proveedor: s(d.proveedor), entregamos: s(d.entregamos), recibimos: s(d.recibimos),
  };
}
