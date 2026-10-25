-- =====================================================================
-- 0003 · Catálogo de la oficina (partidas → conceptos, en orden) y
--        paquetes de generadores por proyecto
-- Ejecutar completo en Supabase → SQL Editor (después de 0001 y 0002).
--
-- Dos capas:
--   1. Catálogo ("el básico"): cada partida trae su paquete de conceptos en
--      el orden del presupuesto. Se llena desde la pantalla, importando el
--      reporte "b) Estándar" de Neodata (solo clave, descripción y unidad;
--      nunca precios ni cantidades).
--   2. Paquete de un proyecto: copia del catálogo que se reacomoda y se
--      ajusta sin tocar el catálogo ni otras casas. Sobre cada concepto del
--      paquete se hace su análisis y su generador.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Catálogo: orden de los conceptos dentro de su partida
-- (mientras no exista el catálogo definitivo PP.SS.CCC, la clave es la de Neodata)
-- ---------------------------------------------------------------------
alter table public.conceptos add column if not exists orden integer not null default 0;
create index if not exists conceptos_partida_orden_idx on public.conceptos (partida_id, orden);

-- ---------------------------------------------------------------------
-- Paquetes de generadores
-- ---------------------------------------------------------------------
create table if not exists public.paquetes (
  id              uuid primary key default gen_random_uuid(),
  proyecto_id     uuid        not null references public.proyectos(id) on delete cascade,
  nombre          text        not null check (btrim(nombre) <> ''),
  estado          text        not null default 'activo' check (estado in ('activo','archivado')),
  creado_por      uuid        default auth.uid(),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index if not exists paquetes_proyecto_idx on public.paquetes (proyecto_id);

create table if not exists public.paquete_partidas (
  id              uuid primary key default gen_random_uuid(),
  paquete_id      uuid        not null references public.paquetes(id) on delete cascade,
  partida_id      uuid        references public.partidas(id) on delete set null,
  clave           text        not null,
  descripcion     text        not null,
  orden           integer     not null,
  actualizado_en  timestamptz not null default now(),
  unique (paquete_id, clave)
);

create table if not exists public.paquete_conceptos (
  id                  uuid primary key default gen_random_uuid(),
  paquete_id          uuid        not null references public.paquetes(id) on delete cascade,
  paquete_partida_id  uuid        not null references public.paquete_partidas(id) on delete cascade,
  concepto_id         uuid        references public.conceptos(id) on delete set null,
  clave               text        not null,
  descripcion         text        not null,
  unidad              text        not null,
  orden               integer     not null,
  estado              text        not null default 'pendiente' check (estado in ('pendiente','en_proceso','listo')),
  nota                text,
  actualizado_en      timestamptz not null default now()
);
create index if not exists paquete_conceptos_paquete_idx on public.paquete_conceptos (paquete_id);
create index if not exists paquete_conceptos_partida_idx on public.paquete_conceptos (paquete_partida_id, orden);

-- ---------------------------------------------------------------------
-- Crear un paquete: crea (o reutiliza) el proyecto y copia del catálogo
-- las partidas elegidas (todas si no se indica ninguna) con sus conceptos,
-- en el orden del catálogo. Todo en una sola operación.
-- ---------------------------------------------------------------------
create or replace function public.crear_paquete(p_nombre text, p_partidas uuid[] default null)
returns uuid language plpgsql set search_path = public as $$
declare
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_base   text;
  v_clave  text;
  v_n      integer := 1;
  v_proy   uuid;
  v_paq    uuid;
begin
  if public.mi_rol() is null or public.mi_rol() = 'lectura' then
    raise exception 'Tu rol no permite crear paquetes';
  end if;
  if v_nombre = '' then
    raise exception 'El paquete necesita un nombre';
  end if;

  v_base := trim(both '-' from regexp_replace(
              upper(translate(v_nombre, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^A-Z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'PAQUETE'; end if;
  v_clave := v_base;

  -- Si ya existe un proyecto con esa clave o con ese nombre y todavía sin paquete
  -- (p. ej. BIELVA "Casa Bielva", que ya tiene sus zapatas), se reutiliza.
  select p.id into v_proy from public.proyectos p
   where (p.clave = v_clave or lower(btrim(p.nombre)) = lower(v_nombre))
     and not exists (select 1 from public.paquetes q where q.proyecto_id = p.id)
   order by (p.clave = v_clave) desc limit 1;
  if v_proy is null then
    while exists (select 1 from public.proyectos where clave = v_clave) loop
      v_n := v_n + 1;
      v_clave := v_base || '-' || v_n;
    end loop;
    insert into public.proyectos (clave, nombre) values (v_clave, v_nombre) returning id into v_proy;
  end if;

  insert into public.paquetes (proyecto_id, nombre) values (v_proy, v_nombre) returning id into v_paq;

  insert into public.paquete_partidas (paquete_id, partida_id, clave, descripcion, orden)
  select v_paq, pa.id, pa.clave, pa.descripcion, row_number() over (order by pa.orden, pa.clave)
    from public.partidas pa
   where (p_partidas is null or pa.id = any(p_partidas))
     and exists (select 1 from public.conceptos c where c.partida_id = pa.id and c.activo);

  insert into public.paquete_conceptos (paquete_id, paquete_partida_id, concepto_id, clave, descripcion, unidad, orden)
  select v_paq, pp.id, c.id, c.clave, c.descripcion, c.unidad,
         row_number() over (partition by pp.id order by c.orden, c.clave)
    from public.paquete_partidas pp
    join public.conceptos c on c.partida_id = pp.partida_id and c.activo
   where pp.paquete_id = v_paq;

  return v_paq;
end $$;

-- ---------------------------------------------------------------------
-- Reacomodar: sube (-1) o baja (+1) un concepto dentro de su partida,
-- o una partida dentro del paquete. Intercambia lugares con su vecino.
-- ---------------------------------------------------------------------
create or replace function public.mover_paquete_concepto(p_id uuid, p_dir integer)
returns void language plpgsql set search_path = public as $$
declare
  a public.paquete_conceptos%rowtype;
  b public.paquete_conceptos%rowtype;
begin
  select * into a from public.paquete_conceptos where id = p_id;
  if not found then raise exception 'Concepto no encontrado'; end if;
  if p_dir < 0 then
    select * into b from public.paquete_conceptos
     where paquete_partida_id = a.paquete_partida_id and orden < a.orden order by orden desc limit 1;
  else
    select * into b from public.paquete_conceptos
     where paquete_partida_id = a.paquete_partida_id and orden > a.orden order by orden asc limit 1;
  end if;
  if not found then return; end if;
  update public.paquete_conceptos set orden = b.orden where id = a.id;
  update public.paquete_conceptos set orden = a.orden where id = b.id;
end $$;

create or replace function public.mover_paquete_partida(p_id uuid, p_dir integer)
returns void language plpgsql set search_path = public as $$
declare
  a public.paquete_partidas%rowtype;
  b public.paquete_partidas%rowtype;
begin
  select * into a from public.paquete_partidas where id = p_id;
  if not found then raise exception 'Partida no encontrada'; end if;
  if p_dir < 0 then
    select * into b from public.paquete_partidas
     where paquete_id = a.paquete_id and orden < a.orden order by orden desc limit 1;
  else
    select * into b from public.paquete_partidas
     where paquete_id = a.paquete_id and orden > a.orden order by orden asc limit 1;
  end if;
  if not found then return; end if;
  update public.paquete_partidas set orden = b.orden where id = a.id;
  update public.paquete_partidas set orden = a.orden where id = b.id;
end $$;

-- ---------------------------------------------------------------------
-- Triggers y seguridad (mismo criterio que las demás tablas)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['paquetes','paquete_partidas','paquete_conceptos'] loop
    execute format('drop trigger if exists %I_actualizado on public.%I', t, t);
    execute format('create trigger %I_actualizado before update on public.%I for each row execute function public.tg_actualizado_en()', t, t);
    execute format('drop trigger if exists %I_bitacora on public.%I', t, t);
    execute format('create trigger %I_bitacora after insert or update or delete on public.%I for each row execute function public.tg_bitacora()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_leer on public.%I', t, t);
    execute format('create policy %I_leer on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_escribir on public.%I', t, t);
    execute format('create policy %I_escribir on public.%I for all to authenticated using (public.mi_rol() <> ''lectura'') with check (public.mi_rol() <> ''lectura'')', t, t);
  end loop;
end $$;
