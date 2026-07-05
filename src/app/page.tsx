import { AppShell } from '@/app/ui/app-shell';

export default function Home() {
  return (
    <main>
      <h1 style={{ marginBottom: '0.25rem' }}>Business Planner Alpha</h1>
      <p style={{ color: '#555', marginBottom: '1.5rem', fontSize: 14 }}>
        Motor de planos · COM-EXP · persistencia PostgreSQL local · OS único publicador
      </p>
      <AppShell />
    </main>
  );
}
