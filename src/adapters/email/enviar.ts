// Adaptador de CORREO (server-only). Envía por Resend vía su API REST (sin dependencias).
// Si no hay RESEND_API_KEY, NO falla: devuelve enviado=false con el motivo, para que el
// agente pueda entregar el correo como BORRADOR listo para enviar. En cuanto se ponga la
// key (y un dominio verificado en RESEND_FROM) el envío es real, sin cambiar código.

export interface ResultadoCorreo {
  enviado: boolean;
  motivo?: string;   // por qué no se envió (sin key, error de Resend…)
  id?: string;       // id del mensaje en Resend si se envió
}

export function correoConfigurado(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function enviarCorreo(to: string, asunto: string, texto: string): Promise<ResultadoCorreo> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Business Planner <onboarding@resend.dev>';
  if (!key) return { enviado: false, motivo: 'sin RESEND_API_KEY: el correo quedó como borrador (no enviado)' };
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())) return { enviado: false, motivo: `correo del destinatario inválido: "${to}"` };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: to.trim(), subject: asunto, text: texto }),
    });
    if (!res.ok) return { enviado: false, motivo: `Resend respondió ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const j = await res.json().catch(() => ({} as { id?: string }));
    const id = (j as { id?: string }).id;
    return id ? { enviado: true, id } : { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}
