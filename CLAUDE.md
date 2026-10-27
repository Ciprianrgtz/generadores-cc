# Sistema de Generadores y Presupuestos — Concepto Cero

Contexto para Claude Code. Resume las decisiones tomadas en la conversación de diseño (octubre 2026) entre Ciprian (Arq. Ricardo Gutiérrez Ciprián, área de Presupuestos e Instalaciones de Concepto Cero Arquitectura, Colima) y Claude. Leer completo antes de proponer código.

---

## 1. Qué estamos construyendo

Un sistema de **cuantificación (generadores de obra) y presupuestos** para casas habitación. La idea es combinar dos cosas:

- **Lo que hace Neodata**: catálogo de conceptos con claves, matrices de precio unitario, insumos precargados, explosión de insumos.
- **Lo que hace ArchiCAD al documentar**: un modelo del que salen las cantidades, con un visor 2D/3D ligero.

**No es un programa de diseño.** Es un visor y cuantificador: se carga el plano, se identifican los elementos y el sistema cuantifica, muestra el avance y valida.

**Objetivo principal: evitar cualquier error.** Todo número debe poder rastrearse hasta su origen y verificarse visualmente en segundos.

## 2. Entorno técnico

- **Stack** (igual que la app de gestión de obras de Concepto Cero): React + Vite + Tailwind + Supabase + Vercel.
- **Proyecto nuevo**: se crean **cuentas nuevas de Supabase y Vercel en plan gratuito**, separadas del sistema de gestión de obras. Hay que diseñar pensando en los límites del plan gratuito.
- **Ciprian trabaja en Windows con PowerShell**: dar los comandos uno por uno, **sin encadenar con `&&`**.
- **Planos**: AutoCAD (DWG/DXF) para 2D y SketchUp para 3D. **No usan ArchiCAD ni Revit.**
- **Presupuesto actual**: se arma en **Neodata** y se exporta a Excel (reportes "b) Estándar", "j) Totales por Tipo", "a/e) Listado de insumos"). Las cantidades se miden en AutoCAD y se anotan aparte. La mano de obra está en Neodata como **cuadrillas con rendimiento**, con precios ya establecidos.
- **Librerías en uso**: `dxf-parser` (leer DXF), `read-excel-file` (importar reportes de Neodata), `three` (modelo 3D, colores planos sin texturas), `lucide-react` (íconos), Vitest (pruebas). Pendientes: PDF.js para calcar planos; el plano 2D va en SVG.
- **Infraestructura**: GitHub `Ciprianrgtz/generadores-cc` (privado), Supabase proyecto `iejofdeskrbulgdwxnmh`, Vercel https://generadores-cc.vercel.app, que publica solo cada push a `main`.
- **Autor de los commits**: Vercel (plan Hobby) bloquea commits de otro autor ("Blocked"). En cada computadora el repo debe tener `git config user.name "Ciprianrgtz"` y `git config user.email "346068397+Ciprianrgtz@users.noreply.github.com"` (solo local; el global es de la cuenta vieja `Ciprian-18`, que usa la app de gestión de obras).
- **Dos computadoras** (PC y laptop): `git pull` antes de empezar, commit + push al terminar. El `.env.local` no está en GitHub. Pasos completos en el README.
- **Migraciones**: se pegan a mano en Supabase → SQL Editor, en orden (`supabase/migrations/000N_*.sql`). Deben poder correrse más de una vez sin duplicar nada.
- **Estilo visual**: idéntico al sistema de gestión de obras (tema oscuro de cristal, menú lateral, mismo login). Colores en variables `--cc-*` (`src/index.css`) y componentes base en `src/componentes/ui.jsx` y `src/lib/ui.js`.

## 3. Principios de diseño (no negociables)

1. **Trazabilidad total.** Desde cualquier importe se baja a su precio unitario, a la matriz y al insumo. Desde cualquier cantidad se baja a los renglones del generador y a la geometría del elemento en el plano. Las fórmulas se muestran **escritas con sus valores**, por ejemplo `7.70 × 2.70 − (2.40×1.50) = 17.19`.
2. **Las reglas son datos, no código.** Los criterios de medición y de análisis se guardan en tablas, se versionan y se pueden agregar paso a paso sin programar.
3. **Cada renglón del generador guarda qué reglas se le aplicaron** (por ejemplo "R-MUR-003: mínimo 1.00 m").
4. **Dos cantidades por renglón:**
   - `cantidad_geometrica`: va a material y a Compras.
   - `cantidad_pago`: va a mano de obra y a Destajos. Las reglas de mínimos (como la de 1 m) normalmente afectan solo esta.
5. **El desperdicio va en la matriz, no en el generador**, para que no se aplique dos veces.
6. **Redondeo definido**: las cantidades a 2 decimales, sin redondear pasos intermedios de forma arbitraria. Las piezas (varillas, estribos) se redondean hacia arriba cuando el criterio lo indica.
7. **Nadie se aprueba a sí mismo.** Los estados son Borrador → Revisado → Aprobado; quien captura no es quien aprueba. Hay bitácora de cambios.
8. **Versiones congeladas.** Al aprobar un presupuesto se congelan precios, cantidades y la **versión del conjunto de reglas**. Un cambio posterior en las reglas no mueve en silencio los presupuestos ya entregados.
9. **Un cambio en una ficha o regla invalida la verificación** de los elementos afectados: regresan a "por verificar".
10. **Casos de prueba (golden tests).** Casa Bielva, una vez calibrada, debe reproducirse al centavo después de cualquier cambio de código o de reglas.
11. **Todo lo que se calcula se dibuja en tiempo real.** Cada método manda al modelo 3D lo que se está capturando (el borrador), no solo lo guardado. Ver lo calculado es la forma de revisarlo.
12. **Base para cualquier proyecto.** Nada de datos de una obra escritos en el código: medidas, huellas, ejes y criterios viven en la base o se importan del DXF. Lo que hoy está atado a Bielva (`src/dominio/bielva/`) es provisional y se debe generalizar; actualizar la app solo cuando de verdad se requiera.

