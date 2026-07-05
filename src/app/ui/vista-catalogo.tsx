'use client';

// INC-1 · Vista Catálogo maestro (UI mínima, ADITIVA).
// Listar/buscar/filtrar productos maestros · crear producto · seleccionar y crear plano COM-EXP.
// NO reemplaza el editor: al crear el plano, lo abre en "Nuevo Plano" (flujo existente).

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ProductoCatalogo } from '@/domain/catalogo';
import { CATALOGO_MAESTRO_ID } from '@/domain/catalogo';
import type { RestriccionCarga } from '@/domain/plano-com-exp';
import {
  listarProductosCatalogo, crearProductoCatalogo, eliminarProductoCatalogo,
  sembrarCatalogoMaestro, crearPlanoDesdeCatalogo, actualizarOperativoProducto,
} from '@/app/actions/catalogo.actions';

const RESTRICCIONES: RestriccionCarga[] = ['general', 'hazmat', 'perecedero', 'automotriz', 'ganado', 'granel'];

const card: CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: '0.6rem 0.9rem', margin: '0.4rem 0', background: '#fafafa' };
const btn: CSSProperties = { padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer', fontSize: 13 };
const inp: CSSProperties = { padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid #ccc' };

interface Props {
  onPlanoCreado: (planoId: string) => void;
}

export function VistaCatalogo({ onPlanoCreado }: Props) {
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [entidad, setEntidad] = useState('');
  const [msg, setMsg] = useState('');

  // alta de producto maestro
  const [nSku, setNSku] = useState('');
  const [nNombre, setNNombre] = useState('');
  const [nCategoria, setNCategoria] = useState('');
  const [nRestriccion, setNRestriccion] = useState<RestriccionCarga>('general');

  // INC-2 · edición inline de atributos operativos
  const [editId, setEditId] = useState<string | null>(null);
  const [eUnidad, setEUnidad] = useState('');
  const [eEmpaque, setEEmpaque] = useState('');
  const [ePresentacion, setEPresentacion] = useState('');
  const [eCantMin, setECantMin] = useState('');

  const cargar = () => {
    setLoading(true);
    listarProductosCatalogo(CATALOGO_MAESTRO_ID)
      .then(setProductos)
      .catch(() => setMsg('Error al cargar el catálogo.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { cargar(); }, []);

  const categorias = Array.from(new Set(productos.map((p) => p.categoria))).sort();
  const filtrados = productos.filter((p) =>
    (categoria === '' || p.categoria === categoria) &&
    (busqueda === '' ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.sku.toLowerCase().includes(busqueda.toLowerCase())),
  );

  function toggle(id: string) {
    setSeleccion((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function onSembrar() {
    setBusy(true);
    try {
      const r = await sembrarCatalogoMaestro();
      setMsg(`Catálogo maestro sembrado: ${r.productos} productos.`);
      cargar();
    } catch { setMsg('Error al sembrar el catálogo.'); } finally { setBusy(false); }
  }

  async function onCrearProducto() {
    if (!nSku.trim() || !nNombre.trim() || !nCategoria.trim()) { setMsg('SKU, nombre y categoría son requeridos.'); return; }
    setBusy(true);
    try {
      await crearProductoCatalogo({ catalogoId: CATALOGO_MAESTRO_ID, sku: nSku, nombre: nNombre, categoria: nCategoria, restriccion: nRestriccion });
      setNSku(''); setNNombre(''); setNCategoria(''); setNRestriccion('general');
      setMsg('Producto maestro creado.');
      cargar();
    } catch { setMsg('Error al crear el producto.'); } finally { setBusy(false); }
  }

  async function onEliminar(id: string) {
    setBusy(true);
    try { await eliminarProductoCatalogo(id); cargar(); } catch { setMsg('Error al eliminar.'); } finally { setBusy(false); }
  }

  function abrirEdicion(p: ProductoCatalogo) {
    setEditId(p.id);
    setEUnidad(p.unidad ?? '');
    setEEmpaque(p.empaque ?? '');
    setEPresentacion(p.presentacion ?? '');
    setECantMin(p.cantidadMinima ?? '');
  }

  async function onGuardarOperativo(id: string) {
    setBusy(true);
    try {
      await actualizarOperativoProducto(id, { unidad: eUnidad, empaque: eEmpaque, presentacion: ePresentacion, cantidadMinima: eCantMin });
      setEditId(null);
      setMsg('Atributos operativos guardados.');
      cargar();
    } catch { setMsg('Error al guardar atributos operativos.'); } finally { setBusy(false); }
  }

  async function onCrearPlano() {
    if (!entidad.trim()) { setMsg('Indica la entidad para el plano.'); return; }
    if (seleccion.size === 0) { setMsg('Selecciona al menos un producto del catálogo.'); return; }
    setBusy(true);
    try {
      const r = await crearPlanoDesdeCatalogo(entidad, Array.from(seleccion));
      setMsg(`Plano creado desde catálogo: ${r.planoId} (${r.productos} productos · ${r.pendientes} pendientes). Abriendo en el editor…`);
      onPlanoCreado(r.planoId);
    } catch (e) { setMsg('Error: ' + (e instanceof Error ? e.message : String(e))); } finally { setBusy(false); }
  }

  return (
    <section>
      <p style={{ color: '#555', fontSize: 14 }}>
        <strong>Catálogo maestro compartido.</strong> Fuente única de productos — Salem, Magno y futuros planos
        seleccionan de aquí sin re-teclear. El plano toma su snapshot inmutable al crearse.
      </p>

      {productos.length === 0 && !loading && (
        <div style={{ ...card, background: '#f0f7ff', borderColor: '#b3d4f7' }}>
          El catálogo está vacío. <button style={btn} onClick={() => void onSembrar()} disabled={busy}>Sembrar catálogo maestro (22 productos)</button>
        </div>
      )}

      {/* Crear plano desde selección */}
      <div style={{ ...card, background: '#e8f5e9', borderColor: '#a5d6a7' }}>
        <strong>Crear plano COM-EXP desde el catálogo</strong>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.4rem' }}>
          <input style={{ ...inp, flex: 1, minWidth: 180 }} placeholder="Entidad del plano (p. ej. Salem Solutions)" value={entidad} onChange={(e) => setEntidad(e.target.value)} />
          <button style={{ ...btn, background: '#fff' }} onClick={() => void onCrearPlano()} disabled={busy || seleccion.size === 0}>
            Crear plano con seleccionados ({seleccion.size})
          </button>
        </div>
      </div>

      {/* Alta de producto maestro */}
      <div style={card}>
        <strong>Nuevo producto maestro</strong>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.4rem' }}>
          <input style={{ ...inp, width: 160 }} placeholder="SKU" value={nSku} onChange={(e) => setNSku(e.target.value)} />
          <input style={{ ...inp, width: 200 }} placeholder="Nombre" value={nNombre} onChange={(e) => setNNombre(e.target.value)} />
          <input style={{ ...inp, width: 160 }} placeholder="Categoría" value={nCategoria} onChange={(e) => setNCategoria(e.target.value)} />
          <select style={inp} value={nRestriccion} onChange={(e) => setNRestriccion(e.target.value as RestriccionCarga)}>
            {RESTRICCIONES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button style={btn} onClick={() => void onCrearProducto()} disabled={busy}>+ Crear</button>
        </div>
      </div>

      {/* Buscador / filtro */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', margin: '0.6rem 0' }}>
        <input style={{ ...inp, flex: 1, minWidth: 180 }} placeholder="Buscar por nombre o SKU…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <select style={inp} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">(todas las categorías)</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button style={btn} onClick={cargar} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</button>
      </div>

      {msg && <p style={{ color: '#0a5', margin: '0.25rem 0' }}>{msg}</p>}

      <p style={{ fontSize: 13, color: '#666' }}>{filtrados.length} de {productos.length} producto(s)</p>

      {filtrados.map((p) => {
        const op = [p.unidad, p.empaque, p.presentacion, p.cantidadMinima].filter((x) => x && x.trim() !== '').length;
        return (
          <div key={p.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <input type="checkbox" checked={seleccion.has(p.id)} onChange={() => toggle(p.id)} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <strong>{p.nombre}</strong> <span style={{ fontSize: 12, color: '#888' }}>· {p.sku}</span>
                <div style={{ fontSize: 12, color: '#666' }}>categoría: {p.categoria} · restricción: {p.restriccion}</div>
                <div style={{ fontSize: 12, color: op === 4 ? '#0a5' : '#a60' }}>
                  operativos: {op === 0 ? 'sin definir (PENDIENTE)' : `${op}/4`}
                  {p.unidad ? ` · unidad: ${p.unidad}` : ''}{p.empaque ? ` · empaque: ${p.empaque}` : ''}
                  {p.presentacion ? ` · present.: ${p.presentacion}` : ''}{p.cantidadMinima ? ` · mín.: ${p.cantidadMinima}` : ''}
                </div>
              </div>
              <button style={btn} onClick={() => (editId === p.id ? setEditId(null) : abrirEdicion(p))} disabled={busy}>
                {editId === p.id ? 'Cerrar' : 'Operativos'}
              </button>
              <button style={btn} onClick={() => void onEliminar(p.id)} disabled={busy}>Eliminar</button>
            </div>
            {editId === p.id && (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #ccc' }}>
                <input style={{ ...inp, width: 130 }} placeholder="Unidad (kg/ton/lb…)" value={eUnidad} onChange={(e) => setEUnidad(e.target.value)} />
                <input style={{ ...inp, width: 180 }} placeholder="Empaque (sacos 25 kg…)" value={eEmpaque} onChange={(e) => setEEmpaque(e.target.value)} />
                <input style={{ ...inp, width: 160 }} placeholder="Presentación (entero…)" value={ePresentacion} onChange={(e) => setEPresentacion(e.target.value)} />
                <input style={{ ...inp, width: 170 }} placeholder="Cant. mínima (1 contenedor…)" value={eCantMin} onChange={(e) => setECantMin(e.target.value)} />
                <button style={{ ...btn, background: '#e8f5e9' }} onClick={() => void onGuardarOperativo(p.id)} disabled={busy}>Guardar</button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
