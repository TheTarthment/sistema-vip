"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, Plus, Lock, DollarSign, LogOut, Calendar, Phone, MessageCircle, FileText, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState('');
  
  // Datos
  const [citas, setCitas] = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  
  // Costo Fijo Mensual (Luz, Agua, Local) - Mantenemos el dato de tu Excel
  const COSTO_FIJO_LUZ = 30000; 

  // Formularios
  // AHORA INCLUYE 'COSTO' (Lo que gasta ella)
  const [nuevoServicio, setNuevoServicio] = useState({ nombre: '', precio: '', costo: '' });
  const [bloqueo, setBloqueo] = useState({ fecha: '', hora: '' });
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7));
  
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

  // --- HELPERS: OBTENER PRECIO Y COSTO ---
  const getInfoServicio = (nombreServicio: string) => {
    const s = servicios.find(ser => ser.nombre === nombreServicio);
    // Devuelve precio venta y costo insumos. Si no existe, devuelve 0.
    return { 
      precio: s ? s.precio : 0, 
      costo: s ? s.costo : 0 
    };
  };

  // --- GESTIÓN SERVICIOS (AHORA CON COSTO) ---
  const agregarServicio = async () => {
    if (!nuevoServicio.nombre || !nuevoServicio.precio || !nuevoServicio.costo) return alert("Faltan datos (Nombre, Precio o Costo)");
    
    await supabase.from('servicios').insert([{ 
      nombre: nuevoServicio.nombre, 
      precio: parseInt(nuevoServicio.precio), 
      costo: parseInt(nuevoServicio.costo), // Guardamos el costo específico
      activo: true 
    }]);
    
    setNuevoServicio({ nombre: '', precio: '', costo: '' });
    cargarDatos();
  };

  const borrarServicio = async (id: string) => {
    if(confirm("¿Borrar servicio?")) {
      await supabase.from('servicios').delete().eq('id', id);
      cargarDatos();
    }
  };

  // --- CÁLCULOS FINANCIEROS REALES ---
  const citasHistorial = citas.filter(c => {
    if (c.servicio === 'BLOQUEADO') return false;
    const fechaCita = new Date(`${c.fecha}T${c.hora}`);
    const ahora = new Date();
    // Filtro: Completada O Pasada + Mes Correcto
    return (c.estado === 'completada' || fechaCita < ahora) && c.fecha.startsWith(mesFiltro);
  });

  // 1. Total Vendido (Ingresos)
  const totalIngresos = citasHistorial.reduce((sum, c) => {
    return c.estado === 'completada' ? sum + getInfoServicio(c.servicio).precio : sum;
  }, 0);

  // 2. Total Gastado en Insumos (Variable Real por cada servicio)
  const totalGastosVariables = citasHistorial.reduce((sum, c) => {
    return c.estado === 'completada' ? sum + getInfoServicio(c.servicio).costo : sum;
  }, 0);

  // 3. Ganancia Neta
  const gananciaNeta = totalIngresos - COSTO_FIJO_LUZ - totalGastosVariables;


  // --- GENERADOR DE EXCEL EXACTO ---
  const descargarReporteInteligente = () => {
    const wb = XLSX.utils.book_new();

    // HOJA 1: RESUMEN FINANCIERO EXACTO
    const datosResumen = [
      ["REPORTE FINANCIERO MENSUAL", mesFiltro],
      ["Sistema", "Carolina Nails Studio"],
      ["", ""],
      ["INGRESOS (Ventas)", totalIngresos],
      ["", ""],
      ["GASTOS", ""],
      ["Gastos Fijos (Luz/Local)", COSTO_FIJO_LUZ],
      ["Gastos Variables (Insumos por servicio)", totalGastosVariables],
      ["TOTAL GASTOS", COSTO_FIJO_LUZ + totalGastosVariables],
      ["", ""],
      ["GANANCIA LÍQUIDA REAL", gananciaNeta]
    ];
    
    const wsResumen = XLSX.utils.aoa_to_sheet(datosResumen);
    XLSX.utils.book_append_sheet(wb, wsResumen, "Balance Real");

    // HOJAS POR SERVICIO
    const serviciosUnicos = Array.from(new Set(citasHistorial.map(c => c.servicio)));
    serviciosUnicos.forEach(servicio => {
      const citasServ = citasHistorial.filter(c => c.servicio === servicio);
      const info = getInfoServicio(servicio);

      const datosServicio = [
        ["Fecha", "Cliente", "Venta", "Costo Insumo", "Ganancia Unit.", "Estado"],
        ...citasServ.map(c => [
          c.fecha,
          c.cliente,
          info.precio,
          info.costo, // Aquí mostramos cuánto costó este servicio específico
          info.precio - info.costo,
          c.estado === 'completada' ? "Pagado" : "Pendiente"
        ])
      ];
      const wsServicio = XLSX.utils.aoa_to_sheet(datosServicio);
      const nombreLimpio = servicio.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 30) || "Srv";
      XLSX.utils.book_append_sheet(wb, wsServicio, nombreLimpio);
    });

    XLSX.writeFile(wb, `Reporte_Exacto_${mesFiltro}.xlsx`);
  };

  // --- OTRAS FUNCIONES (Bloqueo, Terminar, etc) ---
  const bloquearHorario = async () => {
    if (!bloqueo.fecha || !bloqueo.hora) return alert("Faltan datos");
    const { error } = await supabase.from('citas').insert([{ cliente: '⛔ BLOQUEO', fecha: bloqueo.fecha, hora: bloqueo.hora, servicio: 'BLOQUEADO', telefono: '-', email: '-', estado: 'bloqueado' }]);
    if (error) alert("Error"); else { alert("Bloqueado"); setBloqueo({ fecha: '', hora: '' }); cargarDatos(); }
  };

  const terminarCitaYAgradecer = async (cita: any) => {
    if(!cita.telefono) return alert("Sin teléfono");
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
    if(confirm("¿Eliminar?")) { await supabase.from('citas').delete().eq('id', id); cargarDatos(); }
  };

  if (!auth) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="bg-gray-900 p-8 rounded text-center"><input type="password" className="bg-gray-800 text-white p-2 rounded mb-4" placeholder="Contraseña" value={pass} onChange={e=>setPass(e.target.value)}/><button onClick={login} className="bg-purple-600 text-white p-2 rounded w-full">Entrar</button></div></div>;

  // Render principal
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 bg-gray-900/50 p-4 rounded-xl border border-gray-800 sticky top-0 z-50">
          <h1 className="text-2xl font-bold text-purple-400 flex items-center gap-2"><Lock className="w-6 h-6"/> Panel Financiero PRO</h1>
          <button onClick={()=>setAuth(false)} className="text-red-400 px-3 py-2 rounded-lg flex items-center gap-2"><LogOut size={18}/> Salir</button>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* PANEL IZQUIERDO: GESTIÓN DE SERVICIOS */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-400"><DollarSign/> Crear Servicio</h2>
              <p className="text-xs text-gray-400 mb-2">Define precio de venta y costo de materiales.</p>
              
              <div className="space-y-3">
                <input placeholder="Nombre Servicio" className="w-full bg-gray-800 border border-gray-700 p-2 rounded text-sm" value={nuevoServicio.nombre} onChange={e=>setNuevoServicio({...nuevoServicio, nombre: e.target.value})}/>
                <div className="flex gap-2">
                   <div className="flex-1">
                     <label className="text-[10px] text-gray-500">Precio Venta</label>
                     <input type="number" placeholder="$ Venta" className="w-full bg-gray-800 border border-gray-700 p-2 rounded text-sm text-green-400 font-bold" value={nuevoServicio.precio} onChange={e=>setNuevoServicio({...nuevoServicio, precio: e.target.value})}/>
                   </div>
                   <div className="flex-1">
                     <label className="text-[10px] text-gray-500">Costo Insumos</label>
                     <input type="number" placeholder="$ Costo" className="w-full bg-gray-800 border border-gray-700 p-2 rounded text-sm text-red-400 font-bold" value={nuevoServicio.costo} onChange={e=>setNuevoServicio({...nuevoServicio, costo: e.target.value})}/>
                   </div>
                </div>
                <button onClick={agregarServicio} className="w-full bg-green-600 hover:bg-green-500 text-white p-2 rounded font-bold flex justify-center gap-2"><Plus size={18}/> Agregar Servicio</button>
              </div>

              {/* LISTA DE SERVICIOS EXISTENTES */}
              <ul className="mt-6 space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {servicios.map(s => (
                  <li key={s.id} className="flex justify-between items-center bg-gray-800/50 p-3 rounded border border-gray-700/50 text-xs">
                    <div>
                      <span className="block font-bold text-white">{s.nombre}</span>
                      <span className="text-gray-400">Venta: <span className="text-green-400">${s.precio}</span> | Costo: <span className="text-red-400">${s.costo || 0}</span></span>
                    </div>
                    <button onClick={() => borrarServicio(s.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={16}/></button>
                  </li>
                ))}
              </ul>
            </div>

            {/* BLOQUEO DE HORAS */}
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-400"><Lock/> Bloquear Agenda</h2>
              <div className="space-y-3">
                <input type="date" className="w-full bg-gray-800 border border-gray-700 p-2 rounded text-sm" onChange={e=>setBloqueo({...bloqueo, fecha: e.target.value})}/>
                <select className="w-full bg-gray-800 border border-gray-700 p-2 rounded text-sm" onChange={e=>setBloqueo({...bloqueo, hora: e.target.value})}>
                  <option value="">Hora...</option>
                  {["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"].map(h=><option key={h} value={h}>{h}</option>)}
                </select>
                <button onClick={bloquearHorario} className="w-full bg-red-600 hover:bg-red-500 text-white py-2 rounded font-bold text-sm">Bloquear</button>
              </div>
            </div>
          </div>

          {/* PANEL DERECHO: AGENDA Y FINANZAS */}
          <div className="lg:col-span-8">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl h-full flex flex-col">
              
              <div className="flex gap-4 border-b border-gray-800 pb-4 mb-4">
                <button onClick={() => setVista('activas')} className={`px-4 py-2 rounded-lg text-sm font-bold ${vista === 'activas' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Agenda Activa</button>
                <button onClick={() => setVista('historial')} className={`px-4 py-2 rounded-lg text-sm font-bold ${vista === 'historial' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Caja y Reportes</button>
              </div>

              {/* VISTA ACTIVAS */}
              {vista === 'activas' && (
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 max-h-[800px]">
                   <h3 className="text-gray-400 text-sm flex items-center gap-2"><Calendar size={16}/> Pendientes (Futuras)</h3>
                   {citasActivas.map(c => (
                     <div key={c.id} className="bg-gray-800/40 border border-gray-700 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-center">
                       <div className="text-center min-w-[60px]"><span className="block text-xl font-bold text-white">{c.hora.slice(0,5)}</span><span className="text-[10px] text-gray-400">{c.fecha}</span></div>
                       <div className="flex-1">
                         <h4 className="font-bold text-white">{c.cliente}</h4>
                         <span className="text-purple-300 text-sm">{c.servicio}</span>
                       </div>
                       <div className="flex gap-2">
                         <button onClick={() => terminarCitaYAgradecer(c)} className="bg-green-600 px-3 py-2 rounded-lg text-xs font-bold text-white flex gap-1 items-center"><MessageCircle size={14}/> Terminar</button>
                         <button onClick={() => cancelarCita(c.id)} className="bg-red-900/20 text-red-400 px-3 py-2 rounded-lg"><Trash2 size={16}/></button>
                       </div>
                     </div>
                   ))}
                   {citasActivas.length === 0 && <p className="text-center text-gray-600 py-10">Todo al día.</p>}
                </div>
              )}

              {/* VISTA CAJA */}
              {vista === 'historial' && (
                <div className="flex-1 flex flex-col space-y-6">
                  
                  {/* TABLERO DE CONTROL FINANCIERO */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-900/20 border border-green-800 p-4 rounded-xl">
                      <p className="text-xs text-green-400 flex items-center gap-1"><TrendingUp size={12}/> Ingresos Venta</p>
                      <h3 className="text-2xl font-bold text-white">${totalIngresos.toLocaleString()}</h3>
                    </div>
                    <div className="bg-red-900/20 border border-red-800 p-4 rounded-xl">
                      <p className="text-xs text-red-400 flex items-center gap-1"><TrendingDown size={12}/> Gastos (Luz + Insumos)</p>
                      <h3 className="text-2xl font-bold text-white">${(COSTO_FIJO_LUZ + totalGastosVariables).toLocaleString()}</h3>
                    </div>
                    <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-xl">
                      <p className="text-xs text-blue-400 font-bold">GANANCIA LÍQUIDA</p>
                      <h3 className="text-3xl font-bold text-blue-200">${gananciaNeta.toLocaleString()}</h3>
                    </div>
                  </div>

                  {/* CONTROLES EXPORTACIÓN */}
                  <div className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-800">
                    <input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="bg-black text-white border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none"/>
                    <button onClick={descargarReporteInteligente} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg animate-pulse">
                      <Download size={16}/> DESCARGAR REPORTE EXCEL
                    </button>
                  </div>

                  {/* TABLA DETALLE */}
                  <div className="flex-1 overflow-y-auto pr-2 bg-gray-900 rounded-xl border border-gray-800">
                     <table className="w-full text-sm text-left text-gray-400">
                       <thead className="text-xs text-gray-200 uppercase bg-gray-800 sticky top-0">
                         <tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Servicio</th><th className="px-4 py-3">Costo</th><th className="px-4 py-3">Ganancia</th></tr>
                       </thead>
                       <tbody>
                         {citasHistorial.map(c => {
                           const info = getInfoServicio(c.servicio);
                           return (
                             <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                               <td className="px-4 py-3">{c.fecha}</td>
                               <td className="px-4 py-3 text-white">{c.cliente}</td>
                               <td className="px-4 py-3">{c.servicio}</td>
                               <td className="px-4 py-3 text-red-400">-${info.costo}</td>
                               <td className="px-4 py-3 text-green-400">+${info.precio - info.costo}</td>
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