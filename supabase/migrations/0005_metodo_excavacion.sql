-- =====================================================================
-- 0005 · Método de análisis "excavacion" (excavación por elementos)
-- Ejecutar completo en Supabase → SQL Editor (después de 0004).
-- =====================================================================

alter table public.paquete_conceptos drop constraint if exists paquete_conceptos_analisis_tipo_check;
alter table public.paquete_conceptos
  add constraint paquete_conceptos_analisis_tipo_check
  check (analisis_tipo is null or analisis_tipo in ('terreno', 'zapata_corrida', 'excavacion'));
