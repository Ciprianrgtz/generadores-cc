-- =====================================================================
-- 0004 · Proyecto primero, generadores por concepto y terreno del proyecto
-- Ejecutar completo en Supabase → SQL Editor (después de 0001, 0002 y 0003).
--
-- El orden de la app es: PROYECTO → su paquete de generadores → cada
-- concepto del paquete con su análisis (generador), que da el volumen.
--   · proyectos.terreno        geometría del terreno (la usan varios conceptos y el visor 3D)
--   · paquete_conceptos.analisis_tipo   qué análisis lleva cada concepto
--   · generadores              el análisis guardado de cada concepto, con su cantidad y su fórmula
-- ---------------------------------------------------------------------

alter table public.proyectos add column if not exists terreno jsonb;

alter table public.paquete_conceptos add column if not exists analisis_tipo text;
alter table public.paquete_conceptos drop constraint if exists paquete_conceptos_analisis_tipo_check;
alter table public.paquete_conceptos
  add constraint paquete_conceptos_analisis_tipo_check check (analisis_tipo is null or analisis_tipo in ('terreno', 'zapata_corrida'));

-- Un proyecto tiene un solo paquete de generadores.
create unique index if not exists paquetes_un_paquete_por_proyecto on public.paquetes (proyecto_id);

-- ---------------------------------------------------------------------
-- Generadores: el análisis de un concepto del paquete
-- ---------------------------------------------------------------------
create table if not exists public.generadores (
  id                   uuid primary key default gen_random_uuid(),
  paquete_concepto_id  uuid        not null unique references public.paquete_conceptos(id) on delete cascade,
  tipo                 text        not null,
  datos                jsonb       not null default '{}'::jsonb,   -- lo que se capturó (medidas, vértices, capa del DXF…)
  cantidad             numeric(16,4),                              -- volumen que sale del análisis
  unidad               text,
  formula              text,                                       -- el cálculo escrito con sus valores
  capturado_por        uuid        default auth.uid(),
  actualizado_en       timestamptz not null default now()
);

do $$
declare t text := 'generadores';
begin
  execute format('drop trigger if exists %I_actualizado on public.%I', t, t);
  execute format('create trigger %I_actualizado before update on public.%I for each row execute function public.tg_actualizado_en()', t, t);
  execute format('drop trigger if exists %I_bitacora on public.%I', t, t);
  execute format('create trigger %I_bitacora after insert or update or delete on public.%I for each row execute function public.tg_bitacora()', t, t);
  execute format('alter table public.%I enable row level security', t);
  execute format('drop policy if exists %I_leer on public.%I', t, t);
  execute format('create policy %I_leer on public.%I for select to authenticated using (true)', t, t);
  execute format('drop policy if exists %I_escribir on public.%I', t, t);
  execute format('create policy %I_escribir on public.%I for all to authenticated using (public.mi_rol() <> ''lectura'') with check (public.mi_rol() <> ''lectura'')', t, t);
end $$;

-- ---------------------------------------------------------------------
-- Crear el paquete DE un proyecto que ya existe (o, sin proyecto, como antes:
-- crea o reutiliza uno por nombre). p_partidas = partidas del catálogo que
-- entran; [] = paquete vacío; null = todas.
-- ---------------------------------------------------------------------
drop function if exists public.crear_paquete(text, uuid[]);

create or replace function public.crear_paquete(p_nombre text, p_partidas uuid[] default null, p_proyecto_id uuid default null)
returns uuid language plpgsql set search_path = public as $$
declare
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_base   text;
  v_clave  text;
  v_n      integer := 1;
  v_proy   uuid := p_proyecto_id;
  v_paq    uuid;
begin
  if public.mi_rol() is null or public.mi_rol() = 'lectura' then
    raise exception 'Tu rol no permite crear paquetes';
  end if;

  if v_proy is not null then
    select p.nombre into v_nombre from public.proyectos p where p.id = v_proy;
    if not found then raise exception 'El proyecto no existe'; end if;
    if exists (select 1 from public.paquetes q where q.proyecto_id = v_proy) then
      raise exception 'Este proyecto ya tiene su paquete de generadores';
    end if;
  else
    if v_nombre = '' then
      raise exception 'El paquete necesita un nombre';
    end if;
    v_base := trim(both '-' from regexp_replace(
                upper(translate(v_nombre, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^A-Z0-9]+', '-', 'g'));
    if v_base = '' then v_base := 'PAQUETE'; end if;
    v_clave := v_base;
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
