import type { ReactNode } from 'react';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

export const metadata = {
  title: 'Business Planner — Alpha',
  description: 'MVP local · vertical COM-EXP · mock · persistencia local',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          maxWidth: 1100,
          margin: '2rem auto',
          padding: '0 1rem',
          lineHeight: 1.5,
          color: '#1a1a1a',
        }}
      >
        {children}
      </body>
    </html>
  );
}
