-- 0010 · Método de longitud de elementos (cimbra de zapatas corridas, de trabes de liga, dalas…)
alter table public.paquete_conceptos drop constraint if exists paquete_conceptos_analisis_tipo_check;
alter table public.paquete_conceptos add constraint paquete_conceptos_analisis_tipo_check
  check (analisis_tipo is null or analisis_tipo in ('terreno', 'zapata_corrida', 'excavacion', 'afine', 'plantilla', 'areas', 'longitud'));
