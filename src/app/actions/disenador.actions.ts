'use server';

// Server Action del DISEÑADOR 3D (ADITIVO). El agente amuebla la sede conversando:
// crea/mueve/gira/redimensiona/renombra/elimina ObjetoFisico reales en el plano.
// Ref: adapters/ai/arquitecto-agent.ts (correrDisenador3D) + domain/espacios (buscarHueco).

import { correrDisenador3D } from '@/adapters/ai/arquitecto-agent';
import type { EjecutorHerramienta, MensajeChat } from '@/adapters/ai/arquitecto-agent';
import {
  obtenerSede, listarEspacios, listarObjetos, crearObjeto, actualizarObjeto, eliminarObjeto,
} from '@/app/actions/espacios.actions';
import type { CategoriaObjeto } from '@/domain/espacios';
import { buscarHueco, normalizarGrados, claveForma3D } from '@/domain/espacios';
const tieneModeloGenerico = (n: string) => claveForma3D(n) !== null;
import { cargarConversacion, guardarConversacion } from '@/app/actions/contexto.actions';
import { modeloActual } from '@/app/actions/config.actions';

export interface RespuestaDisenador { reply: string; refrescar: boolean }

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

  const ejecutar: EjecutorHerramienta = async (nombre, input) => {
    try {
      const { espacios, objetos } = await leer();

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
        const forma = tieneModeloGenerico(nom) ? 'con forma 3D reconocible' : 'se verá como caja (nombre sin palabra clave; puede subirle un .glb)';
        return `Creado "${nom}" (${ancho}×${fondo} m) en "${area.nombre}" en (${redondo(x)}, ${redondo(y)})${giro ? ` girado ${giro}°` : ''} — ${forma}.${aviso}`;
      }

      if (nombre === 'mover_objeto') {
        const o = porNombre(objetos, String(input.objeto ?? ''));
        if (!o) return `No encontré el objeto "${String(input.objeto ?? '')}".`;
        const x = num(input.x), y = num(input.y);
        if (x === undefined || y === undefined) return 'Faltan x/y.';
        await actualizarObjeto(o.id, { x: redondo(Math.max(0, x)), y: redondo(Math.max(0, y)) });
        return `"${o.nombre}" movido a (${redondo(x)}, ${redondo(y)}).`;
      }

      if (nombre === 'rotar_objeto') {
        const o = porNombre(objetos, String(input.objeto ?? ''));
        if (!o) return `No encontré el objeto "${String(input.objeto ?? '')}".`;
        const g = normalizarGrados(Math.round(num(input.grados) ?? 0));
        await actualizarObjeto(o.id, { rot: g });
        return `"${o.nombre}" girado a ${g}°.`;
      }

      if (nombre === 'redimensionar_objeto') {
        const o = porNombre(objetos, String(input.objeto ?? ''));
        if (!o) return `No encontré el objeto "${String(input.objeto ?? '')}".`;
        const ancho = num(input.ancho), fondo = num(input.fondo);
        if (!ancho || !fondo) return 'Faltan ancho/fondo.';
        await actualizarObjeto(o.id, { ancho: redondo(ancho), alto: redondo(fondo) });
        return `"${o.nombre}" ahora mide ${ancho}×${fondo} m.`;
      }

      if (nombre === 'renombrar_objeto') {
        const o = porNombre(objetos, String(input.objeto ?? ''));
        if (!o) return `No encontré el objeto "${String(input.objeto ?? '')}".`;
        const nuevo = String(input.nuevoNombre ?? '').trim();
        if (!nuevo) return 'Falta el nuevo nombre.';
        await actualizarObjeto(o.id, { nombre: nuevo });
        return `"${o.nombre}" renombrado a "${nuevo}"${tieneModeloGenerico(nuevo) ? ' (con forma 3D reconocible)' : ''}.`;
      }

      if (nombre === 'eliminar_objeto') {
        const o = porNombre(objetos, String(input.objeto ?? ''));
        if (!o) return `No encontré el objeto "${String(input.objeto ?? '')}".`;
        await eliminarObjeto(o.id);
        return `"${o.nombre}" eliminado del plano.`;
      }

      return `Herramienta desconocida: ${nombre}`;
    } catch (e) {
      return `Error al ejecutar ${nombre}: ${e instanceof Error ? e.message : String(e)}`;
    }
  };

  try {
    const estado = await snapshotSede(sedeId, capa);
    const r = await correrDisenador3D(historial, estado, ejecutar, await modeloActual('curador'));
    await guardarConversacion(`SEDE3D:${sedeId}`, [...historial, { role: 'assistant', content: r.reply }]);
    return { reply: r.reply, refrescar: r.huboCambios };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const falta = /api[_ -]?key|authentication|x-api-key/i.test(msg)
      ? 'Falta ANTHROPIC_API_KEY.' : msg;
    return { reply: `⚠ No pude consultar al Diseñador (IA): ${falta}`, refrescar: false };
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
  L.push(`Áreas (${esp.length}):`);
  for (const e of esp) L.push(`  · "${e.nombre}" — x=${e.x} y=${e.y} ancho=${e.ancho} fondo=${e.alto}`);
  L.push(`Objetos (${obj.length}):`);
  for (const o of obj) L.push(`  · "${o.nombre}" [${o.categoria}] en "${areaDe.get(o.espacioId) ?? '?'}" — x=${o.x} y=${o.y} ancho=${o.ancho} fondo=${o.alto}${o.rot ? ` giro=${o.rot}°` : ''}`);
  if (!obj.length) L.push('  (ninguno todavía)');
  return L.join('\n');
}
