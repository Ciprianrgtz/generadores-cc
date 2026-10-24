-- =====================================================================
-- 0002 · Proyectos, perfiles con rol y flujo Borrador → Revisado → Aprobado
-- Ejecutar completo en Supabase → SQL Editor (después de 0001).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfiles: uno por usuario de Supabase Auth
--   lectura < captura < revision < aprobacion
-- El primer usuario que se registre queda como 'aprobacion'; los demás
-- entran como 'captura' y el rol se cambia desde el Table Editor.
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  nombre          text        not null,
  rol             text        not null default 'captura' check (rol in ('lectura','captura','revision','aprobacion')),
  creado_en       timestamptz not null default now()
);

create or replace function public.tg_nuevo_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.perfiles) then 'captura' else 'aprobacion' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists auth_nuevo_perfil on auth.users;
create trigger auth_nuevo_perfil after insert on auth.users
  for each row execute function public.tg_nuevo_perfil();

-- Usuarios que ya existían antes de esta migración
insert into public.perfiles (id, nombre, rol)
select u.id, split_part(u.email, '@', 1),
       case when row_number() over (order by u.created_at) = 1
                 and not exists (select 1 from public.perfiles) then 'aprobacion' else 'captura' end
from auth.users u
on conflict (id) do nothing;

create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid()
$$;

alter table public.perfiles enable row level security;
drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles for select to authenticated using (true);
-- Los roles solo se cambian desde el panel de Supabase (sin política de escritura).

-- ---------------------------------------------------------------------
-- Proyectos (prototipos y obras)
-- ---------------------------------------------------------------------
create table if not exists public.proyectos (
  id              uuid primary key default gen_random_uuid(),
  clave           text        not null unique,
  nombre          text        not null,
  es_prototipo    boolean     not null default false,
  estado          text        not null default 'activo' check (estado in ('activo','archivado')),
  creado_en       timestamptz not null default now()
);

