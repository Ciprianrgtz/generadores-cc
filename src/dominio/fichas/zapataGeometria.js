/**
 * Geometría del esquema de la zapata corrida (solo para dibujar).
 * Usa los mismos números que la ficha: el dibujo nunca calcula cantidades,
 * solo coloca las varillas que la ficha ya contó.
 */
const EPS = 1e-9

/** Diámetro en m: de la tabla de varillas, o de kg/m (kg/m = 0.00617·d², d en mm). */
export function diametroM(varilla) {
  const mm = Number(varilla?.diametro_mm)
  if (mm > 0) return mm / 1000
  return Math.sqrt(Number(varilla?.kg_m ?? 0) / 0.00617) / 1000
}

/**
 * Sentido corto (transversales): n = L ÷ sep + 1, a lo largo del metro analizado.
 * Se dibujan las varillas enteras en x = i·sep; si n trae fracción, se devuelve
 * aparte para dibujarla punteada (el análisis por metro sí la paga).
 */
export function posicionesTransversales(L, sep) {
  if (!(L > 0) || !(sep > 0)) return { xs: [], fraccion: 0, n: 0 }
  const n = L / sep + 1
  const enteras = Math.floor(n + EPS)
  return {
    xs: Array.from({ length: enteras }, (_, i) => Math.min(i * sep, L)),
    fraccion: n - enteras > EPS ? n - enteras : 0,
    n,
  }
}

/**
 * Sentido largo (longitudinales): n = ancho ÷ sep + 1, repartidas en el ancho.
 * Se acomodan parejas entre los recubrimientos para que ninguna salga de la sección.
 */
export function posicionesLongitudinales(ancho, sep, rec) {
  if (!(ancho > 0) || !(sep > 0)) return { ys: [], fraccion: 0, n: 0 }
  const n = ancho / sep + 1
  const enteras = Math.floor(n + EPS)
  const a = Math.min(rec, ancho / 2)
  const b = ancho - a
  const ys = enteras === 1 ? [ancho / 2] : Array.from({ length: enteras }, (_, i) => a + (i * (b - a)) / (enteras - 1))
  return { ys, fraccion: n - enteras > EPS ? n - enteras : 0, n }
}

/** Proyección isométrica: x (largo) a la derecha-abajo, y (ancho) a la izquierda-abajo, z hacia arriba. */
export const isometrica = (x, y, z) => ({ px: (x - y) * 0.8660254, py: (x + y) * 0.5 - z })
