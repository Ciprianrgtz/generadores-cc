import DxfParser from 'dxf-parser'
import { dato, fmt, r2 } from './redondeo.js'

/**
 * Bastones de la losa de cimentación (CC colindante, CI intermedia).
 *
 * El estructural pide malla electrosoldada arriba y bayonetas abajo; en obra se dejan bastones en
 * lugar de bayonetas. Cada bastón mide el claro ÷ 4 (se redondea a una medida práctica) y se pone
 * a lo largo de una franja de la losa:
 *
 *   kg de una zona = ml de la franja × varillas por metro × (largo del bastón + gancho) × kg/m × (1 + desperdicio)
 *
 *   · Varillas por metro = 1.00 ÷ separación + 1 (se suma una), redondeado hacia arriba (7.67 → 8),
 *     o el número que se capture. Neodata tiene 7 capturadas a mano.
 *   · Cada bastón lleva una escuadra a 90° de 5 cm (criterio de la oficina); Neodata no la cuenta.
 *   · El largo de la zona ya es el del bastón completo: en CI (intermedia) el rectángulo abarca los
 *     dos claros, con el claro ÷ 4 hacia cada habitación.
 *   · Cada zona es un rectángulo dibujado en el plano: su lado corto suele ser el largo del bastón
 *     y el largo, los ml de la franja. Si es casi cuadrado, hay que revisar cuál es cuál.
 */
export const CRITERIOS_BASTONES = {
  varilla: '3',
  separacion: 0.15, // m
  sumarUna: true, // 1.00 ÷ sep + 1
  redondearArriba: true, // 7.67 varillas por metro → 8
  piezasPorMetro: null, // número capturado; vacío = se calcula con la separación
  gancho: 0.05, // m: largo de cada escuadra a 90°
  escuadras: 1, // escuadras por bastón
  desperdicio: 0.03, // fracción
}

/** Varillas que lleva cada metro de franja. */
export function piezasPorMetro(criterios) {
  const c = { ...CRITERIOS_BASTONES, ...criterios }
  if (c.piezasPorMetro > 0) return c.piezasPorMetro
  if (!(c.separacion > 0)) return 0
  const n = 1 / c.separacion + (c.sumarUna ? 1 : 0)
  return c.redondearArriba ? Math.ceil(n - 1e-9) : n
}

export function analizarBastones({ zonas = [], criterios, kgM }) {
  const c = { ...CRITERIOS_BASTONES, ...criterios }
  const n = piezasPorMetro(c)
  const fd = 1 + c.desperdicio
  const kgMv = Number(kgM) > 0 ? Number(kgM) : 0
  const filas = zonas.map((z) => {
    const ml = Number(z.ml)
    const largo = Number(z.largo)
    const valido = ml > 0 && largo > 0 && n > 0 && kgMv > 0
    const barra = largo + (c.gancho > 0 ? c.gancho * (c.escuadras >= 0 ? c.escuadras : 1) : 0)
    const kg = valido ? ml * n * barra * kgMv * fd : 0
    const formula = valido
      ? `${dato(ml)} ml × ${dato(Math.round(n * 1e4) / 1e4)} var/ml × ${dato(Math.round(barra * 1e4) / 1e4)} m × ${dato(kgMv)} kg/m × ${dato(Math.round(fd * 1e4) / 1e4)} = ${fmt(kg)} kg`
      : ''
    return { ...z, ml, largo, valido, kg, formula }
  })
  const usadas = filas.filter((f) => f.valido && f.incluir !== false)

  const tipos = new Map()
  for (const f of usadas) {
    const clave = String(f.tipo ?? '').trim() || 'sin tipo'
    const t = tipos.get(clave) ?? { tipo: clave, largos: new Set(), zonas: 0, ml: 0, kg: 0 }
    t.largos.add(Math.round(f.largo * 1000) / 1000)
    t.zonas++
    t.ml += f.ml
    t.kg += f.kg
    tipos.set(clave, t)
  }
  const porTipo = [...tipos.values()].map((t) => ({ tipo: t.tipo, largo: [...t.largos].join(' / '), zonas: t.zonas, ml: t.ml, kg: t.kg, kgMl: t.ml > 0 ? t.kg / t.ml : 0 }))

  const total = usadas.reduce((s, f) => s + f.kg, 0)
  const ml = usadas.reduce((s, f) => s + f.ml, 0)
  const formula = porTipo.length
    ? `${porTipo.map((t) => `${t.tipo} ${fmt(t.kg)}`).join(' + ')} = ${fmt(total)} kg`
    : 'Falta capturar zonas con largo de bastón y ml'
  return {
    filas,
    porTipo,
    ml,
    total,
    cantidad: r2(total),
    porDiametro: total > 0 ? { [c.varilla]: total } : {},
    piezasPorMetro: n,
    formula,
    formulaPiezas: formulaPiezas(c, n),
  }
}

