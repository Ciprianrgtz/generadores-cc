import { useCallback, useEffect, useMemo, useState } from 'react'
import { readSheet } from 'read-excel-file/browser'
import { leerCatalogoNeodata } from '../dominio/importarNeodata'
import * as repo from '../lib/proyectosRepo'
import * as paquetes from '../lib/paquetesRepo'
import { botones } from '../lib/ui'
import EjesProyecto from './EjesProyecto'
import GeneradorAfine from './GeneradorAfine'
import GeneradorExcavacion from './GeneradorExcavacion'
import GeneradorPlantilla from './GeneradorPlantilla'
import GeneradorTerreno from './GeneradorTerreno'
import PaqueteDetalle from './PaqueteDetalle'
import Visor3D from './Visor3D'
import { Aviso, Boton, Seccion, Tarjeta } from './ui'

const { mensajeError } = repo

/**
 * Un proyecto: su paquete de generadores, el análisis de cada concepto y el modelo 3D
 * que se va armando con lo analizado.
 */
export default function ProyectoVista({ proyectoId, perfil, onVolver, onAbrirZapata }) {
  const [proy, setProy] = useState(null)
  const [error, setError] = useState(null)
  const [analisis, setAnalisis] = useState(null) // concepto que se está analizando
  const [generadores, setGeneradores] = useState([]) // análisis guardados, para el modelo 3D
  const [borrador, setBorrador] = useState(null) // lo que se está capturando en el análisis abierto
  const [ejesBorrador, setEjesBorrador] = useState(null) // ejes que se están capturando, sin guardar
  // el 3D dibuja lo guardado y, encima, el borrador del concepto abierto (tiempo real)
  const enVivo = useMemo(() => {
    if (!borrador) return generadores
    const otros = generadores.filter((g) => g.paquete_concepto_id !== borrador.paquete_concepto_id)
    return [...otros, borrador]
  }, [generadores, borrador])
  const cerrarAnalisis = () => {
    setAnalisis(null)
    setBorrador(null)
  }
  const alCapturar = useCallback(
    (tipo, datos) => analisis && setBorrador({ paquete_concepto_id: analisis.id, tipo, datos, concepto: { clave: analisis.clave } }),
    [analisis],
  )
  const puedeEscribir = perfil && perfil.rol !== 'lectura'

  const cargar = useCallback(async () => {
    try {
      const p = await repo.proyecto(proyectoId)
      setProy(p)
      setGeneradores(p.paquete ? await repo.generadoresDelPaquete(p.paquete.id) : [])
      setError(null)
    } catch (e) {
      setError(mensajeError(e))
    }
  }, [proyectoId])

  useEffect(() => {
    cargar()
  }, [cargar])

  function abrirAnalisis(concepto) {
    if (concepto.analisis_tipo === 'zapata_corrida') return onAbrirZapata()
    setAnalisis(concepto)
  }

  if (!proy) return <p className="text-sm text-cc-suave">{error ?? 'Cargando…'}</p>
  const ejesVivos = ejesBorrador ?? proy.ejes ?? null

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Boton onClick={onVolver}>← Proyectos</Boton>
        <h2 className="text-xl font-bold">{proy.nombre}</h2>
        <span className="num text-xs text-cc-suave">{proy.clave}</span>
      </div>
      {error && <Aviso color="rojo">{error}</Aviso>}

      {!proy.paquete ? (
        <NuevoPaquete proyecto={proy} puedeEscribir={puedeEscribir} onCreado={cargar} />
      ) : (
        <>
          <Visor3D terreno={borrador?.tipo === 'terreno' ? borrador.datos : proy.terreno} ejes={ejesVivos} generadores={enVivo} />
          <EjesProyecto key={JSON.stringify(proy.ejes ?? null)} proyecto={proy} puedeEscribir={puedeEscribir} onGuardado={cargar} onCapturar={setEjesBorrador} />
          {analisis?.analisis_tipo === 'excavacion' ? (
            <GeneradorExcavacion
              concepto={analisis}
              ejes={ejesVivos}
              proyecto={proy}
              puedeEscribir={puedeEscribir}
              onGuardado={cargar}
              onVolver={cerrarAnalisis}
              onCapturar={alCapturar}
            />
          ) : analisis?.analisis_tipo === 'plantilla' ? (
            <GeneradorPlantilla
              concepto={analisis}
              generadores={generadores}
              puedeEscribir={puedeEscribir}
              onGuardado={cargar}
              onVolver={cerrarAnalisis}
              onCapturar={alCapturar}
            />
          ) : analisis?.analisis_tipo === 'afine' ? (
            <GeneradorAfine
              concepto={analisis}
              ejes={ejesVivos}
              generadores={generadores}
              puedeEscribir={puedeEscribir}
              onGuardado={cargar}
              onVolver={cerrarAnalisis}
              onCapturar={alCapturar}
            />
          ) : analisis ? (
            <GeneradorTerreno
              concepto={analisis}
              ejes={ejesVivos}
              proyecto={proy}
              puedeEscribir={puedeEscribir}
              onGuardado={cargar}
              onVolver={cerrarAnalisis}
              onCapturar={alCapturar}
            />
          ) : (
            <PaqueteDetalle
              paqueteId={proy.paquete.id}
              perfil={perfil}
              terreno={proy.terreno}
              onAbrirAnalisis={abrirAnalisis}
              onEliminado={cargar}
            />
          )}
        </>
      )}
    </div>
  )
}

