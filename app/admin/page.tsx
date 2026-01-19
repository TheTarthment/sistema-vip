"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, Plus, Lock, DollarSign, LogOut, Calendar, User, Mail, Phone, MessageCircle, FileText, CheckCircle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState('');
  
  // Datos
  const [citas, setCitas] = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  
  // Formularios
  const [nuevoServicio, setNuevoServicio] = useState({ nombre: '', precio: '' });
  const [bloqueo, setBloqueo] = useState({ fecha: '', hora: '' });
  
  // Vistas
  const [vista, setVista] = useState<'activas' | 'historial'>('activas');
  const router = useRouter();

  const PASSWORD_SECRETA = "admin123";

  const login = () => {
    if (pass === PASSWORD_SECRETA) setAuth(true);
    else alert("Contraseña incorrecta");
  };

  const cargarDatos = async () => {
    const { data: citasData } = await supabase.from('citas').select('*').order('fecha', { ascending: true }).order('hora');
    setCitas(citasData || []);

    const { data: servData } = await supabase.from('servicios').select('*').order('nombre');
    setServicios(servData || []);
  };

  useEffect(() => { if (auth) cargarDatos(); }, [auth]);

  // --- GESTIÓN DE SERVICIOS ---
  const agregarServicio = async () => {
    if (!nuevoServicio.nombre || !nuevoServicio.precio) return alert("Faltan datos");
    await supabase.from('servicios').insert([{ nombre: nuevoServicio.nombre, precio: parseInt(nuevoServicio.precio), activo: true }]);
    setNuevoServicio({ nombre: '', precio: '' });
    cargarDatos();
  };

  const borrarServicio = async (id: string) => {
    if(confirm("¿Borrar servicio?")) {
      await supabase.from('servicios').delete().eq('id', id);
      cargarDatos();
    }
  };

  // --- GESTIÓN DE BLOQUEOS ---
  const bloquearHorario = async () => {
    if (!bloqueo.fecha || !bloqueo.hora) return alert("Selecciona fecha y hora");
    
    const { error } = await supabase.from('citas').insert([{ 
      cliente: '⛔ BLOQUEO ADMIN', 
      fecha: bloqueo.fecha, 
      hora: bloqueo.hora, 
      servicio: 'BLOQUEADO', 
      telefono: '-', 
      email: '-',
      estado: 'bloqueado'
    }]);

    if (error) alert("Error: " + error.message);
    else {
      alert("Horario bloqueado exitosamente");
      setBloqueo({ fecha: '', hora: '' });
      cargarDatos();
    }
  };

  // --- FILTROS DE VISTA ---
  const ahora = new Date(); 

  const citasActivas = citas.filter(c => {
    if (c.servicio === 'BLOQUEADO') return false;
    const fechaCita = new Date(`${c.fecha}T${c.hora}`);
    return c.estado !== 'completada' && fechaCita >= ahora;
  });

  const citasHistorial = citas.filter(c => {
    if (c.servicio === 'BLOQUEADO') return false;
    const fechaCita = new Date(`${c.fecha}T${c.hora}`);
    return c.estado === 'completada' || fechaCita < ahora;
  });

  // --- ACCIONES ---
  const terminarCitaYAgradecer = async (cita: any) => {
    if(!cita.telefono) return alert("El cliente no dejó teléfono");

    await supabase.from('citas').update({ estado: 'completada' }).eq('id', cita.id);
    await cargarDatos();

    let fono = cita.telefono.replace(/\D/g, ''); 
    if(fono.length === 8) fono = '569' + fono;
    if(fono.length === 9 && fono.startsWith('9')) fono = '56' + fono;

    const emojis = { corazon: '\uD83D\uDC96', brillos: '\u2728', unias: '\uD83D\uDC85', feliz: '\uD83E\uDD70' };
    const mensaje = `¡Hola ${cita.cliente}! ${emojis.corazon}${emojis.brillos}\n\nMuchas gracias por visitarnos hoy en Carolina Nails Studio ${emojis.unias}.\nFue un gusto atenderte. ¡Espero que ames tus uñas tanto como yo!\n\nNos vemos en la próxima. ${emojis.feliz}`;
    
    window.open(`https://wa.me/${fono}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const cancelarCita = async (id: number) => {
    if(!confirm("¿Eliminar definitivamente?")) return;
    await supabase.from('citas').delete().eq('id', id);
    cargarDatos();
  };

  // --- REPORTE EXCEL CORREGIDO (Separado por punto y coma) ---
  const descargarReporte = () => {
    // 1. Usamos punto y coma (;) para que Excel separe las columnas
    const encabezados = "ID;Cliente;Servicio;Fecha;Hora;Email;Telefono\n";
    
    const filas = citasHistorial.map(c => 
      `${c.id};"${c.cliente}";"${c.servicio}";${c.fecha};${c.hora};${c.email};${c.telefono}`
    );
    
    // 2. Agregamos \uFEFF al principio para que Excel reconozca tildes y emojis (UTF-8)
    const csvContent = "\uFEFF" + encabezados + filas.join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_carolina_nails_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  if (!auth) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gray-900 p-8 rounded-xl border border-purple-500/30 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-6">Acceso Carolina Nails</h1>
          <input type="password" className="w-full bg-gray-800 text-white p-3 rounded-lg mb-4 border border-gray-700 outline-none" 
            placeholder="Contraseña" value={pass} onChange={e => setPass(e.target.value)} />
          <button onClick={login} className="w-full bg-purple-600 text-white p-3 rounded-lg font-bold">Entrar</button>
          <button onClick={() => router.push('/')} className="w-full mt-4 text-gray-500 text-sm">Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-gray-900/50 p-4 rounded-xl border border-gray-800 backdrop-blur-md sticky top-0 z-50">
          <h1 className="text-2xl font-bold text-purple-400 flex items-center gap-2">
            <Lock className="w-6 h-6" /> Panel Carolina Nails
          </h1>
          <div className="flex gap-3 mt-4 md:mt-0">
             <button onClick={() => setAuth(false)} className="text-red-400 hover:bg-red-900/20 px-3 py-2 rounded-lg flex items-center gap-2">
              <LogOut size={18}/> Salir
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* COLUMNA IZQUIERDA: HERRAMIENTAS */}
          <div className="lg:col-span-4 space-y-8">
            
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-400"><DollarSign/> Servicios</h2>
              <div className="flex gap-2 mb-6">
                <input placeholder="Nombre" className="bg-gray-800 border border-gray-700 p-2 rounded w-full outline-none text-sm" 
                  value={nuevoServicio.nombre} onChange={e=>setNuevoServicio({...nuevoServicio, nombre: e.target.value})}/>
                <input placeholder="$" type="number" className="bg-gray-800 border border-gray-700 p-2 rounded w-20 outline-none text-sm" 
                  value={nuevoServicio.precio} onChange={e=>setNuevoServicio({...nuevoServicio, precio: e.target.value})}/>
                <button onClick={agregarServicio} className="bg-green-600 text-white p-2 rounded"><Plus/></button>
              </div>
              <ul className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {servicios.map(s => (
                  <li key={s.id} className="flex justify-between items-center bg-gray-800/50 p-3 rounded border border-gray-700/50">
                    <span className="text-sm">{s.nombre} <b className="text-green-400 ml-1">${s.precio}</b></span>
                    <button onClick={() => borrarServicio(s.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={16}/></button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-400"><Lock/> Bloquear Hora</h2>
              <div className="space-y-3">
                <input type="date" className="w-full bg-gray-800 border border-gray-700 p-2 rounded outline-none text-sm" 
                  onChange={e=>setBloqueo({...bloqueo, fecha: e.target.value})}/>
                <select className="w-full bg-gray-800 border border-gray-700 p-2 rounded outline-none text-sm"
                  onChange={e=>setBloqueo({...bloqueo, hora: e.target.value})}>
                  <option value="">Selecciona hora...</option>
                  {["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"].map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <button onClick={bloquearHorario} className="w-full bg-red-600 hover:bg-red-500 text-white py-2 rounded font-bold text-sm transition-colors">
                  Bloquear Horario
                </button>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: AGENDA */}
          <div className="lg:col-span-8">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl h-full flex flex-col">
              
              <div className="flex gap-4 border-b border-gray-800 pb-4 mb-4">
                <button onClick={() => setVista('activas')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${vista === 'activas' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  Agenda Activa
                </button>
                <button onClick={() => setVista('historial')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${vista === 'historial' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  Historial y Reportes
                </button>
              </div>

              {/* VISTA AGENDA ACTIVA */}
              {vista === 'activas' && (
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 max-h-[800px]">
                  <h3 className="text-gray-400 text-sm flex items-center gap-2"><Calendar size={16}/> {citasActivas.length} Citas Pendientes</h3>
                  
                  {citasActivas.length === 0 ? <div className="text-center py-10 text-gray-600 border-2 border-dashed border-gray-800 rounded-xl">No hay citas pendientes.</div> : 
                   citasActivas.map(c => (
                    <div key={c.id} className="bg-gray-800/40 border border-gray-700 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-start sm:items-center hover:border-purple-500/30 transition-all">
                      <div className="bg-gray-900 px-4 py-2 rounded-lg text-center border border-gray-700 min-w-[80px]">
                        <span className="block text-xl font-bold text-white">{c.hora.slice(0,5)}</span>
                        <span className="text-[10px] text-gray-400">{c.fecha}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-lg text-white">{c.cliente}</h4>
                        <span className="text-purple-300 text-sm bg-purple-900/20 px-2 py-0.5 rounded border border-purple-500/20">{c.servicio}</span>
                        <div className="flex gap-3 mt-2 text-xs text-gray-400">
                           <span className="flex items-center gap-1"><Phone size={12}/> {c.telefono}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => terminarCitaYAgradecer(c)} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-900/20">
                          <MessageCircle size={16} /> Terminar
                        </button>
                        <button onClick={() => cancelarCita(c.id)} className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 px-3 py-2 rounded-lg"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* VISTA HISTORIAL */}
              {vista === 'historial' && (
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-gray-400 text-sm flex items-center gap-2"><Clock size={16}/> Historial Completo</h3>
                    <button onClick={descargarReporte} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-900/20">
                      <FileText size={14}/> Descargar Excel
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-2 bg-gray-900 rounded-xl border border-gray-800">
                    <table className="w-full text-sm text-left text-gray-400">
                      <thead className="text-xs text-gray-200 uppercase bg-gray-800 sticky top-0">
                        <tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Servicio</th><th className="px-4 py-3">Estado</th></tr>
                      </thead>
                      <tbody>
                        {citasHistorial.map(c => {
                           const esPasada = new Date(`${c.fecha}T${c.hora}`) < new Date();
                           return (
                            <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                              <td className="px-4 py-3">{c.fecha} {c.hora}</td>
                              <td className="px-4 py-3 font-medium text-white">{c.cliente}</td>
                              <td className="px-4 py-3">{c.servicio}</td>
                              <td className="px-4 py-3">
                                {c.estado === 'completada' ? (
                                  <span className="text-green-400 bg-green-900/20 px-2 py-0.5 rounded text-xs border border-green-900/50">Completado</span>
                                ) : esPasada ? (
                                  <span className="text-gray-400 bg-gray-800 px-2 py-0.5 rounded text-xs border border-gray-600">Expirado</span>
                                ) : (
                                  <span className="text-yellow-400">?</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}