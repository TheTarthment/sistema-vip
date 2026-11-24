-- =====================================================================
--  SISTEMA DE RESERVAS — Esquema de base de datos y seguridad (Supabase)
--
--  Cómo usarlo: Supabase → SQL Editor → New query → pega TODO este
--  archivo → botón "Run". Se puede ejecutar más de una vez sin problema.
--
--  ⚠️ ANTES DE EJECUTAR: revisa la línea marcada con "CAMBIA AQUÍ" (casi
--  al final). Ese correo es el único que podrá entrar al panel /admin.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------
create table if not exists public.servicios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text    not null,
  precio     integer not null default 0,
  costo      integer not null default 0,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.citas (
  id         uuid primary key default gen_random_uuid(),
  cliente    text not null,
  email      text,
  telefono   text,
  fecha      date not null,
  hora       time not null,
  servicio   text not null,
  estado     text default 'pendiente',
  created_at timestamptz not null default now()
);

-- Columnas nuevas (si las tablas ya existían de antes, se agregan aquí)
alter table public.servicios add column if not exists costo  integer not null default 0;
alter table public.servicios add column if not exists activo boolean not null default true;
alter table public.citas add column if not exists estado text default 'pendiente';
-- Cuántas horas ocupa la cita (servicios = 2, bloqueos = 1 o día completo)
alter table public.citas add column if not exists duracion_horas integer not null default 2;
-- Código secreto de cada reserva: solo quien lo tiene puede verla o cancelarla
alter table public.citas add column if not exists token uuid not null default gen_random_uuid();

update public.citas set estado = 'pendiente' where estado is null;
update public.citas set duracion_horas = 1 where estado = 'bloqueado' and duracion_horas = 2;

create unique index if not exists citas_token_idx on public.citas (token);
create index if not exists citas_fecha_idx on public.citas (fecha);

-- Lista de personas que pueden entrar al panel de administración
create table if not exists public.admins (
  email text primary key
);

-- ---------------------------------------------------------------------
-- 2. SEGURIDAD (Row Level Security)
--    Por defecto NADIE puede leer ni modificar nada directamente.
--    Las clientas solo usan las funciones de la sección 3.
--    Solo un admin con sesión iniciada puede ver/editar todo.
-- ---------------------------------------------------------------------
alter table public.servicios enable row level security;
alter table public.citas     enable row level security;
alter table public.admins    enable row level security;

-- Borra cualquier política antigua (por si en enero quedó algo abierto)
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('servicios', 'citas', 'admins')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Servicios: todo el mundo ve los activos; solo el admin edita
create policy servicios_lectura on public.servicios
  for select using (activo or public.es_admin());
create policy servicios_admin on public.servicios
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Citas: solo el admin (los datos personales quedan protegidos)
create policy citas_admin on public.citas
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- admins: sin políticas = nadie puede leerla ni editarla desde la web

-- ---------------------------------------------------------------------
-- 3. FUNCIONES PÚBLICAS (lo único que puede hacer una clienta)
-- ---------------------------------------------------------------------

-- Horas ocupadas de un día (sin nombres ni datos personales)
create or replace function public.horas_ocupadas(p_fecha date)
returns table (hora time, duracion_horas integer)
language sql stable security definer set search_path = public
as $$
  select c.hora, c.duracion_horas from public.citas c where c.fecha = p_fecha;
$$;

