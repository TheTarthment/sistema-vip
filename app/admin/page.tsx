"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, Plus, Lock, DollarSign, LogOut, Calendar, Phone, MessageCircle, Download, TrendingUp, TrendingDown, RefreshCw, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState('');
  
  // Datos
  const [citas, setCitas] = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  
  // --- CONFIGURACIÓN FINANCIERA (BASE EXCEL) ---
  const COSTO_FIJO_MENSUAL = 30000; // Luz y gastos fijos

  // LISTA MAESTRA DE SERVICIOS
  const SERVICIOS_REALES = [
    { nombre: 'Esmaltado Permanente', precio: 14000, costo: 850 },
    { nombre: 'Permanente + Baño de Gel', precio: 20000, costo: 1200 },
    { nombre: 'Polygel', precio: 25000, costo: 2500 }, 
    { nombre: 'Pedicure Completo', precio: 17000, costo: 1500 },
    { nombre: 'Parafinoterapia', precio: 5000, costo: 800 },
    { nombre: 'Retiro Permanente', precio: 5000, costo: 300 },
    { nombre: 'Retiro Polygel', precio: 8000, costo: 400 },
    { nombre: 'Retiro Acrílico', precio: 10000, costo: 500 }
  ];

  const [nuevoServicio, setNuevoServicio] = useState({ nombre: '', precio: '', costo: '' });
  const [bloqueo, setBloqueo] = useState({ fecha: '', hora: '' });
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7)); // Ej: 2026-01
  const [vista, setVista] = useState<'activas' | 'historial'>('activas');
  const router = useRouter();

  // --- 🔒 CAMBIO DE CONTRASEÑA ---
  const PASSWORD_SECRETA = "Emily123."; // <--- NUEVA CONTRASEÑA
  // -------------------------------

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

  // --- 1. FUNCIÓN: REINICIAR SERVICIOS ---
  const sincronizarServiciosReales = async () => {
    if(!confirm("¿Cargar la lista OFICIAL de servicios y precios del Excel?")) return;
    const { data: actuales } = await supabase.from('servicios').select('id');
    if (actuales) { for (const s of actuales) await supabase.from('servicios').delete().eq('id', s.id); }
    for (const s of SERVICIOS_REALES) {
      await supabase.from('servicios').insert([{ nombre: s.nombre, precio: s.precio, costo: s.costo, activo: true }]);
    }
    alert("✅ Servicios Configurados Correctamente.");
    cargarDatos();
  };

  // --- 2. FUNCIÓN: VACIAR AGENDA (Reset de Fábrica) ---
  const vaciarAgendaCompleta = async () => {
    if(!confirm("⚠️ ¿ESTÁS SEGURA? ⚠️\n\nEsto borrará TODAS las citas y el historial de dinero.\n\nÚsalo solo antes de entregar el sistema.")) return;
    if(!confirm("Confirmación final: Se borrará todo.")) return;
    
    // Solución al error UUID
    const { error } = await supabase.from('citas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    if(error) alert("Error: " + error.message);
    else {
      alert("✨ Sistema Limpio. Caja en $0. Listo para trabajar.");
      cargarDatos();
    }
  };

  // --- LÓGICA FINANCIERA ---
  const getInfoServicio = (nombreServicio: string) => {
    const s = servicios.find(ser => ser.nombre === nombreServicio);
    const respaldo = SERVICIOS_REALES.find(sr => sr.nombre === nombreServicio);
    if (s) return { precio: s.precio, costo: s.costo || 0 };
    if (respaldo) return { precio: respaldo.precio, costo: respaldo.costo };
    return { precio: 0, costo: 0 };
  };

  const citasHistorial = citas.filter(c => {
    if (c.servicio === 'BLOQUEADO') return false;
    const servicioEsValido = servicios.some(s => s.nombre === c.servicio);
    if (!servicioEsValido && servicios.length > 0) return false; 
    const fechaCita = new Date(`${c.fecha}T${c.hora}`);
    const ahora = new Date();
    return (c.estado === 'completada' || fechaCita < ahora) && c.fecha.startsWith(mesFiltro);
  });

  const totalIngresos = citasHistorial.reduce((sum, c) => c.estado === 'completada' ? sum + getInfoServicio(c.servicio).precio : sum, 0);
  const totalCostosVariables = citasHistorial.reduce((sum, c) => c.estado === 'completada' ? sum + getInfoServicio(c.servicio).costo : sum, 0);
  const gananciaNeta = totalIngresos - COSTO_FIJO_MENSUAL - totalCostosVariables;

  // --- EXPORTAR EXCEL FUSIONADO ---
  const descargarReporteFusionado = () => {
    const wb = XLSX.utils.book_new();
    const datosResumen = [
      ["REPORTE FINANCIERO MENSUAL", mesFiltro], ["Carolina Nails Studio", ""], ["", ""],
      ["INGRESOS (Ventas)", totalIngresos], ["", ""],
      ["GASTOS FIJOS (Luz)", COSTO_FIJO_MENSUAL], 
      ["GASTOS VARIABLES (Insumos)", totalCostosVariables], 
      ["TOTAL GASTOS", COSTO_FIJO_MENSUAL + totalCostosVariables],
      ["", ""], ["GANANCIA LÍQUIDA", gananciaNeta]
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(datosResumen);
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen General");

    const serviciosUnicos = Array.from(new Set(citasHistorial.map(c => c.servicio)));
    serviciosUnicos.forEach(servicio => {
      const citasServ = citasHistorial.filter(c => c.servicio === servicio);
      const info = getInfoServicio(servicio);
      const gananciaUnit = info.precio - info.costo;
      const datosServicio = [
        ["Fecha", "Cliente", "Teléfono", "Venta", "Costo", "Ganancia", "Estado"],
        ...citasServ.map(c => [
          c.fecha, c.cliente, c.telefono, info.precio, info.costo, gananciaUnit, c.estado === 'completada' ? "Pagado" : "Pendiente"
        ])
      ];
      const wsServicio = XLSX.utils.aoa_to_sheet(datosServicio);
      const nombreHoja = servicio.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 30) || "Servicio";
      XLSX.utils.book_append_sheet(wb, wsServicio, nombreHoja);
    });
    XLSX.writeFile(wb, `Reporte_CarolinaNails_${mesFiltro}.xlsx`);
  };

  // --- GESTIÓN MANUAL ---
  const agregarServicio = async () => {
    if (!nuevoServicio.nombre || !nuevoServicio.precio || !nuevoServicio.costo) return alert("Faltan datos");
    await supabase.from('servicios').insert([{ nombre: nuevoServicio.nombre, precio: parseInt(nuevoServicio.precio), costo: parseInt(nuevoServicio.costo), activo: true }]);
    setNuevoServicio({ nombre: '', precio: '', costo: '' });
    cargarDatos();
  };
  const borrarServicio = async (id: string) => { if(confirm("¿Borrar?")) await supabase.from('servicios').delete().eq('id', id); cargarDatos(); };
  
  const bloquearHorario = async () => {
    if (!bloqueo.fecha || !bloqueo.hora) return alert("Faltan datos");
    await supabase.from('citas').insert([{ cliente: '⛔ BLOQUEO', fecha: bloqueo.fecha, hora: bloqueo.hora, servicio: 'BLOQUEADO', telefono: '-', email: '-', estado: 'bloqueado' }]);
    alert("Bloqueado"); setBloqueo({ fecha: '', hora: '' }); cargarDatos(); 
  };

  const terminarCitaYAgradecer = async (cita: any) => {
    if(!cita.telefono) return alert("Sin fono");
    await supabase.from('citas').update({ estado: 'completada' }).eq('id', cita.id);
    await cargarDatos();
    
    let fono = cita.telefono.replace(/\D/g, ''); 
    if(fono.length === 8) fono = '569' + fono; 
    if(fono.length === 9 && fono.startsWith('9')) fono = '56' + fono;
    
    const emojis = { corazon: '\uD83D\uDC96', brillos: '\u2728', unias: '\uD83D\uDC85', feliz: '\uD83E\uDD70' };
    const mensaje = `¡Hola ${cita.cliente}! ${emojis.corazon}${emojis.brillos}\n\nMuchas gracias por visitarnos hoy en Carolina Nails Studio ${emojis.unias}.\nFue un gusto atenderte. ¡Espero que ames tus uñas tanto como yo!\n\nNos vemos en la próxima. ${emojis.feliz}`;
    window.open(`https://wa.me/${fono}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const cancelarCita = async (id: any) => { if(confirm("¿Eliminar?")) { await supabase.from('citas').delete().eq('id', id); cargarDatos(); } };

  // --- LOGIN ---
  if (!auth) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gray-900 p-8 rounded-xl border border-purple-500/30 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-6">Acceso Carolina Nails</h1>
          <input type="password" className="w-full bg-gray-800 text-white p-3 rounded-lg mb-4 border border-gray-700 outline-none focus:border-purple-500" placeholder="Contraseña" value={pass} onChange={e => setPass(e.target.value)} />
          <button onClick={login} className="w-full bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-lg font-bold">Entrar</button>
          <button onClick={() => router.push('/')} className="w-full mt-4 text-gray-500 text-sm hover:text-white">Volver al Inicio</button>
        </div>
      </div>
    );
  }

  const citasActivas = citas.filter(c => {
    if (c.servicio === 'BLOQUEADO') return false;
    const fechaCita = new Date(`${c.fecha}T${c.hora}`);
    const ahora = new Date();
    return c.estado !== 'completada' && fechaCita >= ahora;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 bg-gray-900/50 p-4 rounded-xl border border-gray-800 sticky top-0 z-50 backdrop-blur-md">
          <h1 className="text-2xl font-bold text-purple-400 flex items-center gap-2"><Lock className="w-6 h-6"/> Panel Financiero</h1>
          <button onClick={()=>setAuth(false)} className="text-red-400 px-3 py-2 rounded-lg flex items-center gap-2"><LogOut size={18}/> Salir</button>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl">
              <h2 className="text-xl font-bold flex items-center gap-2 text-green-400 mb-4"><DollarSign/> Servicios</h2>
              <div className="grid grid-cols-2 gap-2 mb-6">
                <button onClick={sincronizarServiciosReales} className="text-xs bg-blue-900/40 hover:bg-blue-800 text-blue-200 px-2 py-2 rounded flex flex-col items-center gap-1 text-center border border-blue-800" title="Cargar precios y costos del Excel">
                    <RefreshCw size={14}/> <span>Cargar Oficiales</span>
                </button>
                <button onClick={vaciarAgendaCompleta} className="text-xs bg-red-900/40 hover:bg-red-800 text-red-200 px-2 py-2 rounded flex flex-col items-center gap-1 text-center border border-red-800" title="Dejar caja en $0">
                    <AlertTriangle size={14}/> <span>RESET CAJA</span>
                </button>
              </div>
              <div className="space-y-3 bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                <input placeholder="Nombre Nuevo" className="w-full bg-gray-800 border border-gray-700 p-2 rounded text-sm" value={nuevoServicio.nombre} onChange={e=>setNuevoServicio({...nuevoServicio, nombre: e.target.value})}/>
                <div className="flex gap-2">
                   <input type="number" placeholder="$ Venta" className="w-1/2 bg-gray-800 border border-gray-700 p-2 rounded text-sm text-green-400 font-bold" value={nuevoServicio.precio} onChange={e=>setNuevoServicio({...nuevoServicio, precio: e.target.value})}/>
                   <input type="number" placeholder="$ Costo" className="w-1/2 bg-gray-800 border border-gray-700 p-2 rounded text-sm text-red-400 font-bold" value={nuevoServicio.costo} onChange={e=>setNuevoServicio({...nuevoServicio, costo: e.target.value})}/>
                </div>
                <button onClick={agregarServicio} className="w-full bg-green-600 hover:bg-green-500 text-white p-2 rounded font-bold flex justify-center gap-2"><Plus size={18}/> Agregar</button>
              </div>
              <ul className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {servicios.map(s => (
                  <li key={s.id} className="flex justify-between items-center bg-gray-800/30 p-2 rounded border border-gray-700/30 text-xs hover:bg-gray-800 transition-colors">
                    <div>
                      <span className="block font-bold text-white mb-0.5">{s.nombre}</span>
                      <div className="flex gap-2">
                        <span className="text-gray-400">Venta: <span className="text-green-400 font-mono">${s.precio}</span></span>
                        <span className="text-gray-400">Costo: <span className="text-red-400 font-mono">${s.costo || 0}</span></span>
                      </div>
                    </div>
                    <button onClick={() => borrarServicio(s.id)} className="text-gray-600 hover:text-red-400"><Trash2 size={14}/></button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-400"><Lock/> Bloqueo</h2>
              <div className="space-y-3">
                <input type="date" className="w-full bg-gray-800 border border-gray-700 p-2 rounded text-sm" onChange={e=>setBloqueo({...bloqueo, fecha: e.target.value})}/>
                <select className="w-full bg-gray-800 border border-gray-700 p-2 rounded text-sm" onChange={e=>setBloqueo({...bloqueo, hora: e.target.value})}>
                  <option value="">Hora...</option>
                  {["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"].map(h=><option key={h} value={h}>{h}</option>)}
                </select>
                <button onClick={bloquearHorario} className="w-full bg-red-600 hover:bg-red-500 text-white py-2 rounded font-bold text-sm">Bloquear Hora</button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-8">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl h-full flex flex-col">
              <div className="flex gap-4 border-b border-gray-800 pb-4 mb-4">
                <button onClick={() => setVista('activas')} className={`px-4 py-2 rounded-lg text-sm font-bold ${vista === 'activas' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Agenda Activa</button>
                <button onClick={() => setVista('historial')} className={`px-4 py-2 rounded-lg text-sm font-bold ${vista === 'historial' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Reportes y Caja</button>
              </div>
              {vista === 'activas' && (
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 max-h-[800px]">
                   <h3 className="text-gray-400 text-sm flex items-center gap-2"><Calendar size={16}/> {citasActivas.length} Citas Pendientes</h3>
                   {citasActivas.map(c => (
                     <div key={c.id} className="bg-gray-800/40 border border-gray-700 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-center hover:border-purple-500/30 transition-all">
                       <div className="text-center min-w-[60px]"><span className="block text-xl font-bold text-white">{c.hora.slice(0,5)}</span><span className="text-[10px] text-gray-400">{c.fecha}</span></div>
                       <div className="flex-1">
                         <h4 className="font-bold text-white">{c.cliente}</h4>
                         <span className="text-purple-300 text-sm">{c.servicio}</span>
                       </div>
                       <div className="flex gap-2">
                         <button onClick={() => terminarCitaYAgradecer(c)} className="bg-green-600 hover:bg-green-500 px-3 py-2 rounded-lg text-xs font-bold text-white flex gap-1 items-center transition-transform active:scale-95"><MessageCircle size={14}/> Terminar</button>
                         <button onClick={() => cancelarCita(c.id)} className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-3 py-2 rounded-lg"><Trash2 size={16}/></button>
                       </div>
                     </div>
                   ))}
                   {citasActivas.length === 0 && <p className="text-center text-gray-600 py-10 border-2 border-dashed border-gray-800 rounded-xl">Sin citas pendientes hoy.</p>}
                </div>
              )}
              {vista === 'historial' && (
                <div className="flex-1 flex flex-col space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-900/10 border border-green-800/50 p-4 rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider text-green-400 flex items-center gap-1 mb-1"><TrendingUp size={12}/> Ventas Totales</p>
                      <h3 className="text-2xl font-bold text-white">${totalIngresos.toLocaleString()}</h3>
                    </div>
                    <div className="bg-red-900/10 border border-red-800/50 p-4 rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider text-red-400 flex items-center gap-1 mb-1"><TrendingDown size={12}/> Gastos (Luz+Mat)</p>
                      <h3 className="text-2xl font-bold text-white">${(COSTO_FIJO_MENSUAL + totalCostosVariables).toLocaleString()}</h3>
                    </div>
                    <div className={`p-4 rounded-xl border shadow-[0_0_15px_rgba(0,0,0,0.2)] ${gananciaNeta >= 0 ? 'bg-blue-900/20 border-blue-600/50' : 'bg-red-900/20 border-red-600/50'}`}>
                      <p className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${gananciaNeta >= 0 ? 'text-blue-300' : 'text-red-300'}`}>GANANCIA LÍQUIDA</p>
                      <h3 className="text-3xl font-bold text-white">${gananciaNeta.toLocaleString()}</h3>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-800/40 p-4 rounded-xl border border-gray-700 gap-4">
                    <div className="flex items-center gap-3">
                       <span className="text-sm text-gray-400">Periodo:</span>
                       <input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="bg-gray-900 text-white border border-gray-600 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500"/>
                    </div>
                    <button onClick={descargarReporteFusionado} className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-105">
                      <Download size={16}/> EXPORTAR REPORTE
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 bg-gray-900 rounded-xl border border-gray-800">
                     <table className="w-full text-sm text-left text-gray-400">
                       <thead className="text-xs text-gray-200 uppercase bg-gray-800 sticky top-0">
                         <tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Servicio</th><th className="px-4 py-3 text-right">Ganancia</th></tr>
                       </thead>
                       <tbody>
                         {citasHistorial.map(c => {
                           const info = getInfoServicio(c.servicio);
                           return (
                             <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                               <td className="px-4 py-3">{c.fecha}</td>
                               <td className="px-4 py-3 text-white">{c.cliente}</td>
                               <td className="px-4 py-3">{c.servicio}</td>
                               <td className="px-4 py-3 text-right font-mono text-green-400">+${(info.precio - info.costo).toLocaleString()}</td>
                             </tr>
                           )
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