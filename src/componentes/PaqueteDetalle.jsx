import { useCallback, useEffect, useMemo, useState } from 'react'
import * as proy from '../lib/proyectosRepo'
import ComoSeGenera from './ComoSeGenera'
import { readSheet } from 'read-excel-file/browser'
import { leerCatalogoNeodata } from '../dominio/importarNeodata'
import * as repo from '../lib/paquetesRepo'
import { Aviso, Boton, BotonIcono, Campo, Chip, Entrada, Seccion, Seleccion, AreaTexto, Tarjeta } from './ui'
import { FormularioConcepto, FormularioEliminar, FormularioNombre, FormularioPartida } from './formularios'
import { botones } from '../lib/ui'
import { fmt, unidadTexto } from '../dominio/redondeo'

const { mensajeError } = repo

const ESTADOS = {
  pendiente: { nombre: 'Pendiente', color: 'gris' },
  en_proceso: { nombre: 'En proceso', color: 'ambar' },
  listo: { nombre: 'Listo', color: 'verde' },
}

export default function PaqueteDetalle({ paqueteId, perfil, terreno, onEliminado, onAbrirAnalisis, onCambio }) {
  const [datos, setDatos] = useState(null)
  const [sel, setSel] = useState(null) // id del concepto elegido
  const [error, setError] = useState(null)
  const [agregando, setAgregando] = useState(null) // { partidaId, opciones }
  const [editandoPartida, setEditandoPartida] = useState(null) // id
  const [nuevaPartida, setNuevaPartida] = useState(false)
  const [renombrando, setRenombrando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [importacion, setImportacion] = useState(null) // lo leído del Excel, antes de confirmar
  const [aviso, setAviso] = useState(null)
  const puedeEscribir = perfil && perfil.rol !== 'lectura'

  const cargar = useCallback(async () => {
    try {
      setDatos(await repo.paquete(paqueteId))
      setError(null)
    } catch (e) {
      setError(mensajeError(e))
    }
  }, [paqueteId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const porPartida = useMemo(() => {
    const m = {}
    for (const c of datos?.conceptos ?? []) (m[c.paquete_partida_id] ??= []).push(c)
    return m
  }, [datos])

  async function hacer(fn) {
    try {
      await fn()
      await cargar()
      onCambio?.()
      return true
    } catch (e) {
      setError(mensajeError(e))
      return false
    }
  }

  async function abrirAgregar(pp) {
    if (agregando?.partidaId === pp.id) return setAgregando(null)
    try {
      const opciones = await repo.conceptosDisponibles(pp, porPartida[pp.id] ?? [])
      setAgregando({ partidaId: pp.id, opciones, nuevo: false })
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  async function leerExcel(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setAviso(null)
    try {
      const r = leerCatalogoNeodata(await readSheet(archivo))
      if (!r.conceptos.length) throw new Error('No encontré conceptos. Revisa que sea un reporte de Neodata ("b) Estándar" o "j) Totales por Tipo").')
      const ya = new Set(datos.conceptos.map((c) => c.clave))
      setImportacion({ ...r, archivo: archivo.name, nuevos: r.conceptos.filter((c) => !ya.has(c.clave)).length })
    } catch (err) {
      setImportacion(null)
      setError(err.message)
    }
  }

  async function confirmarImportacion() {
    const ok = await hacer(async () => {
      const r = await repo.importarAlPaquete(paqueteId, importacion, [...datos.partidas], [...datos.conceptos])
      setAviso(`Importado: ${r.partidasNuevas} partidas nuevas y ${r.conceptosNuevos} conceptos nuevos; ${r.yaEstaban} ya estaban y no se tocaron.`)
    })
    if (ok) setImportacion(null)
  }

  if (!datos) return <p className="text-sm text-cc-suave">{error ?? 'Cargando…'}</p>

  const concepto = datos.conceptos.find((c) => c.id === sel)
  const partidaDe = (c) => datos.partidas.find((p) => p.id === c.paquete_partida_id)
  const listos = datos.conceptos.filter((c) => c.estado === 'listo').length
  const conVolumen = datos.conceptos.filter((c) => c.cantidad > 0).length
  const ultimaPartida = Math.max(0, ...datos.partidas.map((p) => p.orden))

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {renombrando ? (
          <FormularioNombre
            inicial={datos.cabecera.nombre}
            onGuardar={async (nombre) => {
              if (await hacer(() => repo.renombrarPaquete(paqueteId, nombre))) setRenombrando(false)
            }}
            onCancelar={() => setRenombrando(false)}
          />
        ) : (
          <>
            <h2 className="text-xl font-bold">{datos.cabecera.nombre}</h2>
            {puedeEscribir && <BotonIcono title="Cambiar el nombre del paquete" onClick={() => setRenombrando(true)}>✎</BotonIcono>}
          </>
        )}
        {datos.cabecera.estado === 'archivado' && <Chip color="gris">Archivado</Chip>}
        <span className="num text-xs text-cc-suave">{datos.cabecera.proyecto?.clave}</span>
        <span className="num ml-auto text-sm text-cc-suave">{conVolumen}/{datos.conceptos.length} con volumen · {listos} listos</span>
      </div>

      {puedeEscribir && (
        <div className="flex flex-wrap items-center gap-2">
          <Boton onClick={() => setNuevaPartida((x) => !x)}>+ Partida</Boton>
          <label className="inline-flex cursor-pointer items-center" style={{ ...botones.sec }}>
            Importar Excel de Neodata a este paquete
            <input type="file" accept=".xlsx" className="hidden" onChange={leerExcel} />
          </label>
          <span className="text-xs text-cc-suave">El reporte puede venir sin volúmenes: aquí solo se toman partidas, claves, descripciones y unidades.</span>
          <span className="ml-auto flex gap-2">
            <Boton onClick={() => hacer(() => repo.archivarPaquete(paqueteId, datos.cabecera.estado !== 'archivado'))}>
              {datos.cabecera.estado === 'archivado' ? 'Reactivar paquete' : 'Archivar paquete'}
            </Boton>
            <Boton variante="rojo" onClick={() => setEliminando((x) => !x)}>Eliminar paquete…</Boton>
          </span>
        </div>
      )}

      {eliminando && (
        <FormularioEliminar
          nombre={datos.cabecera.nombre}
          conceptos={datos.conceptos.length}
          onCancelar={() => setEliminando(false)}
          onEliminar={async () => {
            try {
              await repo.eliminarPaquete(paqueteId)
              onEliminado()
            } catch (e) {
              setError(mensajeError(e))
            }
          }}
        />
      )}

      {error && <Aviso color="rojo">{error}</Aviso>}
      {aviso && <Aviso color="verde">{aviso}</Aviso>}

      {importacion && (
        <Tarjeta className="px-5 py-4 text-sm">
          <p>
            <b>{importacion.archivo}</b>: {importacion.partidas.length} partidas y {importacion.conceptos.length} conceptos; <b>{importacion.nuevos}</b> son nuevos para este paquete.
            Se agregan al final, en el orden del reporte, y lo que ya está no se toca.
          </p>
          <div className="mt-3 flex gap-2">
            <Boton variante="pri" disabled={!importacion.nuevos && !importacion.partidas.length} onClick={confirmarImportacion}>Agregar al paquete</Boton>
            <Boton onClick={() => setImportacion(null)}>Cancelar</Boton>
          </div>
        </Tarjeta>
      )}

      {nuevaPartida && (
        <FormularioPartida
          titulo="Nueva partida"
          inicial={{ clave: '', descripcion: '' }}
          onGuardar={async (v) => {
            if (await hacer(() => repo.agregarPartida(paqueteId, v, ultimaPartida))) setNuevaPartida(false)
          }}
          onCancelar={() => setNuevaPartida(false)}
        />
      )}

      {!datos.partidas.length && !nuevaPartida && (
        <Tarjeta className="px-4 py-8 text-center text-sm text-cc-suave">
          Este paquete está vacío. Agrega una partida con "+ Partida" o importa el Excel de Neodata del proyecto.
        </Tarjeta>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 content-start gap-3">
          {datos.partidas.map((pp, i) => {
            const filas = porPartida[pp.id] ?? []
            return (
              <Tarjeta key={pp.id} className="overflow-hidden">
                {editandoPartida === pp.id ? (
                  <FormularioPartida
                    titulo="Editar partida"
                    inicial={{ clave: pp.clave, descripcion: pp.descripcion }}
                    onGuardar={async (v) => {
                      if (await hacer(() => repo.actualizarPartida(pp.id, v))) setEditandoPartida(null)
                    }}
                    onCancelar={() => setEditandoPartida(null)}
                    sinMarco
                  />
                ) : (
                  <header className="flex flex-wrap items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--cc-borde)', background: 'rgba(255,255,255,0.03)' }}>
                    <span className="num rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: 'rgba(29,158,117,0.14)', color: '#3ddba6' }}>{pp.clave}</span>
                    <b className="text-sm uppercase tracking-wide">{pp.descripcion}</b>
                    <span className="num text-xs text-cc-suave">{filas.length} conceptos</span>
                    {puedeEscribir && (
                      <span className="ml-auto flex items-center gap-1.5">
                        <BotonIcono title="Editar clave y nombre de la partida" onClick={() => setEditandoPartida(pp.id)}>✎</BotonIcono>
                        <BotonIcono title="Subir partida" disabled={i === 0} onClick={() => hacer(() => repo.moverPartida(pp.id, -1))}>▲</BotonIcono>
                        <BotonIcono title="Bajar partida" disabled={i === datos.partidas.length - 1} onClick={() => hacer(() => repo.moverPartida(pp.id, 1))}>▼</BotonIcono>
                        <Boton chico onClick={() => abrirAgregar(pp)}>+ Concepto</Boton>
                        <BotonIcono
                          peligro
                          title="Quitar partida del paquete"
                          onClick={() => confirm(`¿Quitar la partida ${pp.clave} y sus ${filas.length} conceptos de este paquete?`) && hacer(() => repo.quitarPartida(pp.id))}
                        >✕</BotonIcono>
                      </span>
                    )}
                  </header>
                )}

                {agregando?.partidaId === pp.id && (
                  <div className="px-4 py-3 text-sm" style={{ borderBottom: '1px solid var(--cc-borde)', background: 'rgba(29,158,117,0.06)' }}>
                    {agregando.nuevo ? (
                      <FormularioConcepto
                        titulo="Concepto nuevo"
                        inicial={{ clave: '', descripcion: '', unidad: '' }}
                        onGuardar={async (v) => {
                          if (await hacer(() => repo.agregarConcepto(paqueteId, pp, v, Math.max(0, ...filas.map((f) => f.orden))))) setAgregando(null)
                        }}
                        onCancelar={() => setAgregando(null)}
                      />
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {agregando.opciones.length > 0 ? (
                          <Seleccion
                            style={{ width: 'auto', maxWidth: '100%' }}
                            defaultValue=""
                            onChange={async (e) => {
                              const c = agregando.opciones.find((x) => x.id === e.target.value)
                              if (c && (await hacer(() => repo.agregarConcepto(paqueteId, pp, c, Math.max(0, ...filas.map((f) => f.orden)))))) setAgregando(null)
                            }}
                          >
                            <option value="" disabled>Del catálogo: elige un concepto…</option>
                            {agregando.opciones.map((c) => (
                              <option key={c.id} value={c.id}>{c.clave} · {c.descripcion.slice(0, 70)}</option>
                            ))}
                          </Seleccion>
                        ) : (
                          <span className="text-cc-suave">No hay conceptos del catálogo por agregar en esta partida.</span>
                        )}
                        <Boton chico onClick={() => setAgregando({ ...agregando, nuevo: true })}>✎ Escribir uno nuevo</Boton>
                      </div>
                    )}
                  </div>
                )}

                <ul>
                  {filas.map((c, j) => {
                    const activo = sel === c.id
                    return (
                      <li
                        key={c.id}
                        onClick={() => setSel(c.id)}
                        className="flex cursor-pointer items-start gap-2 px-4 py-2"
                        style={{
                          borderTop: j === 0 ? 'none' : '1px solid var(--cc-borde)',
                          background: activo ? 'rgba(29,158,117,0.14)' : 'transparent',
                          boxShadow: activo ? 'inset 0 0 0 1px rgba(29,158,117,0.35)' : 'none',
                        }}
                      >
                        {puedeEscribir && (
                          <span className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                            <BotonIcono style={{ width: 24, height: 22 }} title="Subir" disabled={j === 0} onClick={() => hacer(() => repo.moverConcepto(c.id, -1))}>▲</BotonIcono>
                            <BotonIcono style={{ width: 24, height: 22 }} title="Bajar" disabled={j === filas.length - 1} onClick={() => hacer(() => repo.moverConcepto(c.id, 1))}>▼</BotonIcono>
                          </span>
                        )}
                        <span className="num w-20 shrink-0 pt-0.5 text-xs font-bold" style={{ color: activo ? '#3ddba6' : 'var(--cc-suave)' }}>{c.clave}</span>
                        <span className="min-w-0 flex-1 text-sm leading-snug">
                          <span className="line-clamp-2">{c.descripcion}</span>
                        </span>
                        <span
                          className="num w-24 shrink-0 pt-0.5 text-right text-sm"
                          style={{ color: c.cantidad > 0 ? 'var(--cc-texto)' : 'var(--cc-tenue)', fontWeight: c.cantidad > 0 ? 600 : 400 }}
                          title={c.cantidad > 0 ? 'Cantidad del análisis guardado' : 'Sin analizar'}
                        >
                          {fmt(c.cantidad ?? 0)}
                        </span>
                        <span className="num w-10 shrink-0 pt-0.5 text-xs text-cc-suave">{unidadTexto(c.unidad)}</span>
                        {c.nota && <Chip color="azul" style={{ marginTop: 2 }}>Nota</Chip>}
                        <Chip color={ESTADOS[c.estado].color} style={{ marginTop: 2 }}>{ESTADOS[c.estado].nombre}</Chip>
                      </li>
                    )
                  })}
                  {!filas.length && <li className="px-4 py-3 text-sm text-cc-suave">Sin conceptos en esta partida.</li>}
                </ul>
              </Tarjeta>
            )
          })}
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          {concepto ? (
            <PanelConcepto
              key={concepto.id}
              concepto={concepto}
              partida={partidaDe(concepto)}
              puedeEscribir={puedeEscribir}
              terreno={terreno}
              hacer={hacer}
              onQuitado={() => setSel(null)}
              onAbrirAnalisis={onAbrirAnalisis}
            />
          ) : (
            <Tarjeta className="p-5 text-sm text-cc-suave">Elige un concepto de la lista para ver su análisis.</Tarjeta>
          )}
        </aside>
      </div>
    </div>
  )
}

const ANALISIS = {
  terreno: { nombre: 'Superficie del terreno', detalle: 'Limpia y despalme, trazo… lo que se mide por el terreno' },
  zapata_corrida: { nombre: 'Zapata corrida (ficha de acero)', detalle: 'Acero de la parrilla por metro lineal' },
  excavacion: { nombre: 'Excavación por elementos', detalle: 'Cepas de zapatas, trabes y todo lo que toca el suelo' },
  afine: { nombre: 'Afine de fondo y taludes', detalle: 'Fondo y paredes de las cepas de la excavación' },
  plantilla: { nombre: 'Plantilla bajo zapatas y trabes', detalle: 'ml de zapatas corridas y trabes de liga × ancho con vuelo' },
  areas: { nombre: 'Suma de áreas', detalle: 'Membrana, afine para firme, firmes… se eligen las áreas que entran' },
  longitud: { nombre: 'Longitud de elementos', detalle: 'Cimbra de zapatas corridas, de trabes de liga… por metro lineal' },
  acero_ficha: { nombre: 'Acero por ficha', detalle: 'ml del elemento × kg/ml de su ficha (ZC-01, ZC-02, tipos nuevos…)' },
  bastones: { nombre: 'Bastones de losa de cimentación', detalle: 'CC y CI: franjas con su largo de bastón (claro ÷ 4) y sus ml' },
}

// Sugerencia según de qué es el concepto (el usuario siempre puede cambiarla)
const sugerido = (c) =>
  /limpia y despalme|trazo y nivelaci[oó]n/i.test(c.descripcion)
    ? 'terreno'
    : /^cimbrado de (zapatas|contra\s?trabe|trabes?)/i.test(c.descripcion)
      ? 'longitud'
      : /^plantilla/i.test(c.descripcion)
      ? 'plantilla'
      : /membrana|afine.*firme|firme de concreto/i.test(c.descripcion)
        ? 'areas'
        : /^afine y compactaci[oó]n de fondo/i.test(c.descripcion)
      ? 'afine'
      : /^excavaci[oó]n/i.test(c.descripcion)
      ? 'excavacion'
      : /^acero de refuerzo en zapata corrida/i.test(c.descripcion)
        ? 'acero_ficha'
        : /^acero de refuerzo en (losa de cimentaci[oó]n|cimentaci[oó]n colindante)/i.test(c.descripcion)
          ? 'bastones'
        : /zapata corrida/i.test(c.descripcion)
          ? 'zapata_corrida'
          : null

function PanelConcepto({ concepto, partida, puedeEscribir, terreno, hacer, onQuitado, onAbrirAnalisis }) {
  const [v, setV] = useState({ clave: concepto.clave, descripcion: concepto.descripcion, unidad: concepto.unidad })
  const [gen, setGen] = useState(null) // análisis ya guardado de este concepto
  const [nota, setNota] = useState(concepto.nota ?? '')
  useEffect(() => {
    let vivo = true
    proy.generador(concepto.id).then((g) => vivo && setGen(g)).catch(() => {})
    return () => {
      vivo = false
    }
  }, [concepto.id, concepto.estado])
  const sug = sugerido(concepto)
  const cambio = v.clave !== concepto.clave || v.descripcion !== concepto.descripcion || v.unidad !== concepto.unidad
  const valido = v.clave.trim() && v.descripcion.trim() && v.unidad.trim()
  const campo = (k) => ({ value: v[k], disabled: !puedeEscribir, onChange: (e) => setV({ ...v, [k]: e.target.value }) })

  return (
    <Tarjeta className="grid gap-4 p-5">
      <div className="rounded-xl p-3" style={{ background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.3)' }}>
        <Seccion style={{ color: '#3ddba6' }}>Análisis y generador</Seccion>
        <div className="mt-2 grid gap-2">
          <Seleccion
            value={concepto.analisis_tipo ?? ''}
            disabled={!puedeEscribir}
            onChange={(e) => hacer(() => proy.asignarAnalisis(concepto.id, e.target.value))}
          >
            <option value="">¿Cómo se analiza este concepto?</option>
            {Object.entries(ANALISIS).map(([id, a]) => (
              <option key={id} value={id}>{a.nombre}</option>
            ))}
          </Seleccion>
          {!concepto.analisis_tipo && sug && puedeEscribir && (
            <Boton chico onClick={() => hacer(() => proy.asignarAnalisis(concepto.id, sug))}>Sugerido: {ANALISIS[sug].nombre}</Boton>
          )}
          {concepto.analisis_tipo && <ComoSeGenera concepto={concepto} generador={gen} terreno={terreno} compacto />}
          <Boton variante="pri" disabled={!concepto.analisis_tipo} onClick={() => onAbrirAnalisis(concepto)}>
            {gen ? 'Abrir el análisis' : 'Hacer el análisis'}
          </Boton>
        </div>
      </div>
      <div className="grid gap-2">
        <Campo etiqueta="Nota del concepto (por ejemplo, por qué difiere de Neodata)">
          <AreaTexto value={nota} rows={3} disabled={!puedeEscribir} onChange={(e) => setNota(e.target.value)} style={{ lineHeight: 1.4 }} />
        </Campo>
        {puedeEscribir && nota !== (concepto.nota ?? '') && (
          <div className="flex gap-2">
            <Boton variante="pri" onClick={() => hacer(() => repo.guardarNota(concepto.id, nota))}>Guardar nota</Boton>
            <Boton onClick={() => setNota(concepto.nota ?? '')}>Deshacer</Boton>
          </div>
        )}
      </div>
      <Seccion>{partida?.clave} · concepto del paquete (editable)</Seccion>
      <div className="grid grid-cols-[1fr_88px] gap-2">
        <Campo etiqueta="Clave">
          <Entrada {...campo('clave')} className="num" />
        </Campo>
        <Campo etiqueta="Unidad">
          <Entrada {...campo('unidad')} className="num" />
        </Campo>
      </div>
      <Campo etiqueta="Descripción">
        <AreaTexto {...campo('descripcion')} rows={6} style={{ lineHeight: 1.4 }} />
      </Campo>
      {puedeEscribir && cambio && (
        <div className="flex gap-2">
          <Boton variante="pri" disabled={!valido} onClick={() => hacer(() => repo.actualizarConcepto(concepto.id, v))}>Guardar cambios</Boton>
          <Boton onClick={() => setV({ clave: concepto.clave, descripcion: concepto.descripcion, unidad: concepto.unidad })}>Deshacer</Boton>
        </div>
      )}
      <p className="-mt-2 text-xs text-cc-tenue">Los cambios son solo de este paquete: el catálogo y otras casas no se tocan.</p>

      <Campo etiqueta="Estado del concepto">
        <Seleccion value={concepto.estado} disabled={!puedeEscribir} onChange={(e) => hacer(() => repo.cambiarEstadoConcepto(concepto.id, e.target.value))}>
          {Object.entries(ESTADOS).map(([id, e]) => (
            <option key={id} value={id}>{e.nombre}</option>
          ))}
        </Seleccion>
      </Campo>
      {puedeEscribir && (
        <button
          type="button"
          className="text-left text-xs hover:underline"
          style={{ color: '#f87171' }}
          onClick={async () => {
            if (confirm(`¿Quitar ${concepto.clave} de este paquete?`) && (await hacer(() => repo.quitarConcepto(concepto.id)))) onQuitado()
          }}
        >
          Quitar este concepto del paquete
        </button>
      )}
    </Tarjeta>
  )
}
