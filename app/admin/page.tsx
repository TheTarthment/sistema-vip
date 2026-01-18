"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, Lock, LogOut, Calendar, Mail, Phone, MessageCircle, FileText, CheckCircle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState('');
  const [citas, setCitas] = useState<any[]>([]);
  const [vista, setVista] = useState<'activas' | 'historial'>('activas');
  const router = useRouter();

  const PASSWORD_SECRETA = "admin123"; // Cambia esto si deseas otra clave

  const login = () => {
    if (pass === PASSWORD_SECRETA) setAuth(true);
    else alert("Contraseña incorrecta");
  };

  const cargarDatos = async () => {
    // Traemos TODAS las citas
    const { data } = await supabase.from('citas').select('*').order('fecha', { ascending: true }).order('hora');
    setCitas(data || []);
  };

  useEffect(() => { if (auth) cargarDatos(); }, [auth]);

  // --- LÓGICA DE FILTRADO ---
  const ahora = new Date();
  
  // Citas Activas: Fecha/Hora es mayor a ahora
  const citasActivas = citas.filter(c => {
    const fechaCita = new Date(`${c.fecha}T${c.hora}`);
    return fechaCita >= ahora && c.servicio !== 'BLOQUEADO';
  });

  // Historial: Ya pasaron (incluye bloqueos pasados)
  const citasHistorial = citas.filter(c => {
    const fechaCita = new Date(`${c.fecha}T${c.hora}`);
    return fechaCita < ahora && c.servicio !== 'BLOQUEADO';
  });

  // --- FUNCIONES WHATSAPP (CORREGIDA) Y EXCEL ---
  
  const terminarCitaYAgradecer = (cita: any) => {
    if(!cita.telefono) return alert("El cliente no dejó teléfono");
    
    // 1. Limpiamos el número (sacamos espacios o +56)
    let fono = cita.telefono.replace(/\D/g, ''); 
    if(fono.length === 8) fono = '569' + fono; // Si puso 912345678
    if(fono.length === 9 && fono.startsWith('9')) fono = '56' + fono;

    // 2. Definimos los emojis con código seguro (Unicode) para evitar errores
    const emojis = {
      corazon: '\uD83D\uDC96', // 💖
      brillos: '\u2728',       // ✨
      unias: '\uD83D\uDC85',   // 💅
      feliz: '\uD83E\uDD70'    // 🥰
    };

    // 3. Armamos el mensaje
    const mensaje = `¡Hola ${cita.cliente}! ${emojis.corazon}${emojis.brillos}\n\nMuchas gracias por visitarnos hoy en Carolina Nails Studio ${emojis.unias}.\nFue un gusto atenderte. ¡Espero que ames tus uñas tanto como yo!\n\nNos vemos en la próxima. ${emojis.feliz}`;
    
    // 4. Abrir WhatsApp
    const url = `https://wa.me/${fono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  const descargarReporte = () => {
    // Crear contenido CSV (Excel básico)
    const encabezados = ["ID,Cliente,Servicio,Fecha,Hora,Email,Telefono\n"];
    const filas = citasHistorial.map(c => 
      `${c.id},"${c.cliente}","${c.servicio}",${c.fecha},${c.hora},${c.email},${c.telefono}`
    );
    
    const csvContent = encabezados + filas.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Crear link invisible para descargar
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_carolina_nails_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const cancelarCita = async (id: number) => {
    if(!confirm("¿Eliminar definitivamente?")) return;
    await supabase.from('citas').delete().eq('id', id);
    cargarDatos();
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
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-gray-900/50 p-4 rounded-xl border border-gray-800 backdrop-blur-md sticky top-0 z-50">
          <h1 className="text-2xl font-bold text-purple-400 flex items-center gap-2">
            <Lock className="w-6 h-6" /> Administración
          </h1>
          <div className="flex gap-3 mt-4 md:mt-0">
             {/* PESTAÑAS */}
            <button onClick={() => setVista('activas')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${vista === 'activas' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
              Agenda Activa
            </button>
            <button onClick={() => setVista('historial')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${vista === 'historial' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
              Historial y Reportes
            </button>
            <button onClick={() => setAuth(false)} className="text-red-400 hover:bg-red-900/20 px-3 py-2 rounded-lg">
              <LogOut size={20}/>
            </button>
          </div>
        </div>

        {/* VISTA: AGENDA ACTIVA */}
        {vista === 'activas' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-purple-300 flex items-center gap-2">
              <Calendar className="w-5 h-5"/> Próximas Citas ({citasActivas.length})
            </h2>
            
            <div className="grid gap-4">
              {citasActivas.length === 0 ? <p className="text-gray-500 italic">No hay citas pendientes.</p> : citasActivas.map(c => (
                <div key={c.id} className="bg-gray-900 border border-gray-800 p-5 rounded-xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-lg hover:border-purple-500/30 transition-all">
                  
                  {/* Info Hora */}
                  <div className="flex items-center gap-4 min-w-[150px]">
                    <div className="bg-gray-800 px-4 py-3 rounded-lg text-center border border-gray-700">
                      <span className="block text-2xl font-bold text-white leading-none">{c.hora.slice(0,5)}</span>
                      <span className="text-xs text-purple-400 font-bold mt-1">PENDIENTE</span> 
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">{c.fecha}</p>
                      <h3 className="font-bold text-lg text-white">{c.cliente}</h3>
                      <span className="inline-block bg-purple-900/30 text-purple-300 text-xs px-2 py-1 rounded border border-purple-500/20 mt-1">
                        {c.servicio}
                      </span>
                    </div>
                  </div>

                  {/* Info Contacto */}
                  <div className="flex flex-col gap-2 text-sm text-gray-400 mr-auto">
                    <span className="flex items-center gap-2"><Phone size={14} className="text-green-400"/> {c.telefono || 'Sin teléfono'}</span>
                    <span className="flex items-center gap-2"><Mail size={14} className="text-blue-400"/> {c.email || 'Sin email'}</span>
                  </div>

                  {/* BOTONES DE ACCIÓN */}
                  <div className="flex gap-3 w-full md:w-auto">
                    <button 
                      onClick={() => terminarCitaYAgradecer(c)}
                      className="flex-1 md:flex-none bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-green-900/20"
                    >
                      <MessageCircle size={18} /> Terminar y Agradecer
                    </button>
                    
                    <button 
                      onClick={() => cancelarCita(c.id)}
                      className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 px-3 py-2 rounded-lg transition-colors"
                      title="Cancelar Cita"
                    >
                      <Trash2 size={18}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA: HISTORIAL */}
        {vista === 'historial' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-blue-900/10 border border-blue-800 p-6 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-blue-300 flex items-center gap-2">
                  <Clock className="w-5 h-5"/> Historial de Servicios
                </h2>
                <p className="text-sm text-blue-200/60 mt-1">Aquí están todas las citas pasadas.</p>
              </div>
              <button 
                onClick={descargarReporte}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
              >
                <FileText size={20}/> Descargar Excel Completo
              </button>
            </div>

            <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
              <table className="w-full text-sm text-left text-gray-400">
                <thead className="text-xs text-gray-200 uppercase bg-gray-800">
                  <tr>
                    <th className="px-6 py-3">Fecha</th>
                    <th className="px-6 py-3">Cliente</th>
                    <th className="px-6 py-3">Servicio</th>
                    <th className="px-6 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {citasHistorial.map(c => (
                    <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-6 py-4">{c.fecha} {c.hora}</td>
                      <td className="px-6 py-4 font-medium text-white">{c.cliente}</td>
                      <td className="px-6 py-4">{c.servicio}</td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1 text-green-400 bg-green-900/20 px-2 py-1 rounded w-fit text-xs border border-green-900/50">
                          <CheckCircle size={12}/> Completado
                        </span>
                      </td>
                    </tr>
                  ))}
                  {citasHistorial.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-600">Aún no hay historial.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}