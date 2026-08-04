'use client';

// PLANO 2D READ-ONLY (CAD oscuro). Replica la geometría del editor de espacios pero sin
// interacción, para embeberlo en el entregable de Arquitectura. Escala idéntica al editor
// (viewBox 900×600, scale = min(900/ancho, 600/alto)) para que coincida con lo dibujado.

const VBW = 900, VBH = 600;

export interface EspacioLite { id: string; nombre: string; tipo: string; x: number; y: number; ancho: number; alto: number; rot?: number | undefined; poligono?: { x: number; y: number }[] | undefined }
export interface ObjetoLite { id: string; nombre: string; x: number; y: number; ancho: number; alto: number; rot?: number | undefined }
export interface ElementoLite { id: string; tipo: string; x1: number; y1: number; x2: number; y2: number; grosor?: number | undefined }

export function Plano2D({ espacios, objetos, elementos, footAncho, footAlto, muroExt = 0.30, muroInt = 0.15 }: {
  espacios: EspacioLite[]; objetos: ObjetoLite[]; elementos: ElementoLite[];
  footAncho: number; footAlto: number; muroExt?: number; muroInt?: number;
}) {
  const scale = Math.min(VBW / footAncho, VBH / footAlto);
  const gPx = (m: number) => Math.max(2, m * scale);
  const centro = (f: { x: number; y: number; ancho: number; alto: number }) => ({ x: f.x + f.ancho / 2, y: f.y + f.alto / 2 });

  return (
    <div style={{ border: '1px solid var(--bp-border)', borderRadius: 10, background: 'var(--bp-panel-alt)', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${VBW} ${VBH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <rect x={0} y={0} width={VBW} height={VBH} fill="#14141a" />
        <rect x={0} y={0} width={footAncho * scale} height={footAlto * scale} fill="#1E1E25" stroke="#2A2A33" strokeWidth={1} />
        {/* grid en metros */}
        {Array.from({ length: Math.floor(footAncho) + 1 }).map((_, i) => <line key={`v${i}`} x1={i * scale} y1={0} x2={i * scale} y2={footAlto * scale} stroke="#2A2A33" />)}
        {Array.from({ length: Math.floor(footAlto) + 1 }).map((_, i) => <line key={`h${i}`} x1={0} y1={i * scale} x2={footAncho * scale} y2={i * scale} stroke="#2A2A33" />)}

        {/* habitaciones */}
        {espacios.map((e) => {
          const c = centro(e);
          return (
            <g key={e.id} transform={e.rot ? `rotate(${e.rot} ${c.x * scale} ${c.y * scale})` : undefined}>
              {e.poligono && e.poligono.length >= 3
                ? <polygon points={e.poligono.map((p) => `${p.x * scale},${p.y * scale}`).join(' ')} fill="rgba(255,255,255,0.04)" stroke="#6b7690" strokeWidth={1.5} />
                : <rect x={e.x * scale} y={e.y * scale} width={e.ancho * scale} height={e.alto * scale} rx={4} fill="rgba(255,255,255,0.04)" stroke="#6b7690" strokeWidth={1.5} />}
              <text x={e.x * scale + 6} y={e.y * scale + 16} fontSize={12} fontWeight="bold" fill="#EDEDED">{e.nombre}</text>
              <text x={e.x * scale + 6} y={e.y * scale + 31} fontSize={9} fill="#A2A2AE">{e.tipo}{e.poligono ? ` · polígono ${e.poligono.length}v` : ` · ${e.ancho}×${e.alto} m`}</text>
            </g>
          );
        })}

        {/* objetos */}
        {objetos.map((o) => {
          const c = centro(o);
          return (
            <g key={o.id} transform={o.rot ? `rotate(${o.rot} ${c.x * scale} ${c.y * scale})` : undefined}>
              <rect x={o.x * scale} y={o.y * scale} width={o.ancho * scale} height={o.alto * scale} rx={3} fill="rgba(232,169,60,0.12)" stroke="#E8A93C" strokeWidth={1.5} />
              <line x1={o.x * scale + 3} y1={o.y * scale + 3} x2={(o.x + o.ancho) * scale - 3} y2={o.y * scale + 3} stroke="#c98a3b" strokeWidth={2} />
              <text x={c.x * scale} y={c.y * scale + 3} textAnchor="middle" fontSize={9} fill="#E8C88A">{o.nombre.slice(0, 10)}</text>
            </g>
          );
        })}

        {/* muros / puertas / ventanas */}
        {elementos.map((el) => {
          const X1 = el.x1 * scale, Y1 = el.y1 * scale, X2 = el.x2 * scale, Y2 = el.y2 * scale;
          const dx = X2 - X1, dy = Y2 - Y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux;
          const leafX = X1 + px * L, leafY = Y1 + py * L;
          return (
            <g key={el.id}>
              {el.tipo === 'muro' && <line x1={X1} y1={Y1} x2={X2} y2={Y2} stroke="#D8CBA8" strokeWidth={gPx(el.grosor ?? muroInt)} strokeLinecap="round" />}
              {el.tipo !== 'muro' && <line x1={X1} y1={Y1} x2={X2} y2={Y2} stroke="#14141a" strokeWidth={gPx(muroExt) + 2} />}
              {el.tipo === 'ventana' && <line x1={X1} y1={Y1} x2={X2} y2={Y2} stroke="#3b86c9" strokeWidth={3} />}
              {el.tipo === 'puerta' && <>
                <line x1={X1} y1={Y1} x2={leafX} y2={leafY} stroke="#c78a3b" strokeWidth={3} />
                <path d={`M ${leafX} ${leafY} A ${L} ${L} 0 0 1 ${X2} ${Y2}`} fill="none" stroke="#c78a3b" strokeWidth={1.5} strokeDasharray="3 3" />
              </>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
