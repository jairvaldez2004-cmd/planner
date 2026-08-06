// CONSOLIDACIÓN: mueve los proyectos del workspace WS-GIRLY-ZONE (que tienen los datos
// operativos reales) dentro de WS-GRUPO-DIOQUIS, y elimina los cascarones duplicados vacíos.
//
// SEGURIDAD:
//  · Todo el dato cuelga de `proyectoId`, NO de `workspaceId` → mover el proyecto conserva
//    ofertas, presentaciones, planos, procesos, sedes, tablas, etc. sin tocar una sola fila.
//  · Los ids de proyecto NO se cambian (romperían todas las referencias). El prefijo del id
//    es cosmético e histórico.
//  · Antes de borrar un cascarón se AUDITAN las 15 tablas que cuelgan de proyectoId.
//    Si alguna tiene datos, se ABORTA sin borrar nada.
//
// Correr: DATABASE_URL=<public> node scripts/consolidar-dioquis.mjs [--dry]
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const WS_DESTINO = 'WS-GRUPO-DIOQUIS';
const WS_ORIGEN = 'WS-GIRLY-ZONE';
const CONSUMER = 'WS-GRUPO-DIOQUIS--HOLDING-CONSUMER';

// Proyectos que se MUEVEN (traen sus datos) y su nueva taxonomía/padre.
const MOVER = [
  { id: 'WS-GIRLY-ZONE--GIRLY-ZONE', padre: CONSUMER, tipo: 'concepto_comercial', estado: 'existente',
    nota: 'Naturaleza en revisión (empresa operadora / concepto / plaza / marca paraguas). Solo la relación de UBICACIÓN con Altercing está confirmada.' },
  { id: 'WS-GIRLY-ZONE--ALTERCING-STUDIO', padre: 'WS-GIRLY-ZONE--GIRLY-ZONE', tipo: 'empresa_operativa', estado: 'existente',
    nota: 'Empresa con datos operativos completos: 18 planos, 5 ofertas, 69 presentaciones, mapa operativo y sede real.' },
  { id: 'WS-GIRLY-ZONE--MACAO-PILATES-STUDIO', padre: 'WS-GIRLY-ZONE--GIRLY-ZONE', tipo: 'empresa_operativa', estado: 'propuesta',
    nota: 'No confundir con Macao Marketing (Dioquis Business). Estado por confirmar.' },
];

// Cascarones duplicados a eliminar SOLO si están vacíos.
const BORRAR = ['WS-GRUPO-DIOQUIS--ALTERCING-STUDIO', 'WS-GRUPO-DIOQUIS--GIRLY-ZONE'];

// Las 15 tablas que cuelgan de proyectoId.
async function auditar(proyectoId) {
  const c = {
    unidadComercial: await prisma.unidadComercial.count({ where: { proyectoId } }),
    oferta: await prisma.oferta.count({ where: { proyectoId } }),
    presentacion: await prisma.presentacion.count({ where: { proyectoId } }),
    proceso: await prisma.proceso.count({ where: { proyectoId } }),
    departamento: await prisma.departamento.count({ where: { proyectoId } }),
    sede: await prisma.sede.count({ where: { proyectoId } }),
    espacio: await prisma.espacio.count({ where: { proyectoId } }),
    objetoFisico: await prisma.objetoFisico.count({ where: { proyectoId } }),
    elementoArq: await prisma.elementoArq.count({ where: { proyectoId } }),
    renderSede: await prisma.renderSede.count({ where: { proyectoId } }),
    modelo3DObjeto: await prisma.modelo3DObjeto.count({ where: { proyectoId } }),
    modelo3DNivel: await prisma.modelo3DNivel.count({ where: { proyectoId } }),
    tablaProyecto: await prisma.tablaProyecto.count({ where: { proyectoId } }),
    proyectoPlanoEstado: await prisma.proyectoPlanoEstado.count({ where: { proyectoId } }),
    proyectoDiagnostico: await prisma.proyectoDiagnostico.count({ where: { proyectoId } }),
    // Memoria del Curador: clave = "PROJ:<proyectoId>" (y variantes de chat por alcance).
    conversacion: await prisma.conversacion.count({ where: { clave: { contains: proyectoId } } }),
  };
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const detalle = Object.entries(c).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(' · ');
  return { total, detalle, diag: c.proyectoDiagnostico };
}

