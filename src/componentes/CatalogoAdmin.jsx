import { useCallback, useEffect, useState } from 'react'
import * as repo from '../lib/paquetesRepo'
import { Aviso, Boton, BotonIcono } from './ui'
import { FormularioConcepto, FormularioPartida } from './formularios'

const { mensajeError } = repo

/**
 * Administración del catálogo de la oficina: editar y eliminar partidas y conceptos.
 * Los paquetes ya armados guardan su propia copia, así que nada de lo que se haga
 * aquí les cambia.
 */
export default function CatalogoAdmin({ puedeAdministrar, onCambio }) {
  const [partidas, setPartidas] = useState(null)
  const [abierta, setAbierta] = useState(null)
  const [editando, setEditando] = useState(null) // { tipo: 'partida' | 'concepto', id }
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    try {
      setPartidas(await repo.catalogoAdmin())
      setError(null)
    } catch (e) {
      setError(mensajeError(e))
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function hacer(fn) {
    try {
      await fn()
      await cargar()
      onCambio()
      return true
    } catch (e) {
      setError(mensajeError(e))
      return false
    }
  }

  if (!partidas) return <p className="px-4 py-3 text-sm text-cc-suave">{error ?? 'Cargando…'}</p>

  return (
    <div className="border-t border-cc-borde px-4 py-3">
      {error && <Aviso color="rojo" className="mb-2">{error}</Aviso>}
      {!puedeAdministrar && <p className="mb-2 text-xs text-cc-suave">Solo los roles de revisión y aprobación pueden editar o eliminar del catálogo.</p>}
      <p className="mb-3 text-xs text-cc-suave">
        Los paquetes ya armados guardan su propia copia: lo que cambies o borres aquí no los afecta, solo a los paquetes que crees después.
      </p>
      <ul className="grid gap-1.5">
        {partidas.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--cc-borde)' }}>
            {editando?.tipo === 'partida' && editando.id === p.id ? (
              <FormularioPartida
                titulo="Editar partida del catálogo"
                inicial={{ clave: p.clave, descripcion: p.descripcion }}
                sinMarco
                onGuardar={async (v) => {
                  if (await hacer(() => repo.actualizarPartidaCatalogo(p.id, v))) setEditando(null)
                }}
                onCancelar={() => setEditando(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-2 px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setAbierta(abierta === p.id ? null : p.id)}>
                  <span className="text-xs text-cc-tenue">{abierta === p.id ? '▾' : '▸'}</span>
                  <span className="num rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: 'rgba(29,158,117,0.14)', color: '#3ddba6' }}>{p.clave}</span>
                  <b className="truncate text-sm uppercase tracking-wide">{p.descripcion}</b>
                  <span className="num text-xs text-cc-suave">{p.conceptos.length} conceptos</span>
                </button>
                {puedeAdministrar && (
                  <span className="flex gap-1.5">
                    <BotonIcono title="Editar clave y nombre" onClick={() => setEditando({ tipo: 'partida', id: p.id })}>✎</BotonIcono>
                    <BotonIcono
                      peligro
                      title="Eliminar partida del catálogo"
                      onClick={() =>
                        confirm(
                          p.conceptos.length
                            ? `¿Eliminar del catálogo la partida ${p.clave} y sus ${p.conceptos.length} conceptos? Los paquetes ya armados no cambian.`
                            : `¿Eliminar del catálogo la partida ${p.clave}, que está vacía?`,
                        ) && hacer(() => repo.eliminarPartidaCatalogo(p.id))
                      }
                    >✕</BotonIcono>
                  </span>
                )}
              </div>
            )}

            {abierta === p.id && (
              <ul style={{ borderTop: '1px solid var(--cc-borde)' }}>
                {p.conceptos.map((c) =>
                  editando?.tipo === 'concepto' && editando.id === c.id ? (
                    <li key={c.id} className="px-3 py-3" style={{ background: 'rgba(29,158,117,0.06)' }}>
                      <FormularioConcepto
                        titulo="Editar concepto del catálogo"
                        inicial={{ clave: c.clave, descripcion: c.descripcion, unidad: c.unidad }}
                        guardar="Guardar"
                        onGuardar={async (v) => {
                          if (await hacer(() => repo.actualizarConceptoCatalogo(c.id, v))) setEditando(null)
                        }}
                        onCancelar={() => setEditando(null)}
                      />
                    </li>
                  ) : (
                    <li key={c.id} className="flex items-start gap-2 px-3 py-1.5" style={{ borderTop: '1px solid var(--cc-borde)' }}>
                      <span className="num w-20 shrink-0 pt-0.5 text-xs font-bold text-cc-suave">{c.clave}</span>
                      <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug">{c.descripcion}</span>
                      <span className="num w-10 shrink-0 pt-0.5 text-right text-xs text-cc-suave">{c.unidad}</span>
                      {puedeAdministrar && (
                        <span className="flex gap-1.5">
                          <BotonIcono title="Editar concepto" onClick={() => setEditando({ tipo: 'concepto', id: c.id })}>✎</BotonIcono>
                          <BotonIcono
                            peligro
                            title="Eliminar concepto del catálogo"
                            onClick={() => confirm(`¿Eliminar ${c.clave} del catálogo? Los paquetes ya armados no cambian.`) && hacer(() => repo.eliminarConceptoCatalogo(c.id))}
                          >✕</BotonIcono>
                        </span>
                      )}
                    </li>
                  ),
                )}
                {!p.conceptos.length && <li className="px-3 py-2 text-sm text-cc-suave" style={{ borderTop: '1px solid var(--cc-borde)' }}>Partida sin conceptos.</li>}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <Boton chico className="mt-3" onClick={cargar}>Actualizar lista</Boton>
    </div>
  )
}
