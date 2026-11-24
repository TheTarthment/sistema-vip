import { NextResponse } from 'next/server';
import { supabaseServidor } from '@/lib/supabase';
import { enviarCorreoCita } from '@/lib/email';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let token = '';
  try {
    const body = await request.json();
    token = typeof body.token === 'string' ? body.token : '';
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }
  if (!UUID.test(token)) {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const { data, error } = await supabaseServidor().rpc('cancelar_cita', { p_token: token });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'La cita no existe o ya no se puede cancelar.' }, { status: 404 });
  }

  const cita = data[0];
  if (cita.email) await enviarCorreoCita('cancelacion', cita);

  return NextResponse.json({ ok: true });
}
