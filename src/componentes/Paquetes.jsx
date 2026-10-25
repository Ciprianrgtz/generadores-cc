import { useCallback, useEffect, useState } from 'react'
import { readSheet } from 'read-excel-file/browser'
import { leerCatalogoNeodata } from '../dominio/importarNeodata'
import * as repo from '../lib/paquetesRepo'
import { cardStyle } from '../lib/ui'
import PaqueteDetalle from './PaqueteDetalle'
import CatalogoAdmin from './CatalogoAdmin'
import { Aviso, Boton, Campo, Chip, Entrada, Seccion, Tarjeta } from './ui'

const { mensajeError } = repo

export default function Paquetes({ perfil, onAbrirZapata }) {
  const [abierto, setAbierto] = useState(null) // id del paquete abierto
  const [paquetes, setPaquetes] = useState(null)
  const [partidas, setPartidas] = useState([])
  const [error, setError] = useState(null)
  const [creando, setCreando] = useState(false)
  const [verArchivados, setVerArchivados] = useState(false)
  const puedeEscribir = perfil && perfil.rol !== 'lectura'
  const puedeAdministrar = ['revision', 'aprobacion'].includes(perfil?.rol)

  const cargar = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([repo.listarPaquetes(), repo.catalogo()])
      setPaquetes(p)
      setPartidas(c)
      setError(null)
    } catch (e) {
      setError(mensajeError(e))
      setPaquetes([])
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (abierto)
    return (
      <PaqueteDetalle
        paqueteId={abierto}
        perfil={perfil}
        onVolver={() => {
          setAbierto(null)
          cargar()
        }}
        onAbrirZapata={onAbrirZapata}
      />
    )

  const totalConceptos = partidas.reduce((s, p) => s + p.conceptos, 0)

  return (
    <div className="grid max-w-5xl gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">Paquetes de generadores</h2>
        <Boton variante="pri" className="ml-auto" disabled={!puedeEscribir} onClick={() => setCreando((x) => !x)}>
          {creando ? 'Cancelar' : '+ Crear paquete de generadores'}
        </Boton>
      </div>

      {error && <Aviso color="rojo">{error}</Aviso>}

      {creando && (
        <FormularioPaquete
          partidas={partidas}
          onCreado={(id) => {
            setCreando(false)
            setAbierto(id)
          }}
        />
      )}

      <Catalogo partidas={partidas} totalConceptos={totalConceptos} puedeEscribir={puedeEscribir} puedeAdministrar={puedeAdministrar} onImportado={cargar} />

      <section className="grid gap-3">
        {paquetes === null && <p className="text-sm text-cc-suave">Cargando…</p>}
        {paquetes?.length === 0 && !error && (
          <Tarjeta className="px-4 py-8 text-center text-sm text-cc-suave">Todavía no hay paquetes. Crea el primero con el botón de arriba.</Tarjeta>
        )}
        {paquetes?.some((p) => p.estado === 'archivado') && (
          <label className="flex items-center gap-2 text-xs text-cc-suave">
            <input type="checkbox" checked={verArchivados} onChange={(e) => setVerArchivados(e.target.checked)} />
            Ver paquetes archivados
          </label>
        )}
        {paquetes
          ?.filter((p) => verArchivados || p.estado !== 'archivado')
          .map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setAbierto(p.id)}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-5 py-4 text-left"
              style={{ ...cardStyle, border: 'none', cursor: 'pointer', color: 'var(--cc-texto)', opacity: p.estado === 'archivado' ? 0.6 : 1 }}
            >
              <b className="text-base">{p.nombre}</b>
              {p.estado === 'archivado' && <Chip color="gris">Archivado</Chip>}
              <span className="num text-xs text-cc-suave">{p.proyecto?.clave}</span>
              <span className="ml-auto flex items-center gap-3 text-sm text-cc-suave">
                <span className="num">{p.listos}/{p.total} conceptos listos</span>
                <span className="h-2 w-28 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <span className="block h-full" style={{ width: `${p.total ? (p.listos / p.total) * 100 : 0}%`, background: '#1D9E75' }} />
                </span>
              </span>
            </button>
          ))}
      </section>
    </div>
  )
}

