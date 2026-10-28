import DxfParser from 'dxf-parser'
import { dato } from './redondeo.js'

/**
 * Ejes del proyecto: son el sistema de coordenadas de la obra (en metros, el mismo del terreno).
 *   { verticales: [{ nombre, pos }],   // ejes que corren a lo largo de y; pos = x
 *     horizontales: [{ nombre, pos }] } // ejes que corren a lo largo de x; pos = y
 * Cada renglón de un generador se ubica con su eje, entre qué ejes va y su desfase,
 * de modo que el dibujo sale de los mismos datos que el cálculo.
 */

const limpiarTexto = (t) =>
  String(t ?? '')
    .replace(/\\[A-Za-z][^;\\]*;/g, '')
    .replace(/\\P/g, ' ')
    .replace(/[{}]/g, '')
    .trim()
// X-00, A-1, 1, A, B', EJE 3 …
const ES_EJE = /^(?:EJE\s*)?(?:[A-Z]{1,2}-?\d{1,3}'?|\d{1,3}'?|[A-Z]{1,2}'?)$/i

/**
 * Lee los ejes de un DXF. Cada etiqueta de eje se asigna a la línea de eje que remata cerca de ella;
 * las líneas que se cruzan forman una planta. Devuelve las plantas encontradas, la más completa primero.
 * `factor` pasa las unidades del dibujo a metros.
 */
export function leerEjesDxf(texto, factor = 1) {
  return plantasDeEjes(texto, factor)
    .map(({ verticales, horizontales }) => ({ verticales, horizontales }))
    .filter((p, i, xs) => xs.findIndex((q) => firma(q) === firma(p)) === i) // la misma planta repetida en otro lugar del dibujo
}

/**
 * Todas las plantas del DXF, también las copias de la misma planta en otros lugares del dibujo,
 * cada una con su `origen` (donde cae su 0,0: primer eje vertical y primer eje horizontal).
 * Sirve para llevar a coordenadas del proyecto lo que se dibujó sobre una copia.
 */
export function plantasDeEjesDxf(texto, factor = 1) {
  return plantasDeEjes(texto, factor).map((p) => ({ ...p, origen: { x: p.verticales[0].pos, y: p.horizontales[0].pos } }))
}

function plantasDeEjes(texto, factor) {
  const dxf = new DxfParser().parseSync(texto)
  const ents = dxf?.entities ?? []
  const deEjes = (e) => /eje/i.test(e.layer ?? '')
  const hayCapaEjes = ents.some(deEjes)

  // líneas de eje: rectas horizontales o verticales de más de 1.5 m
  const lineas = []
  for (const e of ents) {
    if (hayCapaEjes && !deEjes(e)) continue
    let pts = null
    if (e.type === 'LINE' && e.vertices?.length === 2) pts = e.vertices
    else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices?.length === 2) pts = e.vertices
    if (!pts) continue
    const [a, b] = pts.map((p) => ({ x: p.x * factor, y: p.y * factor }))
    const dx = b.x - a.x
    const dy = b.y - a.y
    const largo = Math.hypot(dx, dy)
    if (largo < 1.5) continue
    if (Math.abs(dx) < largo * 0.01) lineas.push({ orient: 'v', pos: (a.x + b.x) / 2, min: Math.min(a.y, b.y), max: Math.max(a.y, b.y) })
    else if (Math.abs(dy) < largo * 0.01) lineas.push({ orient: 'h', pos: (a.y + b.y) / 2, min: Math.min(a.x, b.x), max: Math.max(a.x, b.x) })
  }

  // cada etiqueta, a la línea que tiene alineada y que remata cerca
  const marcados = []
  for (const e of ents) {
    if ((e.type !== 'TEXT' && e.type !== 'MTEXT') || (hayCapaEjes && !deEjes(e))) continue
    const nombre = limpiarTexto(e.text).replace(/^EJE\s*/i, '').toUpperCase()
    if (!ES_EJE.test(nombre)) continue
    const p0 = e.position ?? e.startPoint
    if (!p0) continue
    const p = { x: p0.x * factor, y: p0.y * factor }
    let mejor = null
    for (const l of lineas) {
      const lateral = Math.abs((l.orient === 'v' ? p.x : p.y) - l.pos)
      const a = l.orient === 'v' ? p.y : p.x
      const fuera = Math.max(l.min - a, 0, a - l.max)
      if (lateral > 0.6 || fuera > 3) continue
      const nota = lateral + fuera * 0.2
      if (!mejor || nota < mejor.nota) mejor = { l, nota }
    }
    if (mejor) marcados.push({ nombre, linea: mejor.l })
  }

  // plantas: grupos de líneas marcadas que se cruzan entre sí
  const usadas = [...new Set(marcados.map((m) => m.linea))]
  const padre = new Map(usadas.map((l) => [l, l]))
  const raiz = (l) => (padre.get(l) === l ? l : raiz(padre.get(l)))
  const cruzan = (v, h) => v.pos >= h.min - 0.5 && v.pos <= h.max + 0.5 && h.pos >= v.min - 0.5 && h.pos <= v.max + 0.5
  for (const v of usadas.filter((l) => l.orient === 'v'))
    for (const h of usadas.filter((l) => l.orient === 'h')) if (cruzan(v, h)) padre.set(raiz(v), raiz(h))

  const grupos = new Map()
  for (const m of marcados) {
    const k = raiz(m.linea)
    const g = grupos.get(k) ?? { verticales: new Map(), horizontales: new Map() }
    const lista = m.linea.orient === 'v' ? g.verticales : g.horizontales
    if (!lista.has(m.nombre)) lista.set(m.nombre, m.linea.pos)
    grupos.set(k, g)
  }
  const ordenar = (mapa) => [...mapa].map(([nombre, pos]) => ({ nombre, pos: Math.round(pos * 10000) / 10000 })).sort((a, b) => a.pos - b.pos)
  return [...grupos.values()]
    .map((g) => ({ verticales: ordenar(g.verticales), horizontales: ordenar(g.horizontales) }))
    .filter((p) => p.verticales.length >= 2 && p.horizontales.length >= 2)
    .sort((a, b) => b.verticales.length + b.horizontales.length - (a.verticales.length + a.horizontales.length))
}
const firma = (p) => [...p.verticales, ...p.horizontales].map((e) => e.nombre).join(',')

