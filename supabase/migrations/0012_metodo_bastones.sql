-- 0012 · Método de bastones de losa de cimentación (acero de CC y CI = franjas con su largo de bastón y sus ml)
alter table public.paquete_conceptos drop constraint if exists paquete_conceptos_analisis_tipo_check;
alter table public.paquete_conceptos add constraint paquete_conceptos_analisis_tipo_check
  check (analisis_tipo is null or analisis_tipo in ('terreno', 'zapata_corrida', 'excavacion', 'afine', 'plantilla', 'areas', 'longitud', 'acero_ficha', 'bastones'));
