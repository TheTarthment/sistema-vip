// Configuración general del negocio.
// Los valores se pueden cambiar con variables de entorno (ver .env.example)
// sin tocar el código.

export const NEGOCIO = process.env.NEXT_PUBLIC_NEGOCIO_NOMBRE || 'Carolina Nails Studio';

export const ZONA_HORARIA = 'America/Santiago';

// Horario de atención (formato 24h). Debe coincidir con la regla
// "between 9 and 20" de supabase/schema.sql.
export const HORARIOS_BASE = [
  '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
];

// Cada servicio ocupa 2 horas en la agenda
export const DURACION_SERVICIO_HORAS = 2;

// Días hacia adelante que se pueden reservar
export const DIAS_MAXIMOS_RESERVA = 90;

// Gasto fijo mensual (luz, arriendo, etc.) para el cálculo de ganancias
export const COSTO_FIJO_MENSUAL = Number(process.env.NEXT_PUBLIC_COSTO_FIJO_MENSUAL ?? 30000) || 0;
