/**
 * Excavación de Casa Bielva medida en la planta de cimentación del DXF estructural.
 *
 * Reglas (Ciprian, 26-oct-2026):
 *   · Zapatas ZC en colindancia: ancho 0.80 + sobreancho de 10 cm solo del lado de adentro,
 *     alto 0.80 (NDZC −0.80) + plantilla 0.05. La esquina de X-08 con Y-04 se cuenta una vez:
 *     el tramo sobre X-08 va de la cepa de Y-04 hacia adentro (1.66 en lugar de 2.56).
 *   · TL-1 de 25×25: (0.25 + 2×0.10) × (0.25 + 0.05). El tramo sobre X-05 arranca en la cepa
 *     de la TL-1 de Y-02.
 *   · Losas de cimentación CI/CC: las bandas con talud se excavan a 0.25 (ancho total, sin
 *     sobreancho ni plantilla) y la parte de 10 cm a 0.10. Las áreas son netas: sin lo que
 *     ya excavan las zapatas y las TL-1. La parte delgada sale de la capa PROY.CIM.
 *   · Firme de 10 cm en el área interior que no lleva losa, neta de zapatas y TL-1.
 *   · La cochera (entre X-00 y X-01/X-03, entre las zapatas) no entra: su firme es otro concepto.
 *
 * Con esto da 30.88 m³; Neodata trae 31.13 m³ (CIM001).
 *
 * Cada renglón y superficie lleva su «huella» en planta para el modelo 3D: una lista de
 * polígonos, cada uno con su contorno y sus huecos, en metros sobre el terreno del proyecto
 * (origen en la esquina Y-00 / X-00 del paño exterior de la casa: x hacia Y-04, y hacia X-08).
 * Las huellas de las bandas de losa son el contorno de la losa menos su parte delgada; el área
 * que se cobra es la neta (sin zapatas ni TL-1), por eso puede ser algo menor que la dibujada.
 */

// Coordenadas leídas del DXF (relativas al eje Y-00 / X-00) → coordenadas del terreno.
const DX = -0.18
const DY = 0.04
const p = (pts) => pts.map(([x, y]) => [Math.round((x + DX) * 1000) / 1000, Math.round((y + DY) * 1000) / 1000])
const rect = (x1, x2, y1, y2) => p([[x1, y1], [x2, y1], [x2, y2], [x1, y2]])

// parte de 10 cm de las losas (capa PROY.CIM)
const DELGADA = {
  L1: [
    p([[0.68, 5.77], [1.55, 5.77], [1.55, 5.28], [3.04, 5.28], [3.04, 6.28], [3.15, 6.28], [3.15, 8.45], [0.68, 8.45]]),
    rect(0.68, 3.15, 9.05, 9.92),
  ],
  L2: [
    rect(0.68, 3.15, 15.52, 16.39),
    p([[0.68, 16.99], [3.75, 16.99], [3.75, 15.41], [4.12, 15.41], [4.12, 19.46], [0.68, 19.46]]),
  ],
  // la TL-1 sobre X-05 la cruza: se parte en dos, abajo y arriba de su cepa
  L3: [rect(3.75, 6.68, 6.28, 10.045), p([[3.64, 10.495], [6.68, 10.495], [6.68, 14.7], [4.12, 14.7], [4.12, 14.81], [3.64, 14.81]])],
}
const LOSA = { L1: rect(0.18, 3.54, 4.78, 10.42), L2: rect(0.18, 4.62, 15.02, 19.96), L3: rect(3.54, 7.18, 5.78, 15.2) }

const zc = (elemento, eje, entre, largo, huella) => ({ elemento, eje, entre, largo, ancho: 0.8, profundidad: 0.8, piezas: 1, lados: 1, plantilla: true, huella: [[huella]] })
const tl = (eje, entre, largo, huella) => ({ elemento: 'TL-1', eje, entre, largo, ancho: 0.25, profundidad: 0.25, piezas: 1, lados: 2, plantilla: true, huella: [[huella]] })
const banda = (k, descripcion, area) => ({ descripcion, area, espesor: 0.25, huella: [[LOSA[k], ...DELGADA[k]]] })
const delgada = (k, descripcion, area) => ({ descripcion, area, espesor: 0.1, huella: DELGADA[k].map((anillo) => [anillo]) })

export const EXCAVACION_BIELVA = {
  renglones: [
    zc('ZC-01', 'Y-00', 'X-00 a X-01', 4.82, rect(0.18, 1.08, -0.04, 4.78)),
    zc('ZC-01', 'Y-00', 'X-05 a X-06', 4.6, rect(0.18, 1.08, 10.42, 15.02)),
    zc('ZC-01', 'Y-04', 'X-00 a X-01', 4.97, rect(6.28, 7.18, -0.04, 4.93)),
    zc('ZC-02', 'Y-04', 'X-01 a X-02', 0.85, rect(6.28, 7.18, 4.93, 5.78)),
    zc('ZC-01', 'Y-04', 'X-06 a X-08', 4.76, rect(6.28, 7.18, 15.2, 19.96)),
    zc('ZC-01', 'X-08', 'Y-03 a Y-04 (sin esquina)', 1.66, rect(4.62, 6.28, 19.06, 19.96)),
    tl('Y-02', 'X-05 a X-06', 5.08, rect(3.19, 3.64, 10.12, 15.2)),
    tl('X-05', 'Y-02 a Y-04', 3.54, rect(3.64, 7.18, 10.045, 10.495)),
  ],
  superficies: [
    banda('L1', 'Losa X-01 a X-05 / Y-00 a Y-02 · bandas CI/CC', 9.4),
    delgada('L1', 'Losa X-01 a X-05 / Y-00 a Y-02 · parte de 10 cm', 9.44),
    banda('L2', 'Losa X-06 a X-08 / Y-00 a Y-03 · bandas CI/CC', 10.62),
    delgada('L2', 'Losa X-06 a X-08 / Y-00 a Y-03 · parte de 10 cm', 11.23),
    banda('L3', 'Losa X-03 a X-06 / Y-02 a Y-04 · bandas CI/CC', 8.32),
    delgada('L3', 'Losa X-03 a X-06 / Y-02 a Y-04 · parte de 10 cm', 23.87),
    { descripcion: 'Firme X-05 a X-06 / Y-00 a Y-02', area: 9.71, espesor: 0.1, huella: [[rect(1.08, 3.19, 10.42, 15.02)]] },
    { descripcion: 'Firme X-06 a X-08 / Y-03 a Y-04', area: 6.41, espesor: 0.1, huella: [[rect(4.62, 6.28, 15.2, 19.06)]] },
  ],
  referencia: 31.13,
}
