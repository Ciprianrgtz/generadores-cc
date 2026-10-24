import { describe, expect, it } from 'vitest'
import { analizarZapataCorrida, aceroZapata, despieceReal } from './zapataCorrida.js'

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
