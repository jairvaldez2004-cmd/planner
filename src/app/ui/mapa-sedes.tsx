'use client';

// Mapa REAL (Leaflet + OSM) con edición de HUELLA POLIGONAL (Leaflet-Geoman):
// dibuja/mueve/rota/arrastra el polígono de la sede. Ese polígono = cascarón del editor.
// Al seleccionar una sede se superpone su layout interior dentro de la huella.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import type { Sede, Espacio, ObjetoFisico } from '@/domain/espacios';
import { esquinasDe } from '@/domain/espacios';
import { medidasDeRect, anguloInterior, bearingDeg } from './huella-geo';
import type { LL } from './huella-geo';

const CENTRO_DEF: [number, number] = [19.4326, -99.1332]; // CDMX por defecto

interface Props {
  sedes: Sede[];
  selectedId: string | null;
  overlaySpaces: Espacio[];
  overlayObjetos: ObjetoFisico[];
  onSelect: (id: string) => void;
  onMove: (id: string, lat: number, lng: number) => void;
  onPolygon: (id: string, pts: [number, number][]) => void;
  // Modo "alinear a la calle": el usuario hace 2 clics a lo largo de la cuadra y se reporta el rumbo (°N).
  alinearActivo?: boolean;
  onAlinear?: (bearingN: number) => void;
}

