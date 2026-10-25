import { useCallback, useEffect, useState } from 'react'
import { readSheet } from 'read-excel-file/browser'
import { leerCatalogoNeodata } from '../dominio/importarNeodata'
import * as repo from '../lib/paquetesRepo'
import { botones } from '../lib/ui'
import CatalogoAdmin from './CatalogoAdmin'
import { Aviso, Boton, Seccion, Tarjeta } from './ui'

const { mensajeError } = repo

/**
 * El catálogo de la oficina ("el básico"): partidas con sus conceptos en orden.
 * Es el punto de partida para el paquete de un proyecto nuevo; cada paquete
 * guarda su propia copia, así que aquí se puede cambiar sin tocar proyectos ya hechos.
 */
export default function CatalogoPantalla({ perfil }) {
  const [partidas, setPartidas] = useState([])
  const [error, setError] = useState(null)
  const [administrando, setAdministrando] = useState(false)
  const [vista, setVista] = useState(null) // lo leído del Excel, antes de confirmar
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const puedeEscribir = perfil && perfil.rol !== 'lectura'
  const puedeAdministrar = ['revision', 'aprobacion'].includes(perfil?.rol)

  const cargar = useCallback(async () => {
    try {
      setPartidas(await repo.catalogo())
      setError(null)
    } catch (e) {
      setError(mensajeError(e))
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const totalConceptos = partidas.reduce((s, p) => s + p.conceptos, 0)

  async function leer(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setMensaje(null)
    try {
      const r = leerCatalogoNeodata(await readSheet(archivo))
      if (!r.conceptos.length) throw new Error('No encontré conceptos. Revisa que sea un reporte de Neodata ("b) Estándar" o "j) Totales por Tipo").')
      setVista({ ...r, archivo: archivo.name })
    } catch (err) {
      setVista(null)
      setMensaje({ tipo: 'error', texto: err.message })
    }
  }

  async function confirmar() {
    setOcupado(true)
    try {
      const r = await repo.importarCatalogo(vista)
      setMensaje({ tipo: 'ok', texto: `Catálogo actualizado: ${r.nuevos} conceptos nuevos y ${r.reubicados} que ya estaban, acomodados en su partida y orden.` })
      setVista(null)
      cargar()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: mensajeError(err) })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="grid max-w-5xl gap-4">
      <h2 className="text-xl font-bold">Catálogo de la oficina</h2>
      {error && <Aviso color="rojo">{error}</Aviso>}
      <Tarjeta>
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div>
            <Seccion>Partidas y conceptos</Seccion>
            <p className="mt-1 text-sm text-cc-suave">
              <b className="text-cc-texto">{partidas.length}</b> partidas · <b className="text-cc-texto">{totalConceptos}</b> conceptos. Cada partida trae su paquete de conceptos.
            </p>
          </div>
          <span className="ml-auto flex flex-wrap gap-2">
            <Boton onClick={() => setAdministrando((x) => !x)}>{administrando ? 'Cerrar lista' : 'Ver y editar el catálogo'}</Boton>
            <label
              className="inline-flex cursor-pointer items-center"
              style={{ ...botones.sec, ...(puedeEscribir ? null : { pointerEvents: 'none', opacity: 0.4 }) }}
            >
              Importar desde Neodata (.xlsx)
              <input type="file" accept=".xlsx" className="hidden" onChange={leer} disabled={!puedeEscribir} />
            </label>
          </span>
        </div>
        {administrando && <CatalogoAdmin puedeAdministrar={puedeAdministrar} onCambio={cargar} />}
        {mensaje && (
          <div className="border-t border-cc-borde px-5 py-3">
            <Aviso color={mensaje.tipo === 'error' ? 'rojo' : 'verde'}>{mensaje.texto}</Aviso>
          </div>
        )}
        {vista && (
          <div className="border-t border-cc-borde px-5 py-4 text-sm">
            <p>
              <b>{vista.archivo}</b>: {vista.partidas.length} partidas y {vista.conceptos.length} conceptos
              {vista.repetidos > 0 && <> ({vista.repetidos} repetidos se cuentan una vez)</>}. Solo se guardan clave, descripción y unidad; los precios y cantidades no se leen.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-cc-suave">
              {vista.partidas.map((p) => (
                <span key={p.clave}>
                  <b className="num text-cc-texto">{p.clave}</b> {p.descripcion} ({vista.conceptos.filter((c) => c.partida === p.clave).length})
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Boton variante="pri" disabled={ocupado} onClick={confirmar}>Agregar al catálogo</Boton>
              <Boton disabled={ocupado} onClick={() => setVista(null)}>Cancelar</Boton>
            </div>
          </div>
        )}
      </Tarjeta>
    </div>
  )
}
