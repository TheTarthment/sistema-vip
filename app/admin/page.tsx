"use client";
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { COSTO_FIJO_MENSUAL, HORARIOS_BASE, NEGOCIO } from '@/lib/config';
import { ahoraEnChile, yaPaso } from '@/lib/fechas';
import type { Cita, Servicio } from '@/lib/types';
import {
  Trash2, Plus, Lock, DollarSign, LogOut, Calendar, MessageCircle, Download,
  TrendingUp, TrendingDown, AlertTriangle, Eye, EyeOff, LockOpen,
} from 'lucide-react';

type EstadoSesion = 'cargando' | 'fuera' | 'dentro';

// Nombre válido para una hoja de Excel (máx. 31 caracteres, sin : \ / ? * [ ])
function nombreHoja(nombre: string, usados: Set<string>): string {
  const base = nombre.replace(/[:\\/?*[\]]/g, '').slice(0, 28).trim() || 'Servicio';
  let candidato = base;
  let i = 2;
  while (usados.has(candidato.toLowerCase())) candidato = `${base} ${i++}`;
  usados.add(candidato.toLowerCase());
  return candidato;
}

export default function AdminPage() {
  const [sesion, setSesion] = useState<EstadoSesion>('cargando');
  const [login, setLogin] = useState({ email: '', password: '' });
  const [errorLogin, setErrorLogin] = useState('');
  const [entrando, setEntrando] = useState(false);

  const [citas, setCitas] = useState<Cita[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [nuevoServicio, setNuevoServicio] = useState({ nombre: '', precio: '', costo: '' });
  const [bloqueo, setBloqueo] = useState({ fecha: '', hora: '' });
  const [mesFiltro, setMesFiltro] = useState(() => ahoraEnChile().fecha.slice(0, 7));
  const [vista, setVista] = useState<'activas' | 'historial'>('activas');

  const cargarDatos = useCallback(async () => {
    const [{ data: citasData, error: e1 }, { data: servData, error: e2 }] = await Promise.all([
      supabase.from('citas').select('*').order('fecha').order('hora'),
      supabase.from('servicios').select('*').order('nombre'),
    ]);
    if (e1 || e2) alert('Error cargando datos: ' + (e1 ?? e2)?.message);
    setCitas((citasData ?? []) as Cita[]);
    setServicios((servData ?? []) as Servicio[]);
  }, []);

  // Verifica que la sesión exista Y que el correo esté en la tabla "admins"
  const verificarAdmin = useCallback(async (): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const { data: esAdmin } = await supabase.rpc('es_admin');
    return esAdmin === true;
  }, []);

  useEffect(() => {
    const revisar = async () => {
      if (await verificarAdmin()) {
        setSesion('dentro');
        cargarDatos();
      } else {
        setSesion('fuera');
      }
    };
    revisar();
  }, [verificarAdmin, cargarDatos]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEntrando(true);
    setErrorLogin('');
    const { error } = await supabase.auth.signInWithPassword({ email: login.email.trim(), password: login.password });
    if (error) {
      setErrorLogin('Correo o contraseña incorrectos.');
    } else if (!(await verificarAdmin())) {
      await supabase.auth.signOut();
      setErrorLogin('Esta cuenta no tiene permisos de administración.');
    } else {
      setLogin({ email: '', password: '' });
      setSesion('dentro');
      cargarDatos();
    }
    setEntrando(false);
  };

  const salir = async () => {
    await supabase.auth.signOut();
    setCitas([]);
    setServicios([]);
    setSesion('fuera');
  };

  // --- LÓGICA FINANCIERA ---
  const getInfoServicio = (nombreServicio: string) => {
    const s = servicios.find(ser => ser.nombre === nombreServicio);
    return { precio: s?.precio ?? 0, costo: s?.costo ?? 0 };
  };

  const citasReales = citas.filter(c => c.estado !== 'bloqueado');
  const citasActivas = citasReales.filter(c => c.estado !== 'completada' && !yaPaso(c.fecha, c.hora));
  const bloqueosFuturos = citas.filter(c => c.estado === 'bloqueado' && c.fecha >= ahoraEnChile().fecha);
  const citasHistorial = citasReales.filter(c =>
    (c.estado === 'completada' || yaPaso(c.fecha, c.hora)) && c.fecha.startsWith(mesFiltro)
  );
  const completadas = citasHistorial.filter(c => c.estado === 'completada');

  const totalIngresos = completadas.reduce((sum, c) => sum + getInfoServicio(c.servicio).precio, 0);
  const totalCostosVariables = completadas.reduce((sum, c) => sum + getInfoServicio(c.servicio).costo, 0);
  const gananciaNeta = totalIngresos - COSTO_FIJO_MENSUAL - totalCostosVariables;
  const pesos = (n: number) => '$' + n.toLocaleString('es-CL');

  // --- EXPORTAR EXCEL ---
  const descargarReporte = () => {
    const wb = XLSX.utils.book_new();
    const resumen = [
      ['REPORTE FINANCIERO MENSUAL', mesFiltro], [NEGOCIO, ''], ['', ''],
      ['INGRESOS (citas completadas)', totalIngresos], ['', ''],
      ['GASTOS FIJOS', COSTO_FIJO_MENSUAL],
      ['GASTOS VARIABLES (insumos)', totalCostosVariables],
      ['TOTAL GASTOS', COSTO_FIJO_MENSUAL + totalCostosVariables],
      ['', ''], ['GANANCIA LÍQUIDA', gananciaNeta],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), 'Resumen General');

    const usados = new Set<string>(['resumen general']);
    Array.from(new Set(citasHistorial.map(c => c.servicio))).forEach(servicio => {
      const info = getInfoServicio(servicio);
      const filas = [
        ['Fecha', 'Cliente', 'Teléfono', 'Venta', 'Costo', 'Ganancia', 'Estado'],
        ...citasHistorial.filter(c => c.servicio === servicio).map(c => [
          c.fecha, c.cliente, c.telefono ?? '', info.precio, info.costo, info.precio - info.costo,
          c.estado === 'completada' ? 'Pagado' : 'Sin marcar como terminada',
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), nombreHoja(servicio, usados));
    });
    XLSX.writeFile(wb, `Reporte_${NEGOCIO.replace(/\s+/g, '')}_${mesFiltro}.xlsx`);
  };

  // --- SERVICIOS ---
  const agregarServicio = async () => {
    const precio = parseInt(nuevoServicio.precio, 10);
    const costo = parseInt(nuevoServicio.costo, 10);
    if (!nuevoServicio.nombre.trim() || isNaN(precio) || isNaN(costo) || precio < 0 || costo < 0) {
      return alert('Completa nombre, precio y costo (números positivos).');
    }
    if (servicios.some(s => s.nombre.toLowerCase() === nuevoServicio.nombre.trim().toLowerCase())) {
      return alert('Ya existe un servicio con ese nombre.');
    }
    const { error } = await supabase.from('servicios').insert([{ nombre: nuevoServicio.nombre.trim(), precio, costo, activo: true }]);
    if (error) return alert('Error: ' + error.message);
    setNuevoServicio({ nombre: '', precio: '', costo: '' });
    cargarDatos();
  };

  // Se desactiva en vez de borrar, para no perder el historial de ganancias
  const alternarServicio = async (s: Servicio) => {
    const { error } = await supabase.from('servicios').update({ activo: !s.activo }).eq('id', s.id);
    if (error) alert('Error: ' + error.message);
    cargarDatos();
  };

  // --- RESET ---
  const vaciarAgendaCompleta = async () => {
    if (!confirm('⚠️ ¿SEGURO? Esto borrará TODAS las citas, bloqueos e historial de dinero.')) return;
    if (!confirm('Confirmación final: se borrará todo y no se puede deshacer.')) return;
    const { error } = await supabase.from('citas').delete().not('id', 'is', null);
    if (error) alert('Error: ' + error.message);
    else alert('✨ Agenda vacía. Caja en $0.');
    cargarDatos();
  };

  // --- BLOQUEOS ---
  const bloquearHorario = async () => {
    if (!bloqueo.fecha || !bloqueo.hora) return alert('Elige fecha y hora.');
    const diaCompleto = bloqueo.hora === 'dia';
    const { error } = await supabase.from('citas').insert([{
      cliente: '⛔ BLOQUEO', servicio: 'BLOQUEADO', estado: 'bloqueado', telefono: null, email: null,
      fecha: bloqueo.fecha,
      hora: diaCompleto ? HORARIOS_BASE[0] : bloqueo.hora,
      duracion_horas: diaCompleto ? HORARIOS_BASE.length : 1,
    }]);
    if (error) return alert('Error: ' + error.message);
    setBloqueo({ fecha: '', hora: '' });
    cargarDatos();
  };

  const borrarRegistro = async (id: string, pregunta: string) => {
    if (!confirm(pregunta)) return;
    const { error } = await supabase.from('citas').delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    cargarDatos();
  };

  // --- TERMINAR CITA + WHATSAPP ---
  const terminarCitaYAgradecer = async (cita: Cita) => {
    const { error } = await supabase.from('citas').update({ estado: 'completada' }).eq('id', cita.id);
    if (error) return alert('Error: ' + error.message);
    await cargarDatos();
    if (!cita.telefono) return alert('Cita marcada como terminada (la clienta no dejó teléfono).');

    let fono = cita.telefono.replace(/\D/g, '');
    if (fono.length === 8) fono = '569' + fono;
    if (fono.length === 9 && fono.startsWith('9')) fono = '56' + fono;

    const mensaje = `¡Hola ${cita.cliente}! 💖✨\n\nMuchas gracias por visitarnos hoy en ${NEGOCIO} 💅.\nFue un gusto atenderte. ¡Espero que ames tus uñas tanto como yo!\n\nNos vemos en la próxima 🥰`;
    window.open(`https://wa.me/${fono}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
  };

  // --- PANTALLAS ---
  if (sesion === 'cargando') {
    return <div className="min-h-screen bg-black flex items-center justify-center text-gray-500 animate-pulse">Cargando...</div>;
  }

  if (sesion === 'fuera') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <form onSubmit={entrar} className="bg-gray-900 p-8 rounded-xl border border-purple-500/30 w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-white mb-2">Acceso {NEGOCIO}</h1>
          <input type="email" required autoComplete="username" placeholder="Correo"
            className="w-full bg-gray-800 text-white p-3 rounded-lg border border-gray-700 outline-none focus:border-purple-500"
            value={login.email} onChange={e => setLogin({ ...login, email: e.target.value })} />
          <input type="password" required autoComplete="current-password" placeholder="Contraseña"
            className="w-full bg-gray-800 text-white p-3 rounded-lg border border-gray-700 outline-none focus:border-purple-500"
            value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} />
          {errorLogin && <p className="text-sm text-red-400">{errorLogin}</p>}
          <button type="submit" disabled={entrando} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white p-3 rounded-lg font-bold">
            {entrando ? 'Entrando...' : 'Entrar'}
          </button>
          <Link href="/" className="block text-gray-500 text-sm hover:text-white">Volver al inicio</Link>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 bg-gray-900/50 p-4 rounded-xl border border-gray-800 sticky top-0 z-50 backdrop-blur-md">
          <h1 className="text-2xl font-bold text-purple-400 flex items-center gap-2"><Lock className="w-6 h-6" /> Panel de Administración</h1>
          <button onClick={salir} className="text-red-400 px-3 py-2 rounded-lg flex items-center gap-2"><LogOut size={18} /> Salir</button>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-8">
            {/* SERVICIOS */}
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl">
              <h2 className="text-xl font-bold flex items-center gap-2 text-green-400 mb-4"><DollarSign /> Servicios</h2>
              <div className="space-y-3 bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                <input placeholder="Nombre del servicio" className="w-full bg-gray-800 border border-gray-700 p-2 rounded text-sm" value={nuevoServicio.nombre} onChange={e => setNuevoServicio({ ...nuevoServicio, nombre: e.target.value })} />
                <div className="flex gap-2">
                  <input type="number" min={0} placeholder="$ Precio" className="w-1/2 bg-gray-800 border border-gray-700 p-2 rounded text-sm text-green-400 font-bold" value={nuevoServicio.precio} onChange={e => setNuevoServicio({ ...nuevoServicio, precio: e.target.value })} />
                  <input type="number" min={0} placeholder="$ Costo insumos" className="w-1/2 bg-gray-800 border border-gray-700 p-2 rounded text-sm text-red-400 font-bold" value={nuevoServicio.costo} onChange={e => setNuevoServicio({ ...nuevoServicio, costo: e.target.value })} />
                </div>
                <button onClick={agregarServicio} className="w-full bg-green-600 hover:bg-green-500 text-white p-2 rounded font-bold flex justify-center gap-2"><Plus size={18} /> Agregar</button>
              </div>
              <ul className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-2">
                {servicios.map(s => (
                  <li key={s.id} className={`flex justify-between items-center bg-gray-800/30 p-2 rounded border border-gray-700/30 text-xs ${s.activo ? '' : 'opacity-50'}`}>
                    <div>
                      <span className="block font-bold text-white mb-0.5">{s.nombre}{!s.activo && ' (oculto)'}</span>
                      <div className="flex gap-2">
                        <span className="text-gray-400">Precio: <span className="text-green-400 font-mono">{pesos(s.precio)}</span></span>
                        <span className="text-gray-400">Costo: <span className="text-red-400 font-mono">{pesos(s.costo ?? 0)}</span></span>
                      </div>
                    </div>
                    <button onClick={() => alternarServicio(s)} title={s.activo ? 'Ocultar a las clientas' : 'Volver a mostrar'} className="text-gray-500 hover:text-purple-400">
                      {s.activo ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* BLOQUEOS */}
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-400"><Lock /> Bloquear horario</h2>
              <div className="space-y-3">
                <input type="date" min={ahoraEnChile().fecha} className="w-full bg-gray-800 border border-gray-700 p-2 rounded text-sm" value={bloqueo.fecha} onChange={e => setBloqueo({ ...bloqueo, fecha: e.target.value })} />
                <select className="w-full bg-gray-800 border border-gray-700 p-2 rounded text-sm" value={bloqueo.hora} onChange={e => setBloqueo({ ...bloqueo, hora: e.target.value })}>
                  <option value="">Hora...</option>
                  <option value="dia">Todo el día</option>
                  {HORARIOS_BASE.map(h => <option key={h} value={h}>{h} (1 hora)</option>)}
                </select>
                <button onClick={bloquearHorario} className="w-full bg-red-600 hover:bg-red-500 text-white py-2 rounded font-bold text-sm">Bloquear</button>
              </div>
              {bloqueosFuturos.length > 0 && (
                <ul className="mt-4 space-y-2 text-xs">
                  {bloqueosFuturos.map(b => (
                    <li key={b.id} className="flex justify-between items-center bg-gray-800/30 p-2 rounded border border-gray-700/30">
                      <span>{b.fecha} · {b.duracion_horas >= HORARIOS_BASE.length ? 'Todo el día' : b.hora.slice(0, 5)}</span>
                      <button onClick={() => borrarRegistro(b.id, '¿Quitar este bloqueo?')} title="Quitar bloqueo" className="text-gray-500 hover:text-green-400"><LockOpen size={14} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ZONA PELIGROSA */}
            <button onClick={vaciarAgendaCompleta} className="w-full text-xs bg-red-900/20 hover:bg-red-900/50 text-red-300 px-3 py-2 rounded flex items-center justify-center gap-2 border border-red-900">
              <AlertTriangle size={14} /> Vaciar agenda completa (reset)
            </button>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl h-full flex flex-col">
              <div className="flex gap-4 border-b border-gray-800 pb-4 mb-4">
                <button onClick={() => setVista('activas')} className={`px-4 py-2 rounded-lg text-sm font-bold ${vista === 'activas' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Agenda Activa</button>
                <button onClick={() => setVista('historial')} className={`px-4 py-2 rounded-lg text-sm font-bold ${vista === 'historial' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Reportes y Caja</button>
              </div>

              {vista === 'activas' && (
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 max-h-[800px]">
                  <h3 className="text-gray-400 text-sm flex items-center gap-2"><Calendar size={16} /> {citasActivas.length} citas pendientes</h3>
                  {citasActivas.map(c => (
                    <div key={c.id} className="bg-gray-800/40 border border-gray-700 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-center hover:border-purple-500/30 transition-all">
                      <div className="text-center min-w-[60px]"><span className="block text-xl font-bold text-white">{c.hora.slice(0, 5)}</span><span className="text-[10px] text-gray-400">{c.fecha}</span></div>
                      <div className="flex-1">
                        <h4 className="font-bold text-white">{c.cliente}</h4>
                        <span className="text-purple-300 text-sm">{c.servicio}</span>
                        <span className="block text-xs text-gray-500">{c.telefono} · {c.email}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => terminarCitaYAgradecer(c)} className="bg-green-600 hover:bg-green-500 px-3 py-2 rounded-lg text-xs font-bold text-white flex gap-1 items-center"><MessageCircle size={14} /> Terminar</button>
                        <button onClick={() => borrarRegistro(c.id, '¿Eliminar esta cita?')} title="Eliminar cita" className="bg-red-900/20 hover:bg-red-900/40 text-red-400 px-3 py-2 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                  {citasActivas.length === 0 && <p className="text-center text-gray-600 py-10 border-2 border-dashed border-gray-800 rounded-xl">Sin citas pendientes.</p>}
                </div>
              )}

              {vista === 'historial' && (
                <div className="flex-1 flex flex-col space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-900/10 border border-green-800/50 p-4 rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider text-green-400 flex items-center gap-1 mb-1"><TrendingUp size={12} /> Ventas</p>
                      <h3 className="text-2xl font-bold text-white">{pesos(totalIngresos)}</h3>
                    </div>
                    <div className="bg-red-900/10 border border-red-800/50 p-4 rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider text-red-400 flex items-center gap-1 mb-1"><TrendingDown size={12} /> Gastos (fijos + insumos)</p>
                      <h3 className="text-2xl font-bold text-white">{pesos(COSTO_FIJO_MENSUAL + totalCostosVariables)}</h3>
                    </div>
                    <div className={`p-4 rounded-xl border ${gananciaNeta >= 0 ? 'bg-blue-900/20 border-blue-600/50' : 'bg-red-900/20 border-red-600/50'}`}>
                      <p className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${gananciaNeta >= 0 ? 'text-blue-300' : 'text-red-300'}`}>Ganancia líquida</p>
                      <h3 className="text-3xl font-bold text-white">{pesos(gananciaNeta)}</h3>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-800/40 p-4 rounded-xl border border-gray-700 gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400">Periodo:</span>
                      <input type="month" value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="bg-gray-900 text-white border border-gray-600 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
                    </div>
                    <button onClick={descargarReporte} className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2">
                      <Download size={16} /> EXPORTAR EXCEL
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-gray-900 rounded-xl border border-gray-800">
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
                              <td className="px-4 py-3 text-right font-mono">
                                {c.estado === 'completada'
                                  ? <span className="text-green-400">+{pesos(info.precio - info.costo)}</span>
                                  : <span className="text-yellow-500 text-xs" title="Esta cita pasó pero no se marcó como terminada">sin marcar</span>}
                              </td>
                            </tr>
                          );
                        })}
                        {citasHistorial.length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-600">No hay citas en este periodo.</td></tr>
                        )}
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