export default function MapaSedes({ sedes, selectedId, overlaySpaces, overlayObjetos, onSelect, onMove, onPolygon, alinearActivo, onAlinear }: Props) {
  const contRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const capaRef = useRef<L.LayerGroup | null>(null);
  const guiaRef = useRef<L.LayerGroup | null>(null); // capa de la guía de alineación (2 clics)
  const selRef = useRef<string | null>(selectedId);
  const moveRef = useRef(onMove); const selectRef = useRef(onSelect); const polyRef = useRef(onPolygon);
  const fitRef = useRef(false);
  const selHasPolyRef = useRef(false);
  const alinearRef = useRef(false); const onAlinearRef = useRef(onAlinear);
  const alinP1Ref = useRef<L.LatLng | null>(null); // primer clic pendiente del modo alinear
  selRef.current = selectedId; moveRef.current = onMove; selectRef.current = onSelect; polyRef.current = onPolygon;
  onAlinearRef.current = onAlinear;

  useEffect(() => {
    if (mapRef.current || !contRef.current) return;
    const map = L.map(contRef.current, { maxZoom: 22 }).setView(CENTRO_DEF, 13);
    // maxNativeZoom 19 = último nivel de tiles OSM; más allá se re-escalan para acercar más.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 22, maxNativeZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    // controles de dibujo/edición de polígonos
    map.pm.addControls({ position: 'topleft', drawMarker: false, drawCircle: false, drawCircleMarker: false, drawPolyline: false, drawText: false, drawRectangle: false, cutPolygon: false, drawPolygon: true, editMode: true, dragMode: true, rotateMode: true, removalMode: true });
    map.pm.setLang('es');
    map.on('pm:create', (e: { layer: L.Layer }) => {
      const layer = e.layer as L.Polygon;
      const ll = (layer.getLatLngs()[0] as L.LatLng[]);
      map.removeLayer(layer);
      const id = selRef.current;
      if (!id || !ll) { window.alert('Selecciona una sede antes de dibujar su huella.'); return; }
      polyRef.current(id, ll.map((p) => [p.lat, p.lng]));
    });
    // Guía de alineación: dibuja el punto inicial + la línea de rumbo entre los 2 clics.
    const dibujarGuia = (a: L.LatLng, b: L.LatLng | null) => {
      const guia = guiaRef.current; if (!guia) return;
      guia.clearLayers();
      L.circleMarker(a, { radius: 5, color: '#e0795b', fillColor: '#e0795b', fillOpacity: 1, pmIgnore: true }).addTo(guia);
      if (!b) return;
      L.polyline([a, b], { color: '#e0795b', weight: 2, dashArray: '5 5', pmIgnore: true }).addTo(guia);
      const bd = bearingDeg([a.lat, a.lng], [b.lat, b.lng]);
      L.marker([b.lat, b.lng], { interactive: false, pmIgnore: true, icon: L.divIcon({ className: '', html: `<div style="background:#e0795b;color:#fff;border-radius:4px;padding:0 5px;font-size:11px;white-space:nowrap">∠${Math.round(bd)}°N</div>`, iconSize: [0, 0] }) }).addTo(guia);
    };
    // Modo alinear: 1er clic fija el origen; 2º clic calcula el rumbo (°N) y lo reporta.
    const clicAlinear = (ll: L.LatLng) => {
      if (!alinP1Ref.current) { alinP1Ref.current = ll; dibujarGuia(ll, null); return; }
      const p1 = alinP1Ref.current;
      const b = bearingDeg([p1.lat, p1.lng], [ll.lat, ll.lng]);
      alinP1Ref.current = null;
      guiaRef.current?.clearLayers();
      onAlinearRef.current?.(b);
    };
    // Clic en el mapa: en modo alinear captura los 2 puntos; si no, REUBICA una sede sin polígono
    // propio (huella derivada), salvo cuando hay una herramienta de Geoman activa.
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (alinearRef.current) { clicAlinear(e.latlng); return; }
      if (!selRef.current || selHasPolyRef.current) return;
      const pm = map.pm;
      if (pm.globalDrawModeEnabled() || pm.globalEditModeEnabled() || pm.globalDragModeEnabled() || pm.globalRotateModeEnabled() || pm.globalRemovalModeEnabled()) return;
      moveRef.current(selRef.current, e.latlng.lat, e.latlng.lng);
    });
    // Banda elástica: tras el 1er clic, la línea sigue al cursor hasta el 2º clic.
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (alinearRef.current && alinP1Ref.current) dibujarGuia(alinP1Ref.current, e.latlng);
    });
    capaRef.current = L.layerGroup().addTo(map);
    guiaRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Activa/desactiva el modo alinear: cambia el cursor y limpia cualquier clic/guía pendiente.
  useEffect(() => {
    alinearRef.current = !!alinearActivo;
    const map = mapRef.current;
    if (map) map.getContainer().style.cursor = alinearActivo ? 'crosshair' : '';
    if (!alinearActivo) { alinP1Ref.current = null; guiaRef.current?.clearLayers(); }
  }, [alinearActivo]);

  useEffect(() => {
    const map = mapRef.current, capa = capaRef.current;
    if (!map || !capa) return;
    capa.clearLayers();
    const selSede = sedes.find((x) => x.id === selectedId);
    selHasPolyRef.current = !!(selSede?.poligono && selSede.poligono.length >= 3);
    const pts: [number, number][] = [];

    for (const s of sedes) {
      const sel = s.id === selectedId;
      const realPoly = s.poligono && s.poligono.length >= 3 ? s.poligono : null;
      // Toda sede es SIEMPRE un polígono editable: si aún no tiene uno propio, se deriva de su
      // huella (ancho×alto) y se dibuja punteado; al editarlo/rotarlo/moverlo se persiste como real.
      const poly = realPoly ?? rectDesdeHuella(s);
      poly.forEach((p) => pts.push(p));

      const layer = L.polygon(poly, { color: sel ? '#e0795b' : '#8aa0c0', weight: 2, fillOpacity: sel ? 0.1 : 0.06, ...(realPoly ? {} : { dashArray: '4 4' }) }).addTo(capa);
      const persist = () => { const ll = (layer.getLatLngs()[0] as L.LatLng[]).map((p) => [p.lat, p.lng] as [number, number]); polyRef.current(s.id, ll); };
      layer.on('pm:update', persist); layer.on('pm:edit', persist); layer.on('pm:dragend', persist); layer.on('pm:rotateend', persist); layer.on('pm:markerdragend', persist);
      layer.on('click', () => { if (!alinearRef.current) selectRef.current(s.id); });

      // área (m²) + orientación (° respecto al norte, si es cuadrilátero) + centroide
      const areaM2 = areaPoligonoM2(poly);
      const med = poly.length === 4 ? medidasDeRect(poly as LL[]) : null;
      const cLat = poly.reduce((a, p) => a + p[0], 0) / poly.length, cLng = poly.reduce((a, p) => a + p[1], 0) / poly.length;

      // MANIJA CENTRAL: arrastra el recuadro para MOVER toda la huella (cualquier modo, incluso
      // tras rotar/editar). Traslada todos los vértices por el mismo delta y persiste al soltar.
      const label = L.marker([cLat, cLng], {
        draggable: true,
        pmIgnore: true, // que Geoman NO gestione este marcador (evita 'getLatLngs is not a function')
        icon: L.divIcon({ className: '', html: `<div style="background:#fff;border:1px solid #ccc;border-radius:4px;padding:1px 6px;font-size:12px;white-space:nowrap;cursor:move;box-shadow:0 1px 3px rgba(0,0,0,.25)">✥ ${s.nombre} · ${Math.round(areaM2)} m²${med ? ` · ∠${med.orient}°N` : ''}</div>`, iconSize: [0, 0] }),
      }).addTo(capa);
      let orig: { start: L.LatLng; verts: [number, number][] } | null = null;
      label.on('dragstart', () => { orig = { start: label.getLatLng(), verts: poly.map((p) => [p[0], p[1]] as [number, number]) }; });
      label.on('drag', () => {
        if (!orig) return; const now = label.getLatLng();
        const dLat = now.lat - orig.start.lat, dLng = now.lng - orig.start.lng;
        layer.setLatLngs(orig.verts.map(([la, ln]) => [la + dLat, ln + dLng]));
      });
      label.on('dragend', () => {
        if (!orig) return; const now = label.getLatLng();
        const dLat = now.lat - orig.start.lat, dLng = now.lng - orig.start.lng;
        const moved = orig.verts.map(([la, ln]) => [la + dLat, ln + dLng] as [number, number]);
        orig = null; polyRef.current(s.id, moved);
      });
      label.on('click', () => { if (!alinearRef.current) selectRef.current(s.id); });

      // Medidas de cada lado (m) + ÁNGULO interior de cada vértice (solo la sede seleccionada).
      if (sel) {
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
          const d = L.latLng(a[0], a[1]).distanceTo(L.latLng(b[0], b[1]));
          L.marker([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], { interactive: false, pmIgnore: true, icon: L.divIcon({ className: '', html: `<div style="background:rgba(255,255,255,.85);border-radius:3px;padding:0 3px;font-size:11px;color:#33415c;white-space:nowrap">${d.toFixed(1)} m</div>`, iconSize: [0, 0] }) }).addTo(capa);
          const prev = poly[(i - 1 + poly.length) % poly.length]!;
          const ang = anguloInterior(prev as LL, a as LL, b as LL);
          L.marker([a[0], a[1]], { interactive: false, pmIgnore: true, icon: L.divIcon({ className: '', html: `<div style="background:rgba(224,121,91,.92);color:#fff;border-radius:8px;padding:0 4px;font-size:10px;white-space:nowrap">${ang}°</div>`, iconSize: [0, 0] }) }).addTo(capa);
        }
      }

      // overlay interior dentro del bbox del polígono
      if (sel && (overlaySpaces.length || overlayObjetos.length)) {
        const lats = poly.map((p) => p[0]), lngs = poly.map((p) => p[1]);
        dibujarOverlay(capa, Math.max(...lats), Math.min(...lats), Math.min(...lngs), Math.max(...lngs), overlaySpaces, overlayObjetos);
      }
    }

    if (!fitRef.current && pts.length > 0) {
      fitRef.current = true;
      if (pts.length === 1) map.setView(pts[0]!, 18); else map.fitBounds(pts, { padding: [40, 40] });
    }
  }, [sedes, selectedId, overlaySpaces, overlayObjetos]);

  return <div ref={contRef} style={{ width: '100%', height: 400, borderRadius: 10, overflow: 'hidden', border: '1px solid #ddd' }} />;
}

