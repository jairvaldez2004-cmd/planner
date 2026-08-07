// Estimador OFFLINE del costo de traducir los datos de un proyecto. No llama a la API:
// solo cuenta caracteres y multiplica por la tarifa. Sirve para dimensionar antes de gastar.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PRECIO = { 'claude-haiku-4-5': [1,5], 'claude-sonnet-4-6': [3,15], 'claude-opus-4-8': [5,25] };

function esTraducible(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (s.length < 2 || s.length > 2000) return false;
  if (!/[a-záéíóúñA-ZÁÉÍÓÚÑ]/.test(s)) return false;
  if (/^[a-z0-9_-]+$/.test(s)) return false;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return false;
  if (/^https?:\/\//i.test(s)) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return false;
  if (/^[{[]/.test(s)) return false;
  return true;
}
function recorrer(v, out, d = 0) {
  if (d > 8) return;
  if (esTraducible(v)) { out.add(v.trim()); return; }
  if (Array.isArray(v)) { for (const x of v) recorrer(x, out, d + 1); return; }
  if (v && typeof v === 'object') for (const x of Object.values(v)) recorrer(x, out, d + 1);
}

const proyectos = await prisma.proyecto.findMany();
console.log(`\nProyectos en la base: ${proyectos.length}\n`);

let granTotal = new Set();
for (const pr of proyectos) {
  const p = { proyectoId: pr.id };
  const [ucs, sedes, esp, of, pres, dep, proc, planos, tablas, diag] = await Promise.all([
    prisma.unidadComercial.findMany({ where: p }), prisma.sede.findMany({ where: p }),
    prisma.espacio.findMany({ where: p }), prisma.oferta.findMany({ where: p }),
    prisma.presentacion.findMany({ where: p }), prisma.departamento.findMany({ where: p }),
    prisma.proceso.findMany({ where: p }), prisma.proyectoPlanoEstado.findMany({ where: p }),
    prisma.tablaProyecto.findMany({ where: p }),
    prisma.proyectoDiagnostico.findUnique({ where: { proyectoId: pr.id } }),
  ]);
  const set = new Set();
  for (const r of [...ucs, ...sedes, ...of, ...pres, ...dep, ...proc]) {
    if (esTraducible(r.nombre)) set.add(r.nombre.trim());
    recorrer(r.data, set);
  }
  for (const e of esp) if (esTraducible(e.nombre)) set.add(e.nombre.trim());
  for (const x of planos) recorrer(x.campos, set);
  for (const x of tablas) recorrer(x.filas, set);
  if (diag) recorrer(diag.diagnostico, set);

  const chars = [...set].reduce((s, t) => s + t.length, 0);
  if (set.size) {
    const nombre = (pr.data?.nombre) ?? pr.id;
    console.log(`  ${String(set.size).padStart(5)} textos · ${String(chars).padStart(7)} chars · ${nombre}`);
  }
  for (const s of set) granTotal.add(s);
}

const chars = [...granTotal].reduce((s, t) => s + t.length, 0);
const lotes = Math.ceil(granTotal.size / 40);
const tIn = chars / 3.3 + lotes * 400, tOut = (chars / 3.3) * 1.1;
console.log(`\n  TOTAL ÚNICO: ${granTotal.size} textos · ${chars.toLocaleString()} caracteres · ${lotes} lotes`);
console.log(`  ≈ ${Math.round(tIn).toLocaleString()} tokens entrada + ${Math.round(tOut).toLocaleString()} tokens salida\n`);
for (const [m, [pi, po]] of Object.entries(PRECIO)) {
  const c = (tIn / 1e6) * pi + (tOut / 1e6) * po;
  console.log(`  ${m.padEnd(20)} $${c.toFixed(3)} USD  (una sola vez)`);
}
console.log();
await prisma.$disconnect();
