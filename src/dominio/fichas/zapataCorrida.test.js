import { describe, expect, it } from 'vitest'
import { analizarZapataCorrida, aceroZapata, despieceReal } from './zapataCorrida.js'
import { diametroM, posicionesLongitudinales, posicionesTransversales } from './zapataGeometria.js'

// Pesos usados en la plantilla de generadores de la oficina
const varillas = { 2: { kg_m: 0.251 }, 3: { kg_m: 0.557 }, 4: { kg_m: 0.994 } }

const zc01 = () =>
  analizarZapataCorrida({
    seccion: { ancho: 0.8, peralte: 0.2 },
    transversal: { varilla: '3', separacion: 0.2 },
    longitudinal: { varilla: '3', separacion: 0.2 },
    varillas,
  })

describe('Golden test · Casa Bielva · ZC-01 (CIM05D′)', () => {
  const ficha = zc01()

  it('reproduce los pasos de la plantilla', () => {
    expect(ficha.nT).toBeCloseTo(6, 10)
    expect(ficha.lenT).toBeCloseTo(1.12, 10)
    expect(ficha.kgT).toBeCloseTo(3.855331, 6)
    expect(ficha.nL).toBeCloseTo(5, 10)
    expect(ficha.lenL).toBeCloseTo(1.16, 10)
    expect(ficha.kgL).toBeCloseTo(3.327518, 6)
    expect(ficha.kgMl).toBeCloseTo(7.182849, 6)
  })

  it('21.71 ml dan 155.94 kg, igual que Neodata', () => {
    expect(aceroZapata(21.71, ficha).kg).toBe(155.94)
  })

  it('separa el desperdicio del 3 %', () => {
    expect(ficha.kgMl / ficha.kgMlNeto).toBeCloseTo(1.03, 10)
  })
})

describe('Geometría del esquema (solo coloca lo que la ficha contó)', () => {
  it('ZC-01: 6 transversales en el metro y 5 longitudinales en 0.80 m', () => {
    const t = posicionesTransversales(1, 0.2)
    expect(t.xs.length).toBe(6)
    expect(t.xs[5]).toBeCloseTo(1, 10)
    expect(t.fraccion).toBe(0)
    const l = posicionesLongitudinales(0.8, 0.2, 0.02)
    expect(l.ys.length).toBe(5)
    expect(l.ys[0]).toBeCloseTo(0.02, 10)
    expect(l.ys[4]).toBeCloseTo(0.78, 10)
  })

  it('con separación 0.15 hay 7 enteras y 0.67 de varilla punteada, igual que la ficha', () => {
    const t = posicionesTransversales(1, 0.15)
    expect(t.xs.length).toBe(7)
    expect(t.fraccion).toBeCloseTo(0.6667, 3)
    expect(t.n).toBeCloseTo(analizarZapataCorrida({
      seccion: { ancho: 0.8, peralte: 0.2 },
      transversal: { varilla: '3', separacion: 0.15 },
      longitudinal: { varilla: '3', separacion: 0.2 },
      varillas,
    }).nT, 10)
  })

  it('el diámetro sale de la tabla o, si falta, del peso (#3 ≈ 9.5 mm)', () => {
    expect(diametroM({ diametro_mm: 9.5, kg_m: 0.557 })).toBeCloseTo(0.0095, 6)
    expect(diametroM({ kg_m: 0.557 }) * 1000).toBeCloseTo(9.5, 0)
  })
})

describe('Despiece real de la ZC-01 por tramos del DXF', () => {
  const ficha = zc01()
  const d = despieceReal([4.82, 4.6, 4.97, 4.76, 2.56], ficha, varillas)

  it('los tramos suman los 21.71 ml del generador', () => {
    expect(d.ml).toBeCloseTo(21.71, 10)
  })

  it('cuenta 115 varillas cortas en lugar de 130.26', () => {
    expect(d.filas.reduce((s, f) => s + f.nT, 0)).toBe(115)
  })

  it('el análisis por metro queda arriba del despiece real', () => {
    expect(d.diferencia).toBeGreaterThan(0)
  })
})