async function main() {
  console.log(DRY ? '=== SIMULACIÓN (--dry): nada se escribirá ===\n' : '=== CONSOLIDACIÓN ===\n');

  // 1) Auditoría de lo que se va a MOVER (debe tener datos: es lo valioso)
  console.log('1) Proyectos a MOVER (conservan todos sus datos):');
  for (const m of MOVER) {
    const p = await prisma.proyecto.findUnique({ where: { id: m.id } });
    if (!p) throw new Error(`No existe el proyecto a mover: ${m.id}`);
    const a = await auditar(m.id);
    console.log(`   · ${(p.data || {}).nombre}  → ${a.total} registros  ${a.detalle ? `(${a.detalle})` : '(vacío)'}`);
  }

  // 2) Auditoría de los cascarones a BORRAR.
  // Se permite borrar SOLO si su único contenido es `proyectoDiagnostico` (diagnóstico
  // genérico autogenerado al crear la estructura). Cualquier otro dato ABORTA la operación.
  // El diagnóstico se RESPALDA a disco antes de borrarse.
  console.log('\n2) Cascarones a ELIMINAR (auditoría de las 16 tablas):');
  const bloqueantes = [];
  const respaldo = [];
  for (const id of BORRAR) {
    const p = await prisma.proyecto.findUnique({ where: { id } });
    if (!p) { console.log(`   · ${id} — no existe, nada que borrar`); continue; }
    const a = await auditar(id);
    const soloDiagnostico = a.total === a.diag && a.diag > 0;
    const estado = a.total === 0 ? 'VACÍO ✅' : soloDiagnostico ? 'solo diagnóstico → se respalda ✅' : '⛔ TIENE DATOS';
    console.log(`   · ${(p.data || {}).nombre} (${id}) → ${a.total} registros (${a.detalle || '—'}) ${estado}`);
    if (a.total > 0 && !soloDiagnostico) bloqueantes.push({ id, ...a });
    if (a.diag > 0) {
      const d = await prisma.proyectoDiagnostico.findUnique({ where: { proyectoId: id } });
      respaldo.push({ proyectoId: id, nombre: (p.data || {}).nombre, proyecto: p.data, diagnostico: d });
    }
  }
  if (bloqueantes.length) {
    console.error('\n⛔ ABORTADO: hay cascarones con datos operativos. No se borra nada.');
    for (const n of bloqueantes) console.error(`   ${n.id}: ${n.detalle}`);
    process.exitCode = 1;
    return;
  }
  if (respaldo.length) {
    const ruta = 'scripts/_respaldo-cascarones-dioquis.json';
    if (!DRY) writeFileSync(ruta, JSON.stringify(respaldo, null, 2), 'utf8');
    console.log(`   💾 respaldo de ${respaldo.length} diagnóstico(s) → ${ruta}`);
  }

  // 3) Mover
  console.log('\n3) Moviendo proyectos a ' + WS_DESTINO + '…');
  for (const m of MOVER) {
    const p = await prisma.proyecto.findUnique({ where: { id: m.id } });
    const prev = p.data || {};
    const data = {
      ...prev,
      workspaceId: WS_DESTINO,
      padreId: m.padre,
      tipoEntidad: m.tipo,
      estadoEntidad: m.estado,
      notaEntidad: m.nota,
    };
    if (!DRY) await prisma.proyecto.update({ where: { id: m.id }, data: { data } });
    console.log(`   ✓ ${prev.nombre} → padre ${m.padre} [${m.tipo}/${m.estado}]`);
  }

  // 4) Borrar cascarones vacíos
  console.log('\n4) Eliminando cascarones vacíos…');
  for (const id of BORRAR) {
    const p = await prisma.proyecto.findUnique({ where: { id } });
    if (!p) continue;
    if (!DRY) {
      await prisma.proyectoDiagnostico.deleteMany({ where: { proyectoId: id } });
      await prisma.proyecto.delete({ where: { id } });
    }
    console.log(`   ✓ eliminado ${(p.data || {}).nombre} (${id}) + su diagnóstico (respaldado)`);
  }

  // 4b) Relaciones entre proyectos: viven por workspaceId, hay que reapuntarlas.
  const rels = await prisma.relacionProyecto.findMany({ where: { workspaceId: WS_ORIGEN } });
  if (rels.length) {
    if (!DRY) await prisma.relacionProyecto.updateMany({ where: { workspaceId: WS_ORIGEN }, data: { workspaceId: WS_DESTINO } });
    console.log(`   ✓ ${rels.length} relación(es) entre proyectos reapuntadas a ${WS_DESTINO}`);
  } else {
    console.log('   · sin relaciones entre proyectos que mover');
  }

  // 5) Workspace origen: queda vacío
  const quedan = (await prisma.proyecto.findMany()).filter((p) => (p.data || {}).workspaceId === WS_ORIGEN);
  console.log(`\n5) Workspace ${WS_ORIGEN}: quedan ${quedan.length} proyecto(s).`);
  if (quedan.length === 0) {
    if (!DRY) await prisma.workspace.deleteMany({ where: { id: WS_ORIGEN } });
    console.log(`   ✓ workspace vacío eliminado`);
  } else {
    console.log(`   ⚠ NO se elimina: todavía tiene proyectos.`);
  }

  console.log('\n✅ Consolidación completa.');
}

try { await main(); }
catch (e) { console.error('FAIL', e instanceof Error ? e.message : String(e)); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
