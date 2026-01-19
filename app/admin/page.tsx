"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, Plus, Lock, DollarSign, LogOut, Calendar, Phone, MessageCircle, FileText, Clock, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx'; // Importamos la librería profesional de Excel

export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState('');
  
  // Datos de la App
  const [citas, setCitas] = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  
  // Configuración Automática (Extraída de TU Excel)
  const COSTO_FIJO_LUZ = 30000;
  const COSTO_INSUMO_POR_CITA = 848; // Suma de limas, alcohol, pañitos, etc.

  // Formularios
  const [nuevoServicio, setNuevoServicio] = useState({ nombre: '', precio: '' });
  const [bloqueo, setBloqueo] = useState({ fecha: '', hora: '' });
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7)); // Ej: "2026-01"
  
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

  // Auxiliar: Buscar precio de un servicio
  const getPrecioServicio = (nombreServicio: string) => {
    const s = servicios.find(ser => ser.nombre === nombreServicio);
    return s ? s.precio : 0;
  };

  // --- LÓGICA DE FILTRADO ---
  const ahora = new Date(); 

  const citasActivas = citas.filter(c => {
    if (c.servicio === 'BLOQUEADO') return false;
    const fechaCita = new Date(`${c.fecha}T${c.hora}`);
    return c.estado !== 'completada' && fechaCita >= ahora;
  });

  const citasHistorial = citas.filter(c => {
    if (c.servicio === 'BLOQUEADO') return false;
    const fechaCita = new Date(`${c.fecha}T${c.hora}`);
    // Filtro: Completada O Pasada + Coincide con el MES seleccionado
    const esHistorial = c.estado === 'completada' || fechaCita < ahora;
    const coincideMes = c.fecha.startsWith(mesFiltro);
    return esHistorial && coincideMes;
  });

  // --- CÁLCULOS FINANCIEROS AUTOMÁTICOS ---
  const totalIngresos = citasHistorial.reduce((sum, c) => sum + (c.estado === 'completada' ? getPrecioServicio(c.servicio) : 0), 0);
  const totalCitasPagadas = citasHistorial.filter(c => c.estado === 'completada').length;
  const totalGastosVariables = totalCitasPagadas * COSTO_INSUMO_POR_CITA;
  const gananciaNeta = totalIngresos - COSTO_FIJO_LUZ - totalGastosVariables;

  // --- GENERADOR DE EXCEL AVANZADO (FUSIÓN) ---
  const descargarReporteInteligente = () => {
    // 1. Crear Libro de Excel
    const wb = XLSX.utils.book_new();

    // --- HOJA 1: RESUMEN FINANCIERO ---
    const datosResumen = [
      ["REPORTE FINANCIERO MENSUAL", mesFiltro],
      ["Generado automáticamente por", "Sistema Carolina Nails"],
      ["", ""],
      ["METRICAS DEL PERIODO", ""],
      ["Citas Atendidas", totalCitasPagadas],
      ["", ""],
      ["INGRESOS", "MONTO"],
      ["Ventas Totales", totalIngresos],
      ["", ""],
      ["GASTOS (Según estructura de costos)", "MONTO"],
      ["Gastos Fijos (Luz)", COSTO_FIJO_LUZ],
      ["Gastos Variables (Insumos $848 x Cita)", totalGastosVariables],
      ["TOTAL GASTOS", COSTO_FIJO_LUZ + totalGastosVariables],
      ["", ""],
      ["RESULTADO FINAL", ""],
      ["GANANCIA LÍQUIDA", gananciaNeta]
    ];
    
    const wsResumen = XLSX.utils.aoa_to_sheet(datosResumen);
    XLSX.utils.book_append_sheet(wb, wsResumen, "Balance Financiero");

    // --- HOJAS ADICIONALES: UNA POR CADA SERVICIO ---
    // Obtenemos la lista de servicios que se hicieron este mes
    const serviciosUnicos = Array.from(new Set(citasHistorial.map(c => c.servicio)));

    serviciosUnicos.forEach(servicio => {
      // Filtramos las citas de ESTE servicio específico
      const citasDeEsteServicio = citasHistorial.filter(c => c.servicio === servicio);
      
      // Creamos la tabla de datos
      const datosServicio = [
        ["Fecha", "Hora", "Cliente", "Teléfono", "Precio Cobrado", "Estado"], // Encabezados
        ...citasDeEsteServicio.map(c => [
          c.fecha,
          c.hora,
          c.cliente,
          c.telefono,
          getPrecioServicio(c.servicio),
          c.estado === 'completada' ? "Pagado" : "Pendiente/No Asistió"
        ])
      ];

      // Agregamos la hoja al libro
      const wsServicio = XLSX.utils.aoa_to_sheet(datosServicio);
      // Limpiamos el nombre para que Excel no reclame (max 30 caracteres)
      const nombreHoja = servicio.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 30) || "Servicio";
      XLSX.utils.book_append_sheet(wb, wsServicio, nombreHoja);
    });

    // 2. Descargar Archivo
    XLSX.writeFile(wb, `Reporte_Gestion_${mesFiltro}.xlsx`);
  };

  // --- GESTIÓN DE SERVICIOS Y BLOQUEOS ---
  const agregarServicio = async () => {
    if (!nuevoServicio.nombre || !nuevoServicio.precio) return alert("Faltan datos");
    await supabase.from('servicios').insert([{ nombre: nuevoServicio.nombre, precio: parseInt(nuevoServicio.precio), activo: true }]);
    setNuevoServicio({ nombre: '', precio: '' });
    cargarDatos();
  };

  const borrarServicio = async (id: string) => {
    if(confirm("¿Borrar servicio?")) await supabase.from('servicios').delete().eq('id', id); cargarDatos();
  };

  const bloquearHorario = async () => {
    if (!bloqueo.fecha || !bloqueo.hora) return alert("Selecciona fecha y hora");
    const { error } = await supabase.from('citas').insert([{ cliente: '⛔ BLOQUEO ADMIN', fecha: bloqueo.fecha, hora: bloqueo.hora, servicio: 'BLOQUEADO', telefono: '-', email: '-', estado: 'bloqueado' }]);
    if (error) alert("Error: " + error.message); else { alert("Horario bloqueado"); setBloqueo({ fecha: '', hora: '' }); cargarDatos(); }
  };

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

  if (!auth) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-gray-900 p-8 rounded-xl border border-purple-500/30 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-6">Acceso Carolina Nails</h1>
          <input type="password" className="w-full bg-gray-800 text-white p-3 rounded-lg mb-4 border border-gray-700 outline-none" placeholder="Contraseña" value={pass} onChange={e => setPass(e.target.value)} />
          <button onClick={login} className="w-full bg-purple-600 text-white p-3 rounded-lg font-bold">Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-gray-900/50 p-4 rounded-xl border border-gray-800 backdrop-blur-md sticky top-0 z-50">
          <h1 className="text-2xl font-bold text-purple-400 flex items-center gap-2"><Lock className="w-6 h-6" /> Panel Inteligente</h1>
          <button onClick={() => setAuth(false)} className="text-red-400 hover:bg-red-900/20 px-3 py-2 rounded-lg flex items-center gap-2"><LogOut size={18}/> Salir</button>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* BARRA LATERAL */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-400"><DollarSign/> Servicios</h2>
              <div className="flex gap-2 mb-6">
                <input placeholder="Nombre" className="bg-gray-800 border border-gray-700 p-2 rounded w-full outline-none text-sm" value={nuevoServicio.nombre} onChange={e=>setNuevoServicio({...nuevoServicio, nombre: e.target.value})}/>
                <input placeholder="$" type="number" className="bg-gray-800 border border-gray-700 p-2 rounded w-20 outline-none text-sm" value={nuevoServicio.precio} onChange={e=>setNuevoServicio({...nuevoServicio, precio: e.target.value})}/>
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
                <input type="date" className="w-full bg-gray-800 border border-gray-700 p-2 rounded outline-none text-sm" onChange={e=>setBloqueo({...bloqueo, fecha: e.target.value})}/>
                <select className="w-full bg-gray-800 border border-gray-700 p-2 rounded outline-none text-sm" onChange={e=>setBloqueo({...bloqueo, hora: e.target.value})}>
                  <option value="">Selecciona hora...</option>
                  {["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"].map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <button onClick={bloquearHorario} className="w-full bg-red-600 hover:bg-red-500 text-white py-2 rounded font-bold text-sm">Bloquear Horario</button>
              </div>
            </div>
          </div>

          {/* AGENDA CENTRAL */}
          <div className="lg:col-span-8">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl h-full flex flex-col">
              
              <div className="flex gap-4 border-b border-gray-800 pb-4 mb-4">
                <button onClick={() => setVista('activas')} className={`px-4 py-2 rounded-lg text-sm font-bold ${vista === 'activas' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Agenda Activa</button>
                <button onClick={() => setVista('historial')} className={`px-4 py-2 rounded-lg text-sm font-bold ${vista === 'historial' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Historial y Caja</button>
              </div>

              {/* VISTA 1: AGENDA ACTIVA */}
              {vista === 'activas' && (
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 max-h-[800px]">
                  <h3 className="text-gray-400 text-sm flex items-center gap-2"><Calendar size={16}/> {citasActivas.length} Pendientes</h3>
                  {citasActivas.map(c => (
                    <div key={c.id} className="bg-gray-800/40 border border-gray-700 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-center">
                      <div className="bg-gray-900 px-4 py-2 rounded-lg text-center border border-gray-700 min-w-[80px]">
                        <span className="block text-xl font-bold text-white">{c.hora.slice(0,5)}</span>
                        <span className="text-[10px] text-gray-400">{c.fecha}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-lg text-white">{c.cliente}</h4>
                        <span className="text-purple-300 text-sm">{c.servicio} <span className="text-green-400 font-bold ml-1">${getPrecioServicio(c.servicio).toLocaleString()}</span></span>
                        <div className="flex gap-3 mt-1 text-xs text-gray-400"><Phone size={12}/> {c.telefono}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => terminarCitaYAgradecer(c)} className="bg-green-600 text-white px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1"><MessageCircle size={14}/> Terminar</button>
                        <button onClick={() => cancelarCita(c.id)} className="bg-red-900/20 text-red-400 px-3 py-2 rounded-lg"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))}
                  {citasActivas.length === 0 && <p className="text-center text-gray-600 py-10">Sin citas pendientes.</p>}
                </div>
              )}

              {/* VISTA 2: HISTORIAL Y CAJA (LA MAGIA) */}
              {vista === 'historial' && (
                <div className="flex-1 flex flex-col space-y-4">
                  
                  {/* FILTRO DE MES Y TOTAL */}
                  <div className="bg-blue-900/10 border border-blue-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-600 p-3 rounded-lg"><DollarSign className="text-white w-6 h-6"/></div>
                      <div>
                        <p className="text-sm text-blue-200">Ganancia Neta (Aprox)</p>
                        <h2 className="text-2xl font-bold text-white">${gananciaNeta.toLocaleString()}</h2>
                        <p className="text-[10px] text-blue-300">Descarga el reporte para ver detalle</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <input 
                        type="month" 
                        value={mesFiltro} 
                        onChange={(e) => setMesFiltro(e.target.value)}
                        className="bg-gray-900 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                      <button onClick={descargarReporteInteligente} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg animate-pulse">
                        <Download size={14}/> EXPORTAR REPORTE
                      </button>
                    </div>
                  </div>
                  
                  {/* TABLA PRELIMINAR */}
                  <div className="flex-1 overflow-y-auto pr-2 bg-gray-900 rounded-xl border border-gray-800">
                    <table className="w-full text-sm text-left text-gray-400">
                      <thead className="text-xs text-gray-200 uppercase bg-gray-800 sticky top-0">
                        <tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Servicio</th><th className="px-4 py-3">Precio</th><th className="px-4 py-3">Estado</th></tr>
                      </thead>
                      <tbody>
                        {citasHistorial.map(c => (
                          <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="px-4 py-3">{c.fecha} {c.hora}</td>
                            <td className="px-4 py-3 font-medium text-white">{c.cliente}</td>
                            <td className="px-4 py-3">{c.servicio}</td>
                            <td className="px-4 py-3 text-green-400 font-bold">${getPrecioServicio(c.servicio).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              {c.estado === 'completada' ? <span className="text-green-400 bg-green-900/20 px-2 py-0.5 rounded text-xs border border-green-900/50">Pagado</span> 
                              : <span className="text-gray-500 text-xs">No finalizado</span>}
                            </td>
                          </tr>
                        ))}
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