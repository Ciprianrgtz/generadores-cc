import DxfParser from 'dxf-parser'
import { dato, fmt } from './redondeo.js'

/**
 * Terreno del proyecto: un polígono en metros (plano X-Y).
 * Puede venir de un rectángulo (ancho × largo), de vértices capturados a mano
 * o de una polilínea cerrada de un DXF. De ahí salen la superficie y el perímetro.
 */

/** Rectángulo de ancho × largo con una esquina en el origen. */
export const rectangulo = (ancho, largo) => [
  [0, 0],
  [ancho, 0],
  [ancho, largo],
  [0, largo],
]

/**
 * Área por la fórmula de la lazada (shoelace): ½ × |Σ (xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)|.
 * Devuelve cada término para poder escribir el cálculo completo.
 */
export function areaPoligono(vertices) {
  const n = vertices.length
  const terminos = []
  let suma = 0
  let perimetro = 0
  for (let i = 0; i < n; i++) {
    const [x1, y1] = vertices[i]
    const [x2, y2] = vertices[(i + 1) % n]
    const t = x1 * y2 - x2 * y1
    terminos.push({ de: i + 1, a: ((i + 1) % n) + 1, valor: t, texto: `${dato(x1)}×${dato(y2)} − ${dato(x2)}×${dato(y1)}` })
    suma += t
    perimetro += Math.hypot(x2 - x1, y2 - y1)
  }
  return { area: Math.abs(suma) / 2, suma, perimetro, terminos }
}

/** Un polígono sirve si tiene al menos 3 vértices numéricos distintos y no se cruza consigo mismo. */
export function validarPoligono(vertices) {
  if (vertices.length < 3) return 'Se necesitan al menos 3 vértices'
  if (vertices.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return 'Hay vértices sin número'
  const n = vertices.length
  const cruza = (a, b, c, d) => {
    const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
  }
  // primero los cruces: un moño (lados cruzados) puede dar área cero y esconder el motivo real
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      if (cruza(vertices[i], vertices[(i + 1) % n], vertices[j], vertices[(j + 1) % n])) return 'Los lados se cruzan: revisa el orden de los vértices'
    }
  }
  if (areaPoligono(vertices).area <= 0) return 'Los vértices no forman una superficie'
  return null
}

/** Superficie del terreno con su cálculo escrito (la fórmula se muestra con los valores). */
export function analizarTerreno({ modo, ancho, largo, vertices }) {
  if (modo === 'rectangulo') {
    const area = ancho * largo
    return {
      vertices: rectangulo(ancho, largo),
      area,
      perimetro: 2 * (ancho + largo),
      formula: `${dato(ancho)} × ${dato(largo)} = ${fmt(area)} m²`,
      terminos: null,
    }
  }
  const r = areaPoligono(vertices)
  return {
    vertices,
    area: r.area,
    perimetro: r.perimetro,
    formula: `½ × |${r.terminos.map((t) => fmt(t.valor, 3)).join(' + ')}| = ${fmt(r.area)} m²`,
    terminos: r.terminos,
  }
}

/** Factores para pasar las unidades del dibujo a metros. */
export const UNIDADES_DXF = { m: 1, cm: 0.01, mm: 0.001 }

/**
 * Busca en un DXF las polilíneas cerradas (o con ≥3 vértices) y dice en qué capa están.
 * Las de una capa que se llame "terreno" salen primero. Sin la capa, igual se listan todas.
 */
export function leerPoligonosDxf(texto, factor = 1) {
  const dxf = new DxfParser().parseSync(texto)
  const lista = []
  for (const e of dxf?.entities ?? []) {
    if ((e.type !== 'LWPOLYLINE' && e.type !== 'POLYLINE') || !Array.isArray(e.vertices) || e.vertices.length < 3) continue
    const vertices = e.vertices.map((v) => [v.x * factor, v.y * factor])
    const { area } = areaPoligono(vertices)
    if (area <= 0) continue
    lista.push({ capa: e.layer ?? '0', cerrada: !!e.shape, vertices, area, nVertices: vertices.length })
  }
  const esTerreno = (p) => /terreno|predio|lote/i.test(p.capa)
  return lista.sort((a, b) => Number(esTerreno(b)) - Number(esTerreno(a)) || b.area - a.area)
}
