"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, User, Scissors, Trash2, Phone, CheckCircle, Clock, Mail, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Horarios en los que ATENDEMOS (El último turno debe permitir 2 horas de trabajo)
const HORARIOS_BASE = [
  "09:00", "10:00", "11:00", "12:00", "13:00", 
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
];

export default function Home() {
  const router = useRouter();
  const [servicios, setServicios] = useState<any[]>([]);
  const [misCitas, setMisCitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [horasDisponibles, setHorasDisponibles] = useState<string[]>(HORARIOS_BASE);
  const [cargandoHoras, setCargandoHoras] = useState(false);

  const [form, setForm] = useState({
    cliente: '',
    email: '',
    telefono: '',
    fecha: '',
    hora: '',
    servicio: '',
    precio: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      // 1. Cargar servicios
      const { data: servs } = await supabase.from('servicios').select('*').eq('activo', true);
      if (servs && servs.length > 0) {
        setServicios(servs);
        setForm(f => ({ ...f, servicio: servs[0].nombre, precio: servs[0].precio }));
      }

      // 2. Cargar Mis Citas
      const misCitasIds = JSON.parse(localStorage.getItem('mis_reservas_ids') || '[]');
      if (misCitasIds.length > 0) {
        const { data: citas } = await supabase.from('citas').select('*').in('id', misCitasIds).order('fecha').order('hora');
        setMisCitas(citas || []);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // --- LÓGICA INTELIGENTE DE DISPONIBILIDAD ---
  useEffect(() => {
    const calcularDisponibilidad = async () => {
      if (!form.fecha) return;
      setCargandoHoras(true);
      setForm(f => ({ ...f, hora: '' })); 

      // Buscar citas del día seleccionado
      const { data: citasDelDia } = await supabase
        .from('citas')
        .select('hora')
        .eq('fecha', form.fecha);

      if (!citasDelDia) {
        setHorasDisponibles(HORARIOS_BASE);
        setCargandoHoras(false);
        return;
      }

      // 1. Mapear qué horas específicas están OCUPADAS en el reloj
      const horasOcupadasEnElReloj = new Set<number>();

      citasDelDia.forEach((cita) => {
        const horaInicio = parseInt(cita.hora.split(':')[0]); // Ej: 10
        // Una cita a las 10 ocupa las 10:00 y las 11:00
        horasOcupadasEnElReloj.add(horaInicio);
        horasOcupadasEnElReloj.add(horaInicio + 1);
      });

      // 2. Filtrar qué horarios puede elegir el cliente
      // REGLA: Para elegir la hora X, la hora X y la hora X+1 deben estar libres.
      const libres = HORARIOS_BASE.filter((horaStr) => {
        const horaCandidata = parseInt(horaStr.split(':')[0]);
        
        const inicioLibre = !horasOcupadasEnElReloj.has(horaCandidata);
        const finLibre = !horasOcupadasEnElReloj.has(horaCandidata + 1);

        // Solo mostramos la hora si AMBAS condiciones se cumplen
        return inicioLibre && finLibre;
      });

      setHorasDisponibles(libres);
      setCargandoHoras(false);
    };

    calcularDisponibilidad();
  }, [form.fecha]); 

  const actualizarPrecio = (nombreServicio: string) => {
    const serv = servicios.find(s => s.nombre === nombreServicio);
    setForm({ ...form, servicio: nombreServicio, precio: serv ? serv.precio : 0 });
  };

  const guardarReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fecha || !form.hora) return alert("Falta fecha u hora");

    // Doble verificación antes de guardar
    const { data: ocupado } = await supabase.from('citas').select('*').eq('fecha', form.fecha).eq('hora', form.hora + ':00').single();
    if (ocupado) return alert("⚠️ ¡Alguien te ganó la hora! Intenta otra.");

    const { data, error } = await supabase.from('citas').insert([{
      cliente: form.cliente,
      email: form.email,
      telefono: form.telefono,
      fecha: form.fecha,
      hora: form.hora,
      servicio: form.servicio
    }]).select();

    if (error) {
      alert("Error: " + error.message);
    } else {
      const nuevaCita = data[0];
      const idsGuardados = JSON.parse(localStorage.getItem('mis_reservas_ids') || '[]');
      idsGuardados.push(nuevaCita.id);
      localStorage.setItem('mis_reservas_ids', JSON.stringify(idsGuardados));

      // Enviar correo
      await fetch('/api/send', {
        method: 'POST',
        body: JSON.stringify({ tipo: 'confirmacion', ...nuevaCita })
      });

      alert("✅ Reserva Exitosa.");
      setForm({ ...form, cliente: '', email: '', telefono: '', hora: '' });
      
      // Actualización rápida visual (Truco para recargar disponibildad)
      const tempFecha = form.fecha;
      setForm(f => ({...f, fecha: ''}));
      setTimeout(() => setForm(f => ({...f, fecha: tempFecha})), 50);

      setMisCitas([...misCitas, nuevaCita]);
    }
  };

  const cancelarCita = async (cita: any) => {
    if (!confirm("¿Cancelar reserva? Se liberará el horario.")) return;

    await fetch('/api/send', { method: 'POST', body: JSON.stringify({ tipo: 'cancelacion', ...cita }) });
    await supabase.from('citas').delete().eq('id', cita.id);

    alert("Cita cancelada.");
    setMisCitas(misCitas.filter(c => c.id !== cita.id));
    
    // Recargar disponibilidad
    if (form.fecha === cita.fecha) {
      const tempFecha = form.fecha;
      setForm(f => ({...f, fecha: ''}));
      setTimeout(() => setForm(f => ({...f, fecha: tempFecha})), 50);
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans">
      
      <header className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2 rounded-lg"><Scissors className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-xl font-bold text-white">Carolina Nails Studio</h1>
              <p className="text-xs text-gray-400">Reserva tu hora</p>
            </div>
          </div>
          <button onClick={() => router.push('/admin')} className="text-xs flex items-center gap-1 text-gray-500 hover:text-purple-400 transition-colors">
            <Shield size={14} /> Soy la Dueña
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 grid lg:grid-cols-3 gap-8 mt-6">
        
        {/* FORMULARIO */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl sticky top-28">
            <h2 className="text-lg font-semibold mb-5 flex items-center gap-2 text-purple-400">
              <CheckCircle className="w-5 h-5" /> Nueva Reserva
            </h2>
            
            <form onSubmit={guardarReserva} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input type="text" placeholder="Tu Nombre" required className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 pl-9 pr-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  value={form.cliente} onChange={e => setForm({...form, cliente: e.target.value})} />
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input type="email" placeholder="tu@correo.com" required className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 pl-9 pr-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>

              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input type="tel" placeholder="+56 9..." className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 pl-9 pr-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 ml-1 mb-1 block">Fecha</label>
                  <input type="date" required className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 ml-1 mb-1 block">Hora</label>
                  <select required disabled={!form.fecha || cargandoHoras}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50"
                    value={form.hora} onChange={e => setForm({...form, hora: e.target.value})}>
                    <option value="">{cargandoHoras ? 'Cargando...' : 'Selecciona'}</option>
                    {horasDisponibles.map(hora => <option key={hora} value={hora}>{hora}</option>)}
                  </select>
                </div>
              </div>

              {horasDisponibles.length === 0 && form.fecha && !cargandoHoras && (
                <p className="text-xs text-red-400 text-center bg-red-900/20 p-2 rounded">⛔ Día completo ocupado.</p>
              )}

              <div>
                <label className="text-xs text-gray-500 ml-1">Servicio</label>
                <select className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  value={form.servicio} onChange={e => actualizarPrecio(e.target.value)}>
                  {servicios.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                </select>
                <p className="text-right text-purple-400 font-bold mt-1">${form.precio.toLocaleString()}</p>
              </div>

              <button type="submit" disabled={cargandoHoras || horasDisponibles.length === 0}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-lg shadow-lg mt-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                Confirmar y Agendar
              </button>
            </form>
          </div>
        </div>

        {/* LISTA DE CITAS */}
        <div className="lg:col-span-2">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 min-h-[500px]">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-blue-400">
              <Calendar className="w-5 h-5" /> Mis Citas Agendadas
            </h2>
            {loading ? <p className="text-center text-gray-500 animate-pulse">Cargando...</p> : 
             misCitas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-600 border-2 border-dashed border-gray-800 rounded-xl"></div>