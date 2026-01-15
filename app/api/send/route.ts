import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tipo, cliente, email, fecha, hora, servicio } = body;

    // 1. Configurar el "Transportador" de Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER, // Tu correo
        pass: process.env.GMAIL_PASS, // La contraseña rara de aplicación
      },
    });

    let asunto = '';
    let htmlContent = '';

    // 2. Definir el mensaje según el tipo
    if (tipo === 'confirmacion') {
      asunto = `✅ Reserva Confirmada: ${servicio}`;
      htmlContent = `
        <div style="font-family: Arial, color: #333; padding: 20px;">
          <h2 style="color: #6d28d9;">¡Hola ${cliente}! 👋</h2>
          <p>Tu cita ha sido agendada exitosamente.</p>
          <hr/>
          <p><strong>💇 Servicio:</strong> ${servicio}</p>
          <p><strong>📅 Fecha:</strong> ${fecha}</p>
          <p><strong>⏰ Hora:</strong> ${hora}</p>
          <br/>
          <p style="font-size: 12px; color: #888;">Te esperamos en VIP Salon.</p>
        </div>
      `;
    } else if (tipo === 'cancelacion') {
      asunto = `❌ Cita Cancelada: ${servicio}`;
      htmlContent = `
        <div style="font-family: Arial, color: #333; padding: 20px;">
          <h2 style="color: #e11d48;">Cita Cancelada</h2>
          <p>Estimado/a ${cliente}, la cita del <strong>${fecha}</strong> a las <strong>${hora}</strong> ha sido eliminada del sistema.</p>
        </div>
      `;
    }

    // 3. ENVIAR AL CLIENTE (Si puso correo)
    if (email) {
      await transporter.sendMail({
        from: `"Sistema VIP" <${process.env.GMAIL_USER}>`,
        to: email, // ¡AHORA SÍ FUNCIONA CON CUALQUIER CORREO!
        subject: asunto,
        html: htmlContent,
      });
    }

 // 4. ENVIAR COPIA A LA DUEÑA (Siempre)
    // OJO: Aquí reemplaza 'tucorreo@gmail.com' por el CORREO REAL de la dueña
    const correoDuena = 'martin20041206@gmail.com'; 

    await transporter.sendMail({
      from: `"Sistema Notificaciones" <${process.env.GMAIL_USER}>`,
      to: correoDuena, // Usamos la variable directa, así no falla
      subject: `[ADMIN] ${asunto}`,
      html: `
        <div style="background: #f3f4f6; padding: 20px; border-left: 4px solid #6d28d9; font-family: sans-serif;">
          <h3>🔔 Nueva Actividad en la Agenda</h3>
          <p><strong>Cliente:</strong> ${cliente}</p>
          <p><strong>Email Cliente:</strong> ${email}</p>
          <p><strong>Detalle:</strong> ${servicio}</p>
          <p><strong>Cuándo:</strong> ${fecha} a las ${hora}</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("❌ Error enviando correo:", error);
    return NextResponse.json({ error: "Error enviando email" }, { status: 500 });
  }
}