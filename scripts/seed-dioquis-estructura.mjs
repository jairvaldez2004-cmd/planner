// ALTA DE LA ESTRUCTURA CORPORATIVA DE GRUPO DIOQUIS en el Business Planner.
// Fuente: fichas canónicas del Knowledge System (03_Empresas/) + ARQUITECTURA_CORPORATIVA_DIOQUIS.
//
// IDEMPOTENTE: si el proyecto/UC ya existe, se ACTUALIZA (nombre, padre, taxonomía) en vez de
// duplicarse. NO DESTRUCTIVO: no borra nada. El workspace WS-GIRLY-ZONE no se toca.
//
// Correr: DATABASE_URL=<public> node scripts/seed-dioquis-estructura.mjs [--dry]
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const WS = 'WS-GRUPO-DIOQUIS';
const P = (s) => `${WS}--${s}`;

// ---------------------------------------------------------------------------
// ESTRUCTURA. Cada nodo: id, nombre, tipoEntidad, estadoEntidad, padre, ucs[]
// Los ids EXISTENTES se conservan tal cual para no duplicar lo ya cargado.
// ---------------------------------------------------------------------------
const ESTRUCTURA = [
  // ---------- MATRIZ ----------
  { id: P('GRUPO-DIOQUIS'), nombre: 'Grupo Dioquis', tipo: 'holding_matriz', estado: 'existente', padre: null },

  // ---------- DIOQUIS BUSINESS ----------
  { id: P('HOLDING-BUSINESS'), nombre: 'Dioquis Business', tipo: 'holding_sectorial', estado: 'existente', padre: P('GRUPO-DIOQUIS') },
  {
    id: P('CORPORATIVO-PALO-FIERRO'), nombre: 'Corporativo Palo Fierro', tipo: 'empresa_operativa', estado: 'existente', padre: P('HOLDING-BUSINESS'),
    ucs: ['Diseño de empresas', 'Consultoría y transformación', 'Venture building', 'Broker de empresas (M&A)', 'Automatización y sistematización'],
  },
  {
    id: P('PROCNOR'), nombre: 'PROCNOR', tipo: 'empresa_operativa', estado: 'en_construccion', padre: P('HOLDING-BUSINESS'),
    nombreAnterior: 'Constructora ALV',
    ucs: ['Arquitectura y diseño', 'Construcción', 'Remodelación y adecuaciones', 'Instalaciones', 'Supervisión de obra'],
  },
  {
    id: P('XLINE'), nombre: 'XLine', tipo: 'empresa_operativa', estado: 'propuesta', padre: P('HOLDING-BUSINESS'),
    ucs: ['Interiorismo residencial', 'Interiorismo comercial', 'Interiorismo corporativo', 'Hospitality', 'Retail', 'Diseño de mobiliario', 'Iluminación', 'Señalética', 'Home staging', 'Visual merchandising'],
  },
  {
    id: P('MACAO-MARKETING'), nombre: 'Macao Marketing', tipo: 'empresa_operativa', estado: 'en_construccion', padre: P('HOLDING-BUSINESS'),
    ucs: ['Branding', 'Publicidad y campañas', 'Marketing digital', 'Producción audiovisual', 'Community management', 'SEO', 'Automatización de marketing', 'Diseño gráfico'],
  },
  {
    id: P('COMERCIALIZADORA'), nombre: 'Comercializadora General Commerce', tipo: 'empresa_operativa', estado: 'existente', padre: P('HOLDING-BUSINESS'),
    nombreAnterior: 'Comercializadora ALV', alias: 'General Commerce',
    ucs: ['Exportación', 'Importación', 'Distribución nacional', 'Compras estratégicas', 'Representación comercial'],
  },
  {
    id: P('MAGNO-COMMODITIES'), nombre: 'Magno Commodities', tipo: 'unidad_negocio', estado: 'en_construccion', padre: P('COMERCIALIZADORA'),
    nombreAnterior: 'Salem Solutions',
    ucs: ['Granos', 'Legumbres', 'Chiles secos', 'Especias', 'Alimentos', 'Materias primas'],
  },

  // ---------- DIOQUIS TECHNOLOGIES ----------
  { id: P('HOLDING-TECHNOLOGIES'), nombre: 'Dioquis Technologies', tipo: 'holding_sectorial', estado: 'existente', padre: P('GRUPO-DIOQUIS') },
  { id: P('ALV-TECH'), nombre: 'ALV TECH', tipo: 'empresa_operativa', estado: 'existente', padre: P('HOLDING-TECHNOLOGIES'), nota: 'EN TRANSICIÓN hacia Dioquis Software. Pendiente de aprobación del propietario.' },
  { id: P('DIOQUIS-SOFTWARE'), nombre: 'Dioquis Software', tipo: 'empresa_operativa', estado: 'objetivo', padre: P('HOLDING-TECHNOLOGIES') },
  // Productos de software: pertenecen a quien los DESARROLLA, no a quien los usa.
  { id: P('PROD-BUSINESS-PLANNER'), nombre: 'Business Planner', tipo: 'producto_tecnologico', estado: 'existente', padre: P('DIOQUIS-SOFTWARE') },
  { id: P('PROD-SICA'), nombre: 'SICA', tipo: 'producto_tecnologico', estado: 'en_construccion', padre: P('DIOQUIS-SOFTWARE') },
  { id: P('PROD-EXPORTS-HUB'), nombre: 'ALV Exports Hub', tipo: 'producto_tecnologico', estado: 'propuesta', padre: P('DIOQUIS-SOFTWARE') },
  { id: P('PROD-ERP'), nombre: 'ERP Corporativo', tipo: 'producto_tecnologico', estado: 'objetivo', padre: P('DIOQUIS-SOFTWARE') },
  { id: P('PROD-CRM'), nombre: 'CRM Corporativo', tipo: 'producto_tecnologico', estado: 'objetivo', padre: P('DIOQUIS-SOFTWARE') },
  { id: P('DIOQUIS-AI'), nombre: 'Dioquis AI', tipo: 'empresa_operativa', estado: 'objetivo', padre: P('HOLDING-TECHNOLOGIES') },
  { id: P('DIOQUIS-HARDWARE'), nombre: 'Dioquis Hardware', tipo: 'empresa_operativa', estado: 'objetivo', padre: P('HOLDING-TECHNOLOGIES') },
  { id: P('DIOQUIS-TELECOM'), nombre: 'Dioquis Telecom', tipo: 'empresa_operativa', estado: 'objetivo', padre: P('HOLDING-TECHNOLOGIES') },
  { id: P('DIOQUIS-ROBOTICS'), nombre: 'Dioquis Robotics', tipo: 'empresa_operativa', estado: 'objetivo', padre: P('HOLDING-TECHNOLOGIES') },
  { id: P('DIOQUIS-CYBERSECURITY'), nombre: 'Dioquis Cybersecurity', tipo: 'empresa_operativa', estado: 'objetivo', padre: P('HOLDING-TECHNOLOGIES') },

  // ---------- DIOQUIS INDUSTRIES ----------
  { id: P('HOLDING-INDUSTRIES'), nombre: 'Dioquis Industries', tipo: 'holding_sectorial', estado: 'existente', padre: P('GRUPO-DIOQUIS') },
  {
    id: P('AGRICOLA-ALV'), nombre: 'Agrícola ALV', tipo: 'empresa_operativa', estado: 'propuesta', padre: P('HOLDING-INDUSTRIES'),
    ucs: ['Granos', 'Hortalizas', 'Especias'],
  },

  // ---------- DIOQUIS CAPITAL ----------
  { id: P('HOLDING-PATRIMONIAL'), nombre: 'Dioquis Capital', tipo: 'holding_sectorial', estado: 'existente', padre: P('GRUPO-DIOQUIS'), nombreAnterior: 'Holding Patrimonial' },
  {
    id: P('INMOBILIARIA-ALV'), nombre: 'Inmobiliaria ALV', tipo: 'empresa_operativa', estado: 'propuesta', padre: P('HOLDING-PATRIMONIAL'),
    ucs: ['Arrendamiento', 'Compraventa', 'Desarrollo inmobiliario', 'Administración de propiedades'],
  },
  {
    id: P('FINANCIERA-ALV'), nombre: 'Financiera ALV', tipo: 'empresa_operativa', estado: 'propuesta', padre: P('HOLDING-PATRIMONIAL'),
    ucs: ['Crédito', 'Leasing', 'Inversión y participaciones'],
  },

  // ---------- DIOQUIS CONSUMER ----------
  { id: P('HOLDING-CONSUMER'), nombre: 'Dioquis Consumer', tipo: 'holding_sectorial', estado: 'existente', padre: P('GRUPO-DIOQUIS') },
  { id: P('GIRLY-ZONE'), nombre: 'Girly Zone', tipo: 'concepto_comercial', estado: 'existente', padre: P('HOLDING-CONSUMER'), nota: 'Naturaleza en revisión. Ver ficha del vault.' },
  { id: P('ALTERCING-STUDIO'), nombre: 'Altercing Studio', tipo: 'empresa_operativa', estado: 'existente', padre: P('GIRLY-ZONE'), nota: 'Los datos operativos reales viven en el workspace WS-GIRLY-ZONE. Solo relación de UBICACIÓN confirmada con Girly Zone.' },
];

