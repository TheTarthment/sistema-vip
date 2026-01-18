"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, Plus, Lock, DollarSign, LogOut, Calendar, User, Mail, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState('');
  const [citas, setCitas] = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  
  const [nuevoServicio, setNuevoServicio] = useState({ nombre: '', precio: '' });
  const [bloqueo, setBloqueo] = useState({ fecha: '', hora: '' });
  const router = useRouter();

  // CONTRASEÑA ADMIN
  const PASSWORD_SECRETA = "admin123";

  const login = () => {
    if (pass === PASSWORD_SECRETA) setAuth(true);
    else alert("Contraseña incorrecta");
  };

  const cargarDatos = async () => {
    const { data: citasData } = await supabase.from('citas').select('*').order('fecha').order('hora');
    const { data: servData } = await supabase.from('servicios').select('*').order('nombre');
    setCitas(citasData || []);
    setServicios(servData || []);
  };

  useEffect(() => { if (auth) cargarDatos(); }, [auth]);

  const agregarServicio = async () => {
    if (!nuevoServicio.nombre || !nuevoServicio.precio) return alert("Faltan datos");
    await supabase.from('servicios').insert([{ nombre: nuevoServicio.nombre, precio: parseInt(nuevoServicio.precio) }]);
    setNuevoServicio({ nombre: '', precio: '' });
    cargarDatos();
  };

  const borrarServicio = async (id: string) => {
    if(confirm("¿Borrar servicio?")) {
      await supabase.from('servicios').delete().eq('id', id);
      cargarDatos();
    }
  };

  const bloquearHorario = async () => {
    if (!bloqueo.fecha || !bloqueo.hora) return alert("Selecciona fecha y hora");
    const { error } = await supabase.from('citas').insert([{ 
      cliente: '⛔ BLOQUEO ADMIN', fecha: bloqueo.fecha, hora: bloqueo.hora, servicio: 'BLOQUEADO', telefono: '-', email: '-'
    }]);
    if (error) alert("Error: " + error.message);
    else {
      alert("Horario bloqueado");
      setBloqueo({ fecha: '', hora: '' });
      cargarDatos();
    }
  };

  const cancelarCita = async (cita: any) => {
    if(!confirm("¿Cancelar cita?")) return;
    try {
      await fetch('/api/send', { method: 'POST', body: JSON.stringify({ tipo: 'cancelacion', ...cita }) });
    } catch (e) { console.error(e); }
    await supabase.from('citas').delete().eq('id', cita.id);
    alert("Cita eliminada.");
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
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 bg-gray-900/50 p-4 rounded-xl border border-gray-800 backdrop-blur-md sticky top-0 z-50">
          <h1 className="text-2xl font-bold text-purple-400 flex items-center gap-2">
            <Lock className="w-6 h-6" /> Panel Carolina Nails
          </h1>
          <button onClick={() => setAuth(false)} className="flex items-center gap-2 text-red-400 hover:text-red-300 bg-red-900/20 px-4 py-2 rounded-lg">
            <LogOut size={18}/> Salir
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-400"><DollarSign/> Servicios</h2>
              <div className="flex gap-2 mb-6">
                <input placeholder="Nombre" className="bg-gray-800 border border-gray-700 p-2 rounded w-full outline-none" 
                  value={nuevoServicio.nombre} onChange={e=>setNuevoServicio({...nuevoServicio, nombre: e.target.value})}/>
                <input placeholder="$" type="number" className="bg-gray-800 border border-gray-700 p-2 rounded w-20 outline-none" 
                  value={nuevoServicio.precio} onChange={e=>setNuevoServicio({...nuevoServicio, precio: e.target.value})}/>
                <button onClick={agregarServicio} className="bg-green-600 text-white p-2 rounded"><Plus/></button>
              </div>
              <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
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
                <input type="date" className="w-full bg-gray-800 border border-gray-700 p-2 rounded outline-none" 
                  onChange={e=>setBloqueo({...bloqueo, fecha: e.target.value})}/>
                <input type="time" className="w-full bg-gray-800 border border-gray-700 p-2 rounded outline-none" 
                  onChange={e=>setBloqueo({...bloqueo, hora: e.target.value})}/>
                <button onClick={bloquearHorario} className="w-full bg-red-600 text-white py-2 rounded font-bold">Bloquear</button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl h-full flex flex-col">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-400"><Calendar/> Agenda Completa</h2>
              <div className="space-y-3 flex-1 overflow-y-auto pr-2 max-h-[600px]">
                {citas.length === 0 ? <p className="text-center text-gray-600 mt-10">Sin citas.</p> : citas.map(c => (
                  <div key={c.id} className={`p-4 rounded-lg border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 
                    ${c.servicio === 'BLOQUEADO' ? 'bg-red-900/10 border-red-500/30' : 'bg-gray-800/40 border-gray-700'}`}>
                    <div className="flex items-center gap-4 min-w-[150px]">
                      <div className={`px-3 py-2 rounded text-center border ${c.servicio === 'BLOQUEADO' ? 'bg-red-900/40 border-red-500/50 text-red-200' : 'bg-gray-900 border-gray-600 text-gray-200'}`}>
                        <span className="block text-lg font-bold leading-none">{c.hora.slice(0,5)}</span>
                      </div>
                      <div>
                        <span className="block text-sm text-gray-400">{c.fecha}</span>
                        <span className={`text-xs font-bold ${c.servicio === 'BLOQUEADO' ? 'text-red-400' : 'text-blue-400'}`}>
                          {c.servicio === 'BLOQUEADO' ? '⛔ BLOQUEADO' : 'Confirmada'}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-white">{c.cliente}</h3>
                      <p className="text-sm text-purple-300 font-medium">{c.servicio}</p>
                      {c.servicio !== 'BLOQUEADO' && (
                        <div className="flex gap-4 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Mail size={12}/> {c.email}</span>
                          <span className="flex items-center gap-1"><Phone size={12}/> {c.telefono}</span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => cancelarCita(c)} className="text-red-400 hover:text-white hover:bg-red-600 px-3 py-2 rounded-lg transition-all text-sm">
                      <Trash2 size={16}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}