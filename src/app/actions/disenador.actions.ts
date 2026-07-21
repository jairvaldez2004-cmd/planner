'use server';

// Server Action del DISEÑADOR 3D (ADITIVO). El agente amuebla la sede conversando:
// crea/mueve/gira/redimensiona/renombra/elimina ObjetoFisico reales en el plano.
// Ref: adapters/ai/arquitecto-agent.ts (correrDisenador3D) + domain/espacios (buscarHueco).

import { correrDisenador3D } from '@/adapters/ai/arquitecto-agent';
import type { EjecutorHerramienta, MensajeChat } from '@/adapters/ai/arquitecto-agent';
import {
  obtenerSede, listarEspacios, listarObjetos, crearObjeto, actualizarObjeto, eliminarObjeto,
  actualizarEspacio, actualizarSede, crearEspacio, eliminarEspacio,
} from '@/app/actions/espacios.actions';
import { esRectanguloLL, medidasDeRect, rectRotado, centroide } from '@/app/ui/huella-geo';
import type { LL } from '@/app/ui/huella-geo';
import type { CategoriaObjeto } from '@/domain/espacios';
import { buscarHueco, normalizarGrados, claveForma3D } from '@/domain/espacios';
import { codificarAcabado, describeAcabado } from '@/domain/acabados';
const tieneModeloGenerico = (n: string) => claveForma3D(n) !== null;
import { cargarConversacion, guardarConversacion } from '@/app/actions/contexto.actions';
import { modeloActual } from '@/app/actions/config.actions';

// Inversa SERIALIZABLE de una operación del agente: viaja al cliente, que la registra
// en la pila de deshacer; al deshacer, `aplicarInversaDisenador` la ejecuta.
export type InversaDisenador =
  | { tipo: 'actualizar_objeto'; id: string; patch: { x?: number; y?: number; rot?: number; ancho?: number; alto?: number; nombre?: string } }
  | { tipo: 'eliminar_objeto'; id: string }
  | { tipo: 'recrear_objeto'; sedeId: string; datos: { espacioId: string; nombre: string; categoria: CategoriaObjeto; capa: number; x: number; y: number; ancho: number; alto: number; rot: number; campos: Record<string, string> } }
  | { tipo: 'acabado_sede'; sedeId: string; campo: 'acabadoPiso' | 'acabadoMuros'; valor: string }
  | { tipo: 'acabado_area'; id: string; valor: string }
  | { tipo: 'eliminar_area'; id: string }
  | { tipo: 'actualizar_area'; id: string; patch: { nombre?: string; x?: number; y?: number; ancho?: number; alto?: number } }
  | { tipo: 'recrear_area'; sedeId: string; datos: { tipo: string; nombre: string; capa: number; x: number; y: number; ancho: number; alto: number; rot: number; ucIds: string[]; campos: Record<string, string>; objetos: { nombre: string; categoria: CategoriaObjeto; x: number; y: number; ancho: number; alto: number; rot: number; campos: Record<string, string> }[] } }
  | { tipo: 'huella'; sedeId: string; footAncho: number; footAlto: number; poligono: [number, number][] };

export interface RespuestaDisenador {
  reply: string;
  refrescar: boolean;
  inversas: { descripcion: string; op: InversaDisenador }[]; // en orden de ejecución
}

// Ejecuta una inversa (desde el botón de deshacer del cliente).
export async function aplicarInversaDisenador(proyectoId: string, op: InversaDisenador): Promise<void> {
  if (op.tipo === 'actualizar_objeto') { await actualizarObjeto(op.id, op.patch); return; }
  if (op.tipo === 'eliminar_objeto') { await eliminarObjeto(op.id); return; }
  if (op.tipo === 'recrear_objeto') {
    const d = op.datos;
    const n = await crearObjeto(proyectoId, op.sedeId, { espacioId: d.espacioId, nombre: d.nombre, categoria: d.categoria, capa: d.capa, x: d.x, y: d.y });
    await actualizarObjeto(n.id, { ancho: d.ancho, alto: d.alto, rot: d.rot, campos: d.campos });
    return;
  }
  if (op.tipo === 'acabado_sede') { await actualizarSede(op.sedeId, { [op.campo]: op.valor }); return; }
  if (op.tipo === 'acabado_area') { await actualizarEspacio(op.id, { campos: { acabadoPiso: op.valor } }); return; }
  if (op.tipo === 'eliminar_area') { await eliminarEspacio(op.id); return; }
  if (op.tipo === 'actualizar_area') { await actualizarEspacio(op.id, op.patch); return; }
  if (op.tipo === 'recrear_area') {
    const d = op.datos;
    const a = await crearEspacio(proyectoId, op.sedeId, { tipo: d.tipo as 'habitacion' | 'area', nombre: d.nombre, capa: d.capa, x: d.x, y: d.y, ancho: d.ancho, alto: d.alto });
    await actualizarEspacio(a.id, { ucIds: d.ucIds, rot: d.rot, campos: d.campos });
    // los objetos que vivían dentro vuelven con ella
    for (const o of d.objetos) {
      const n = await crearObjeto(proyectoId, op.sedeId, { espacioId: a.id, nombre: o.nombre, categoria: o.categoria, capa: d.capa, x: o.x, y: o.y });
      await actualizarObjeto(n.id, { ancho: o.ancho, alto: o.alto, rot: o.rot, campos: o.campos });
    }
    return;
  }
  if (op.tipo === 'huella') { await actualizarSede(op.sedeId, { footAncho: op.footAncho, footAlto: op.footAlto, poligono: op.poligono }); return; }
}

