import { describe, expect, it } from 'vitest'
import { agruparCopias, analizarBastones, clasesDeRectangulos, esDudosa, girarZona, grupoDelConcepto, huellaDeZona, numerarTipos, origenSugerido, piezasPorMetro, zonasDeCopia } from './bastones.js'

const KG_M_3 = 0.557

// Las 23 zonas que Ciprian dibujó sobre una copia de la planta de Bielva (cian = CC, azul = CI):
// [color, x0, x1, y0, y1] en coordenadas del DXF estructural.
const ZONAS_DXF = [
  [4, -152.399, -147.959, 113.935, 114.785], [4, -152.399, -151.249, 111.515, 114.785], [4, -149.109, -147.959, 111.665, 114.785],
  [5, -152.399, -149.129, 110.965, 112.365], [4, -148.509, -147.959, 109.845, 111.665], [5, -149.979, -148.779, 109.845, 111.515],
  [4, -152.399, -151.549, 109.845, 111.515], [5, -149.129, -148.049, 108.775, 110.425], [4, -152.399, -149.129, 109.845, 110.395],
  [4, -148.049, -145.399, 108.775, 110.025], [4, -146.399, -145.399, 100.605, 110.025], [4, -152.399, -149.129, 104.595, 105.245],
  [4, -152.399, -151.549, 103.575, 105.245], [5, -149.979, -148.129, 100.695, 105.245], [5, -152.399, -149.129, 102.725, 104.025],
  [4, -152.399, -151.549, 100.295, 103.575], [4, -149.129, -145.399, 100.605, 101.755], [5, -152.399, -151.329, 100.095, 101.145],
  [4, -149.639, -149.039, 99.605, 100.695], [4, -151.329, -149.039, 99.605, 100.605], [5, -151.629, -150.729, 99.605, 100.295],
  [4, -152.399, -152.099, 99.605, 100.295], [4, -152.399, -151.329, 99.605, 99.805],
].map(([color, x0, x1, y0, y1]) => ({ capa: '0', color, x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 }))

// Una copia igual, mucho más a la derecha: no debe mezclarse con la primera.
const OTRA_COPIA = ZONAS_DXF.map((r) => ({ ...r, x0: r.x0 + 200, x1: r.x1 + 200 }))

const CLASES = [
  { clave: '0|4', capa: '0', color: 4, n: 16, grupo: 'CC' },
  { clave: '0|5', capa: '0', color: 5, n: 7, grupo: 'CI' },
]
const NEODATA = { piezasPorMetro: 7, gancho: 0 } // Neodata: 7 varillas por metro capturadas a mano y sin escuadra

const zonasBielva = () => {
  const [copia] = agruparCopias(ZONAS_DXF)
  return zonasDeCopia(copia, CLASES, { x: copia.x0, y: 94.654 })
}
// Neodata: CI-3 y CI-6 son casi cuadradas y su bastón es el lado largo / el otro; se giran a mano
const corregidas = () => zonasBielva().map((z) => (z.grupo === 'CI' && ((z.largo === 1.08 && z.ml === 1.65) || (z.largo === 1.05 && z.ml === 1.07)) ? girarZona(z) : z))

