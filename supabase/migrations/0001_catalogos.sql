-- =====================================================================
-- 0001 · Catálogos base, estructural y fichas de análisis
-- Sistema de Generadores y Presupuestos · Concepto Cero
-- Ejecutar completo en Supabase → SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.tg_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

-- Bitácora de cambios: un renglón por campo modificado.
create table if not exists public.bitacora (
  id              bigint generated always as identity primary key,
  tabla           text        not null,
  registro_id     text        not null,
  operacion       text        not null check (operacion in ('INSERT','UPDATE','DELETE')),
  campo           text,
  valor_anterior  jsonb,
  valor_nuevo     jsonb,
  usuario         uuid        default auth.uid(),
  fecha           timestamptz not null default now()
);
create index if not exists bitacora_registro_idx on public.bitacora (tabla, registro_id);

create or replace function public.tg_bitacora()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_id  text  := coalesce(v_new->>'id', v_old->>'id');
  k     text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if k <> 'actualizado_en' and (v_old->k) is distinct from (v_new->k) then
        insert into public.bitacora (tabla, registro_id, operacion, campo, valor_anterior, valor_nuevo)
        values (tg_table_name, v_id, tg_op, k, v_old->k, v_new->k);
      end if;
    end loop;
  else
    insert into public.bitacora (tabla, registro_id, operacion, valor_anterior, valor_nuevo)
    values (tg_table_name, v_id, tg_op, v_old, v_new);
  end if;
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------
-- Varillas (tabla de pesos)
-- ---------------------------------------------------------------------
create table if not exists public.varillas (
  id              text primary key,            -- '2', '2.5', '3', '4'…
  diametro_pulg   text        not null,        -- '1/4"', '3/8"'…
  diametro_mm     numeric(6,2) not null check (diametro_mm > 0),
  kg_m            numeric(8,3) not null check (kg_m > 0),
  fuente          text        not null default 'provisional',
  confirmado      boolean     not null default false,
  orden           smallint    not null,
  actualizado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Insumos
-- ---------------------------------------------------------------------
create table if not exists public.insumos (
  id              uuid primary key default gen_random_uuid(),
  clave           text        not null unique,
  descripcion     text        not null,
  unidad          text        not null,
  tipo            text        not null check (tipo in ('material','mano_obra','equipo','herramienta','basico','subcontrato')),
  precio          numeric(14,4) not null default 0 check (precio >= 0),
  precio_fuente   text,                         -- 'ultimo', 'promedio_90d', 'cotizacion', 'neodata'…
  varilla_id      text references public.varillas(id),  -- liga acero ↔ diámetro para la explosión
  activo          boolean     not null default true,
  actualizado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Partidas y conceptos
-- ---------------------------------------------------------------------
create table if not exists public.partidas (
  id              uuid primary key default gen_random_uuid(),
  clave           text        not null unique,  -- '02', '02.01'
  descripcion     text        not null,
  padre_id        uuid references public.partidas(id),
  orden           integer     not null default 0
);

create table if not exists public.conceptos (
  id              uuid primary key default gen_random_uuid(),
  clave           text        not null unique,  -- PP.SS.CCC
  clave_origen    text,                         -- clave Neodata u otra (ej. CIM05D')
  descripcion     text        not null,
  unidad          text        not null,
  partida_id      uuid references public.partidas(id),
  activo          boolean     not null default true,
  actualizado_en  timestamptz not null default now()
);
create index if not exists conceptos_clave_origen_idx on public.conceptos (clave_origen);

-- Matriz de precio unitario: el desperdicio vive aquí, no en el generador.
create table if not exists public.matrices (
  id                   uuid primary key default gen_random_uuid(),
  concepto_id          uuid not null references public.conceptos(id) on delete cascade,
  insumo_id            uuid not null references public.insumos(id),
  cantidad_por_unidad  numeric(14,6) not null check (cantidad_por_unidad >= 0),
  desperdicio_pct      numeric(6,3)  not null default 0 check (desperdicio_pct >= 0),
  nota                 text,
  actualizado_en       timestamptz not null default now(),
  unique (concepto_id, insumo_id)
);

-- ---------------------------------------------------------------------
-- Elementos tipo (del estructural) y fichas de análisis unitario
-- ---------------------------------------------------------------------
create table if not exists public.elementos_tipo (
  id              uuid primary key default gen_random_uuid(),
  codigo          text        not null unique,  -- ZC-01, K-1, TL-1…
  grupo           text        not null check (grupo in ('ZC','Z','LC','CT','CD','K','M','CC','T','L','F','OTRO')),
  descripcion     text,
  seccion         jsonb       not null default '{}'::jsonb,  -- {"b":0.80,"h":0.20}
  armado          jsonb       not null default '[]'::jsonb,  -- [{"varilla":"3","sep":0.20,"sentido":"corto"}]
  fuente          text,                                      -- plano / hoja del estructural
  actualizado_en  timestamptz not null default now()
);

create table if not exists public.fichas (
  id                uuid primary key default gen_random_uuid(),
  elemento_tipo_id  uuid        not null references public.elementos_tipo(id) on delete cascade,
  version           integer     not null default 1 check (version > 0),
  unidad_analisis   text        not null check (unidad_analisis in ('ml','m2','m3','pza')),
  parametros        jsonb       not null default '{}'::jsonb,  -- recubrimiento, ganchos, traslape…
  resultados        jsonb       not null default '{}'::jsonb,  -- kg por diámetro, m³, m²… por unidad
  pasos             jsonb       not null default '[]'::jsonb,  -- pasos con fórmula escrita y resultado
  estado            text        not null default 'borrador' check (estado in ('borrador','revisado','aprobado')),
  capturado_por     uuid        default auth.uid(),
  revisado_por      uuid,
  aprobado_por      uuid,
  aprobado_en       timestamptz,
  actualizado_en    timestamptz not null default now(),
  unique (elemento_tipo_id, version),
  -- nadie se aprueba a sí mismo
  constraint fichas_aprobador_distinto check (aprobado_por is null or aprobado_por is distinct from capturado_por)
);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['varillas','insumos','conceptos','matrices','elementos_tipo','fichas'] loop
    execute format('drop trigger if exists %I_actualizado on public.%I', t, t);
    execute format('create trigger %I_actualizado before update on public.%I for each row execute function public.tg_actualizado_en()', t, t);
    execute format('drop trigger if exists %I_bitacora on public.%I', t, t);
    execute format('create trigger %I_bitacora after insert or update or delete on public.%I for each row execute function public.tg_bitacora()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Seguridad (RLS)
-- Fase 1: lectura para usuarios autenticados, escritura para autenticados.
-- Los roles captura / revisión / aprobación / solo lectura se agregan después.
-- Varillas también se puede leer sin sesión (dato técnico, sin costos).
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['varillas','insumos','partidas','conceptos','matrices','elementos_tipo','fichas','bitacora'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_leer on public.%I', t, t);
    execute format('create policy %I_leer on public.%I for select to authenticated using (true)', t, t);
  end loop;
  foreach t in array array['varillas','insumos','partidas','conceptos','matrices','elementos_tipo','fichas'] loop
    execute format('drop policy if exists %I_escribir on public.%I', t, t);
    execute format('create policy %I_escribir on public.%I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

drop policy if exists varillas_leer_publico on public.varillas;
create policy varillas_leer_publico on public.varillas for select to anon using (true);

-- ---------------------------------------------------------------------
-- Datos iniciales: pesos de varilla PROVISIONALES (por confirmar con la oficina)
-- ---------------------------------------------------------------------
insert into public.varillas (id, diametro_pulg, diametro_mm, kg_m, fuente, orden) values
  ('2',   '1/4"',  6.4,  0.251, 'provisional', 1),
  ('2.5', '5/16"', 7.9,  0.384, 'provisional', 2),
  ('3',   '3/8"',  9.5,  0.557, 'provisional', 3),
  ('4',   '1/2"', 12.7,  0.994, 'provisional', 4),
  ('5',   '5/8"', 15.9,  1.552, 'provisional', 5),
  ('6',   '3/4"', 19.1,  2.235, 'provisional', 6),
  ('8',   '1"',   25.4,  3.973, 'provisional', 7)
on conflict (id) do nothing;
