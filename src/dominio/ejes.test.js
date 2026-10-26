import { describe, expect, it } from 'vitest'
import { EXCAVACION_BIELVA } from './bielva/excavacion.js'
import { buscarEje, ejesAlOrigen, ejesDeEntre, huellaPorEjes } from './ejes.js'
import { calcularRenglon, CRITERIOS_EXCAVACION } from './excavacion.js'

// Ejes de Bielva como los lee leerEjesDxf del DXF estructural, con el 0,0 en Y-00 / X-00.
const BIELVA = ejesAlOrigen({
  verticales: [['Y-00', 48.299], ['Y-01', 49.369], ['Y-02', 51.569], ['Y-03', 52.649], ['Y-04', 55.299]].map(([nombre, pos]) => ({ nombre, pos })),
  horizontales: [['X-00', 59.932], ['X-01', 64.842], ['X-02', 65.442], ['X-03', 65.842], ['X-04', 68.722], ['X-05', 70.302], ['X-06', 75.082], ['X-07', 76.662], ['X-08', 79.932]].map(([nombre, pos]) => ({ nombre, pos })),
})
const caja = (h) => {
  const xs = h[0][0].map((p) => p[0])
  const ys = h[0][0].map((p) => p[1])
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map((n) => Math.round(n * 1000) / 1000)
}

describe('Ejes del proyecto', () => {
  it('al origen: el primer eje de cada sentido queda en 0 y se guarda dónde cayó en el DXF', () => {
    expect(BIELVA.verticales.map((e) => e.pos)).toEqual([0, 1.07, 3.27, 4.35, 7])
    expect(BIELVA.horizontales.at(-1).pos).toBe(20)
    expect(BIELVA.origen_dxf).toEqual({ x: 48.299, y: 59.932 })
  })

  it('busca el eje y los ejes de «entre», aunque traiga más texto', () => {
    expect(buscarEje(BIELVA, 'y-04')).toEqual({ orient: 'v', pos: 7 })
    expect(ejesDeEntre(BIELVA, 'Y-03 a Y-04 (sin esquina)', 'h').map((e) => e.nombre)).toEqual(['Y-03', 'Y-04'])
    expect(ejesDeEntre(BIELVA, 'X-01 a X-02', 'v').map((e) => e.nombre)).toEqual(['X-01', 'X-02'])
  })

  it('sin inicio la pieza va centrada entre los ejes; sin desfase, centrada en el eje', () => {
    const { huella } = huellaPorEjes({ eje: 'Y-02', entre: 'X-00 a X-01', largo: 2 }, BIELVA, 0.5)
    expect(caja(huella)).toEqual([3.02, 3.52, 1.455, 3.455])
  })

  it('avisa qué falta para ubicarla', () => {
    expect(huellaPorEjes({ eje: 'Z-9', entre: 'X-00 a X-01', largo: 1 }, BIELVA, 1).falta).toMatch(/no está/)
    expect(huellaPorEjes({ eje: 'Y-00', entre: '', largo: 1 }, BIELVA, 1).falta).toMatch(/entre/)
    expect(huellaPorEjes({ eje: 'Y-00', entre: 'X-00 a X-01', largo: 1 }, null, 1).huella).toBeNull()
  })

  it('Bielva: cada renglón cae donde está en el plano (cepas medidas en el DXF)', () => {
    const esperado = [
      [0, 0.9, 0, 4.82],
      [0, 0.9, 10.46, 15.06],
      [6.1, 7, 0, 4.97],
      [6.1, 7, 4.97, 5.82],
      [6.1, 7, 15.24, 20],
      [4.44, 6.1, 19.1, 20],
      [3.01, 3.46, 10.16, 15.24],
      [3.46, 7, 10.085, 10.535],
    ]
    EXCAVACION_BIELVA.renglones.forEach((r, i) => {
      const f = calcularRenglon(r, CRITERIOS_EXCAVACION)
      const got = caja(huellaPorEjes(f, BIELVA, f.anchoCepa).huella)
      got.forEach((v, k) => expect(v).toBeCloseTo(esperado[i][k], 2))
    })
  })
})