describe('Bastones de losa de cimentación · cálculo', () => {
  it('varillas por metro: 1 ÷ separación + 1 redondeado hacia arriba (8), o el número que se capture', () => {
    expect(piezasPorMetro({})).toBe(8) // criterios de la oficina: #3 @ 15 → 7.67 → 8
    expect(piezasPorMetro({ redondearArriba: false })).toBeCloseTo(7.6667, 4)
    expect(piezasPorMetro({ sumarUna: false })).toBe(7) // 6.67 → 7
    expect(piezasPorMetro({ separacion: 0.2 })).toBe(6) // 1 ÷ 0.20 + 1 = 6, ya entero
    expect(piezasPorMetro({ piezasPorMetro: 7 })).toBe(7)
  })

  it('con los criterios de la oficina: 8 varillas por metro y escuadra de 5 cm (CC-1: 11.06 ml de 0.85 m = 45.69 kg)', () => {
    const r = analizarBastones({ zonas: [{ tipo: 'CC-1', largo: 0.85, ml: 11.06 }], kgM: KG_M_3 })
    // 11.06 ml × 8 × (0.85 + 0.05) m × 0.557 kg/m × 1.03
    expect(r.total).toBeCloseTo(11.06 * 8 * 0.9 * 0.557 * 1.03, 8)
    expect(r.cantidad).toBe(45.69)
    expect(r.formulaPiezas).toBe('1.00 ÷ 0.15 + 1 = 7.6667 → 8.00 var/ml (hacia arriba)')
    expect(r.filas[0].formula).toBe('11.06 ml × 8.00 var/ml × 0.90 m × 0.557 kg/m × 1.03 = 45.69 kg')
  })

  it('Bielva con los criterios de la oficina: CC y CI en kg', () => {
    const esperado = (zonas) => zonas.reduce((s, z) => s + z.ml * 8 * (z.largo + 0.05) * KG_M_3 * 1.03, 0)
    const cc = zonasBielva().filter((z) => z.grupo === 'CC')
    const ci = corregidas().filter((z) => z.grupo === 'CI')
    expect(analizarBastones({ zonas: cc, kgM: KG_M_3 }).total).toBeCloseTo(esperado(cc), 8)
    expect(analizarBastones({ zonas: ci, kgM: KG_M_3 }).total).toBeCloseTo(esperado(ci), 8)
    expect(analizarBastones({ zonas: cc, kgM: KG_M_3 }).cantidad).toBeGreaterThan(168.92) // más que Neodata con sus propios datos (7 var/ml, sin escuadra)
  })

  it('la escuadra se multiplica por las escuadras de cada bastón (0 = bastón recto)', () => {
    const z = [{ tipo: 'CC-1', largo: 1, ml: 2 }]
    const una = analizarBastones({ zonas: z, criterios: { piezasPorMetro: 8, escuadras: 1 }, kgM: KG_M_3 }).total
    const dos = analizarBastones({ zonas: z, criterios: { piezasPorMetro: 8, escuadras: 2 }, kgM: KG_M_3 }).total
    const recto = analizarBastones({ zonas: z, criterios: { piezasPorMetro: 8, escuadras: 0 }, kgM: KG_M_3 }).total
    expect(una / recto).toBeCloseTo(1.05, 10)
    expect(dos / recto).toBeCloseTo(1.1, 10)
  })

  it('una zona: ml × varillas × largo × kg/m × 1.03 (CC-1 de Neodata: 11.06 ml de 0.85 m = 37.754 kg)', () => {
    const r = analizarBastones({ zonas: [{ tipo: 'CC-1', largo: 0.85, ml: 11.06 }], criterios: NEODATA, kgM: KG_M_3 })
    expect(r.total).toBeCloseTo(37.754134, 5)
    expect(r.filas[0].formula).toBe('11.06 ml × 7.00 var/ml × 0.85 m × 0.557 kg/m × 1.03 = 37.75 kg')
  })

  it('el gancho se suma al largo de cada bastón', () => {
    const base = analizarBastones({ zonas: [{ tipo: 'CC-1', largo: 1, ml: 2 }], criterios: { ...NEODATA, gancho: 0 }, kgM: KG_M_3 })
    const conGancho = analizarBastones({ zonas: [{ tipo: 'CC-1', largo: 1, ml: 2 }], criterios: { ...NEODATA, gancho: 0.1 }, kgM: KG_M_3 })
    expect(conGancho.total / base.total).toBeCloseTo(1.1, 10)
  })

  it('agrupa por tipo, deja fuera lo desmarcado y da el desglose por diámetro', () => {
    const r = analizarBastones({
      zonas: [
        { tipo: 'CC-1', largo: 0.85, ml: 4 },
        { tipo: 'CC-1', largo: 0.85, ml: 6 },
        { tipo: 'CC-2', largo: 1.15, ml: 3, incluir: false },
        { tipo: 'CC-3', largo: 0, ml: 5 },
      ],
      criterios: { ...NEODATA, varilla: '4' },
      kgM: 0.994,
    })
    expect(r.porTipo).toHaveLength(1)
    expect(r.porTipo[0]).toMatchObject({ tipo: 'CC-1', zonas: 2, ml: 10 })
    expect(Object.keys(r.porDiametro)).toEqual(['4'])
    expect(r.porDiametro['4']).toBeCloseTo(r.total, 10)
  })

  it('Bielva CC: las 16 zonas de tu dibujo dan los 9 tipos y los ml de Neodata (168.92 kg con sus propios datos)', () => {
    const zonas = zonasBielva().filter((z) => z.grupo === 'CC')
    const r = analizarBastones({ zonas, criterios: NEODATA, kgM: KG_M_3 })
    expect(r.porTipo.map((t) => [t.tipo, t.largo, Math.round(t.ml * 100) / 100])).toEqual([
      ['CC-1', '0.85', 11.06],
      ['CC-2', '1.15', 10.12],
      ['CC-3', '0.55', 5.09],
      ['CC-4', '1.25', 2.65],
      ['CC-5', '1', 11.71],
      ['CC-6', '0.65', 3.27],
      ['CC-7', '0.6', 1.09],
      ['CC-8', '0.3', 0.69],
      ['CC-9', '0.2', 1.07],
    ])
    expect(r.ml).toBeCloseTo(46.75, 6)
    expect(r.cantidad).toBe(168.92) // Neodata trae 171.72: usa valores capturados a mano con el 1.03 aplicado dos veces
  })

  it('Bielva CI: con CI-3 y CI-6 girados, 7 tipos y 91.47 kg (Neodata trae 94.97)', () => {
    const zonas = corregidas().filter((z) => z.grupo === 'CI')
    const r = analizarBastones({ zonas, criterios: NEODATA, kgM: KG_M_3 })
    expect(r.porTipo.map((t) => [t.tipo, Math.round(t.ml * 100) / 100])).toEqual([
      ['CI-1', 3.27],
      ['CI-2', 1.67],
      ['CI-3', 1.08],
      ['CI-4', 4.55],
      ['CI-5', 3.27],
      ['CI-6', 1.05],
      ['CI-7', 0.9],
    ])
    expect(r.cantidad).toBe(91.47)
  })
})

