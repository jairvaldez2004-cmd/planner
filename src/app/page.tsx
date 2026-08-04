import { AppShell } from '@/app/ui/app-shell';
import { Logo, BRAND } from '@/app/ui/brand';

export default function Home() {
  return (
    <main>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: `1px solid ${BRAND.border}`, paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <Logo size={46} />
        <span style={{ fontSize: 12, color: BRAND.faint, letterSpacing: 1, textTransform: 'uppercase' }}>Fábrica de planos de negocio</span>
      </header>
      <AppShell />
    </main>
  );
}