async function main() {
  const ws = await prisma.workspace.findUnique({ where: { id: WS } });
  if (!ws) throw new Error(`No existe el workspace ${WS}`);

  const existentes = await prisma.proyecto.findMany();
  const porId = new Map(existentes.map((p) => [p.id, p.data || {}]));

  let creados = 0, actualizados = 0, sinCambio = 0;
  const log = [];

  for (const n of ESTRUCTURA) {
    const prev = porId.get(n.id);
    const data = {
      id: n.id,
      workspaceId: WS,
      nombre: n.nombre,
      ...(n.padre ? { padreId: n.padre } : {}),
      ...(prev?.etapaObjetivo ? { etapaObjetivo: prev.etapaObjetivo } : {}),
      tipoEntidad: n.tipo,
      estadoEntidad: n.estado,
      ...(n.nombreAnterior ? { nombreAnterior: n.nombreAnterior } : {}),
      ...(n.alias ? { alias: n.alias } : {}),
      ...(n.nota ? { notaEntidad: n.nota } : {}),
    };
    const igual = prev && JSON.stringify({ ...prev }) === JSON.stringify(data);
    if (igual) { sinCambio++; continue; }
    if (!DRY) {
      await prisma.proyecto.upsert({
        where: { id: n.id },
        create: { id: n.id, data, version: 0 },
        update: { data },
      });
    }
    if (prev) { actualizados++; log.push(`  ~ ACTUALIZADO ${n.nombre} [${n.tipo}/${n.estado}]`); }
    else { creados++; log.push(`  + CREADO      ${n.nombre} [${n.tipo}/${n.estado}]`); }
  }

  // ---------- Unidades comerciales (idempotente por nombre dentro del proyecto) ----------
  const ucsExist = await prisma.unidadComercial.findMany();
  const claveUC = (proyectoId, nombre) => `${proyectoId}::${nombre.trim().toLowerCase()}`;
  const setUC = new Set(ucsExist.map((u) => claveUC(u.proyectoId, u.nombre)));
  let ucsCreadas = 0, ucsOmitidas = 0;
  for (const n of ESTRUCTURA) {
    for (const nombre of n.ucs ?? []) {
      if (setUC.has(claveUC(n.id, nombre))) { ucsOmitidas++; continue; }
      if (!DRY) {
        const id = `UC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        await prisma.unidadComercial.create({ data: { id, proyectoId: n.id, nombre, data: { tipo: '' } } });
      }
      setUC.add(claveUC(n.id, nombre));
      ucsCreadas++;
    }
  }

  console.log(DRY ? '=== SIMULACIÓN (--dry): nada se escribió ===' : '=== ALTA EJECUTADA ===');
  console.log(log.join('\n'));
  console.log(`\nPROYECTOS: ${creados} creados · ${actualizados} actualizados · ${sinCambio} sin cambio`);
  console.log(`UNIDADES COMERCIALES: ${ucsCreadas} creadas · ${ucsOmitidas} ya existían`);
}

try { await main(); }
catch (e) { console.error('FAIL', e instanceof Error ? e.message : String(e)); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
