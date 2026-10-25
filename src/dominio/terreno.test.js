import { describe, expect, it } from 'vitest'
import { analizarTerreno, areaPoligono, leerPoligonosDxf, rectangulo, validarPoligono } from './terreno.js'

describe('Superficie del terreno', () => {
  it('rectángulo de 8 × 20 m = 160 m²', () => {
    const r = analizarTerreno({ modo: 'rectangulo', ancho: 8, largo: 20 })
    expect(r.area).toBe(160)
    expect(r.perimetro).toBe(56)
    expect(r.formula).toBe('8.00 × 20.00 = 160.00 m²')
  })

  it('polígono: el rectángulo da lo mismo que ancho × largo, gire como gire', () => {
    expect(areaPoligono(rectangulo(8, 20)).area).toBe(160)
    expect(areaPoligono([...rectangulo(8, 20)].reverse()).area).toBe(160)
  })

  it('terreno irregular en L', () => {
    // 10 × 10 menos una esquina de 4 × 4
    const L = [[0, 0], [10, 0], [10, 6], [6, 6], [6, 10], [0, 10]]
    const r = analizarTerreno({ modo: 'poligono', vertices: L })
    expect(r.area).toBeCloseTo(84, 10)
    expect(r.perimetro).toBeCloseTo(40, 10)
    expect(r.formula).toContain('= 84.00 m²')
  })

  it('avisa de vértices que no sirven', () => {
    expect(validarPoligono([[0, 0], [1, 1]])).toMatch(/3 vértices/)
    expect(validarPoligono([[0, 0], [4, 4], [4, 0], [0, 4]])).toMatch(/se cruzan/)
    expect(validarPoligono(rectangulo(8, 20))).toBeNull()
  })
})

describe('Polilíneas de un DXF', () => {
  // DXF mínimo: un terreno de 8 × 20 m en la capa TERRENO y un cuadro de 1 × 1 en la capa 0
  const poli = (capa, pts) =>
    ['0', 'LWPOLYLINE', '8', capa, '90', String(pts.length), '70', '1', ...pts.flatMap(([x, y]) => ['10', String(x), '20', String(y)])].join('\n')
  const dxf = ['0', 'SECTION', '2', 'ENTITIES', poli('0', [[0, 0], [1, 0], [1, 1], [0, 1]]), poli('TERRENO', [[0, 0], [8, 0], [8, 20], [0, 20]]), '0', 'ENDSEC', '0', 'EOF'].join('\n')

  it('pone primero la polilínea de la capa terreno', () => {
    const r = leerPoligonosDxf(dxf)
    expect(r).toHaveLength(2)
    expect(r[0].capa).toBe('TERRENO')
    expect(r[0].area).toBe(160)
    expect(r[0].cerrada).toBe(true)
  })

  it('convierte las unidades del dibujo a metros', () => {
    const cm = dxf.replace(/\n8\n/g, '\n8\n') // mismas medidas, pero leídas como centímetros
    expect(leerPoligonosDxf(cm, 0.01)[0].area).toBeCloseTo(0.016, 10)
  })
})
