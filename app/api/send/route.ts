import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tipo, cliente, email, fecha, hora, servicio } = body;

    // Configuración del Transportador (Gmail)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    let asunto = '';
    let htmlContent = '';

    // Diseños de Correo
    if (tipo === 'confirmacion') {
      asunto = `✅ Reserva Confirmada: ${servicio}`;
      htmlContent = `
        <div style="font-family: Arial, color: #333; padding: 20px;">
          <h2 style="color: #6d28d9;">¡Hola ${cliente}! 👋</h2>
          <p>Tu cita en <strong>Carolina Nails Studio</strong> ha sido agendada.</p>
          <hr/>
          <p><strong>💅 Servicio:</strong> ${servicio}</p>
          <p><strong>📅 Fecha:</strong> ${fecha}</p>
          <p><strong>⏰ Hora:</strong> ${hora}</p>
          <br/>
          <p style="font-size: 12px; color: #888;">Te esperamos.</p>
        </div>
      `;
    } else if (tipo === 'cancelacion') {
      asunto = `❌ Cita Cancelada: ${servicio}`;
      htmlContent = `
        <div style="font-family: Arial, color: #333; padding: 20px;">
          <h2 style="color: #e11d48;">Cita Cancelada</h2>
          <p>Estimado/a ${cliente}, la cita del <strong>${fecha}</strong> a las <strong>${hora}</strong> ha sido eliminada.</p>
        </div>
      `;
    }

    // 1. Enviar al Cliente (Si hay email)
    if (email) {
      await transporter.sendMail({
        from: `"Carolina Nails Studio" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: asunto,
        html: htmlContent,
      });
    }

    // 2. Enviar a la Dueña (Siempre)
    // CAMBIA AQUÍ 'tucorreo@gmail.com' POR EL EMAIL REAL DE LA DUEÑA
    const correoDuena = 'tucorreo@gmail.com'; 

    await transporter.sendMail({
      from: `"Sistema Notificaciones" <${process.env.GMAIL_USER}>`,
      to: correoDuena,
      subject: `[ADMIN] ${asunto}`,
      html: `
        <div style="background: #f3f4f6; padding: 20px; border-left: 4px solid #6d28d9; font-family: sans-serif;">
          <h3>🔔 Actividad en Carolina Nails</h3>
          <p><strong>Cliente:</strong> ${cliente}</p>
          <p><strong>Email:</strong> ${email || 'No proporcionado'}</p>
          <p><strong>Detalle:</strong> ${servicio} - ${fecha} ${hora}</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("❌ Error enviando correo:", error);
    return NextResponse.json({ error: "Error enviando email" }, { status: 500 });
  }
}