import { NextResponse } from 'next/server';
import { supabaseServidor } from '@/lib/supabase';
import { enviarCorreoCita } from '@/lib/email';

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const { data, error } = await supabaseServidor().rpc('reservar_cita', {
    p_cliente: texto(body.cliente),
    p_email: texto(body.email),
    p_telefono: texto(body.telefono),
    p_fecha: texto(body.fecha),
    p_hora: texto(body.hora),
    p_servicio: texto(body.servicio),
  });

  if (error || !data || data.length === 0) {
    // Los mensajes de validación vienen de la base de datos (schema.sql)
    return NextResponse.json({ error: error?.message || 'No se pudo reservar.' }, { status: 400 });
  }

  const cita = data[0];
  const correoEnviado = await enviarCorreoCita('confirmacion', cita);

  return NextResponse.json({
    token: cita.token,
    cliente: cita.cliente,
    fecha: cita.fecha,
    hora: cita.hora,
    servicio: cita.servicio,
    correoEnviado,
  });
}
