import { DURACION_SERVICIO_HORAS, HORARIOS_BASE, ZONA_HORARIA } from './config';
import type { Ocupacion } from './types';

// Fecha y hora actuales en Chile, sin importar dónde esté el servidor o el navegador
export function ahoraEnChile(): { fecha: string; hora: number; minutos: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t: string) => partes.find(p => p.type === t)?.value ?? '00';
  return {
    fecha: `${get('year')}-${get('month')}-${get('day')}`,
    hora: Number(get('hour')),
    minutos: Number(get('minute')),
  };
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const horaANumero = (hora: string) => Number(hora.split(':')[0]);

// ¿Ya pasó esta fecha/hora (hora de Chile)?
export function yaPaso(fecha: string, hora: string): boolean {
  const ahora = ahoraEnChile();
  if (fecha !== ahora.fecha) return fecha < ahora.fecha;
  const h = horaANumero(hora);
  return h < ahora.hora || (h === ahora.hora && ahora.minutos > 0);
}

// Calcula qué horas se pueden ofrecer, considerando que cada servicio dura
// DURACION_SERVICIO_HORAS y que no puede chocar con citas o bloqueos existentes.
export function calcularHorasLibres(fecha: string, ocupadas: Ocupacion[]): string[] {
  return HORARIOS_BASE.filter(horaStr => {
    const inicio = horaANumero(horaStr);
    const fin = inicio + DURACION_SERVICIO_HORAS;
    if (yaPaso(fecha, horaStr)) return false;
    return ocupadas.every(o => {
      const oInicio = horaANumero(o.hora);
      const oFin = oInicio + o.duracion_horas;
      return fin <= oInicio || inicio >= oFin; // no se superponen
    });
  });
}

// "2026-12-05" -> "sábado 5 de diciembre de 2026"
export function fechaLarga(fecha: string): string {
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}