## 4. Anatomía del presupuesto (dominio)

```
PRESUPUESTO → Partidas → Conceptos (clave, unidad)
  Importe = Cantidad (del GENERADOR) × Precio unitario (de la MATRIZ)
  PU = Costo directo × factor de sobrecosto
    Costo directo:
      materiales (cantidad/unidad + desperdicio)
      mano de obra (salario × FSR ÷ rendimiento de cuadrilla)
      herramienta menor (% de la MO)
      equipo
      básicos (morteros y concretos reutilizables)
    Sobrecosto: indirectos + financiamiento + utilidad + cargos adicionales
```

**Explosión de insumos**: cantidad × matriz, sumada en toda la obra. Es la lista de compra (va a Compras) y la mano de obra (va a Destajos).

**Generador**: la memoria de cálculo de cada cantidad. Se usa en tres momentos: el presupuesto, las compras y el control de obra (avance, estimaciones y destajos).

## 5. Arquitectura en capas

```
1. Insumos                 ← precios conectados a Compras (último, promedio 90 días, cotización)
2. Conceptos + matrices    ← catálogo con claves (tipo Neodata)
3. Elementos tipo          ← del cálculo estructural: sección + armado (Z-1, ZC-1, CD-1, K-1, CC-1, T-1, L-1…)
4. Fichas de análisis      ← análisis unitario por elemento tipo (por ml, m² o pza): acero por diámetro, concreto, cimbra…
5. Reglas de medición      ← criterios de la oficina, versionados
6. Ensambles / sistemas    ← ej. Muro M1 = block + castillos + cadena + aplanados + pintura
7. Prototipos de casa      ← casas ya hechas como plantilla (Casa Bielva primero)
8. Proyecto                ← copia de un prototipo + geometría en el plano + ajustes
9. Generador → Presupuesto → Explosión de insumos → Compras / Destajos / Programa de obra
```

**Duplicar una casa**: elegir prototipo → ajustar parámetros y medidas → cambiar acabados (básico, medio, premium) → ajustes manuales → **comparativo contra el original que muestre solo lo que cambió**.

## 6. Codificación

**Conceptos**, con formato `PP.SS.CCC` (partida, subpartida, concepto):

| Clave | Concepto |
|---|---|
| `02.01.001` | Excavación a mano en cepa |
| `02.02.020` | Concreto en zapata corrida |
| `02.02.031` | Acero #3 en cimentación |
| `03.02.015` | Muro de block 15 |
| `03.03.004` | Castillo K-1 |
| `03.04.002` | Cadena de cerramiento CC-1 |

Partidas usadas en el prototipo: 02 Cimentación, 03 Albañilería, 04 Pisos y firmes, 05 Estructura, 06 Acabados. **El catálogo definitivo está por armarse desde cero.**

