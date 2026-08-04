import type { ReactNode } from 'react';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

export const metadata = {
  title: 'Business Planner® · Corporativo Palo Fierro',
  description: 'Fábrica de planos de negocio — configuración inicial completa y entregables.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body
        style={{
          maxWidth: 1140,
          margin: '0 auto',
          padding: '1.5rem 1rem 4rem',
          lineHeight: 1.5,
        }}
      >
        {children}
      </body>
    </html>
  );
}
