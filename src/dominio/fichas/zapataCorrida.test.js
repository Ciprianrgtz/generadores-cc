import { describe, expect, it } from 'vitest'
import { analizarZapataCorrida, aceroZapata } from './zapataCorrida.js'

// Pesos usados en la plantilla de generadores de la oficina
const varillas = { 2: { kg_m: 0.251 }, 3: { kg_m: 0.557 }, 4: { kg_m: 0.994 } }

describe('Golden test · Casa Bielva · ZC-01 (CIM05D′)', () => {
  const ficha = analizarZapataCorrida({
    seccion: { ancho: 0.8, peralte: 0.2 },
    transversal: { varilla: '3', separacion: 0.2 },
    longitudinal: { varilla: '3', separacion: 0.2 },
    varillas,
  })

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
})
