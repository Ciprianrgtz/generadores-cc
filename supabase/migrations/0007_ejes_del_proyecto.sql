-- 0007 · Ejes del proyecto
-- Son el sistema de coordenadas de la obra (en metros): cada renglón de un generador se
-- ubica por su eje y entre qué ejes va, y de ahí sale su dibujo en el modelo 3D.
--   { "verticales":   [{ "nombre": "Y-00", "pos": 0 }, …],   -- pos = x
--     "horizontales": [{ "nombre": "X-00", "pos": 0 }, …],   -- pos = y
--     "origen_dxf":   { "x": 48.299, "y": 59.932 } }         -- dónde cae el 0,0 en el DXF (en metros)
alter table public.proyectos add column if not exists ejes jsonb;