/**
 * Mueve los ejes para que el primero de cada sentido quede en 0 y guarda dónde cayó ese 0
 * en el dibujo (origen_dxf), para llevar al mismo lugar lo que después se importe del DXF.
 */
export function ejesAlOrigen(ejes) {
  const dx = ejes.verticales[0]?.pos ?? 0
  const dy = ejes.horizontales[0]?.pos ?? 0
  const mover = (lista, d) => lista.map((e) => ({ ...e, pos: Math.round((e.pos - d) * 10000) / 10000 }))
  return { verticales: mover(ejes.verticales, dx), horizontales: mover(ejes.horizontales, dy), origen_dxf: { x: dx, y: dy } }
}

/** Pasa un punto de un DXF (ya en metros) a las coordenadas del proyecto. */
export const delDxf = (ejes, [x, y]) => {
  const o = ejes?.origen_dxf ?? { x: 0, y: 0 }
  return [Math.round((x - o.x) * 1e6) / 1e6, Math.round((y - o.y) * 1e6) / 1e6]
}

/** Dónde está un eje: { orient: 'v' | 'h', pos } o null. */
export function buscarEje(ejes, nombre) {
  const n = String(nombre ?? '').trim().toUpperCase()
  if (!n || !ejes) return null
  const v = ejes.verticales?.find((e) => e.nombre.toUpperCase() === n)
  if (v) return { orient: 'v', pos: v.pos }
  const h = ejes.horizontales?.find((e) => e.nombre.toUpperCase() === n)
  return h ? { orient: 'h', pos: h.pos } : null
}

/** Los ejes del otro sentido que se mencionan en «entre» («X-00 a X-01», «Y-03 a Y-04 (sin esquina)»). */
export function ejesDeEntre(ejes, entre, orient) {
  const lista = (orient === 'v' ? ejes?.horizontales : ejes?.verticales) ?? []
  const texto = String(entre ?? '').toUpperCase()
  return lista
    .map((e) => ({ ...e, i: buscarPalabra(texto, e.nombre.toUpperCase()) }))
    .filter((e) => e.i >= 0)
    .sort((a, b) => a.i - b.i)
    .slice(0, 2)
}
const buscarPalabra = (texto, palabra) => {
  const m = new RegExp(`(^|[^A-Z0-9-])${palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Z0-9])`).exec(texto)
  return m ? m.index + m[1].length : -1
}

/**
 * Huella en planta de un renglón ubicado por ejes: un rectángulo a lo largo del eje, del ancho de la cepa.
 *   · desfase: distancia del eje al centro de la cepa, positiva hacia donde crecen las coordenadas.
 *   · inicio: dónde arranca, medido desde el primer eje de «entre» hacia el segundo; vacío = centrado entre los dos.
 * Devuelve { huella, nota } o { huella: null, falta } con lo que impide ubicarlo.
 */
export function huellaPorEjes(r, ejes, anchoCepa) {
  const eje = buscarEje(ejes, r.eje)
  if (!eje) return { huella: null, falta: r.eje ? `El eje ${r.eje} no está en los ejes del proyecto` : 'Falta el eje' }
  const [a, b] = ejesDeEntre(ejes, r.entre, eje.orient)
  if (!a || !b) return { huella: null, falta: `Falta entre qué ejes va (${eje.orient === 'v' ? 'horizontales' : 'verticales'})` }
  const largo = Number(r.largo)
  if (!(largo > 0) || !(anchoCepa > 0)) return { huella: null, falta: 'Faltan largo o ancho' }
  const sentido = b.pos >= a.pos ? 1 : -1
  const inicio = Number.isFinite(r.inicio) ? a.pos + sentido * r.inicio : (a.pos + b.pos) / 2 - (sentido * largo) / 2
  const fin = inicio + sentido * largo
  const centro = eje.pos + (Number.isFinite(r.desfase) ? r.desfase : 0)
  const l1 = Math.min(inicio, fin)
  const l2 = Math.max(inicio, fin)
  const t1 = centro - anchoCepa / 2
  const t2 = centro + anchoCepa / 2
  const anillo = eje.orient === 'v' ? [[t1, l1], [t2, l1], [t2, l2], [t1, l2]] : [[l1, t1], [l2, t1], [l2, t2], [l1, t2]]
  const r6 = (n) => Math.round(n * 1e6) / 1e6
  return {
    huella: [[anillo.map(([x, y]) => [r6(x), r6(y)])]],
    nota: `${r.eje} en ${dato(eje.pos)}, de ${a.nombre} (${dato(a.pos)}) hacia ${b.nombre} (${dato(b.pos)})`,
  }
}
