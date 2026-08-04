// Genera los entregables REALES de Altercing (mismo motor que la app) y los escribe a disco.
// Correr: DATABASE_URL=<public> npx tsx scripts/generar-entregables.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { PAQUETES } from '@/domain/entregables';
import { generarPaqueteEntregables, generarDocumentoDePlano, obtenerDetallePlano } from '@/app/actions/especialista.actions';
import { ORDEN_PLANOS } from '@/domain/diagnostico';

const PID = 'WS-GIRLY-ZONE--ALTERCING-STUDIO';
const OUT = process.env.OUT_DIR || './entregables-altercing';

async function main() {
  mkdirSync(OUT, { recursive: true });

  // 1) Cada plano (readiness real: pendientes/total)
  console.log('=== PLANOS (documento por plano) ===');
  let totPend = 0, totReq = 0;
  for (const planoId of ORDEN_PLANOS) {
    const doc = await generarDocumentoDePlano(PID, planoId);
    if (!doc) { console.log(`  ${planoId}: (sin config)`); continue; }
    totPend += doc.pendientes; totReq += doc.totalRequerido;
    const bar = doc.pendientes === 0 ? '✅' : '⚠ ';
    console.log(`  ${bar} ${planoId.padEnd(5)} ${doc.titulo.padEnd(34)} pendientes ${doc.pendientes}/${doc.totalRequerido}`);
  }
  console.log(`  ----> TOTAL: ${totPend} pendientes de ${totReq} requeridos al nivel del proyecto.`);

  // 2) Cada paquete de entregables
  console.log('\n=== PAQUETES (entregables) ===');
  for (const pq of PAQUETES) {
    const doc = await generarPaqueteEntregables(PID, pq.id);
    if (!doc) { console.log(`  ${pq.id}: (no generado)`); continue; }
    const file = `${OUT}/${pq.id}.md`;
    writeFileSync(file, doc.markup, 'utf8');
    const bar = doc.pendientes === 0 ? '✅' : '⚠ ';
    console.log(`  ${bar} ${pq.icono} ${doc.titulo.padEnd(40)} ${doc.pendientes}/${doc.totalRequerido} pend · ${doc.planos.length} planos · ${(doc.markup.length/1024).toFixed(0)} KB → ${file}`);
  }

  console.log(`\n🎉 Entregables escritos en ${OUT}/`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('GEN_FAIL', e); process.exit(1); });
