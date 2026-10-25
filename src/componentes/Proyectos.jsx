import { useCallback, useEffect, useState } from 'react'
import * as repo from '../lib/proyectosRepo'
import { cardStyle } from '../lib/ui'
import ProyectoVista from './ProyectoVista'
import { Aviso, Boton, Campo, Chip, Entrada, Tarjeta } from './ui'

const { mensajeError } = repo

/** Entrada de la app: los proyectos. De cada uno cuelga su paquete de generadores. */
export default function Proyectos({ perfil, onAbrirZapata }) {
  const [abierto, setAbierto] = useState(null)
  const [proyectos, setProyectos] = useState(null)
  const [error, setError] = useState(null)
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const puedeEscribir = perfil && perfil.rol !== 'lectura'

  const cargar = useCallback(async () => {
    try {
      setProyectos(await repo.listarProyectos())
      setError(null)
    } catch (e) {
      setError(mensajeError(e))
      setProyectos([])
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function crear(e) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      const p = await repo.crearProyecto(nombre)
      setNombre('')
      setCreando(false)
      setAbierto(p.id)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  if (abierto)
    return (
      <ProyectoVista
        proyectoId={abierto}
        perfil={perfil}
        onAbrirZapata={onAbrirZapata}
        onVolver={() => {
          setAbierto(null)
          cargar()
        }}
      />
    )

  return (
    <div className="grid max-w-5xl gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">Proyectos</h2>
        <Boton variante="pri" className="ml-auto" disabled={!puedeEscribir} onClick={() => setCreando((x) => !x)}>
          {creando ? 'Cancelar' : '+ Crear proyecto'}
        </Boton>
      </div>

      {error && <Aviso color="rojo">{error}</Aviso>}

      {creando && (
        <Tarjeta className="p-5">
          <form onSubmit={crear} className="grid gap-3">
            <Campo etiqueta="Nombre del proyecto" className="max-w-sm">
              <Entrada autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Casa Bielva" />
            </Campo>
            <p className="text-xs text-cc-suave">Después de crearlo importas su paquete de generadores y empiezas a analizar concepto por concepto.</p>
            <div>
              <Boton type="submit" variante="pri" disabled={ocupado || !nombre.trim()}>Crear proyecto</Boton>
            </div>
          </form>
        </Tarjeta>
      )}

      <section className="grid gap-3">
        {proyectos === null && <p className="text-sm text-cc-suave">Cargando…</p>}
        {proyectos?.length === 0 && !error && (
          <Tarjeta className="px-4 py-8 text-center text-sm text-cc-suave">Todavía no hay proyectos. Crea el primero con el botón de arriba.</Tarjeta>
        )}
        {proyectos?.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setAbierto(p.id)}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-5 py-4 text-left"
            style={{ ...cardStyle, border: 'none', cursor: 'pointer', color: 'var(--cc-texto)' }}
          >
            <b className="text-base">{p.nombre}</b>
            <span className="num text-xs text-cc-suave">{p.clave}</span>
            {p.paquete?.estado === 'archivado' && <Chip color="gris">Paquete archivado</Chip>}
            <span className="ml-auto flex items-center gap-3 text-sm text-cc-suave">
              {p.paquete ? (
                <>
                  <span className="num">{p.listos}/{p.total} conceptos listos</span>
                  <span className="h-2 w-28 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <span className="block h-full" style={{ width: `${p.total ? (p.listos / p.total) * 100 : 0}%`, background: '#1D9E75' }} />
                  </span>
                </>
              ) : (
                <Chip color="ambar">Sin paquete de generadores</Chip>
              )}
            </span>
          </button>
        ))}
      </section>
    </div>
  )
}
