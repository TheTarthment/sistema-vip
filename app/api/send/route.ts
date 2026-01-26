import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { cliente, fecha, hora, servicio, email, telefono } = data;

    // --- AQUÍ ES DONDE CAMBIAS EL REMITENTE ---
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'caronailsestudioculenar@gmail.com', // <--- TU NUEVO CORREO
        pass: 'mlsg nhns sytt qxxy'          // <--- PEGA AQUÍ LA CLAVE DE 16 LETRAS DE CAROLINANAILS (NO LA DE MARTIN)
      }
    });
    // -------------------------------------------

    // Configuración del correo que le llega al cliente
    const mailOptions = {
      from: '"Carolina Nails Studio" <carolinanails2026@gmail.com>', // Nombre visible
      to: email, // Se le envía al cliente
      subject: '✅ Confirmación de Reserva - Carolina Nails Studio',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #000; padding: 20px; text-align: center;">
            <h1 style="color: #fff; margin: 0;">Reserva Confirmada</h1>
          </div>
          <div style="padding: 20px;">
            <p>Hola <strong>${cliente}</strong>,</p>
            <p>¡Tu cita ha sido agendada con éxito! Aquí están los detalles:</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>📅 Fecha:</strong> ${fecha}</p>
              <p><strong>⏰ Hora:</strong> ${hora}</p>
              <p><strong>💅 Servicio:</strong> ${servicio}</p>
            </div>

            <p style="font-size: 0.9em; color: #666;">
              📍 <strong>Ubicación:</strong> [Tu Dirección Aquí]<br>
              📞 <strong>Contacto:</strong> +56 9 [Tu Número]
            </p>
          </div>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 0.8em; color: #888;">
            <p>Si necesitas cancelar o reagendar, por favor contáctanos con anticipación.</p>
            <p>© 2026 Carolina Nails Studio</p>
          </div>
        </div>
      `
    };

    // Enviar el correo
    await transporter.sendMail(mailOptions);

    return NextResponse.json({ message: 'Correo enviado exitosamente' }, { status: 200 });
  } catch (error) {
    console.error('Error enviando correo:', error);
    return NextResponse.json({ error: 'Error al enviar el correo' }, { status: 500 });
  }
}