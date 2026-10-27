import { describe, expect, it } from 'vitest'
import { analizarAreas, areaDeHuella, areasDeExcavacion } from './areas.js'
import { EXCAVACION_BIELVA } from './bielva/excavacion.js'

describe('Suma de áreas', () => {
  it('área de una huella: contorno menos huecos', () => {
    const cuadro = (a, b) => [[a, a], [b, a], [b, b], [a, b]]
    expect(areaDeHuella([[cuadro(0, 4), cuadro(1, 2)]])).toBeCloseTo(15, 10)
  })

  it('de la excavación toma las superficies con su área dibujada completa', () => {
    const areas = areasDeExcavacion(EXCAVACION_BIELVA)
    expect(areas).toHaveLength(8)
    expect(areas[4].area).toBeCloseTo(10.42, 2) // banda de losa X-03 a X-06: neta de excavación 8.32
    expect(areas.every((a) => a.incluir)).toBe(true)
  })

  it('suma solo las que entran y escribe la suma', () => {
    const r = analizarAreas({ areas: [{ area: 10 }, { area: 2.5 }, { area: 4, incluir: false }, { area: 0 }] })
    expect(r.cantidad).toBe(12.5)
    expect(r.formula).toBe('Σ áreas = 10.00 + 2.50 = 12.50 m²')
  })
})
