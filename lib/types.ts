export type Servicio = {
  id: string;
  nombre: string;
  precio: number;
  costo: number | null;
  activo: boolean;
};

export type EstadoCita = 'pendiente' | 'completada' | 'bloqueado';

export type Cita = {
  id: string;
  cliente: string;
  email: string | null;
  telefono: string | null;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
  duracion_horas: number;
  servicio: string;
  estado: EstadoCita;
};

// Lo que ve una clienta de sus propias citas
export type MiCita = {
  token: string;
  cliente: string;
  fecha: string;
  hora: string;
  servicio: string;
};

export type Ocupacion = {
  hora: string;
  duracion_horas: number;
};
