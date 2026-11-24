import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_KEY. Revisa tu archivo .env.local (ver .env.example).'
  );
}

// Cliente para el navegador (usa la clave pública; la seguridad la ponen
// las políticas RLS de supabase/schema.sql).
export const supabase = createClient(supabaseUrl, supabaseKey);

// Cliente para el servidor (rutas /api), sin guardar sesión.
export function supabaseServidor() {
  return createClient(supabaseUrl!, supabaseKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
