'use client';

// MARCA — Business Planner® by Corporativo Palo Fierro.
// Paleta premium: negro + dorado (Bitcoin) + blanco. Tokens y logo (SVG recreado) reusables
// en todo el planner y en los entregables (portadas). El logo NO depende de imágenes externas.

import type { CSSProperties } from 'react';

// Tokens de marca (también expuestos como variables CSS en globals.css).
export const BRAND = {
  bg: '#0F0F13',        // fondo app (negro azulado)
  bg2: '#0B0B0E',       // fondo más profundo (portadas)
  panel: '#17171D',     // superficie de tarjeta
  panelAlt: '#1E1E25',  // superficie alterna / hover
  border: '#2A2A33',    // bordes
  borderSoft: '#22222A',
  text: '#F4F4F6',      // texto principal
  muted: '#A2A2AE',     // texto secundario
  faint: '#6E6E7A',     // texto tenue
  gold: '#E8A93C',      // dorado Bitcoin (acento)
  goldDim: '#B9852B',
  goldSoft: 'rgba(232,169,60,0.12)',
  ok: '#37B26B',
  warn: '#E0A82E',
  danger: '#E5604D',
} as const;

// Icono del logo (documento con grid, ₿ dorado, barras y flecha ascendente).
export function LogoMark({ size = 40 }: { size?: number }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Documento con esquina doblada */}
      <path d="M22 12 h40 l16 16 v60 a4 4 0 0 1 -4 4 H22 a4 4 0 0 1 -4 -4 V16 a4 4 0 0 1 4 -4 Z"
        fill="#131317" stroke="#FFFFFF" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M62 12 v16 h16" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinejoin="round" />
      {/* Grid tenue */}
      <g stroke="#3A3A45" strokeWidth="1">
        <path d="M28 30 H72 M28 40 H72 M28 50 H72 M28 60 H72" />
        <path d="M34 26 V64 M44 26 V64 M54 26 V64 M64 26 V64" />
      </g>
      {/* ₿ dorado */}
      <text x="41" y="52" textAnchor="middle" fontFamily="Segoe UI, system-ui, sans-serif" fontWeight="800" fontSize="30" fill={BRAND.gold}>₿</text>
      {/* Barras ascendentes + flecha */}
      <g fill="#FFFFFF">
        <rect x="45" y="70" width="6" height="8" rx="1.2" />
        <rect x="54" y="65" width="6" height="13" rx="1.2" />
        <rect x="63" y="59" width="6" height="19" rx="1.2" />
      </g>
      <path d="M44 66 L58 56 L66 48" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M60 48 H67 V55" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* Líneas de texto */}
      <g stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round">
        <path d="M27 70 H39" /><path d="M27 76 H35" />
      </g>
    </svg>
  );
}

// Logo completo (icono + wordmark). `sub` muestra la firma del corporativo.
export function Logo({ size = 40, sub = true, stacked = false }: { size?: number; sub?: boolean; stacked?: boolean }) {
  const word: CSSProperties = { fontFamily: 'Segoe UI, system-ui, sans-serif', fontWeight: 800, letterSpacing: -0.5, lineHeight: 0.98, color: BRAND.text };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.32 }}>
      <LogoMark size={size} />
      <div>
        <div style={{ ...word, fontSize: size * (stacked ? 0.5 : 0.62) }}>
          {stacked ? (<>Business<br />Planner<span style={{ color: BRAND.gold }}>®</span></>) : (<>Business Planner<span style={{ color: BRAND.gold }}>®</span></>)}
        </div>
        {sub && <div style={{ fontFamily: 'Segoe UI, system-ui, sans-serif', fontSize: size * 0.26, color: BRAND.muted, marginTop: size * 0.06 }}>By Corporativo Palo Fierro</div>}
      </div>
    </div>
  );
}
