"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { NEGOCIO, DIAS_MAXIMOS_RESERVA } from '@/lib/config';
import { ahoraEnChile, calcularHorasLibres, fechaLarga, sumarDias } from '@/lib/fechas';
import type { MiCita, Ocupacion, Servicio } from '@/lib/types';
import { Calendar, User, Scissors, Trash2, Phone, CheckCircle, Clock, Mail, Shield } from 'lucide-react';

// Los códigos de las reservas se guardan en este navegador
const CLAVE_LOCAL = 'mis_reservas_tokens';

function leerTokens(): string[] {
  try {
    const valor = JSON.parse(localStorage.getItem(CLAVE_LOCAL) || '[]');
    return Array.isArray(valor) ? valor.filter(t => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function guardarTokens(tokens: string[]) {
  try {
    localStorage.setItem(CLAVE_LOCAL, JSON.stringify(tokens.slice(-50)));
  } catch {
    // Navegador sin almacenamiento (modo privado, etc.): no pasa nada
  }
}

type Aviso = { tipo: 'ok' | 'error'; texto: string } | null;

const FORM_VACIO = { cliente: '', email: '', telefono: '', fecha: '', hora: '', servicio: '' };

export default function Home() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [misCitas, setMisCitas] = useState<MiCita[]>([]);
  const [loading, setLoading] = useState(true);
  const [horasDisponibles, setHorasDisponibles] = useState<string[]>([]);
  const [cargandoHoras, setCargandoHoras] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [recargarHoras, setRecargarHoras] = useState(0);
  const [form, setForm] = useState(FORM_VACIO);

  // Se calcula recién en el navegador (después de cargar) para que la fecha
  // mínima sea siempre "hoy" y no la fecha en que se publicó la página.
  const hoy = loading ? undefined : ahoraEnChile().fecha;
  const fechaMaxima = hoy ? sumarDias(hoy, DIAS_MAXIMOS_RESERVA) : undefined;
  const precio = servicios.find(s => s.nombre === form.servicio)?.precio ?? 0;

  // 1. Cargar servicios y mis próximas citas
  useEffect(() => {
    const cargar = async () => {
      const { data: servs } = await supabase
        .from('servicios').select('*').eq('activo', true).order('nombre');
      if (servs && servs.length > 0) {
        setServicios(servs);
        setForm(f => ({ ...f, servicio: f.servicio || servs[0].nombre }));
      }

      const tokens = leerTokens();
      if (tokens.length > 0) {
        const { data: citas } = await supabase.rpc('mis_citas', { p_tokens: tokens });
        if (citas) {
          setMisCitas(citas);
          // Limpia códigos de citas que ya pasaron o fueron canceladas
          guardarTokens((citas as MiCita[]).map(c => c.token));
        }
      }
      setLoading(false);
    };
    cargar();
  }, []);

  // 2. Calcular horas disponibles cuando cambia la fecha
  useEffect(() => {
    if (!form.fecha) return;
    let cancelado = false;
    const calcular = async () => {
      const { data, error } = await supabase.rpc('horas_ocupadas', { p_fecha: form.fecha });
      if (cancelado) return;
      if (error) {
        setAviso({ tipo: 'error', texto: 'No se pudo cargar la disponibilidad. Intenta de nuevo.' });
        setHorasDisponibles([]);
      } else {
        setHorasDisponibles(calcularHorasLibres(form.fecha, (data ?? []) as Ocupacion[]));
      }
      setCargandoHoras(false);
    };
    calcular();
    return () => { cancelado = true; };
  }, [form.fecha, recargarHoras]);

  const cambiarFecha = (fecha: string) => {
    setForm(f => ({ ...f, fecha, hora: '' }));
    setCargandoHoras(Boolean(fecha));
    if (!fecha) setHorasDisponibles([]);
  };

  // 3. Guardar reserva (toda la validación real ocurre en el servidor)
  const guardarReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fecha || !form.hora) {
      setAviso({ tipo: 'error', texto: 'Elige una fecha y una hora.' });
      return;
    }
    setEnviando(true);
    setAviso(null);
    try {
      const res = await fetch('/api/reservar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const datos = await res.json();
      if (!res.ok) {
        setAviso({ tipo: 'error', texto: datos.error || 'No se pudo reservar.' });
        setRecargarHoras(n => n + 1);
        setCargandoHoras(true);
        return;
      }

      guardarTokens([...leerTokens(), datos.token]);
      setMisCitas(prev =>
        [...prev, { token: datos.token, cliente: datos.cliente, fecha: datos.fecha, hora: datos.hora, servicio: datos.servicio }]
          .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
      );
      setAviso({
        tipo: 'ok',
        texto: datos.correoEnviado
          ? '✅ ¡Reserva lista! Te enviamos la confirmación por correo.'
          : '✅ ¡Reserva lista! (No pudimos enviar el correo, pero tu hora quedó guardada.)',
      });
      setForm(f => ({ ...f, cliente: '', email: '', telefono: '', hora: '' }));
      setRecargarHoras(n => n + 1);
      setCargandoHoras(true);
    } catch {
      setAviso({ tipo: 'error', texto: 'Error de conexión. Revisa tu internet e intenta de nuevo.' });
    } finally {
      setEnviando(false);
    }
  };

  const cancelarCita = async (cita: MiCita) => {
    if (!confirm('¿Cancelar esta reserva? El horario quedará libre.')) return;
    try {
      const res = await fetch('/api/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cita.token }),
      });
      const datos = await res.json();
      if (!res.ok && res.status !== 404) {
        setAviso({ tipo: 'error', texto: datos.error || 'No se pudo cancelar.' });
        return;
      }
      setMisCitas(prev => prev.filter(c => c.token !== cita.token));
      guardarTokens(leerTokens().filter(t => t !== cita.token));
      setAviso({ tipo: 'ok', texto: res.ok ? 'Cita cancelada. Te enviamos un correo de confirmación.' : 'Esa cita ya no estaba activa.' });
      if (form.fecha === cita.fecha) {
        setRecargarHoras(n => n + 1);
        setCargandoHoras(true);
      }
    } catch {
      setAviso({ tipo: 'error', texto: 'Error de conexión. Intenta de nuevo.' });
    }
  };

  const inputClase = 'w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 pl-9 pr-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none';

  return (
    <div className="min-h-screen bg-black text-gray-100">
      {/* HEADER */}
      <header className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2 rounded-lg"><Scissors className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-xl font-bold text-white">{NEGOCIO}</h1>
              <p className="text-xs text-gray-400">Reserva tu hora</p>
            </div>
          </div>
          <Link href="/admin" className="text-xs flex items-center gap-1 text-gray-500 hover:text-purple-400 transition-colors">
            <Shield size={14} /> Administración
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 grid lg:grid-cols-3 gap-8 mt-6">
        {/* FORMULARIO */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl lg:sticky lg:top-28">
            <h2 className="text-lg font-semibold mb-5 flex items-center gap-2 text-purple-400">
              <CheckCircle className="w-5 h-5" /> Nueva Reserva
            </h2>

            {aviso && (
              <p role="status" className={`text-sm mb-4 p-3 rounded-lg border ${aviso.tipo === 'ok' ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-red-900/20 border-red-800 text-red-300'}`}>
                {aviso.texto}
              </p>
            )}

            <form onSubmit={guardarReserva} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input type="text" placeholder="Tu nombre" aria-label="Tu nombre" required maxLength={100} className={inputClase}
                  value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} />
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input type="email" placeholder="tu@correo.com" aria-label="Tu correo" required maxLength={200} className={inputClase}
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>

              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input type="tel" placeholder="+56 9 1234 5678" aria-label="Tu teléfono" required maxLength={30} className={inputClase}
                  value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="fecha" className="text-xs text-gray-500 ml-1 mb-1 block">Fecha</label>
                  <input id="fecha" type="date" required min={hoy} max={fechaMaxima}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    value={form.fecha} onChange={e => cambiarFecha(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="hora" className="text-xs text-gray-500 ml-1 mb-1 block">Hora</label>
                  <select id="hora" required disabled={!form.fecha || cargandoHoras}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50"
                    value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })}>
                    <option value="">{cargandoHoras ? 'Cargando...' : 'Selecciona'}</option>
                    {horasDisponibles.map(hora => <option key={hora} value={hora}>{hora}</option>)}
                  </select>
                </div>
              </div>

              {horasDisponibles.length === 0 && form.fecha && !cargandoHoras && (
                <p className="text-xs text-red-400 text-center bg-red-900/20 p-2 rounded">⛔ No quedan horas este día. Prueba otra fecha.</p>
              )}

              <div>
                <label htmlFor="servicio" className="text-xs text-gray-500 ml-1">Servicio (duración: 2 horas)</label>
                <select id="servicio" required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  value={form.servicio} onChange={e => setForm({ ...form, servicio: e.target.value })}>
                  {servicios.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                </select>
                <p className="text-right text-purple-400 font-bold mt-1">${precio.toLocaleString('es-CL')}</p>
              </div>

              <button type="submit" disabled={enviando || cargandoHoras || !form.hora}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-lg shadow-lg mt-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                {enviando ? 'Reservando...' : 'Confirmar y Agendar'}
              </button>
            </form>
          </div>
        </div>

        {/* MIS CITAS */}
        <div className="lg:col-span-2">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 min-h-[500px]">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-blue-400">
              <Calendar className="w-5 h-5" /> Mis Citas Agendadas
            </h2>
            {loading ? <p className="text-center text-gray-500 animate-pulse">Cargando...</p> :
             misCitas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-600 border-2 border-dashed border-gray-800 rounded-xl">
                <Clock className="w-10 h-10 mb-2 opacity-20" />
                <p>No tienes citas pendientes en este dispositivo.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {misCitas.map(cita => (
                  <div key={cita.token} className="relative bg-gray-800 border border-gray-700 p-4 rounded-xl hover:border-purple-500/50 transition-all">
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="bg-gray-900 px-2 py-1 rounded text-xs font-mono text-purple-300 border border-purple-500/20">{cita.hora.slice(0, 5)}</div>
                      <span className="text-xs text-gray-400 capitalize text-right">{fechaLarga(cita.fecha)}</span>
                    </div>
                    <h3 className="font-bold text-white text-lg mb-1">{cita.servicio}</h3>
                    <p className="text-xs text-gray-500">{cita.cliente}</p>
                    <div className="mt-4 pt-3 border-t border-gray-700/50 flex justify-end">
                      <button onClick={() => cancelarCita(cita)} className="text-red-400 hover:text-red-300 px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" /> Cancelar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
