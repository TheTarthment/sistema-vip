// Este archivo solo se usa en el servidor (rutas /api), nunca en el navegador.
import nodemailer from 'nodemailer';
import { NEGOCIO } from './config';
import { fechaLarga } from './fechas';

// Datos sacados de variables de entorno: NUNCA escribas contraseñas en el código.
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const DIRECCION = process.env.CONTACTO_DIRECCION || '';
const TELEFONO = process.env.CONTACTO_TELEFONO || '';

// Evita que alguien meta código HTML en su nombre
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

type DatosCita = { cliente: string; email: string; fecha: string; hora: string; servicio: string };

function plantilla(tipo: 'confirmacion' | 'cancelacion', c: DatosCita): { asunto: string; html: string } {
  const esConfirmacion = tipo === 'confirmacion';
  const titulo = esConfirmacion ? 'Reserva confirmada' : 'Reserva cancelada';
  const intro = esConfirmacion
    ? '¡Tu cita quedó agendada! Estos son los detalles:'
    : 'Tu cita fue cancelada y el horario quedó libre. Estos eran los detalles:';
  const colorCabecera = esConfirmacion ? '#000' : '#7f1d1d';

  const contacto = [
    DIRECCION && `📍 <strong>Dirección:</strong> ${escapar(DIRECCION)}`,
    TELEFONO && `📞 <strong>Contacto:</strong> ${escapar(TELEFONO)}`,
  ].filter(Boolean).join('<br>');

  const html = `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
    <div style="background-color: ${colorCabecera}; padding: 20px; text-align: center;">
      <h1 style="color: #fff; margin: 0;">${titulo}</h1>
    </div>
    <div style="padding: 20px;">
      <p>Hola <strong>${escapar(c.cliente)}</strong>,</p>
      <p>${intro}</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>📅 Fecha:</strong> ${escapar(fechaLarga(c.fecha))}</p>
        <p><strong>⏰ Hora:</strong> ${escapar(c.hora.slice(0, 5))}</p>
        <p><strong>💅 Servicio:</strong> ${escapar(c.servicio)}</p>
      </div>
      ${contacto ? `<p style="font-size: 0.9em; color: #666;">${contacto}</p>` : ''}
    </div>
    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 0.8em; color: #888;">
      ${esConfirmacion ? '<p>Si necesitas cancelar, puedes hacerlo desde la misma página donde reservaste.</p>' : '<p>Puedes agendar una nueva hora cuando quieras.</p>'}
      <p>© ${new Date().getFullYear()} ${escapar(NEGOCIO)}</p>
    </div>
  </div>`;

  return { asunto: `${esConfirmacion ? '✅' : '❌'} ${titulo} - ${NEGOCIO}`, html };
}

// Devuelve true si el correo salió, false si no (la reserva no falla por esto)
export async function enviarCorreoCita(tipo: 'confirmacion' | 'cancelacion', cita: DatosCita): Promise<boolean> {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.warn('Correo no enviado: faltan GMAIL_USER o GMAIL_APP_PASSWORD.');
    return false;
  }
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
    const { asunto, html } = plantilla(tipo, cita);
    await transporter.sendMail({
      from: `"${NEGOCIO}" <${GMAIL_USER}>`,
      to: cita.email,
      subject: asunto,
      html,
    });
    return true;
  } catch (error) {
    console.error('Error enviando correo:', error);
    return false;
  }
}