/** El proyecto todavía no tiene paquete: se importa el de Neodata, se copia del catálogo o se arma a mano. */
function NuevoPaquete({ proyecto, puedeEscribir, onCreado }) {
  const [vista, setVista] = useState(null) // lo leído del Excel
  const [catalogo, setCatalogo] = useState(null) // partidas del catálogo, si se elige copiarlas
  const [elegidas, setElegidas] = useState(new Set())
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  async function leer(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setError(null)
    try {
      const r = leerCatalogoNeodata(await readSheet(archivo))
      if (!r.conceptos.length) throw new Error('No encontré conceptos. Revisa que sea un reporte de Neodata ("b) Estándar" o "j) Totales por Tipo").')
      setVista({ ...r, archivo: archivo.name })
    } catch (err) {
      setVista(null)
      setError(err.message)
    }
  }

  async function crear(partidaIds, importar) {
    setOcupado(true)
    setError(null)
    try {
      const paqueteId = await repo.crearPaqueteDelProyecto(proyecto.id, proyecto.nombre, partidaIds)
      if (importar) await paquetes.importarAlPaquete(paqueteId, importar, [], [])
      onCreado()
    } catch (err) {
      setError(mensajeError(err))
      setOcupado(false)
    }
  }

  async function abrirCatalogo() {
    try {
      const c = (await paquetes.catalogo()).filter((p) => p.conceptos)
      setCatalogo(c)
      setElegidas(new Set(c.map((p) => p.id)))
    } catch (err) {
      setError(paquetes.mensajeError(err))
    }
  }

  const alternar = (id) =>
    setElegidas((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  return (
    <Tarjeta className="grid gap-5 p-5">
      <div>
        <Seccion>Paquete de generadores</Seccion>
        <h3 className="mt-1 text-lg font-bold">Este proyecto todavía no tiene su paquete</h3>
        <p className="mt-1 text-sm text-cc-suave">
          El paquete es la lista de partidas y conceptos de la obra, en el orden del presupuesto. De ahí se abre cada concepto para hacer su análisis y sacar su volumen.
        </p>
      </div>

      {error && <Aviso color="rojo">{error}</Aviso>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid content-start gap-2 rounded-2xl p-4" style={{ border: '1px solid rgba(29,158,117,0.35)', background: 'rgba(29,158,117,0.08)' }}>
          <b>1 · Importar el Excel de Neodata</b>
          <p className="text-xs text-cc-suave">El reporte del presupuesto de este proyecto. Puede venir sin volúmenes: solo se toman partidas, claves, descripciones y unidades.</p>
          <label className="inline-flex w-fit cursor-pointer items-center" style={{ ...botones.pri, ...(puedeEscribir ? null : { pointerEvents: 'none', opacity: 0.4 }) }}>
            Elegir archivo .xlsx
            <input type="file" accept=".xlsx" className="hidden" onChange={leer} disabled={!puedeEscribir || ocupado} />
          </label>
        </div>
        <div className="grid content-start gap-2 rounded-2xl p-4" style={{ border: '1px solid var(--cc-borde)' }}>
          <b>2 · Copiar del catálogo</b>
          <p className="text-xs text-cc-suave">Parte de las partidas y conceptos que ya tiene la oficina (por ejemplo, los de Casa Bielva).</p>
          <Boton disabled={!puedeEscribir || ocupado} onClick={abrirCatalogo}>Elegir partidas</Boton>
        </div>
        <div className="grid content-start gap-2 rounded-2xl p-4" style={{ border: '1px solid var(--cc-borde)' }}>
          <b>3 · Empezar vacío</b>
          <p className="text-xs text-cc-suave">Agregas las partidas y conceptos a mano, uno por uno.</p>
          <Boton disabled={!puedeEscribir || ocupado} onClick={() => crear([], null)}>Crear paquete vacío</Boton>
        </div>
      </div>

      {vista && (
        <div className="rounded-2xl p-4 text-sm" style={{ border: '1px solid var(--cc-borde)' }}>
          <p>
            <b>{vista.archivo}</b>: {vista.partidas.length} partidas y {vista.conceptos.length} conceptos
            {vista.repetidos > 0 && <> ({vista.repetidos} repetidos se cuentan una vez)</>}. Se importan en este orden:
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-cc-suave">
            {vista.partidas.map((p) => (
              <span key={p.clave}>
                <b className="num text-cc-texto">{p.clave}</b> {p.descripcion} ({vista.conceptos.filter((c) => c.partida === p.clave).length})
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Boton variante="pri" disabled={ocupado} onClick={() => crear([], vista)}>Crear el paquete con estos conceptos</Boton>
            <Boton disabled={ocupado} onClick={() => setVista(null)}>Cancelar</Boton>
          </div>
        </div>
      )}

      {catalogo && (
        <div className="rounded-2xl p-4" style={{ border: '1px solid var(--cc-borde)' }}>
          <p className="mb-2 text-xs text-cc-suave">Partidas del catálogo que entran (cada una trae sus conceptos, en el orden del catálogo):</p>
          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {catalogo.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={elegidas.has(p.id)} onChange={() => alternar(p.id)} />
                <span className="num w-10 text-xs text-cc-suave">{p.clave}</span>
                <span className="truncate">{p.descripcion}</span>
                <span className="num ml-auto text-xs text-cc-tenue">{p.conceptos}</span>
              </label>
            ))}
            {!catalogo.length && <p className="text-sm text-cc-suave">El catálogo está vacío. Impórtalo desde el menú Catálogo.</p>}
          </div>
          <div className="mt-3 flex gap-2">
            <Boton variante="pri" disabled={ocupado || !elegidas.size} onClick={() => crear([...elegidas], null)}>Crear el paquete con estas partidas</Boton>
            <Boton disabled={ocupado} onClick={() => setCatalogo(null)}>Cancelar</Boton>
          </div>
        </div>
      )}
    </Tarjeta>
  )
}
