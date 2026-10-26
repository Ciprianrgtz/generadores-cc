# Generadores y Presupuestos · Concepto Cero

Sistema de cuantificación (generadores de obra) y presupuestos. El contexto completo y los principios de diseño están en [CLAUDE.md](CLAUDE.md); el prototipo de referencia del visor está en [referencia/visor-generadores.html](referencia/visor-generadores.html).

## Arranque local

1. Copiar `.env.example` como `.env.local` y llenar la URL y la anon key de Supabase.
2. `npm install`
3. `npm run dev`

## Trabajar en otra computadora

Requisitos: Git, Node.js 22 o superior y, opcionalmente, VS Code y la app de Claude.

1. `git clone https://github.com/Ciprianrgtz/generadores-cc.git` (iniciar sesión con la cuenta **Ciprianrgtz**).
2. Dentro de la carpeta, configurar el autor **solo para este repo** (Vercel bloquea commits de otro autor):
   - `git config user.name "Ciprianrgtz"`
   - `git config user.email "346068397+Ciprianrgtz@users.noreply.github.com"`
3. `npm install`
4. Crear `.env.local` con la URL y la anon key de Supabase (no está en GitHub).
5. **Siempre** `git pull` antes de empezar y commit + push al terminar, para no pisar el trabajo de la otra computadora.

## Base de datos

Las migraciones están en `supabase/migrations/` y se ejecutan en orden en Supabase → SQL Editor.

| Archivo | Contenido |
|---|---|
| `0001_catalogos.sql` | Bitácora, varillas, insumos, partidas, conceptos, matrices, elementos tipo y fichas |
| `0002_proyectos_perfiles_flujo.sql` | Perfiles con rol, proyectos, flujo Borrador → Revisado → Aprobado validado en la base, ZC-01 y ZC-02 de Bielva |
| `0003_catalogo_y_paquetes.sql` | Orden del catálogo, paquetes de generadores por proyecto y funciones para crearlos y reacomodarlos |
| `0004_proyecto_primero_y_generadores.sql` | Terreno del proyecto, método de análisis por concepto y tabla de generadores |

## Usuarios

Las cuentas se crean en Supabase → **Authentication → Users → Add user** (registro público desactivado). El primer usuario queda con rol *Aprobación*; los siguientes entran como *Captura* y el rol se cambia en la tabla `perfiles`. Nadie puede revisar ni aprobar una ficha que él mismo capturó.

## Pruebas

`npm test` ejecuta los casos de prueba (golden tests) con Vitest.