export async function conversarDisenador3D(
  historial: MensajeChat[],
  proyectoId: string,
  sedeId: string,
  capa: number,
): Promise<RespuestaDisenador> {
  const num = (v: unknown): number | undefined => (typeof v === 'number' && isFinite(v) ? v : undefined);
  const redondo = (v: number) => Number(v.toFixed(2));

  // Estado fresco por operación (el agente puede encadenar varias en un turno).
  const leer = async () => {
    const [sede, espacios, objetos] = await Promise.all([obtenerSede(sedeId), listarEspacios(sedeId), listarObjetos(sedeId)]);
    return { sede, espacios: espacios.filter((e) => e.capa === capa), objetos: objetos.filter((o) => o.capa === capa) };
  };
  const porNombre = <T extends { nombre: string }>(xs: T[], n: string): T | undefined => {
    const k = n.trim().toLowerCase();
    return xs.find((x) => x.nombre.trim().toLowerCase() === k) ?? xs.find((x) => x.nombre.toLowerCase().includes(k));
  };

  // Inversas del turno, en orden de ejecución (viajan al cliente para el deshacer).
  const inversas: { descripcion: string; op: InversaDisenador }[] = [];

  const ejecutar: EjecutorHerramienta = async (nombre, input) => {
    try {
      const { sede, espacios, objetos } = await leer();

      if (nombre === 'crear_objeto') {
        const nom = String(input.nombre ?? '').trim();
        if (!nom) return 'Falta el nombre del objeto.';
        const area = porNombre(espacios, String(input.area ?? ''));
        if (!area) return `No encontré el área "${String(input.area ?? '')}". Áreas disponibles: ${espacios.map((e) => e.nombre).join(', ') || 'ninguna'}.`;
        const ancho = num(input.ancho) ?? 0.5, fondo = num(input.fondo) ?? 0.5;
        let x = num(input.x), y = num(input.y);
        let aviso = '';
        if (x === undefined || y === undefined) {
          const hueco = buscarHueco(area, objetos, ancho, fondo);
          if (hueco) { x = hueco.x; y = hueco.y; }
          else {
            // No cabe sin encimarse: se coloca al centro pero SE AVISA — el agente debe
            // decírselo al usuario y proponer moverlo o usar otra área.
            x = redondo(area.x + Math.max(0, (area.ancho - ancho) / 2));
            y = redondo(area.y + Math.max(0, (area.alto - fondo) / 2));
            aviso = ` ⚠ OJO: no había hueco libre suficiente en "${area.nombre}" (${area.ancho}×${area.alto} m) — quedó al CENTRO y probablemente ENCIMADO con otros objetos. Dile al usuario y propón moverlo o usar otra área.`;
          }
        }
        const cat = (['mueble', 'herramienta', 'insumo', 'equipo'].includes(String(input.categoria)) ? String(input.categoria) : 'mueble') as CategoriaObjeto;
        const o = await crearObjeto(proyectoId, sedeId, { espacioId: area.id, nombre: nom, categoria: cat, capa, x: redondo(x), y: redondo(y) });
        const giro = num(input.giro);
        await actualizarObjeto(o.id, { ancho: redondo(ancho), alto: redondo(fondo), ...(giro !== undefined ? { rot: normalizarGrados(Math.round(giro)) } : {}) });
        inversas.push({ descripcion: `crear "${nom}"`, op: { tipo: 'eliminar_objeto', id: o.id } });
        const forma = tieneModeloGenerico(nom) ? 'con forma 3D reconocible' : 'se verá como caja (nombre sin palabra clave; puede subirle un .glb)';
        return `Creado "${nom}" (${ancho}×${fondo} m) en "${area.nombre}" en (${redondo(x)}, ${redondo(y)})${giro ? ` girado ${giro}°` : ''} — ${forma}.${aviso}`;
      }

      if (nombre === 'mover_objeto') {
        const o = porNombre(objetos, String(input.objeto ?? ''));
        if (!o) return `No encontré el objeto "${String(input.objeto ?? '')}".`;
        const x = num(input.x), y = num(input.y);
        if (x === undefined || y === undefined) return 'Faltan x/y.';
        inversas.push({ descripcion: `mover "${o.nombre}"`, op: { tipo: 'actualizar_objeto', id: o.id, patch: { x: o.x, y: o.y } } });
        await actualizarObjeto(o.id, { x: redondo(Math.max(0, x)), y: redondo(Math.max(0, y)) });
        return `"${o.nombre}" movido a (${redondo(x)}, ${redondo(y)}).`;
      }

      if (nombre === 'rotar_objeto') {
        const o = porNombre(objetos, String(input.objeto ?? ''));
        if (!o) return `No encontré el objeto "${String(input.objeto ?? '')}".`;
        const g = normalizarGrados(Math.round(num(input.grados) ?? 0));
        inversas.push({ descripcion: `girar "${o.nombre}"`, op: { tipo: 'actualizar_objeto', id: o.id, patch: { rot: o.rot } } });
        await actualizarObjeto(o.id, { rot: g });
        return `"${o.nombre}" girado a ${g}°.`;
      }

      if (nombre === 'redimensionar_objeto') {
        const o = porNombre(objetos, String(input.objeto ?? ''));
        if (!o) return `No encontré el objeto "${String(input.objeto ?? '')}".`;
        const ancho = num(input.ancho), fondo = num(input.fondo);
        if (!ancho || !fondo) return 'Faltan ancho/fondo.';
        inversas.push({ descripcion: `redimensionar "${o.nombre}"`, op: { tipo: 'actualizar_objeto', id: o.id, patch: { ancho: o.ancho, alto: o.alto } } });
        await actualizarObjeto(o.id, { ancho: redondo(ancho), alto: redondo(fondo) });
        return `"${o.nombre}" ahora mide ${ancho}×${fondo} m.`;
      }

      if (nombre === 'renombrar_objeto') {
        const o = porNombre(objetos, String(input.objeto ?? ''));
        if (!o) return `No encontré el objeto "${String(input.objeto ?? '')}".`;
        const nuevo = String(input.nuevoNombre ?? '').trim();
        if (!nuevo) return 'Falta el nuevo nombre.';
        inversas.push({ descripcion: `renombrar "${o.nombre}"`, op: { tipo: 'actualizar_objeto', id: o.id, patch: { nombre: o.nombre } } });
        await actualizarObjeto(o.id, { nombre: nuevo });
        return `"${o.nombre}" renombrado a "${nuevo}"${tieneModeloGenerico(nuevo) ? ' (con forma 3D reconocible)' : ''}.`;
      }

      if (nombre === 'eliminar_objeto') {
        const o = porNombre(objetos, String(input.objeto ?? ''));
        if (!o) return `No encontré el objeto "${String(input.objeto ?? '')}".`;
        inversas.push({ descripcion: `eliminar "${o.nombre}"`, op: { tipo: 'recrear_objeto', sedeId, datos: { espacioId: o.espacioId, nombre: o.nombre, categoria: o.categoria, capa: o.capa, x: o.x, y: o.y, ancho: o.ancho, alto: o.alto, rot: o.rot, campos: o.data } } });
        await eliminarObjeto(o.id);
        return `"${o.nombre}" eliminado del plano.`;
      }

      if (nombre === 'acabado_piso') {
        const cod = codificarAcabado(String(input.tipo ?? ''), input.color ? String(input.color) : undefined, 'piso');
        if (!cod) return `Tipo de piso no válido: "${String(input.tipo ?? '')}". Usa duela, porcelanato, azulejo, cemento, alfombra o pintura.`;
        const areaTxt = String(input.area ?? '').trim();
        if (areaTxt) {
          const area = porNombre(espacios, areaTxt);
          if (!area) return `No encontré el área "${areaTxt}". Áreas: ${espacios.map((e) => e.nombre).join(', ')}.`;
          inversas.push({ descripcion: `piso de "${area.nombre}"`, op: { tipo: 'acabado_area', id: area.id, valor: area.data.acabadoPiso ?? '' } });
          await actualizarEspacio(area.id, { campos: { acabadoPiso: cod } });
          return `Piso de "${area.nombre}": ahora ${describeAcabado(cod)}.`;
        }
        inversas.push({ descripcion: 'piso de la sede', op: { tipo: 'acabado_sede', sedeId, campo: 'acabadoPiso', valor: sede?.acabadoPiso ?? '' } });
        await actualizarSede(sedeId, { acabadoPiso: cod });
        return `Piso de toda la sede: ahora ${describeAcabado(cod)}.`;
      }

      if (nombre === 'acabado_muros') {
        const cod = codificarAcabado(String(input.tipo ?? ''), input.color ? String(input.color) : undefined, 'muro');
        if (!cod) return `Tipo de muro no válido: "${String(input.tipo ?? '')}". Usa pintura, azulejo, ladrillo, cemento o yeso.`;
        inversas.push({ descripcion: 'muros de la sede', op: { tipo: 'acabado_sede', sedeId, campo: 'acabadoMuros', valor: sede?.acabadoMuros ?? '' } });
        await actualizarSede(sedeId, { acabadoMuros: cod });
        return `Muros de la sede: ahora ${describeAcabado(cod)}.`;
      }

      if (nombre === 'crear_area') {
        const nom = String(input.nombre ?? '').trim();
        if (!nom) return 'Falta el nombre del área.';
        const ancho = num(input.ancho) ?? 3, fondo = num(input.fondo) ?? 3;
        let x = num(input.x), y = num(input.y);
        if (x === undefined || y === undefined) {
          // sin posición: a la derecha de lo que ya existe
          const derecha = espacios.length ? Math.max(...espacios.map((e) => e.x + e.ancho)) : 0;
          x = x ?? (derecha ? Number((derecha + 0.15).toFixed(2)) : 0.2);
          y = y ?? 0.2;
        }
        const tipoA = (String(input.tipo) === 'habitacion' ? 'habitacion' : 'area') as 'habitacion' | 'area';
        const a = await crearEspacio(proyectoId, sedeId, { tipo: tipoA, nombre: nom, capa, x: redondo(x), y: redondo(y), ancho: redondo(ancho), alto: redondo(fondo) });
        inversas.push({ descripcion: `crear área "${nom}"`, op: { tipo: 'eliminar_area', id: a.id } });
        return `Área "${nom}" creada (${ancho}×${fondo} m) en (${redondo(x)}, ${redondo(y)}).`;
      }

      if (nombre === 'actualizar_area') {
        const a = porNombre(espacios, String(input.area ?? ''));
        if (!a) return `No encontré el área "${String(input.area ?? '')}". Áreas: ${espacios.map((e) => e.nombre).join(', ')}.`;
        const patch: { nombre?: string; x?: number; y?: number; ancho?: number; alto?: number } = {};
        const prev: typeof patch = {};
        if (input.nuevoNombre) { patch.nombre = String(input.nuevoNombre).trim(); prev.nombre = a.nombre; }
        for (const [k, campo] of [['x', 'x'], ['y', 'y'], ['ancho', 'ancho'], ['fondo', 'alto']] as const) {
          const v = num(input[k]);
          if (v !== undefined) { patch[campo] = redondo(v); prev[campo] = a[campo]; }
        }
        if (!Object.keys(patch).length) return 'No indicaste qué cambiar del área.';
        inversas.push({ descripcion: `ajustar área "${a.nombre}"`, op: { tipo: 'actualizar_area', id: a.id, patch: prev } });
        await actualizarEspacio(a.id, patch);
        return `Área "${a.nombre}" actualizada.`;
      }

      if (nombre === 'eliminar_area') {
        const a = porNombre(espacios, String(input.area ?? ''));
        if (!a) return `No encontré el área "${String(input.area ?? '')}".`;
        const dentro = objetos.filter((o) => o.espacioId === a.id);
        inversas.push({
          descripcion: `eliminar área "${a.nombre}"`,
          op: { tipo: 'recrear_area', sedeId, datos: { tipo: a.tipo, nombre: a.nombre, capa: a.capa, x: a.x, y: a.y, ancho: a.ancho, alto: a.alto, rot: a.rot, ucIds: a.ucIds, campos: a.data, objetos: dentro.map((o) => ({ nombre: o.nombre, categoria: o.categoria, x: o.x, y: o.y, ancho: o.ancho, alto: o.alto, rot: o.rot, campos: o.data })) } },
        });
        await eliminarEspacio(a.id);
        return `Área "${a.nombre}" eliminada${dentro.length ? ` (con sus ${dentro.length} objetos)` : ''}.`;
      }

      if (nombre === 'ajustar_huella') {
        const ancho = num(input.ancho), fondo = num(input.fondo);
        if (!ancho || !fondo || ancho < 1 || fondo < 1 || ancho > 500 || fondo > 500) return 'Medidas de huella no válidas (1–500 m).';
        const prevPoly = (sede?.poligono ?? []) as [number, number][];
        inversas.push({ descripcion: `huella a ${ancho}×${fondo} m`, op: { tipo: 'huella', sedeId, footAncho: sede?.footAncho ?? 20, footAlto: sede?.footAlto ?? 15, poligono: prevPoly } });
        // si hay huella rectangular georreferenciada en el mapa, se regenera con el
        // mismo centro y orientación para que el mapa no quede desfasado
        let poligono = prevPoly;
        if (prevPoly.length === 4 && esRectanguloLL(prevPoly as LL[])) {
          const med = medidasDeRect(prevPoly as LL[]);
          poligono = rectRotado(centroide(prevPoly as LL[]), ancho, fondo, med.orient) as [number, number][];
        }
        await actualizarSede(sedeId, { footAncho: redondo(ancho), footAlto: redondo(fondo), poligono });
        return `Huella de la sede ajustada a ${ancho}×${fondo} m${poligono !== prevPoly ? ' (la huella del mapa se regeneró con el mismo centro y orientación)' : ''}.`;
      }

      return `Herramienta desconocida: ${nombre}`;
    } catch (e) {
      return `Error al ejecutar ${nombre}: ${e instanceof Error ? e.message : String(e)}`;
    }
  };

  try {
    const estado = await snapshotSede(sedeId, capa);
    const r = await correrDisenador3D(historial, estado, ejecutar, await modeloActual('curador'));
    // Las fotos NO se persisten: engordarían la BD y se re-pagarían sus tokens en cada
    // turno siguiente. Queda la marca "[N foto(s) adjunta(s)]" en el texto del historial.
    const sinFotos: MensajeChat[] = historial.map((m) =>
      m.imagenes?.length ? { role: m.role, content: `${m.content || ''} [${m.imagenes.length} foto${m.imagenes.length > 1 ? 's' : ''} adjunta${m.imagenes.length > 1 ? 's' : ''}]`.trim() } : m);
    await guardarConversacion(`SEDE3D:${sedeId}`, [...sinFotos, { role: 'assistant', content: r.reply }]);
    return { reply: r.reply, refrescar: r.huboCambios, inversas };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const falta = /api[_ -]?key|authentication|x-api-key/i.test(msg)
      ? 'Falta ANTHROPIC_API_KEY.' : msg;
    return { reply: `⚠ No pude consultar al Diseñador (IA): ${falta}`, refrescar: false, inversas };
  }
}