/** Cómo salen las varillas por metro, con el cálculo escrito. */
function formulaPiezas(c, n) {
  if (c.piezasPorMetro > 0) return `${dato(n)} var/ml (capturado)`
  const crudo = c.separacion > 0 ? 1 / c.separacion + (c.sumarUna ? 1 : 0) : 0
  const base = `1.00 ÷ ${dato(c.separacion)}${c.sumarUna ? ' + 1' : ''} = ${dato(Math.round(crudo * 1e4) / 1e4)}`
  return c.redondearArriba && n !== crudo ? `${base} → ${dato(n)} var/ml (hacia arriba)` : `${base} var/ml`
}

/** Un rectángulo casi cuadrado no dice cuál lado es el bastón: hay que revisarlo. */
export const esDudosa = (a, b) => Math.max(a, b) / Math.max(Math.min(a, b), 1e-9) < 1.6

/** Intercambia el largo del bastón y los ml de la franja de una zona. */
export const girarZona = (z) => ({ ...z, largo: z.ml, ml: z.largo })

/** Las zonas de un grupo, con tipo «CC-1», «CC-2»… por cada largo de bastón distinto, en el orden en que aparecen. */
export function numerarTipos(zonas) {
  const vistos = {}
  return zonas.map((z) => {
    const g = z.grupo
    const lista = (vistos[g] ??= [])
    const largo = Math.round(Number(z.largo) * 100) / 100
    let i = lista.indexOf(largo)
    if (i < 0) i = lista.push(largo) - 1
    return { ...z, tipo: `${g}-${i + 1}` }
  })
}

// ---------------------------------------------------------------------------------------------
// Lectura del DXF: las zonas están dibujadas como rectángulos cerrados; cada copia de la planta
// con sus zonas es un grupo de rectángulos cercanos entre sí.
// ---------------------------------------------------------------------------------------------

/** Rectángulos cerrados con lados paralelos a los ejes del dibujo, ya en metros. */
export function leerRectangulosDxf(texto, factor = 1) {
  const dxf = new DxfParser().parseSync(texto)
  const rects = []
  for (const e of dxf?.entities ?? []) {
    if ((e.type !== 'LWPOLYLINE' && e.type !== 'POLYLINE') || !e.shape || !e.vertices?.length) continue
    const v = e.vertices
    const pts = v.length === 5 && Math.hypot(v[0].x - v[4].x, v[0].y - v[4].y) < 1e-6 ? v.slice(0, 4) : v
    if (pts.length !== 4) continue
    const xs = [...new Set(pts.map((p) => Math.round(p.x * 1000)))]
    const ys = [...new Set(pts.map((p) => Math.round(p.y * 1000)))]
    if (xs.length !== 2 || ys.length !== 2) continue
    const x0 = (Math.min(...xs) / 1000) * factor
    const x1 = (Math.max(...xs) / 1000) * factor
    const y0 = (Math.min(...ys) / 1000) * factor
    const y1 = (Math.max(...ys) / 1000) * factor
    const w = x1 - x0
    const h = y1 - y0
    if (!Number.isFinite(w * h) || w < 0.1 || h < 0.1 || w * h < 0.05) continue
    rects.push({ capa: e.layer ?? '0', color: e.colorIndex ?? e.color ?? null, x0, y0, x1, y1, w, h })
  }
  return rects
}

/** Los rectángulos que están a menos de `hueco` m unos de otros forman una copia de la planta. */
export function agruparCopias(rects, hueco = 2) {
  const padre = rects.map((_, i) => i)
  const raiz = (i) => (padre[i] === i ? i : (padre[i] = raiz(padre[i])))
  const cerca = (a, b) => a.x0 - hueco <= b.x1 && b.x0 - hueco <= a.x1 && a.y0 - hueco <= b.y1 && b.y0 - hueco <= a.y1
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (cerca(rects[i], rects[j])) padre[raiz(i)] = raiz(j)
  const grupos = new Map()
  rects.forEach((r, i) => grupos.set(raiz(i), [...(grupos.get(raiz(i)) ?? []), r]))
  return [...grupos.values()]
    .map((rs) => ({
      rects: rs,
      x0: Math.min(...rs.map((r) => r.x0)),
      x1: Math.max(...rs.map((r) => r.x1)),
      y0: Math.min(...rs.map((r) => r.y0)),
      y1: Math.max(...rs.map((r) => r.y1)),
    }))
    .sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0)
}