describe('Bastones de losa de cimentación · zonas del DXF', () => {
  it('cada copia de la planta es un grupo aparte; las demás se pueden ignorar', () => {
    const copias = agruparCopias([...ZONAS_DXF, ...OTRA_COPIA])
    expect(copias).toHaveLength(2)
    expect(copias.map((c) => c.rects.length)).toEqual([23, 23])
    expect(copias[0].x0).toBeLessThan(copias[1].x0)
  })

  it('sugiere CC y CI por el número de rectángulos de cada capa y color', () => {
    const clases = clasesDeRectangulos(ZONAS_DXF)
    expect(clases.map((c) => [c.color, c.n, c.grupo])).toEqual([[4, 16, 'CC'], [5, 7, 'CI']])
  })

  it('el origen sale del borde izquierdo de las zonas y del primer eje horizontal de la planta que las cubre', () => {
    const [copia] = agruparCopias(ZONAS_DXF)
    const planta = { origen: { x: -124.9545, y: 94.6538 }, verticales: [], horizontales: [{ pos: 94.6538 }, { pos: 114.6538 }] }
    expect(origenSugerido(copia, [planta])).toEqual({ x: -152.399, y: 94.654 })
    expect(origenSugerido(copia, [])).toEqual({ x: -152.399, y: 99.605 })
  })

  it('las zonas quedan en coordenadas del proyecto, con el lado corto como largo del bastón', () => {
    const zonas = zonasBielva()
    expect(zonas).toHaveLength(23)
    expect(zonas[0]).toMatchObject({ grupo: 'CC', tipo: 'CC-1', largo: 0.85, ml: 4.44, rect: { x0: 0, x1: 4.44, y0: 19.281, y1: 20.131 } })
    expect(huellaDeZona(zonas[0])[0][0]).toHaveLength(4)
  })

  it('avisa de las zonas casi cuadradas, donde no se sabe cuál lado es el bastón', () => {
    expect(esDudosa(1.08, 1.65)).toBe(true)
    expect(esDudosa(1.07, 1.05)).toBe(true)
    expect(esDudosa(0.85, 4.44)).toBe(false)
    const dudosas = zonasBielva().filter((z) => z.dudosa).map((z) => z.tipo)
    expect(dudosas).toContain('CI-3')
    expect(dudosas).toContain('CI-6')
  })

  it('numera un tipo por cada largo distinto, en el orden en que aparecen', () => {
    const z = numerarTipos([{ grupo: 'CC', largo: 0.85 }, { grupo: 'CI', largo: 1.4 }, { grupo: 'CC', largo: 1.15 }, { grupo: 'CC', largo: 0.85 }])
    expect(z.map((x) => x.tipo)).toEqual(['CC-1', 'CI-1', 'CC-2', 'CC-1'])
  })

  it('girar intercambia el largo del bastón y los ml', () => {
    expect(girarZona({ largo: 1.08, ml: 1.65 })).toMatchObject({ largo: 1.65, ml: 1.08 })
  })

  it('el grupo sale de la descripción del concepto', () => {
    expect(grupoDelConcepto('ACERO DE REFUERZO EN LOSA DE CIMENTACION COLINDANTE CC-01 DE (LONGITUD = LARGO DEL CLARO / 4)')).toBe('CC')
    expect(grupoDelConcepto('ACERO DE REFUERZO EN LOSA DE CIMENTACION INTERMEDIA CI-01 DE (LONGITUD = LARGO DEL CLARO / 4)')).toBe('CI')
    expect(grupoDelConcepto('Excavación')).toBeNull()
  })
})