**Acero**: una clave por diámetro (#2.5, #3, #4, #5, #6), para que la explosión dé kg por diámetro.

**Elementos en el plano**: tipo + ubicación por ejes.

| Código | Elemento |
|---|---|
| `M-A-1-3` | Muro sobre eje A, entre ejes 1 y 3 |
| `K-A1` | Castillo en la intersección A-1 |
| `ZC-A-1-3` | Zapata corrida bajo ese muro |
| `F-PB-01` | Firme 01 de planta baja |
| `L-N1-01` | Losa 01 del nivel 1 |

## 7. Fichas de análisis unitario — método de trabajo acordado

**Se definen una por una**, en este orden (sigue la obra):

1. Zapata corrida
2. Zapata aislada
3. Cadena de desplante
4. Castillos
5. Muros (con la regla de 1 m y la cadena a 2.20)
6. Cadena de cerramiento
7. Trabes
8. Losa
9. Firmes
10. Acabados

**Cada ficha tiene siempre la misma estructura:**

1. **Unidad de análisis**: por ml, m² o pza. La oficina analiza la zapata corrida **por 1.00 m de longitud**.
2. **Datos del estructural**: sección y armado. El calculista solo da el tipo de armado (varilla y separación). **La oficina calcula** cuántas varillas caben, el peso, los kg/ml, los kg/m², el concreto, etc.
3. **Criterios**: recubrimiento, ganchos, traslapes, redondeo de piezas, mínimos.
4. **Pasos del cálculo**, visibles uno por uno.
5. **Resultados por unidad**: acero por diámetro, concreto, plantilla, excavación, cimbra, alambre.
6. **Prueba con Casa Bielva**: tiene que reproducir lo que la oficina calculó a mano.

### Ejemplo trabajado: ZC-1 (0.80 × 0.20, por 1.00 m)

Armado: #3 @20 y #4 @15. Criterios provisionales: recubrimiento 0.05, gancho 0.10 por lado y traslape 40Ø en varilla de 12 m.

| # | Paso | Cálculo | Resultado |
|---|---|---|---|
| 1 | Longitudinales #3 @20 en 0.80 | ⌈(0.80 − 2×0.05) ÷ 0.20⌉ + 1 | 5 pzas × 1.00 m |
| 2 | Traslape 40Ø cada 12 m | 40 × 9.5 mm = 0.38 m ÷ 12 | 3.17 % |
| 3 | Acero longitudinal | 5 × 1.00 × 0.557 × 1.0317 | 2.87 kg |
| 4 | Transversales #4 @15 por metro | 1.00 ÷ 0.15 (tramo continuo, sin +1) | 6.67 pzas |
| 5 | Longitud transversal | 0.80 − 2×0.05 + 2×0.10 | 0.90 m |
| 6 | Acero transversal | 6.67 × 0.90 × 0.994 | 5.96 kg |
| Σ | Acero por ml | 2.87 + 5.96 | **8.83 kg/ml** |
| Σ | Acero por m² | 8.83 ÷ 0.80 | **11.04 kg/m²** |
| 7 | Concreto | 0.80 × 0.20 × 1.00 | 0.16 m³/ml |
| 8 | Plantilla | 0.80 × 1.00 | 0.80 m²/ml |
| 9 | Excavación | 0.80 × 0.80 (desplante) × 1.00 | 0.64 m³/ml |
| 10 | Cimbra en costados | 0, si se cuela contra terreno (parámetro) | 0.00 m²/ml |
| 11 | Alambre recocido | % del acero, a calibrar (va en la matriz del acero) | — |

Pesos de varilla usados (kg/m): #2.5 = 0.384, #3 = 0.557, #4 = 0.994, #5 = 1.552, #6 = 2.235. **Confirmar la tabla oficial de la oficina.**

**Comprobación de despiece real.** Con el análisis por metro, una zapata de 7.70 m lleva 7.70 ÷ 0.15 = 51.33 transversales. Contadas en la pieza completa son ⌈(7.70 − 0.10) ÷ 0.15⌉ + 1 = 52 (Δ 0.60 kg). El sistema debe mostrar esa diferencia, que cubre el desperdicio de la matriz.

**⚠ PENDIENTE DE CONFIRMAR CON CIPRIAN:**

- La dirección de cada varilla: se interpretó que el #4 @15 son las transversales repartidas en el metro y que el #3 @20 son las longitudinales repartidas en los 0.80.
- El recubrimiento, los ganchos, el traslape y el criterio de redondeo que usa la oficina.

## 8. Reglas de medición

Estructura de cada regla:

| Campo | Contenido |
|---|---|
| `codigo` | Identificador, ej. `R-MUR-003` |
| `aplica_a` | Grupo de elemento y/o concepto |
| `condicion` | Cuándo aplica |
| `accion` | Qué cambia |
| `afecta` | Material, pago o ambos |
| `nivel` | Oficina → prototipo → proyecto |
| `justificacion` | Por qué existe |
| `caso_prueba` | Entrada y resultado esperado |
| `version` | Versión de la regla |

**Orden de aplicación**, siempre igual:

1. Geometría.
2. Reglas geométricas (franjas, deducción de vanos, cruces de muros).
3. Cantidad de material.
4. Reglas de pago (mínimos, redondeos).
5. Cantidad de mano de obra.

**Reglas ya identificadas por Ciprian:**

- **Mínimo 1 m**: un elemento de menos de 1 m se cuantifica como 1 m. Ejemplo: un muro de 0.60 (o 0.98) × 3.00 m se toma como 1.00 × 3.00. *Por confirmar si aplica solo al pago o también al material* (la propuesta es solo al pago).
- **Cadena de cerramiento a 2.20 m**: parte el muro en franjas. Ejemplo con un muro de 4.00 m y losa a 2.70:

  | Franja | Altura | Cantidad |
  |---|---|---|
  | Block bajo la cadena | 0.00–2.20 | 8.80 m² |
  | Cadena | 2.20–2.40 | 4.00 ml |
  | Block sobre la cadena | 2.40–2.70 | 1.20 m² |
  | **Total de block** | | **10.00 m²** (no 10.80) |

  Esa cadena también sirve de dintel: hay que avisar cuando un vano supera 2.20 m.
- **Acero en kg** en zapatas y demás elementos, por despiece desde la ficha.
- **Muro de enrase, mínimo 1.00 m de altura**: el m² se calcula como `ml × max(altura, 1.00)`. Si el enrase mide menos de 1.00 m de alto, se cuantifica como 1.00 m² por ml (por eso en Bielva el muro de enrase CIM21D' = 22.56 m², igual a los 22.56 ml de dala). *Por confirmar si afecta solo al pago o también al material.*

**Detalles que suelen saltarse** (convertir en reglas o en checklist):

- **Acero**: traslapes, ganchos, varilla de 12 m y desperdicio por corte, alambre recocido, silletas y separadores.
- **Cimbra**: por área de contacto (costados de cadenas, castillos y trabes) y fronteras de losa.
- **Excavación**: abundamiento para acarreos; relleno = excavación − volumen de cimentación.
- **Muros**: no duplicar en cruces (definir si se mide a ejes o a paños); pretiles.
- **Acabados**: boquillas, aristas y goteros en ml; entortado de azotea con espesor promedio.
- **Losa**: huecos (definir el tamaño mínimo que se descuenta), bastones, columpios, dalas de repartición.
- **Escaleras**: peraltes, rampa y armado.
- **Varios**: pruebas de laboratorio, impermeabilización de cadena de desplante, limpieza y acarreos finales.

## 9. Visor (interfaz principal)

Hay un prototipo funcional de referencia en `referencia/visor-generadores.html` (HTML + three.js, datos de ejemplo). Funciones que deben conservarse:

- **Plano 2D** con ejes, cotas y elementos con código. Clic en un elemento muestra su generador con las fórmulas y casillas para asignar conceptos.
- **Semáforo por elemento**:
  - ⬜ Sin cuantificar
  - 🟨 Parcial
  - 🟦 Cuantificado, por verificar
  - 🟩 Verificado
  - 🟥 Conflicto (por ejemplo, tramos que no cierran con la cota: 5.55 vs 5.70)
- **Partidas con barras de avance** y filtro por grupo (cimentación, muros, castillos, firmes, losas).
- **Selección por concepto**: al elegir un concepto del generador consolidado, se seleccionan y **numeran** en el plano todos los elementos que lo generan, el resto se atenúa, y se muestra la lista con cantidades. La **suma se concilia contra el consolidado**. Pasar el mouse por la lista resalta el elemento.
- **Modelo 3D ligero**: los muros se extruyen por altura y las losas por espesor, con color por material o por estatus. Clic en 3D selecciona.
- **Cruces de validación**:
  - Firmes = área de losa.
  - Muros exteriores = perímetro.
  - Castillo en cada extremo de muro.
  - Zapata bajo cada muro.
  - Cuantía de acero en rango (kg/m³).
- **Ficha de análisis editable**, ligada a los generadores.
- **Plano de calco**: cargar una imagen o PDF de fondo (en la versión real, calibrada con una cota conocida).

Funciones planeadas: locales con cuadro de acabados, vanos con catálogo de cancelería, capa de instalaciones (salidas como puntos, tuberías en ml), modo obra (avance y destajo sobre el mismo plano), comparar versiones de plano y exportar el plano de cuantificación en PDF.

## 10. Importación de planos

- **AutoCAD → DXF** (ruta principal). Requiere un **estándar de capas** de la oficina:

  | Capa | Contenido |
  |---|---|
  | `CC-EJES` | Ejes |
  | `CC-MURO-M1` / `CC-MURO-M2` | Muros por tipo de ensamble |
  | `CC-CASTILLO` | Castillos |
  | `CC-FIRME` | Polilíneas cerradas de firmes |
  | `CC-LOSA` | Polilíneas cerradas de losas |
  | `CC-VANO-V` / `CC-VANO-P` | Bloques de ventanas y puertas, con atributos de ancho y alto |

  Sin estándar de capas, el respaldo es calcar sobre una imagen calibrada.
- **SketchUp**: exportar glTF/DAE para el visor 3D. Usar etiquetas y componentes con nombre (`M1`, `K-1`, `ZC-1`) y el *Generate Report* en CSV para la revisión cruzada de volúmenes.
- **Detección por IA sobre imágenes**: solo como sugerencia que alguien confirma, nunca como cálculo final.

## 11. Modelo de datos inicial (borrador para Supabase)

```sql
-- Catálogos
insumos            (id, clave, descripcion, unidad, tipo /*material|mo|equipo*/, precio, precio_fuente, actualizado_en)
conceptos          (id, clave /*PP.SS.CCC*/, descripcion, unidad, partida)
matrices           (concepto_id, insumo_id, cantidad_por_unidad, desperdicio_pct)
varillas           (numero /*'3','4'…*/, diametro_mm, kg_m)

-- Estructural y análisis
elementos_tipo     (id, codigo /*ZC-1*/, grupo /*ZC|Z|CD|K|M|CC|T|L|F*/, seccion jsonb, armado jsonb, fuente /*plano estructural*/)
fichas             (id, elemento_tipo_id, version, unidad_analisis /*ml|m2|pza*/, parametros jsonb, resultados jsonb, aprobada_por, aprobada_en)
reglas             (id, codigo, aplica_a jsonb, condicion jsonb, accion jsonb, afecta /*material|pago|ambos*/, nivel /*oficina|prototipo|proyecto*/, justificacion, version, activa)
casos_prueba       (id, regla_id | ficha_id, entrada jsonb, esperado jsonb)
ensambles          (id, codigo /*M1*/, descripcion) ; ensamble_conceptos (ensamble_id, concepto_id, formula)

-- Proyecto
proyectos          (id, nombre, prototipo_origen_id, version_reglas, estado)
niveles            (proyecto_id, nombre, cota /*NPT, lecho bajo losa…*/)
ejes               (proyecto_id, nombre, orientacion, posicion)
elementos          (id, proyecto_id, codigo /*M-A-1-3*/, elemento_tipo_id | ensamble_id, nivel, geometria jsonb, ubicacion)
generador_renglones(id, elemento_id, concepto_id, cantidad_geometrica, cantidad_pago, formula_texto, reglas_aplicadas jsonb,
                    asignado bool, capturado_por, verificado_por, verificado_en)
presupuestos       (id, proyecto_id, version, estado /*borrador|revisado|aprobado*/, congelado_en, snapshot jsonb)
bitacora           (id, tabla, registro_id, campo, valor_anterior, valor_nuevo, usuario, fecha)
```

Notas:

- Las **cantidades se calculan** a partir de la geometría, la ficha y las reglas. Se guardan con su fórmula en texto para poder auditarlas.
- Usar RLS de Supabase con roles: captura, revisión, aprobación, solo lectura (sin costos).

## 12. Plan inmediato: prueba con Casa Bielva

Ciprian va a compartir la información de Casa Bielva. Pasos:

1. **Reunir**: planos arquitectónicos y **estructurales** (DWG/PDF), generadores hechos a mano, presupuesto y, de ser posible, **compras y destajos reales**.
2. **Inventariar los elementos tipo** del estructural: zapatas, cadenas, castillos, trabes, losas, con su armado.
3. **Ficha 1: zapata corrida**, usando los datos reales de Bielva. Confirmar ganchos, recubrimiento, traslapes y redondeo.
4. **Comparar** el resultado de la ficha contra los generadores a mano de Bielva. Cada diferencia termina siendo una regla nueva, un error del generador original o un dato para calibrar.
5. Seguir con las fichas en el orden de la sección 7, **una a la vez**.
6. Al terminar, congelar Casa Bielva como **prototipo** y como **caso de prueba permanente**.

**Fase 1 técnica sugerida**:

1. Proyecto Vite + Supabase con las tablas de catálogos, varillas, elementos tipo y fichas.
2. Pantalla de la ficha de zapata corrida (editable, con pasos visibles), validada contra Bielva.
3. Después, el visor 2D.

## 13. Hallazgos del presupuesto de Casa Bielva (Neodata, ago-2026)

- Total $1,338,708.63 sin IVA, 146 conceptos, 21 partidas en 4 bloques: obra negra 32.7 %, obra gris 22.6 %, instalaciones 12.6 %, acabados 32.1 %.
- Por tipo de costo: **mano de obra 46 %**, materiales 43 %, subcontratos 8.6 %, equipo 2.4 %. Los listados de insumos exportados solo traen materiales; la MO no se puede rastrear hoy → en el sistema la MO es insumo (cuadrilla + rendimiento) para que la explosión dé también Destajos.
- **Factor de sobrecosto ajustable**: en la versión del 6-ago, costo = costo directo × 1.10 en todos los conceptos; cambia entre versiones. Se guarda como parámetro de cada versión de presupuesto y se congela al aprobar.
- 43 conceptos hacen el 80 % del importe y 33 insumos el 80 % del material: la verificación se prioriza ahí.
- Señales a validar automáticamente: conceptos en 0 (11) o en 1 (34), cantidades iguales en unidades distintas, unidades sin norma (`PZA` / `PZA.`), claves Neodata con sufijos (`D'`, `B'`, `*`), plantillas de generadores copiadas de otra casa (el catálogo de Bielva trae datos de Casa Palma Real).

### Planos DXF de Bielva (`...\13 - CASA BIELVA\PLANTAS ARQUITECTONICAS\*.dxf`)

- Dibujados a escala 1:1 en metros; el model space trae varias copias de cada planta lado a lado ("distancia de los planos: 15 m").
- **Ejes**: X-00…X-08 son horizontales (a lo largo, 0.00 · 4.91 · 5.51 · 5.91 · 8.79 · 10.37 · 15.15 · 16.73 · 20.00) y Y-00…Y-04 verticales (a lo ancho, 0.00 · 1.07 · 3.27 · 4.35 · 7.00). Casa de 7.00 × 20.00 m a ejes.
- **Niveles**: desplante de zapata −0.80, lecho superior de zapata −0.60, terreno ±0.00, piso terminado +0.45, lecho inferior de dala de cerramiento +2.65, losa de azotea +3.45 / +3.65.
- **Elementos tipo**: ZC-1, ZC-2, CC-1…9 (colindante), CI-1…7 (intermedia), CT-1 y CT-2 (Armex 15x20-4, f'c 250), TL-1 (25×25, 4#4, E#3 @10-15-10), DD-1 (Armex 15x15-4, f'c 200), K-1 (6#3, E#2 @20), K-2, K-3 (8#3, 2E#2 @20), K-A (Armex 15x15-4), DC-1, DCo-1, T-1, T-2, N-1, LV-20 (vigueta y bovedilla), LM-10, MRH-1.
- El plano trae la tabla ACI 318 de **recubrimientos** (7.5 cm contra suelo; 5.0/4.0 expuesto; 4.0/2.0 interior), **ganchos** estándar (90°, 135°, 180°) y traslape > 40 Db.
- **Capas**: ya existe un estándar parcial `CC-` (CC- EJES, CC- MUROS DE CARGA, CC- COTAS…), pero los elementos estructurales están en capas mezcladas (PROYECCIÓN DE ZAPATA, CONTRATRABE, ARMADO, E-castillos…) y hay ~27,000 líneas en la capa 0. Muros como líneas dobles, sin polilíneas cerradas de firmes/losas ni bloques de vanos con atributos.
- **Comprobación**: con la geometría de la capa PROYECCIÓN DE ZAPATA se reproduce el **22.56 ml** de Neodata: 4.82 + 4.60 + (4.97 + 0.85) + 4.76 + 2.56. En la esquina superior derecha el cruce de 0.80 × 0.80 se cuenta en los dos tramos (medido por paño exterior).

### Método de la plantilla de generadores (acero de ZC, bloque CIM05B) — decidido con Ciprian

- **Análisis por metro**, porque así se paga en obra. Por la misma razón algunos conceptos usan unidades distintas a las tradicionales; se aceptan sugerencias, pero por ahora se respeta el método.
- Transversales: `n = 1.00 ÷ sep + 1`, largo `(ancho − 2·rec) + 2·gancho`. Longitudinales: `n = ancho ÷ sep + 1`, largo por metro `(1.00 − rec) + gancho`. `kg = n × largo × kg/m × 1.03`.
- **El 1.03 es desperdicio** → parámetro `desperdicio` (3 %, editable). La ficha muestra el acero neto y el desperdicio. Al importar las matrices de Neodata, revisar que el acero no traiga desperdicio otra vez.
- **Recubrimiento editable** (la plantilla usa 0.02 por lado; el estructural de Bielva pide 7.5 cm contra suelo). Gancho 0.18 por lado, también editable.
- El **despiece real por tramos** se muestra solo como comparativo informativo; no cambia la cantidad del generador.
- ZC-01 = 21.71 ml × 7.182849 kg/ml = **155.94 kg** (golden test en `src/dominio/fichas/zapataCorrida.test.js`). ZC-01 21.71 + ZC-02 0.85 = 22.56 ml, igual que el DXF.

## 14. Estado de la app (al 26-oct-2026)

### Cómo se usa

```
PROYECTO → su paquete de generadores (1 por proyecto)
  → partidas y conceptos, en el orden del presupuesto
    → cada concepto lleva un MÉTODO de análisis
      → el método da la cantidad, guardada con su fórmula (tabla generadores)
```

- **Catálogo de la oficina** ("el básico"): partidas y conceptos en orden, cargados desde el reporte "b) Estándar" de Neodata (solo clave, descripción y unidad; **nunca precios ni cantidades**). Mientras no exista el catálogo definitivo `PP.SS.CCC`, la clave es la de Neodata.
- **Paquete de un proyecto**: copia del catálogo (o importado del Excel, o vacío) que se reacomoda, edita y archiva **sin tocar el catálogo ni otras casas**. Cada concepto tiene estado pendiente / en proceso / listo.
- **Al abrir un concepto** se ve "Cómo se genera el volumen": método, cálculo con los datos del proyecto, origen de los datos y pasos. La cantidad de Neodata es de cada concepto y sirve para comparar.
- **Menú**: Generadores → Proyectos · Análisis → Métodos de análisis · Catálogos → Conceptos, Varillas.

### Métodos de análisis implementados (`src/dominio/metodos.js`)

| Método | Conceptos | Cómo calcula |
|---|---|---|
| `terreno` — Superficie del terreno | Limpia y despalme, trazo y nivelación | Rectángulo, vértices o polilínea cerrada del DXF en la capa «terreno» (fórmula de la lazada). El terreno se captura una vez en el proyecto (`proyectos.terreno`), lo reusan todos los conceptos y se dibuja en el 3D. |
| `zapata_corrida` — Acero de la parrilla | Acero de ZC-01, ZC-02… | Ficha por 1.00 ml (sección 13, método CIM05B), con versiones y flujo Borrador → Revisado → Aprobado y esquema interactivo en planta e isométrico. |
| `excavacion` — Excavación por elementos | Excavación de cepas (CIM001) | Renglones por tramo de cada elemento que toca el suelo (eje, entre, largo, ancho total, desplante, piezas). Reglas abajo. |
| `afine` — Afine de fondo y taludes | Afine y compactación (CIM002) | Toma las cepas del análisis de excavación guardado: ml del elemento × (ancho cepa + 2 × profundidad cepa). Reglas abajo. |
| `plantilla` — Plantilla bajo zapatas y trabes | Plantilla de concreto (CIM003) | Toma los tramos de la excavación: ml de ZC y TL del plano × (ancho del elemento + 2 × vuelo). Vuelo editable. |
| `areas` — Suma de áreas | Membrana (CIM003'), afine para firme (EST13B'), firmes | Se eligen áreas: superficies de la excavación (área dibujada completa), polígonos del DXF o a mano. **La membrana va solo en la losa de cimentación** (no bajo zapatas, trabes ni firmes). Bielva: las 3 losas completas suman **75.17 m²**; Neodata trae 50.58 porque solo midió una franja (ver «Reglas de membrana»). |
| `longitud` — Longitud de elementos | Cimbra de zapatas corridas (CIM004), de trabes de liga (CIM22D')… | Suma de los ml del elemento del plano que entran (tramos de la excavación, o agregados a mano) por sus piezas. Bielva: ZC = 22.56 ml (igual que Neodata); TL-1 = 8.62 ml (Neodata trae 8.97). Se dibuja en el 3D como las dos fronteras laterales de cada tramo (ancho del elemento, sin sobreancho) sobre su desplante; el alto de la frontera es un criterio editable solo de dibujo (0.20 por defecto) y no cambia la cantidad. |
| `acero_ficha` — Acero por ficha | Acero de ZC-01 (CIM05D'), ZC-02 (CIM06D') y de cualquier tipo nuevo de zapata; luego trabes, losas y castillos cuando tengan ficha | Σ ml del elemento (tramos de la excavación o a mano) × kg/ml de la última versión de su ficha. La separación, los números de varilla por sentido, el recubrimiento, los ganchos y el desperdicio viven en la ficha; un tipo nuevo solo necesita su ficha (botón «+ Nuevo tipo» en la ficha de zapata, que copia sección y armado). Guarda también el desglose por diámetro. Avisa si la ficha no está aprobada o cambió después de guardar. Bielva: ZC-01 = 21.71 ml × 7.182849 = 155.94 kg (igual que Neodata); ZC-02 = 0.85 ml × 7.182849 = 6.11 kg contra 5.69 de Neodata (≈ 0.79 ml con el mismo armado: por aclarar). |

### Ejes del proyecto y dibujo en tiempo real (principios 11 y 12)

- Los **ejes** (`proyectos.ejes`) son el sistema de coordenadas de la obra, en metros: `verticales` (posición x) y `horizontales` (posición y), más `origen_dxf` (dónde cae el 0,0 en el DXF). Se importan del DXF desde la tarjeta «Ejes del proyecto» (`src/dominio/ejes.js` → `leerEjesDxf`: cada etiqueta de eje se asigna a la línea de una capa «eje» que remata junto a ella; las líneas que se cruzan forman una planta) o se capturan a mano. Bielva: Y-00 0 · Y-01 1.07 · Y-02 3.27 · Y-03 4.35 · Y-04 7.00; X-00 0 … X-08 20.00.
- Cada renglón se **dibuja con sus propios datos** (`huellaPorEjes`): eje, entre qué ejes, largo, ancho de la cepa, **desfase** (del eje al centro de la cepa, + hacia donde crecen las coordenadas) e **inicio** (desde el primer eje de «entre»; vacío = centrado). Si cambia una medida, cambia el dibujo.
- Las **superficies** (losas, firmes) se importan del DXF como polilíneas cerradas, ya en coordenadas del proyecto; las que caen dentro de otra se pueden restar como huecos. El terreno importado del DXF usa el mismo origen que los ejes.
- Cada pantalla de análisis manda su borrador al 3D (`onCapturar`); el visor conserva la cámara y solo redibuja el contenido.
- Pendiente de generalizar: la precarga de Bielva (`src/dominio/bielva/`) sigue en código como muestra; con ejes + importación de superficies ya se puede capturar sin ella.

### Reglas de excavación (explicadas por Ciprian, 26-oct-2026)

- Se excava **todo elemento en contacto con el suelo**: zapatas, trabes de liga, contratrabes, plantillas…; se suma el volumen de cada uno.
- **No se sigue la forma del elemento en corte**: se excava su **ancho total** (el más ancho de la sección) hasta su **desplante**.
- A la profundidad se suma la **plantilla de 5 cm** que va debajo.
- **Sobreancho de 10 cm por lado** para maniobrar el armado, el colado y los amarres.
- Si entre dos cepas quedan **menos de 35 cm de tierra**, esa franja también se excava (en obra no se sostiene); su volumen cuenta como excavación **y como relleno**.
- `Volumen = largo × (ancho total + 2 × 0.10) × (desplante + 0.05) × piezas`. Los tres valores son criterios editables.
- Las cotas del corte son las que cuentan (los dibujos pueden estar fuera de escala). La profundidad se mide desde el **NTN ±0.00**.
- **Zapata (ZC-1, ZC-2)**: el alto es la suma de lo que lleva encima (zapata 0.20 + muro de enrase + dala de desplante = 0.80 hasta NDZC −0.80); el muro de enrase y la dala **solo aportan altura**, el ancho es el de la zapata (0.80 + 0.10 por lado). La contratrabe CT-1 queda dentro de esa cepa.
- **Contratrabes o trabes de liga fuera de zapatas o losas**: `largo × (ancho + 2 × 0.10) × (alto + 0.05)`.
- **Losa de cimentación con talud (CI, CC)**: se excava el ancho total por el alto total, sin seguir los taludes, sin sobreancho ni plantilla. CI-1: `0.25 × (0.40 + 0.10 + 0.10)`; la CT-2 que va dentro ya queda incluida. En el generador: «Sobreancho: sin sobreancho» y sin «+Plant» (se pone solo al escribir CI o CC).
- **Zapatas en colindancia**: sobreancho **de un solo lado** (el de adentro); no se excava hacia el lindero. En el generador: «Sobreancho: 1 lado».
- La losa de cimentación **nunca lleva plantilla**: es un sistema de bajo costo que la sustituye por plástico negro o membrana, que no cuenta en la profundidad.
- **Área del firme**: neta, sin lo que ya se excava más hondo (zapatas, trabes, bandas de losa). La **cochera** no entra: su firme es otro concepto (APB16A').
- **Bielva** (`src/dominio/bielva/excavacion.js`, botón «Precargar cimentación de Bielva»): zapatas 21.66 ml × 0.90 × 0.85 (esquina X-08/Y-04 contada una vez), TL-1 8.62 ml × 0.45 × 0.30, bandas de losa 28.34 m² × 0.25, parte de 10 cm de losa y firme 60.66 m² × 0.10 → **30.88 m³** contra 31.13 de Neodata (−0.8 %). Áreas medidas en el DXF con un raster de 5 mm.
- Cuando hay losa de cimentación, su parte de 10 cm hace de firme: en el presupuesto el firme de concreto se sustituye por el sistema de losa.
- El **firme de concreto de 10 cm** va en toda el área interior de la casa y también se excava, por superficie: `Volumen = área × espesor`, sin sobreancho ni plantilla (sección «Superficies» del generador).

### Reglas de membrana (Ciprian, 26-oct-2026)

- La membrana lleva la **superficie completa de cada losa de cimentación** (CI y CC), dibujada de cara a cara. **Bielva: L1 18.95 + L2 21.93 + L3 34.29 = 75.17 m²** (a ejes serían 73.42).
- **Diferencia con Neodata (50.58 m²), ya explicada**: Neodata midió solo una franja continua del lado Y-00: **L1 + firme X-05/X-06 + L2** (18.95 + 21.93 + 9.71 = 50.59) y se quedó **sin la losa central L3 (34.29 m²)** ni el firme de X-06 a X-08 / Y-03 a Y-04 (6.41). Dice 50.58 en la membrana (CIM003') y también en el afine para firme (EST13B'): el mismo número en dos conceptos.
- **Decisión: el generador se queda en 75.17 m²**; el presupuesto de Neodata está corto unos 24.6 m² de membrana. Queda como nota del concepto (`paquete_conceptos.nota`) y se ve en «Cómo se genera el volumen».
- **Pendiente**: el afine para recibir firme (EST13B') trae el mismo 50.58, que no es el área de firme; hay que decidir con la oficina cuál es su superficie correcta.
- Las notas por concepto sirven para dejar por escrito por qué un generador difiere de Neodata.

### Reglas de afine (Ciprian, 26-oct-2026)

- Se afina el **fondo y las dos paredes (taludes)** de cada cepa: `ml × (ancho de la cepa + 2 × profundidad de la cepa)`, también la pared del lindero en colindancia.
- Se usan los **ml del elemento del plano** (en una esquina cuenta en los dos tramos; en la excavación se guardan en `mlElemento`).
- Las losas y el firme no entran: su afine es otro concepto (EST13B', afine para recibir firme).
- Bielva: zapatas 22.56 × (0.90 + 2×0.85) = **58.66** (Neodata 58.63, que solo contó zapatas); con la TL-1 (8.62 × (0.45 + 2×0.30) = 9.05) da **67.71**.

Para agregar un método: definirlo en `metodos.js`, su cálculo puro en `src/dominio/` con pruebas, su pantalla en `src/componentes/`, y **ampliar el check `paquete_conceptos_analisis_tipo_check`** con una migración nueva.

### Reglas de plantilla (Ciprian, 26-oct-2026)

- La plantilla se calcula con los **ml de zapatas corridas y de trabes de liga** del plano: `ml × (ancho del elemento + 2 × vuelo)`.
- El **vuelo** (lo que sobresale por lado) es criterio editable; en el corte de la ZC-1 se ve de unos 5 cm. **Pendiente**: confirmar el ancho con el que Neodata llega a 23.58 (con vuelo 0.05: ZC 22.56 × 0.90 + TL 8.62 × 0.35 = 23.32; Neodata trae TL-1 de 8.97 ml contra 8.62 medidos en el DXF).
- La losa de cimentación no lleva plantilla.

### Base de datos (migraciones 0001–0011)

| Migración | Contenido |
|---|---|
| 0001 | Bitácora automática por campo, varillas (pesos provisionales), insumos, partidas, conceptos, matrices, elementos tipo, fichas. RLS en todo. |
| 0002 | Perfiles con rol (lectura < captura < revisión < aprobación; el primer usuario es aprobación), proyectos, flujo de fichas validado por trigger (nadie se aprueba a sí mismo; aprobadas congeladas), Casa Bielva con ZC-01 y ZC-02. |
| 0003 | Orden de conceptos en el catálogo; `paquetes`, `paquete_partidas`, `paquete_conceptos`; funciones `crear_paquete`, `mover_paquete_concepto`, `mover_paquete_partida`. |
| 0004 | `proyectos.terreno`, `paquete_conceptos.analisis_tipo`, tabla `generadores` (datos capturados, cantidad, unidad, fórmula); un paquete por proyecto. |
| 0005 | Permite el método `excavacion` en `analisis_tipo`. |
| 0006 | Permite el método `afine` en `analisis_tipo`. |
| 0007 | `proyectos.ejes`: ejes del proyecto (verticales, horizontales y origen en el DXF). |
| 0008 | Permite el método `plantilla` en `analisis_tipo`. |
| 0009 | Permite el método `areas` en `analisis_tipo`. |
| 0010 | Permite el método `longitud` en `analisis_tipo`. |
| 0011 | Permite el método `acero_ficha` en `analisis_tipo`. |

- Usuarios: se dan de alta en Supabase → Authentication (registro público desactivado).
- Golden tests: `npm test` (zapata corrida 155.94 kg, lectura del catálogo de Neodata, terreno).

### Código

- `src/dominio/`: cálculos puros y probados (fichas, terreno, métodos, importar Neodata, redondeo). Las fórmulas se escriben con `dato()` para los datos de entrada (sin redondear) y `fmt()` para resultados.
- `src/lib/`: acceso a Supabase (`*Repo.js`), sesión, tema y estilos base.
- `src/componentes/`: pantallas (Proyectos, ProyectoVista, PaqueteDetalle, GeneradorTerreno, FichaZapataCorrida, EsquemaZapata, Visor3D, Metodos, Catalogo…).
- No hay router: `App.jsx` elige la vista.

### Siguientes pasos

1. Métodos para los demás conceptos de cimentación de Bielva, en orden de obra: completar la excavación (contratrabes, TL-1…), afine, plantilla, membrana, cimbra de ZC, concreto, contratrabes, dalas, castillos… (trazo y nivelación ya usa el terreno).
2. Inventario completo de elementos tipo de Bielva (CT-1, CT-2, TL-1, DD-1, K-1…) desde el estructural.
3. Reportes de Neodata con tarjetas de PU y mano de obra (cuadrillas) para cargar matrices.

## 15. Decisiones abiertas

- [ ] Dirección de varillas e interpretación del análisis de la ZC (sección 7).
- [ ] Recubrimiento, ganchos, traslapes y redondeo oficiales de la oficina.
- [ ] Tabla oficial de pesos de varilla.
- [ ] La regla de 1 m: ¿aplica al pago, al material o a ambos?
- [ ] La regla del muro de enrase (mínimo 1.00 m de alto): ¿pago, material o ambos?
- [ ] Reporte de Neodata con las matrices (tarjetas de PU) y el catálogo de cuadrillas/salarios, para cargar matrices y MO.
- [ ] Muros: ¿se miden a ejes o a paños? ¿Cómo se tratan los cruces?
- [ ] Vanos: ¿a partir de qué área se descuentan?
- [ ] Cimbra en zapatas: ¿se cuela contra terreno o lleva cimbra?
- [ ] Catálogo de claves definitivo (desde cero).
- [ ] Estándar de capas de AutoCAD (`CC-*`) y bloques de vanos con atributos.
- [ ] Fuente de precios de Compras (módulo de la app actual u otra plataforma) y cómo se conecta.
