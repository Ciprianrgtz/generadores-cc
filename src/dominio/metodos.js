/**
 * Métodos de análisis: cómo se genera el volumen de cada tipo de concepto.
 * Los usa la página de métodos (la biblioteca) y el bloque "Cómo se genera el volumen"
 * que se ve al abrir un concepto de un proyecto.
 */
export const METODOS = {
  terreno: {
    id: 'terreno',
    nombre: 'Superficie del terreno',
    aplica: 'Limpia y despalme, trazo y nivelación y todo lo que se mide por la superficie del terreno.',
    unidad: 'm²',
    pasos: [
      'Se toma la superficie del terreno del proyecto (se captura una sola vez y la usan todos los conceptos).',
      'Terreno regular: ancho × largo. Terreno irregular: vértices en metros, o una polilínea cerrada de AutoCAD en la capa «terreno» (fórmula de la lazada: ½ × |Σ(xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)|).',
      'La cantidad del concepto es esa superficie, en m².',
      'El terreno queda guardado en el proyecto y se dibuja en el modelo 3D.',
      'Se compara con la cantidad que trae Neodata para detectar diferencias.',
    ],
    criterios: 'No lleva criterios de la oficina: solo las medidas del terreno. Del DXF se respeta la unidad del dibujo (metros, centímetros o milímetros).',
  },
  zapata_corrida: {
    id: 'zapata_corrida',
    nombre: 'Zapata corrida (acero de la parrilla)',
    aplica: 'Acero de refuerzo de zapatas corridas (ZC-01, ZC-02…). Se analiza por 1.00 m de zapata, porque así se paga en obra.',
    unidad: 'kg',
    pasos: [
      'Sentido corto (transversal): varillas = 1.00 ÷ separación + 1; cada una mide (ancho − 2 × recubrimiento) + 2 × gancho.',
      'Sentido largo (longitudinal): varillas = ancho ÷ separación + 1; cada una mide (1.00 − recubrimiento) + gancho.',
      'Peso = varillas × largo × kg/m × (1 + desperdicio). Se suma el de los dos sentidos: kg por metro lineal.',
      'Cantidad del generador = metros lineales de zapata × kg por metro lineal.',
      'Se compara con Neodata y, como comparativo informativo, con el despiece real por tramos del DXF.',
    ],
    criterios: 'Criterios editables en la ficha: recubrimiento por lado, gancho por lado y desperdicio. La ficha tiene versiones y flujo Borrador → Revisado → Aprobado.',
    abrir: true,
  },
}

export const LISTA_METODOS = Object.values(METODOS)

/** Cómo se dio el terreno en un análisis guardado, escrito en una línea. */
export function origenTerreno(datos) {
  if (!datos) return null
  if (datos.modo === 'rectangulo') return `Rectángulo de ${datos.ancho} m × ${datos.largo} m`
  const n = datos.vertices?.length ?? 0
  return datos.origen
    ? `Polilínea de ${n} vértices del DXF «${datos.origen.archivo}» (capa ${datos.origen.capa}, dibujo en ${datos.origen.unidad})`
    : `Polígono de ${n} vértices capturados a mano`
}
