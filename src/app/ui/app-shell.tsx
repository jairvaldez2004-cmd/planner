'use client';

// AppShell: navegación del Business Planner.
// Flujo: Workspaces → Grafo del workspace (estilo Obsidian) → Proyecto.
// El agente (Arquitecto) identifica el proyecto dentro del workspace y lo acomoda como nodo.
// Es también la raíz del árbol cliente: aquí se monta el Provider de idioma.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Workspace } from '@/domain/workspace';
import { VistaWorkspaces } from './vista-workspaces';
import { VistaGrafo } from './vista-grafo';
import { VistaProyecto } from './vista-proyecto';
import { VistaConfig } from './vista-config';
import { I18nProvider, useT } from './i18n';
import { TraduccionProvider, useTx } from './traduccion';
import { LOCALES } from '@/domain/i18n';
import type { Locale } from '@/domain/i18n';

type Vista = 'workspaces' | 'grafo' | 'proyecto' | 'config';

const crumb: CSSProperties = { cursor: 'pointer', color: 'var(--bp-gold)' };
const sep: CSSProperties = { color: '#bbb', margin: '0 0.4rem' };

// Selector de idioma: un botón por idioma, el activo resaltado.
function SelectorIdioma() {
  const { locale, setLocale, t } = useT();
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }} title={t('nav.idioma')}>
      {LOCALES.map((l) => (
        <button
          key={l.id}
          onClick={() => setLocale(l.id as Locale)}
          aria-pressed={locale === l.id}
          style={{
            cursor: 'pointer', fontSize: 12, padding: '0.1rem 0.45rem', borderRadius: 6,
            border: `1px solid ${locale === l.id ? 'var(--bp-gold)' : 'var(--bp-border)'}`,
            background: locale === l.id ? 'var(--bp-gold)' : 'transparent',
            color: locale === l.id ? '#1E1E25' : 'var(--bp-muted)',
            fontWeight: locale === l.id ? 'bold' : 'normal',
          }}
        >{l.bandera} {l.id.toUpperCase()}</button>
      ))}
    </span>
  );
}

// Aparece solo si quedan datos tuyos sin traducir. Es la vía para volver al aviso de costo
// después de haber dicho "ahora no": el aviso no insiste, pero la puerta queda abierta.
function BotonTraducir() {
  const { t } = useT();
  const { pendientes, abrirAviso, traduciendo } = useTx();
  if (pendientes === 0) return null;
  return (
    <button
      onClick={abrirAviso}
      disabled={traduciendo}
      title={t('traducir.titulo')}
      style={{
        cursor: 'pointer', fontSize: 12, padding: '0.1rem 0.5rem', borderRadius: 6,
        border: '1px dashed var(--bp-gold)', background: 'transparent', color: 'var(--bp-gold)',
      }}
    >🌐 {t('traducir.reintentar')} ({pendientes})</button>
  );
}

function Shell() {
  const { t } = useT();
  const [vista, setVista] = useState<Vista>('workspaces');
  const [vistaPrevia, setVistaPrevia] = useState<Vista>('workspaces');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [proyectoId, setProyectoId] = useState<string | null>(null);

  function abrirWorkspace(ws: Workspace) { setWorkspace(ws); setVista('grafo'); }
  function abrirProyecto(id: string) { setProyectoId(id); setVista('proyecto'); }
  function irWorkspaces() { setVista('workspaces'); }
  function irGrafo() { setVista('grafo'); }
  function abrirConfig() { setVistaPrevia(vista === 'config' ? 'workspaces' : vista); setVista('config'); }

  return (
    <TraduccionProvider proyectoId={vista === 'proyecto' ? proyectoId : null}>
    <div>
      {/* Breadcrumbs + idioma + acceso a Configuración */}
      <nav style={{ fontSize: 14, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--bp-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span>
          <span style={vista === 'workspaces' ? { fontWeight: 'bold' } : crumb} onClick={irWorkspaces}>{t('nav.workspaces')}</span>
          {workspace && (
            <>
              <span style={sep}>›</span>
              <span style={vista === 'grafo' ? { fontWeight: 'bold' } : crumb} onClick={irGrafo}>{workspace.nombre}</span>
            </>
          )}
          {vista === 'proyecto' && proyectoId && (
            <>
              <span style={sep}>›</span>
              <span style={{ fontWeight: 'bold' }}>{t('nav.proyecto')}</span>
            </>
          )}
          {vista === 'config' && (
            <>
              <span style={sep}>›</span>
              <span style={{ fontWeight: 'bold' }}>{t('nav.configuracion')}</span>
            </>
          )}
        </span>
        <span style={{ display: 'inline-flex', gap: '0.75rem', alignItems: 'center' }}>
          <BotonTraducir />
          <SelectorIdioma />
          <span style={crumb} onClick={abrirConfig} title={t('nav.configuracionTitle')}>⚙ {t('nav.configuracion')}</span>
        </span>
      </nav>

      {vista === 'workspaces' && <VistaWorkspaces onAbrir={abrirWorkspace} />}
      {vista === 'grafo' && workspace && (
        <VistaGrafo workspace={workspace} onAbrirProyecto={abrirProyecto} onVolver={irWorkspaces} />
      )}
      {vista === 'proyecto' && proyectoId && (
        <VistaProyecto proyectoId={proyectoId} onVolver={irGrafo} />
      )}
      {vista === 'config' && <VistaConfig onVolver={() => setVista(vistaPrevia)} />}
    </div>
    </TraduccionProvider>
  );
}

export function AppShell() {
  return <I18nProvider><Shell /></I18nProvider>;
}