-- Los elementos tipo pertenecen a un proyecto (vienen de su estructural);
-- sin proyecto = elemento tipo de la oficina.
alter table public.elementos_tipo add column if not exists proyecto_id uuid references public.proyectos(id);
alter table public.elementos_tipo drop constraint if exists elementos_tipo_codigo_key;
create unique index if not exists elementos_tipo_proyecto_codigo_idx
  on public.elementos_tipo (coalesce(proyecto_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo);

-- Método de cálculo con el que se generó cada ficha (para reproducirla igual)
alter table public.fichas add column if not exists metodo text not null default 'zc-plantilla-v1';
alter table public.fichas add column if not exists nota text;

-- ---------------------------------------------------------------------
-- Flujo de estados de las fichas (se valida en la base, no en la pantalla)
-- ---------------------------------------------------------------------
create or replace function public.tg_fichas_flujo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rol text := public.mi_rol();
begin
  if tg_op = 'INSERT' then
    if v_rol is null or v_rol = 'lectura' then
      raise exception 'Tu rol no permite capturar fichas';
    end if;
    new.estado := 'borrador';
    new.capturado_por := auth.uid();
    new.revisado_por := null;
    new.aprobado_por := null;
    new.aprobado_en := null;
    return new;
  end if;

  -- Una ficha aprobada queda congelada: los cambios van en una versión nueva.
  if old.estado = 'aprobado' then
    raise exception 'La ficha v% está aprobada y congelada; crea una versión nueva', old.version;
  end if;

  if new.estado = old.estado then
    if old.estado <> 'borrador' then
      raise exception 'Solo se puede editar una ficha en borrador';
    end if;
    if v_rol is null or v_rol = 'lectura' then
      raise exception 'Tu rol no permite editar fichas';
    end if;
    -- quien edita pasa a ser quien capturó
    new.capturado_por := auth.uid();
    return new;
  end if;

  -- Cambios de estado: nadie revisa ni aprueba lo que capturó.
  if auth.uid() = old.capturado_por then
    raise exception 'Nadie se aprueba a sí mismo: otra persona debe revisar y aprobar esta ficha';
  end if;
  -- El contenido no cambia al cambiar de estado
  new.parametros := old.parametros;
  new.resultados := old.resultados;
  new.pasos := old.pasos;
  new.capturado_por := old.capturado_por;

  if old.estado = 'borrador' and new.estado = 'revisado' then
    if v_rol not in ('revision','aprobacion') then
      raise exception 'Se requiere rol de revisión';
    end if;
    new.revisado_por := auth.uid();
  elsif old.estado = 'revisado' and new.estado = 'aprobado' then
    if v_rol <> 'aprobacion' then
      raise exception 'Se requiere rol de aprobación';
    end if;
    new.aprobado_por := auth.uid();
    new.aprobado_en := now();
  elsif old.estado = 'revisado' and new.estado = 'borrador' then
    if v_rol not in ('revision','aprobacion') then
      raise exception 'Se requiere rol de revisión para regresar a borrador';
    end if;
    new.revisado_por := null;
  else
    raise exception 'Cambio de estado no permitido: % → %', old.estado, new.estado;
  end if;
  return new;
end $$;

drop trigger if exists fichas_flujo on public.fichas;
create trigger fichas_flujo before insert or update on public.fichas
  for each row execute function public.tg_fichas_flujo();

-- Solo se borran borradores
drop policy if exists fichas_escribir on public.fichas;
drop policy if exists fichas_insertar on public.fichas;
drop policy if exists fichas_actualizar on public.fichas;
drop policy if exists fichas_borrar on public.fichas;
create policy fichas_insertar on public.fichas for insert to authenticated with check (true);
create policy fichas_actualizar on public.fichas for update to authenticated using (true) with check (true);
create policy fichas_borrar on public.fichas for delete to authenticated using (estado = 'borrador' and public.mi_rol() <> 'lectura');

-- El rol de solo lectura no escribe en catálogos
do $$
declare t text;
begin
  foreach t in array array['varillas','insumos','partidas','conceptos','matrices','elementos_tipo','proyectos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_escribir on public.%I', t, t);
    execute format('create policy %I_escribir on public.%I for all to authenticated using (public.mi_rol() <> ''lectura'') with check (public.mi_rol() <> ''lectura'')', t, t);
  end loop;
end $$;
drop policy if exists proyectos_leer on public.proyectos;
create policy proyectos_leer on public.proyectos for select to authenticated using (true);

-- Bitácora también para proyectos y perfiles
drop trigger if exists proyectos_bitacora on public.proyectos;
create trigger proyectos_bitacora after insert or update or delete on public.proyectos
  for each row execute function public.tg_bitacora();
drop trigger if exists perfiles_bitacora on public.perfiles;
create trigger perfiles_bitacora after insert or update or delete on public.perfiles
  for each row execute function public.tg_bitacora();

-- ---------------------------------------------------------------------
-- Datos de Casa Bielva: proyecto y zapatas corridas del estructural
-- ---------------------------------------------------------------------
insert into public.proyectos (clave, nombre, es_prototipo)
values ('BIELVA', 'Casa Bielva', true)
on conflict (clave) do nothing;

insert into public.elementos_tipo (proyecto_id, codigo, grupo, descripcion, seccion, armado, fuente)
select p.id, e.codigo, 'ZC', e.descripcion, e.seccion::jsonb, e.armado::jsonb, e.fuente
from public.proyectos p
cross join (values
  ('ZC-01', 'Zapata corrida ZC-01 80×20, f''c 250',
   '{"ancho":0.80,"peralte":0.20}',
   '[{"sentido":"corto","varilla":"3","separacion":0.20},{"sentido":"largo","varilla":"3","separacion":0.20}]',
   'EST - CASA BIELVA (ZC-1) · Neodata CIM05D′'),
  ('ZC-02', 'Zapata corrida ZC-02 80×20, f''c 250',
   '{"ancho":0.80,"peralte":0.20}',
   '[{"sentido":"corto","varilla":"3","separacion":0.20},{"sentido":"largo","varilla":"3","separacion":0.20}]',
   'EST - CASA BIELVA (ZC-2) · Neodata CIM06D′')
) as e(codigo, descripcion, seccion, armado, fuente)
where p.clave = 'BIELVA'
  and not exists (select 1 from public.elementos_tipo x where x.proyecto_id = p.id and x.codigo = e.codigo);