-- Crear una reserva con todas las validaciones del lado del servidor
create or replace function public.reservar_cita(
  p_cliente text, p_email text, p_telefono text,
  p_fecha date, p_hora time, p_servicio text
)
returns table (token uuid, cliente text, email text, fecha date, hora time, servicio text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_ahora timestamp := now() at time zone 'America/Santiago';
  v_duracion constant integer := 2;
begin
  if coalesce(trim(p_cliente), '') = '' or length(p_cliente) > 100 then
    raise exception 'Escribe tu nombre.';
  end if;
  if p_email is null or length(p_email) > 200 or p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El correo no es válido.';
  end if;
  if coalesce(trim(p_telefono), '') = '' or length(p_telefono) > 30 then
    raise exception 'Escribe tu teléfono.';
  end if;
  if extract(minute from p_hora) <> 0 or extract(hour from p_hora) not between 9 and 20 then
    raise exception 'Esa hora está fuera del horario de atención.';
  end if;
  if (p_fecha + p_hora) <= v_ahora then
    raise exception 'No se puede reservar en una fecha u hora que ya pasó.';
  end if;
  if p_fecha > (v_ahora::date + 90) then
    raise exception 'Solo se puede reservar hasta 90 días hacia adelante.';
  end if;
  if not exists (select 1 from public.servicios s where s.nombre = p_servicio and s.activo) then
    raise exception 'Ese servicio no está disponible.';
  end if;

  -- Candado: dos reservas del mismo día se procesan una después de la otra,
  -- así es imposible que dos personas tomen la misma hora al mismo tiempo.
  perform pg_advisory_xact_lock(hashtext('citas:' || p_fecha::text));

  if exists (
    select 1 from public.citas c
    where c.fecha = p_fecha
      and c.hora < p_hora + make_interval(hours => v_duracion)
      and p_hora < c.hora + make_interval(hours => c.duracion_horas)
  ) then
    raise exception '¡Alguien acaba de tomar ese horario! Elige otro.';
  end if;

  return query
  with nueva as (
    insert into public.citas (cliente, email, telefono, fecha, hora, duracion_horas, servicio, estado)
    values (trim(p_cliente), lower(trim(p_email)), trim(p_telefono), p_fecha, p_hora, v_duracion, p_servicio, 'pendiente')
    returning *
  )
  select n.token, n.cliente, n.email, n.fecha, n.hora, n.servicio from nueva n;
end;
$$;

-- Ver mis próximas citas (solo con los códigos guardados en mi navegador)
create or replace function public.mis_citas(p_tokens uuid[])
returns table (token uuid, cliente text, fecha date, hora time, servicio text)
language sql stable security definer set search_path = public
as $$
  select c.token, c.cliente, c.fecha, c.hora, c.servicio
  from public.citas c
  where cardinality(p_tokens) <= 50
    and c.token = any (p_tokens)
    and c.estado = 'pendiente'
    and (c.fecha + c.hora) >= (now() at time zone 'America/Santiago')
  order by c.fecha, c.hora;
$$;

-- Cancelar una cita (solo con su código secreto)
create or replace function public.cancelar_cita(p_token uuid)
returns table (cliente text, email text, fecha date, hora time, servicio text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  with borrada as (
    delete from public.citas c
    where c.token = p_token
      and c.estado = 'pendiente'
      and (c.fecha + c.hora) > (now() at time zone 'America/Santiago')
    returning c.cliente, c.email, c.fecha, c.hora, c.servicio
  )
  select * from borrada;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. DATOS INICIALES
-- ---------------------------------------------------------------------

-- 👇👇 CAMBIA AQUÍ si quieres que otro correo sea el administrador 👇👇
insert into public.admins (email) values ('martin20041206@gmail.com')
on conflict do nothing;

-- Servicios oficiales (solo se agregan si no existen)
insert into public.servicios (nombre, precio, costo, activo)
select v.nombre, v.precio, v.costo, true
from (values
  ('Esmaltado Permanente',     14000,  850),
  ('Permanente + Baño de Gel', 20000, 1200),
  ('Polygel',                  25000, 2500),
  ('Pedicure Completo',        17000, 1500),
  ('Parafinoterapia',           5000,  800),
  ('Retiro Permanente',         5000,  300),
  ('Retiro Polygel',            8000,  400),
  ('Retiro Acrílico',          10000,  500)
) as v (nombre, precio, costo)
where not exists (select 1 from public.servicios s where s.nombre = v.nombre);
