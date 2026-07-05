'use client';

import { useState } from 'react';
import {
  asegurarWorkspace, asegurarProyecto, guardarDraft,
  publicarPlano, listarHistorial,
} from '@/app/actions/plano.actions';
import { generarDocumento } from '@/app/actions/documento.actions';
import { construirPlanoDraft, validarCaptura } from '@/app/captura/form-engine';
import { transicionar } from '@/domain/states';
import type { Instancia, Workspace, Proyecto } from '@/domain/workspace';
import type { PlanoComExp } from '@/domain/plano-com-exp';
import type { Documento } from '@/domain/documento';
import type { VersionSnapshot } from '@/domain/version';

const card = { border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem 1rem', margin: '0.5rem 0', background: '#fafafa' } as const;
const btn = { padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #999', background: '#fff', cursor: 'pointer' } as const;

type StepState = 'pending' | 'running' | 'ok' | 'error';
interface Step { label: string; state: StepState; detail: string }

const STEPS_INIT: Step[] = [
  { label: 'Setup: WS-DEMO + PROJ-DEMO',            state: 'pending', detail: '' },
  { label: 'Captura: plan COM-EXP con datos DEMO',  state: 'pending', detail: '' },
  { label: 'Generar draft + guardar en DB',          state: 'pending', detail: '' },
  { label: 'Validación humana',                     state: 'pending', detail: '' },
  { label: 'Publicar (OS → PostgreSQL)',             state: 'pending', detail: '' },
  { label: 'Generar Documento (RESUMEN_COMERCIAL)',  state: 'pending', detail: '' },
  { label: 'Listar historial de versiones',          state: 'pending', detail: '' },
];

function stateColor(s: StepState): string {
  return s === 'ok' ? '#0a5' : s === 'error' ? '#c00' : s === 'running' ? '#06c' : '#888';
}
function stateIcon(s: StepState): string {
  return s === 'ok' ? '✓' : s === 'error' ? '✗' : s === 'running' ? '⟳' : '·';
}

export function VistaDemo() {
  const [steps, setSteps] = useState<Step[]>(STEPS_INIT);
  const [running, setRunning] = useState(false);
  const [resultado, setResultado] = useState<{
    plano: PlanoComExp; doc: Documento; historial: VersionSnapshot[];
  } | null>(null);

  function upd(idx: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  async function ejecutarDemo() {
    setRunning(true);
    setResultado(null);
    setSteps(STEPS_INIT.map((s) => ({ ...s, state: 'pending', detail: '' })));

    try {
      // PASO 0: Setup workspace y proyecto
      upd(0, { state: 'running' });
      const ws: Workspace = { id: 'WS-DEMO', nombre: 'Workspace DEMO', tipo: 'INT' };
      const proj: Proyecto = { id: 'PROJ-DEMO', workspaceId: 'WS-DEMO', nombre: 'Proyecto DEMO' };
      await asegurarWorkspace(ws);
      await asegurarProyecto(proj);
      upd(0, { state: 'ok', detail: 'WS-DEMO + PROJ-DEMO listos (upsert).' });

      // PASO 1: Captura con datos DEMO
      upd(1, { state: 'running' });
      const captura = {
        entidad: 'ALV Exports Hub — DEMO',
        productos: [
          {
            sku: 'FRIJOL-NEGRO-001',
            nombre: 'Frijol Negro Arriñonado (DEMO)',
            categoria: 'legumbres',
            restriccion: 'general' as const,
            hsCode: '0713.33',
            incotermSugerido: 'FOB' as const,
            puertoSalida: 'MXMZT' as const,
            certificadoOrigenRequerido: true,
          },
        ],
      };
      const vc = validarCaptura(captura);
      if (!vc.ok) throw new Error('Captura demo inválida: ' + vc.errores.join(', '));
      upd(1, { state: 'ok', detail: '1 producto DEMO — valores de negocio PENDIENTE (no inventados).' });

      // PASO 2: Generar draft + guardar en DB
      upd(2, { state: 'running' });
      const draft = construirPlanoDraft(captura);
      let estado = transicionar('SOLICITUD', 'CAPTURA');
      estado = transicionar(estado, 'DISENO');
      estado = transicionar(estado, 'VALIDACION');
      const instancia: Instancia = {
        id: `BP-DEMO-COM-EXP-${Date.now()}`,
        proyectoId: 'PROJ-DEMO',
        tipoPlano: 'COM-EXP',
        estado,
        acl: 'N3',
        planoId: null,
      };
      await guardarDraft(draft, instancia);
      upd(2, { state: 'ok', detail: `Draft guardado en DB: ${draft.id}` });

      // PASO 3: Validación humana
      upd(3, { state: 'running' });
      await new Promise((r) => setTimeout(r, 200)); // simula revisión humana
      upd(3, { state: 'ok', detail: 'Aprobado por: demo-validador (humano simulado).' });

      // PASO 4: Publicar (OS → PostgreSQL)
      upd(4, { state: 'running' });
      const { plano: planoPublicado, version } = await publicarPlano(
        draft, instancia, 'demo-validador', true,
      );
      upd(4, { state: 'ok', detail: `OS publicó v${version}. publicado=true. Snapshot inmutable guardado.` });

      // PASO 5: Generar documento
      upd(5, { state: 'running' });
      const doc = await generarDocumento(planoPublicado.id, 'RESUMEN_COMERCIAL');
      upd(5, { state: 'ok', detail: `${doc.tipoDocumento} generado. ${doc.pendientes} campo(s) PENDIENTE.` });

      // PASO 6: Historial
      upd(6, { state: 'running' });
      const historial = await listarHistorial(planoPublicado.id);
      upd(6, { state: 'ok', detail: `${historial.length} versión(es) en historial. Append-only.` });

      setResultado({ plano: planoPublicado, doc, historial });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSteps((prev) => prev.map((s) => s.state === 'running' ? { ...s, state: 'error', detail: msg } : s));
    } finally {
      setRunning(false);
    }
  }

  const allOk = steps.every((s) => s.state === 'ok');

  return (
    <section>
      <p style={{ color: '#555', marginBottom: '1rem' }}>
        Demostración completa del método: <strong>Captura → Draft → Validación → Publicación (OS) → Documento → Historial.</strong><br/>
        Datos etiquetados <strong>DEMO</strong>. Valores de negocio → PENDIENTE (no inventados).
        La demo crea y persiste en PostgreSQL local.
      </p>

      <button
        style={{ ...btn, background: '#e8f5e9', fontWeight: 'bold', marginBottom: '1rem' }}
        onClick={() => void ejecutarDemo()}
        disabled={running}
      >
        {running ? 'Ejecutando demo…' : allOk ? 'Re-ejecutar demo' : 'Ejecutar demo completo'}
      </button>

      {steps.map((s, i) => (
        <div key={i} style={{ ...card, borderLeft: `4px solid ${stateColor(s.state)}` }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ color: stateColor(s.state), fontWeight: 'bold', fontSize: 16 }}>{stateIcon(s.state)}</span>
            <span style={{ fontWeight: s.state === 'ok' ? 'normal' : 'bold' }}>{s.label}</span>
          </div>
          {s.detail && <div style={{ fontSize: 13, color: '#555', marginTop: '0.25rem', marginLeft: '1.5rem' }}>{s.detail}</div>}
        </div>
      ))}

      {resultado && (
        <>
          <h3 style={{ marginTop: '1.5rem' }}>Resultado</h3>
          <div style={card}>
            <strong>Plano publicado:</strong> {resultado.plano.id}<br/>
            <strong>Versión:</strong> {resultado.plano.version} · <strong>Productos:</strong> {resultado.plano.productos.length}
          </div>
          <div style={card}>
            <strong>Documento generado:</strong> {resultado.doc.tipoDocumento} v{resultado.doc.version}<br/>
            <strong>Pendientes en plano:</strong> {resultado.doc.pendientes}
          </div>
          <h4 style={{ marginTop: '1rem' }}>Markup del documento</h4>
          <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {resultado.doc.markup}
          </pre>
          <div style={card}>
            <strong>Historial ({resultado.historial.length} versión/es):</strong>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.2rem' }}>
              {resultado.historial.map((h) => (
                <li key={h.version} style={{ fontSize: 13 }}>
                  v{h.version} · {h.publicado ? 'publicado' : 'draft'} · {h.timestamp.slice(0, 19).replace('T', ' ')}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
