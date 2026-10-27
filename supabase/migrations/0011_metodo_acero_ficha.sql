-- 0011 · Método de acero por ficha (acero de ZC-01, ZC-02… = ml del elemento × kg/ml de su ficha)
alter table public.paquete_conceptos drop constraint if exists paquete_conceptos_analisis_tipo_check;
alter table public.paquete_conceptos add constraint paquete_conceptos_analisis_tipo_check
  check (analisis_tipo is null or analisis_tipo in ('terreno', 'zapata_corrida', 'excavacion', 'afine', 'plantilla', 'areas', 'longitud', 'acero_ficha'));
