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
 */
const zc = (elemento, eje, entre, largo) => ({ elemento, eje, entre, largo, ancho: 0.8, profundidad: 0.8, piezas: 1, lados: 1, plantilla: true })
const tl = (eje, entre, largo) => ({ elemento: 'TL-1', eje, entre, largo, ancho: 0.25, profundidad: 0.25, piezas: 1, lados: 2, plantilla: true })

export const EXCAVACION_BIELVA = {
  renglones: [
    zc('ZC-01', 'Y-00', 'X-00 a X-01', 4.82),
    zc('ZC-01', 'Y-00', 'X-05 a X-06', 4.6),
    zc('ZC-01', 'Y-04', 'X-00 a X-01', 4.97),
    zc('ZC-02', 'Y-04', 'X-01 a X-02', 0.85),
    zc('ZC-01', 'Y-04', 'X-06 a X-08', 4.76),
    zc('ZC-01', 'X-08', 'Y-03 a Y-04 (sin esquina)', 1.66),
    tl('Y-02', 'X-05 a X-06', 5.08),
    tl('X-05', 'Y-02 a Y-04', 3.54),
  ],
  superficies: [
    { descripcion: 'Losa X-01 a X-05 / Y-00 a Y-02 · bandas CI/CC', area: 9.4, espesor: 0.25 },
    { descripcion: 'Losa X-01 a X-05 / Y-00 a Y-02 · parte de 10 cm', area: 9.44, espesor: 0.1 },
    { descripcion: 'Losa X-06 a X-08 / Y-00 a Y-03 · bandas CI/CC', area: 10.62, espesor: 0.25 },
    { descripcion: 'Losa X-06 a X-08 / Y-00 a Y-03 · parte de 10 cm', area: 11.23, espesor: 0.1 },
    { descripcion: 'Losa X-03 a X-06 / Y-02 a Y-04 · bandas CI/CC', area: 8.32, espesor: 0.25 },
    { descripcion: 'Losa X-03 a X-06 / Y-02 a Y-04 · parte de 10 cm', area: 23.87, espesor: 0.1 },
    { descripcion: 'Firme X-05 a X-06 / Y-00 a Y-02', area: 9.71, espesor: 0.1 },
    { descripcion: 'Firme X-06 a X-08 / Y-03 a Y-04', area: 6.41, espesor: 0.1 },
  ],
  referencia: 31.13,
}