// rectángulo (4 esquinas lat/lng) derivado de la huella ancho×alto de una sede sin polígono propio.
function rectDesdeHuella(s: Sede): [number, number][] {
  const lat = typeof s.lat === 'number' ? s.lat : CENTRO_DEF[0];
  const lng = typeof s.lng === 'number' ? s.lng : CENTRO_DEF[1];
  const Wm = s.footAncho ?? 20, Hm = s.footAlto ?? 15;
  const dLat = (Hm / 2) / 111320, dLng = (Wm / 2) / (111320 * Math.cos(lat * Math.PI / 180));
  return [[lat - dLat, lng - dLng], [lat - dLat, lng + dLng], [lat + dLat, lng + dLng], [lat + dLat, lng - dLng]];
}

// área de un polígono lat/lng en m² (shoelace sobre metros locales; exacto para huellas de edificios)
function areaPoligonoM2(poly: [number, number][]): number {
  if (poly.length < 3) return 0;
  const lat0 = poly.reduce((a, p) => a + p[0], 0) / poly.length;
  const mLat = 111320, mLng = 111320 * Math.cos(lat0 * Math.PI / 180);
  const xy = poly.map(([la, ln]) => [ln * mLng, la * mLat] as [number, number]);
  let s = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i]!, b = xy[(i + 1) % xy.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

// dibuja el layout interior (áreas + objetos, CON su rotación) dentro de un bbox geográfico
function dibujarOverlay(capa: L.LayerGroup, north: number, south: number, west: number, east: number, espacios: Espacio[], objetos: ObjetoFisico[]) {
  const lat0 = (north + south) / 2, cos = Math.cos(lat0 * Math.PI / 180);
  const Wm = Math.max(1, (east - west) * 111320 * cos), Hm = Math.max(1, (north - south) * 111320);
  // metros del plano → lat/lng dentro del bbox de la huella
  const aLL = (p: { x: number; y: number }): [number, number] => [north - (p.y / Hm) * (north - south), west + (p.x / Wm) * (east - west)];
  for (const e of espacios) {
    const pts = (e.poligono && e.poligono.length >= 3) ? e.poligono : esquinasDe(e);
    L.polygon(pts.map(aLL), { color: '#33415c', weight: 1, fillColor: '#5b8def', fillOpacity: 0.22, pmIgnore: true }).addTo(capa).bindTooltip(e.nombre);
  }
  // los objetos también, para que el mapa muestre el layout TAL COMO ESTÁ
  for (const o of objetos) {
    L.polygon(esquinasDe(o).map(aLL), { color: '#b5813f', weight: 1, fillColor: '#e0a96b', fillOpacity: 0.5, pmIgnore: true }).addTo(capa).bindTooltip(o.nombre);
  }
}
