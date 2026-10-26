-- 0006 · Método de afine de fondo y taludes (CIM002)
-- Las cepas salen del análisis de excavación del mismo paquete.
alter table public.paquete_conceptos drop constraint if exists paquete_conceptos_analisis_tipo_check;
alter table public.paquete_conceptos add constraint paquete_conceptos_analisis_tipo_check
  check (analisis_tipo is null or analisis_tipo in ('terreno', 'zapata_corrida', 'excavacion', 'afine'));
