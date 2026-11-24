# 💅 Sistema de Reservas para Estudio de Uñas

Aplicación web para que las clientas de un estudio de manicure **agenden su hora online** y la dueña **administre su agenda y sus finanzas** desde un solo lugar.

> 🔗 **Demo:** _(pega aquí el link de Vercel)_  
> 📸 _(agrega aquí 2–3 capturas: página de reservas, panel admin y reporte de caja)_

## El problema

El estudio agendaba por WhatsApp y llevaba las cuentas en un Excel a mano: horas que se cruzaban, clientas que no recibían confirmación y ninguna visibilidad real de cuánto se ganaba al mes después de gastos.

## La solución

### Para las clientas
- Reserva en 3 pasos: datos → fecha/hora → servicio con precio visible.
- **Disponibilidad inteligente:** cada servicio dura 2 horas y solo se ofrecen horarios que no chocan con otras citas o bloqueos.
- Correo automático de **confirmación** y de **cancelación**.
- "Mis citas": ve y cancela sus próximas reservas desde el mismo dispositivo, sin crear cuenta.

### Para la dueña (`/admin`)
- Agenda de citas pendientes y botón **Terminar** que la marca como pagada y abre WhatsApp con un mensaje de agradecimiento.
- Gestión de servicios con **precio de venta y costo de insumos**.
- Bloqueo de horas sueltas o días completos.
- **Caja mensual:** ventas, gastos fijos + variables y ganancia líquida.
- Exportación a **Excel** con una hoja de resumen y una hoja por servicio.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Rutas API de Next.js, Nodemailer (Gmail) |
| Base de datos y auth | Supabase (PostgreSQL, Row Level Security, Supabase Auth) |
| Reportes | SheetJS (xlsx) |
| Deploy | Vercel |

## Decisiones técnicas destacadas

- **Seguridad con RLS:** la clave pública de Supabase no da acceso a datos personales. Las clientas solo pueden ejecutar funciones acotadas (`horas_ocupadas`, `reservar_cita`, `mis_citas`, `cancelar_cita`); el panel admin requiere iniciar sesión con Supabase Auth **y** estar en la tabla `admins`.
- **Sin reservas duplicadas:** la validación de choques ocurre dentro de PostgreSQL con un candado por día (`pg_advisory_xact_lock`), así dos personas no pueden tomar la misma hora aunque reserven en el mismo segundo.
- **Cancelación con token secreto:** cada reserva tiene un UUID que solo conoce el navegador de quien reservó; nadie puede cancelar citas ajenas.
- **Zona horaria explícita** (`America/Santiago`) en servidor y cliente para no permitir reservas en el pasado.
- **Correos seguros:** credenciales en variables de entorno, HTML escapado y el correo solo se envía a quien acaba de reservar (no hay un endpoint de envío abierto).

## Estructura

```
app/
  page.tsx              # Página pública de reservas
  admin/page.tsx        # Panel de administración
  api/reservar/route.ts # Crea la reserva y envía confirmación
  api/cancelar/route.ts # Cancela con token y envía aviso
lib/
  config.ts             # Horarios, duración, nombre del negocio
  fechas.ts             # Zona horaria y cálculo de disponibilidad
  email.ts              # Plantillas y envío de correos
  supabase.ts           # Clientes de Supabase
supabase/schema.sql     # Tablas, políticas RLS, funciones y datos iniciales
```

## Cómo correrlo localmente

1. Crea un proyecto gratis en [supabase.com](https://supabase.com) y ejecuta `supabase/schema.sql` en el **SQL Editor** (cambia antes el correo de admin).
2. En Supabase → **Authentication → Users → Add user**, crea el usuario admin con ese mismo correo.
3. Copia `.env.example` como `.env.local` y completa los valores.
4. Instala y ejecuta:
   ```bash
   npm install
   npm run dev
   ```
5. Abre http://localhost:3000 (y http://localhost:3000/admin para el panel).

## Autor

**Martín** — _(tu LinkedIn / GitHub / portafolio)_
