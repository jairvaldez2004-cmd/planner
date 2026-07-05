'use client';

// AppShell: navegación del Business Planner.
// Flujo: Workspaces → Grafo del workspace (estilo Obsidian) → Proyecto.
// El agente (Arquitecto) identifica el proyecto dentro del workspace y lo acomoda como nodo.

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Workspace } from '@/domain/workspace';
import { VistaWorkspaces } from './vista-workspaces';
import { VistaGrafo } from './vista-grafo';
import { VistaProyecto } from './vista-proyecto';
import { VistaConfig } from './vista-config';

type Vista = 'workspaces' | 'grafo' | 'proyecto' | 'config';

const crumb: CSSProperties = { cursor: 'pointer', color: '#06c' };
const sep: CSSProperties = { color: '#bbb', margin: '0 0.4rem' };

export function AppShell() {
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
    <div>
      {/* Breadcrumbs + acceso a Configuración */}
      <nav style={{ fontSize: 14, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          <span style={vista === 'workspaces' ? { fontWeight: 'bold' } : crumb} onClick={irWorkspaces}>Workspaces</span>
          {workspace && (
            <>
              <span style={sep}>›</span>
              <span style={vista === 'grafo' ? { fontWeight: 'bold' } : crumb} onClick={irGrafo}>{workspace.nombre}</span>
            </>
          )}
          {vista === 'proyecto' && proyectoId && (
            <>
              <span style={sep}>›</span>
              <span style={{ fontWeight: 'bold' }}>Proyecto</span>
            </>
          )}
          {vista === 'config' && (
            <>
              <span style={sep}>›</span>
              <span style={{ fontWeight: 'bold' }}>Configuración</span>
            </>
          )}
        </span>
        <span style={crumb} onClick={abrirConfig} title="Configuración (modelo por agente)">⚙ Configuración</span>
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
  );
}