function Catalogo({ partidas, totalConceptos, puedeEscribir, puedeAdministrar, onImportado }) {
  const [administrando, setAdministrando] = useState(false)
  const [vista, setVista] = useState(null) // lo leído del Excel, antes de confirmar
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  async function leer(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setMensaje(null)
    try {
      const filas = await readSheet(archivo)
      const r = leerCatalogoNeodata(filas)
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
      onImportado()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: mensajeError(err) })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <div>
          <Seccion>Catálogo de la oficina</Seccion>
          <p className="mt-1 text-sm text-cc-suave">
            <b className="text-cc-texto">{partidas.length}</b> partidas · <b className="text-cc-texto">{totalConceptos}</b> conceptos. Cada partida trae su paquete de conceptos.
          </p>
        </div>
        <span className="ml-auto flex flex-wrap gap-2">
          <Boton onClick={() => setAdministrando((x) => !x)}>{administrando ? 'Cerrar catálogo' : 'Administrar catálogo'}</Boton>
          <label
            className="inline-flex cursor-pointer items-center"
            style={{ ...{ background: 'var(--cc-superficie)', color: 'var(--cc-suave)', borderRadius: 12, padding: '8px 16px', fontSize: 13, fontWeight: 600, boxShadow: '3px 3px 8px var(--cc-sombra), -2px -2px 6px var(--cc-luz)' }, ...(puedeEscribir ? null : { pointerEvents: 'none', opacity: 0.4 }) }}
          >
            Importar desde Neodata (.xlsx)
            <input type="file" accept=".xlsx" className="hidden" onChange={leer} disabled={!puedeEscribir} />
          </label>
        </span>
      </div>
      {administrando && <CatalogoAdmin puedeAdministrar={puedeAdministrar} onCambio={onImportado} />}
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
  )
}

function FormularioPaquete({ partidas, onCreado }) {
  const [nombre, setNombre] = useState('')
  const [elegidas, setElegidas] = useState(() => new Set(partidas.filter((p) => p.conceptos).map((p) => p.id)))
  // una casa nueva suele empezar vacía: se arma a mano o importando el Excel de Neodata del proyecto
  const [vacio, setVacio] = useState(partidas.length === 0)
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const alternar = (id) =>
    setElegidas((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  async function crear(e) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      onCreado(await repo.crearPaquete(nombre, vacio ? [] : [...elegidas]))
    } catch (err) {
      setError(mensajeError(err))
      setOcupado(false)
    }
  }

  return (
    <Tarjeta className="p-5">
      <form onSubmit={crear} className="grid gap-4">
        <Campo etiqueta="Nombre del paquete (normalmente el del proyecto)" className="max-w-sm">
          <Entrada autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Casa Bielva" />
        </Campo>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={vacio} onChange={(e) => setVacio(e.target.checked)} />
          <span>
            <b>Empezar vacío</b>
            <span className="block text-xs text-cc-suave">
              Para una casa nueva: dentro del paquete agregas las partidas y conceptos a mano, o importas el Excel de Neodata del proyecto (sin volúmenes).
            </span>
          </span>
        </label>
        <fieldset className={`grid gap-1 ${vacio ? 'hidden' : ''}`}>
          <legend className="mb-2 text-xs text-cc-suave">Partidas del catálogo que entran al paquete (cada una trae sus conceptos, en el orden del catálogo)</legend>
          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {partidas.filter((p) => p.conceptos).map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={elegidas.has(p.id)} onChange={() => alternar(p.id)} />
                <span className="num w-10 text-xs text-cc-suave">{p.clave}</span>
                <span className="truncate">{p.descripcion}</span>
                <span className="num ml-auto text-xs text-cc-tenue">{p.conceptos}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <Aviso color="rojo">{error}</Aviso>}
        <div>
          <Boton type="submit" variante="pri" disabled={ocupado || !nombre.trim() || (!vacio && !elegidas.size)}>Crear paquete</Boton>
        </div>
      </form>
    </Tarjeta>
  )
}
