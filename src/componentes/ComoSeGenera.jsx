import { METODOS, origenAcero, origenAfine, origenAreas, origenExcavacion, origenLongitud, origenPlantilla, origenTerreno } from '../dominio/metodos'
import { fmt, unidadTexto } from '../dominio/redondeo'
import { Seccion } from './ui'

/**
 * "Cómo se genera el volumen": lo primero que debe ver quien abre un concepto.
 * Dice qué método se usa, los pasos del método y, con los datos de ESTE proyecto,
 * cómo salió el número (o que todavía falta hacer el análisis).
 */
export default function ComoSeGenera({ concepto, generador, terreno, compacto = false }) {
  const m = METODOS[concepto.analisis_tipo]
  if (!m) {
    return (
      <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(214,158,46,0.08)', border: '1px solid rgba(214,158,46,0.3)' }}>
        <Seccion style={{ color: '#f0b866' }}>Cómo se genera el volumen</Seccion>
        <p className="mt-1 text-cc-suave">Todavía no se ha elegido el método de análisis de este concepto.</p>
      </div>
    )
  }

  const unidad = unidadTexto(generador?.unidad ?? concepto.unidad)
  // sin análisis guardado, el terreno del proyecto ya sirve de punto de partida
  const previo = !generador && concepto.analisis_tipo === 'terreno' && terreno?.area > 0 ? terreno : null

  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.3)' }}>
      <Seccion style={{ color: '#3ddba6' }}>Cómo se genera el volumen</Seccion>
      <p className="mt-1 text-sm font-semibold">{m.nombre}</p>

      {generador ? (
        <div className="mt-2 rounded-lg px-3 py-2" style={{ background: 'rgba(0,0,0,0.22)' }}>
          <p className="num text-sm">{generador.formula}</p>
          {concepto.analisis_tipo === 'terreno' && <p className="mt-1 text-xs text-cc-suave">{origenTerreno(generador.datos)}</p>}
          {concepto.analisis_tipo === 'excavacion' && <p className="mt-1 text-xs text-cc-suave">{origenExcavacion(generador.datos)}</p>}
          {concepto.analisis_tipo === 'afine' && <p className="mt-1 text-xs text-cc-suave">{origenAfine(generador.datos)}</p>}
          {concepto.analisis_tipo === 'plantilla' && <p className="mt-1 text-xs text-cc-suave">{origenPlantilla(generador.datos)}</p>}
          {concepto.analisis_tipo === 'areas' && <p className="mt-1 text-xs text-cc-suave">{origenAreas(generador.datos)}</p>}
          {concepto.analisis_tipo === 'longitud' && <p className="mt-1 text-xs text-cc-suave">{origenLongitud(generador.datos)}</p>}
          {concepto.analisis_tipo === 'acero_ficha' && <p className="mt-1 text-xs text-cc-suave">{origenAcero(generador.datos)}</p>}
          <p className="num mt-1 text-sm">
            Volumen: <b style={{ color: '#3ddba6' }}>{fmt(generador.cantidad)} {unidad}</b>
          </p>
        </div>
      ) : previo ? (
        <div className="mt-2 rounded-lg px-3 py-2 text-xs text-cc-suave" style={{ background: 'rgba(0,0,0,0.22)' }}>
          El proyecto ya tiene el terreno capturado (<b className="num text-cc-texto">{fmt(previo.area)} m²</b>). Al hacer el análisis de este concepto se usa tal cual; solo falta guardarlo.
        </div>
      ) : (
        <p className="mt-2 text-xs text-cc-suave">Aún sin análisis: abre el análisis para capturar los datos y sacar el volumen.</p>
      )}

      {concepto.nota && (
        <p className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(49,130,206,0.10)', border: '1px solid rgba(49,130,206,0.3)', color: 'var(--cc-texto)' }}>
          <b style={{ color: '#63b3ed' }}>Nota · </b>
          {concepto.nota}
        </p>
      )}

      <details className="mt-2 text-xs text-cc-suave" open={!compacto}>
        <summary className="cursor-pointer select-none">Pasos del método</summary>
        <ol className="mt-2 grid gap-1.5">
          {m.pasos.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span className="num w-4 shrink-0 text-cc-tenue">{i + 1}.</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-cc-tenue">{m.criterios}</p>
      </details>
    </div>
  )
}
