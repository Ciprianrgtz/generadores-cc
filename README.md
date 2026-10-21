# Generadores y Presupuestos · Concepto Cero

Sistema de cuantificación (generadores de obra) y presupuestos. El contexto completo y los principios de diseño están en [CLAUDE.md](CLAUDE.md); el prototipo de referencia del visor está en [referencia/visor-generadores.html](referencia/visor-generadores.html).

## Arranque local

1. Copiar `.env.example` como `.env.local` y llenar la URL y la anon key de Supabase.
2. `npm install`
3. `npm run dev`

## Base de datos

Las migraciones están en `supabase/migrations/` y se ejecutan en orden en Supabase → SQL Editor.

| Archivo | Contenido |
|---|---|
| `0001_catalogos.sql` | Bitácora, varillas, insumos, partidas, conceptos, matrices, elementos tipo y fichas |

## Pruebas

`npm test` ejecuta los casos de prueba (golden tests) con Vitest.