export async function cargarChatDisenador(sedeId: string): Promise<MensajeChat[]> {
  return cargarConversacion(`SEDE3D:${sedeId}`);
}

// Estado del plano que ve el agente en cada turno (se reconstruye de la BD).
async function snapshotSede(sedeId: string, capa: number): Promise<string> {
  const [sede, espacios, objetos] = await Promise.all([obtenerSede(sedeId), listarEspacios(sedeId), listarObjetos(sedeId)]);
  const esp = espacios.filter((e) => e.capa === capa);
  const obj = objetos.filter((o) => o.capa === capa);
  const areaDe = new Map(esp.map((e) => [e.id, e.nombre]));
  const L: string[] = [];
  L.push(`# Estado del plano (nivel ${capa}) — se actualiza en cada turno`);
  L.push(`Huella de la sede "${sede?.nombre ?? '?'}": ${sede?.footAncho ?? 20} m de ancho (x) × ${sede?.footAlto ?? 15} m de fondo (y).`);
  L.push(`Acabados actuales: piso general = ${describeAcabado(sede?.acabadoPiso)} · muros = ${describeAcabado(sede?.acabadoMuros)}.`);
  L.push(`Áreas (${esp.length}):`);
  for (const e of esp) L.push(`  · "${e.nombre}" — x=${e.x} y=${e.y} ancho=${e.ancho} fondo=${e.alto}${e.data.acabadoPiso ? ` · piso: ${describeAcabado(e.data.acabadoPiso)}` : ''}`);
  L.push(`Objetos (${obj.length}):`);
  for (const o of obj) L.push(`  · "${o.nombre}" [${o.categoria}] en "${areaDe.get(o.espacioId) ?? '?'}" — x=${o.x} y=${o.y} ancho=${o.ancho} fondo=${o.alto}${o.rot ? ` giro=${o.rot}°` : ''}`);
  if (!obj.length) L.push('  (ninguno todavía)');
  return L.join('\n');
}