/**
 * Capa y color de los rectángulos que pueden ser zonas, con cuántos son: los de color explícito (los
 * dibujados a mano con un color) y los de una capa de bastones («CC-BASTON-CC», «CC-BASTON-CI»).
 * Si la capa dice a qué grupo pertenece se asigna sola; los de color, en orden de cantidad: CC y luego CI.
 */
export function clasesDeRectangulos(rects) {
  const m = new Map()
  for (const r of rects) {
    const k = `${r.capa}|${r.color ?? ''}`
    m.set(k, { clave: k, capa: r.capa, color: r.color, n: (m.get(k)?.n ?? 0) + 1 })
  }
  const nombre = (capa) => String(capa).toUpperCase().replace(/^CC-\s*/, '') // «CC-» es el prefijo de capas de la oficina
  const deBastones = (c) => /BAST/.test(nombre(c.capa))
  const porNombre = (c) => (!deBastones(c) ? '' : /COLINDANTE|\bCC\b/.test(nombre(c.capa)) ? 'CC' : /INTERMEDIA|\bCI\b/.test(nombre(c.capa)) ? 'CI' : '')
  const lista = [...m.values()].filter((c) => c.color != null || deBastones(c)).sort((a, b) => b.n - a.n)
  const libres = ['CC', 'CI'].filter((g) => !lista.some((c) => porNombre(c) === g))
  return lista.map((c) => ({ ...c, grupo: porNombre(c) || (c.color != null && !deBastones(c) ? libres.shift() ?? '' : '') }))
}

/** Dónde queda el 0,0 del proyecto en esa copia: el borde izquierdo de sus zonas y el primer eje horizontal de la planta más cercana. */
export function origenSugerido(copia, plantas = []) {
  const solape = (p) => {
    const ys = p.horizontales.map((e) => e.pos)
    return Math.min(copia.y1, Math.max(...ys)) - Math.max(copia.y0, Math.min(...ys))
  }
  const mejor = plantas.filter((p) => solape(p) > 0).sort((a, b) => solape(b) - solape(a))[0]
  return { x: Math.round(copia.x0 * 1000) / 1000, y: Math.round((mejor?.origen.y ?? copia.y0) * 1000) / 1000 }
}

/**
 * Zonas de una copia en coordenadas del proyecto. `clases` dice a qué grupo (CC, CI) pertenece cada
 * capa+color; los demás rectángulos se ignoran. El lado corto queda como largo del bastón.
 */
export function zonasDeCopia(copia, clases, origen) {
  const grupoDe = Object.fromEntries(clases.filter((c) => c.grupo).map((c) => [c.clave, c.grupo]))
  const r3 = (n) => Math.round(n * 1000) / 1000
  const zonas = copia.rects
    .filter((r) => grupoDe[`${r.capa}|${r.color ?? ''}`])
    .sort((a, b) => b.y1 - a.y1 || a.x0 - b.x0)
    .map((r) => ({
      grupo: grupoDe[`${r.capa}|${r.color ?? ''}`],
      largo: r3(Math.min(r.w, r.h)),
      ml: r3(Math.max(r.w, r.h)),
      rect: { x0: r3(r.x0 - origen.x), y0: r3(r.y0 - origen.y), x1: r3(r.x1 - origen.x), y1: r3(r.y1 - origen.y) },
      dudosa: esDudosa(r.w, r.h),
      incluir: true,
    }))
  return numerarTipos(zonas)
}

/** Anillo de la zona en planta, listo para dibujar (coordenadas del proyecto). */
export const huellaDeZona = (z) => (z.rect ? [[[[z.rect.x0, z.rect.y0], [z.rect.x1, z.rect.y0], [z.rect.x1, z.rect.y1], [z.rect.x0, z.rect.y1]]]] : null)

/** El grupo (CC o CI) que menciona un concepto: «…LOSA DE CIMENTACION COLINDANTE CC-01…» → CC. */
export function grupoDelConcepto(descripcion) {
  const t = String(descripcion ?? '')
  if (/\bCI\s*-?\s*\d|intermedia/i.test(t)) return 'CI'
  if (/\bCC\s*-?\s*\d|colindante/i.test(t)) return 'CC'
  return null
}
