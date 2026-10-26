import { dato, fmt, r2 } from './redondeo.js'

/**
 * Excavación por elementos — método de la oficina (explicado por Ciprian, 26-oct-2026).
 *
 * Se excava todo elemento en contacto con el suelo (zapatas, trabes de liga,
 * contratrabes, plantillas…), sumando el volumen de cada uno:
 *   · No se sigue la forma del elemento en corte: se excava su ANCHO TOTAL
 *     (el más ancho de la sección) por la PROFUNDIDAD hasta su desplante.
 *   · A la profundidad se suma la plantilla de concreto que va debajo (5 cm).
 *   · Al ancho se suma un sobreancho de 10 cm por lado para maniobrar el armado,
 *     el colado y los amarres.
 *   · Si entre dos excavaciones queda menos de 35 cm de tierra, esa franja también
 *     se excava (en obra no se sostiene); su volumen cuenta como excavación y como relleno.
 *
 *   Volumen = largo × (ancho + 2·sobreancho) × (profundidad + plantilla) × piezas
 *
 * La profundidad de una zapata es la suma de las alturas de lo que lleva encima hasta
 * el NTN ±0.00 (zapata + muro de enrase + dala de desplante): esos elementos solo dan
 * altura; el ancho sigue siendo el de la zapata. Las contratrabes o trabes de liga que
 * caen dentro de la cepa de una zapata no se vuelven a excavar.
 *
 * Losa de cimentación con talud (CI, CC): se excava el ancho total por el alto total, sin
 * seguir los taludes y sin sobreancho ni plantilla (lleva nylon). Ej. CI-1: 0.25 × (0.40 +
 * 0.10 + 0.10). La contratrabe CT-2 que va dentro ya queda incluida. Esos renglones se
 * marcan con sobreancho = false y plantilla = false.
 *
 * Los elementos de superficie (el firme de concreto de 10 cm que va en toda el área
 * interior de la casa) se excavan por área, sin sobreancho ni plantilla:
 *   Volumen = área × espesor
 */
export const CRITERIOS_EXCAVACION = {
  sobreancho: 0.1, // m por lado
  plantilla: 0.05, // m de espesor bajo el elemento
  separacionMinima: 0.35, // m de tierra entre excavaciones
}

const n = (v) => (Number.isFinite(v) ? v : 0)

export function calcularRenglon(r, c) {
  const piezas = r.piezas > 0 ? r.piezas : 1
  const conSobreancho = r.sobreancho !== false
  const conPlantilla = r.plantilla !== false
  const ancho = n(r.ancho) + (conSobreancho ? 2 * c.sobreancho : 0)
  const alto = n(r.profundidad) + (conPlantilla ? c.plantilla : 0)
  const volumen = n(r.largo) * ancho * alto * piezas
  const valido = r.largo > 0 && r.ancho > 0 && r.profundidad > 0
  const tAncho = conSobreancho ? `(${dato(n(r.ancho))} + 2×${dato(c.sobreancho)})` : dato(n(r.ancho))
  const tAlto = conPlantilla ? `(${dato(n(r.profundidad))} + ${dato(c.plantilla)})` : dato(n(r.profundidad))
  const formula =
    `${dato(n(r.largo))} × ${tAncho} × ${tAlto}` +
    (piezas !== 1 ? ` × ${dato(piezas)}` : '') +
    ` = ${fmt(volumen)} m³`
  return { ...r, piezas, sobreancho: conSobreancho, plantilla: conPlantilla, anchoCepa: ancho, altoCepa: alto, volumen, valido, formula }
}

export function calcularSeparacion(s, c) {
  const entra = s.separacion > 0 && s.separacion < c.separacionMinima
  const alto = n(s.profundidad) + c.plantilla
  const volumen = entra ? n(s.largo) * s.separacion * alto : 0
  const formula = entra
    ? `${dato(n(s.largo))} × ${dato(s.separacion)} × (${dato(n(s.profundidad))} + ${dato(c.plantilla)}) = ${fmt(volumen)} m³`
    : `${dato(n(s.separacion))} m ≥ ${dato(c.separacionMinima)} m: la tierra se deja`
  return { ...s, entra, altoCepa: alto, volumen, formula }
}

export function calcularSuperficie(s) {
  const volumen = n(s.area) * n(s.espesor)
  const valido = s.area > 0 && s.espesor > 0
  const formula = `${dato(n(s.area))} m² × ${dato(n(s.espesor))} = ${fmt(volumen)} m³`
  return { ...s, volumen, valido, formula }
}

export function analizarExcavacion({ renglones = [], separaciones = [], superficies = [], criterios = {} }) {
  const c = { ...CRITERIOS_EXCAVACION, ...criterios }
  const filas = renglones.map((r) => calcularRenglon(r, c))
  const franjas = separaciones.map((s) => calcularSeparacion(s, c))
  const volElementos = filas.reduce((s, f) => s + (f.valido ? f.volumen : 0), 0)
  const volFranjas = franjas.reduce((s, f) => s + f.volumen, 0)
  const areas = superficies.map(calcularSuperficie)
  const volSuperficies = areas.reduce((s, f) => s + (f.valido ? f.volumen : 0), 0)
  const total = volElementos + volSuperficies + volFranjas

  // resumen por tipo de elemento (ZC, TL, CT…)
  const porElemento = {}
  for (const f of filas) {
    if (!f.valido) continue
    const k = (f.elemento || 'Sin tipo').trim()
    const x = (porElemento[k] ??= { ml: 0, volumen: 0 })
    x.ml += f.largo * f.piezas
    x.volumen += f.volumen
  }

  const partes = [`elementos ${fmt(volElementos)}`]
  if (volSuperficies > 0) partes.push(`superficies ${fmt(volSuperficies)}`)
  if (volFranjas > 0) partes.push(`franjas menores a ${dato(c.separacionMinima)} m ${fmt(volFranjas)}`)
  return {
    criterios: c,
    filas,
    franjas,
    areas,
    porElemento,
    volElementos,
    volSuperficies,
    volFranjas,
    rellenoFranjas: volFranjas,
    total,
    cantidad: r2(total),
    formula: `Excavación = ${partes.join(' + ')} = ${fmt(total)} m³`,
  }
}
