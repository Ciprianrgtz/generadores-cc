import { useCallback, useEffect, useMemo, useState } from 'react'
import { analizarZapataCorrida, aceroZapata, despieceReal, PARAMETROS_OFICINA } from '../dominio/fichas/zapataCorrida'
import { fmt, r2 } from '../dominio/redondeo'
import { varillasPorId } from '../lib/useVarillas'
import * as repo from '../lib/fichasRepo'
import EsquemaZapata from './EsquemaZapata'
import { COLOR_SENTIDO } from './coloresSentido'
import { Aviso, Boton, Campo, Chip, Entrada, Seccion, Seleccion, Tarjeta } from './ui'
import { avisoStyle } from '../lib/ui'

// Datos para verificar contra lo que ya se presupuestó en Neodata (Casa Bielva).
// Una vez guardada la ficha, estos valores viven en la ficha misma.
const VERIFICACION_BIELVA = {
  'ZC-01': { ml: 21.71, referencia: 155.94, tramos: [4.82, 4.6, 4.97, 4.76, 2.56] },
  'ZC-02': { ml: 0.85, referencia: 5.69, tramos: [0.85] },
}

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const lista = (s) => String(s).split(/[,;\s]+/).map(num).filter((n) => n > 0)

// formulario (texto editable) ⇄ parámetros guardados (números)
function formDesdeParametros(p) {
  return {
    ancho: p.seccion.ancho,
    peralte: p.seccion.peralte,
    varillaT: p.transversal.varilla,
    sepT: p.transversal.separacion,
    varillaL: p.longitudinal.varilla,
    sepL: p.longitudinal.separacion,
    recubrimiento: p.criterios.recubrimiento,
    gancho: p.criterios.gancho,
    desperdicio: r2(p.criterios.desperdicio * 100),
    ml: p.verificacion?.ml ?? 0,
    referencia: p.verificacion?.referencia ?? 0,
    tramos: (p.verificacion?.tramos ?? []).map((t) => t.toFixed(2)).join(', '),
  }
}

function parametrosDesdeForm(f) {
  return {
    seccion: { ancho: num(f.ancho), peralte: num(f.peralte) },
    transversal: { varilla: f.varillaT, separacion: num(f.sepT) },
    longitudinal: { varilla: f.varillaL, separacion: num(f.sepL) },
    criterios: { recubrimiento: num(f.recubrimiento), gancho: num(f.gancho), desperdicio: num(f.desperdicio) / 100 },
    verificacion: { ml: num(f.ml), referencia: num(f.referencia), tramos: lista(f.tramos) },
  }
}

function parametrosIniciales(elemento) {
  const corto = elemento.armado.find((a) => a.sentido === 'corto') ?? { varilla: '3', separacion: 0.2 }
  const largo = elemento.armado.find((a) => a.sentido === 'largo') ?? { varilla: '3', separacion: 0.2 }
  return {
    seccion: { ancho: elemento.seccion.ancho, peralte: elemento.seccion.peralte },
    transversal: { varilla: corto.varilla, separacion: corto.separacion },
    longitudinal: { varilla: largo.varilla, separacion: largo.separacion },
    criterios: {
      recubrimiento: PARAMETROS_OFICINA.recubrimiento,
      gancho: PARAMETROS_OFICINA.gancho,
      desperdicio: PARAMETROS_OFICINA.desperdicio,
    },
    verificacion: VERIFICACION_BIELVA[elemento.codigo] ?? { ml: 0, referencia: 0, tramos: [] },
  }
}

// jsonb no conserva el orden de las llaves: se compara con las llaves ordenadas
const canonico = (v) =>
  Array.isArray(v)
    ? v.map(canonico)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonico(v[k])]))
      : v
const mismo = (a, b) => JSON.stringify(canonico(a)) === JSON.stringify(canonico(b))

const ESTADO = {
  borrador: { nombre: 'Borrador', color: 'gris' },
  revisado: { nombre: 'Revisado', color: 'azul' },
  aprobado: { nombre: 'Aprobado', color: 'verde' },
}

function Grupo({ titulo, children }) {
  return (
    <fieldset className="grid grid-cols-2 gap-3 rounded-xl p-3" style={{ border: '1px solid var(--cc-borde)' }}>
      <legend className="px-1" style={{ fontSize: 10, fontWeight: 700, color: 'var(--cc-tenue)', textTransform: 'uppercase', letterSpacing: '.6px' }}>{titulo}</legend>
      {children}
    </fieldset>
  )
}

export default function FichaZapataCorrida({ varillas, perfil }) {
  const tabla = useMemo(() => varillasPorId(varillas), [varillas])
  const [elementos, setElementos] = useState([])
  const [elementoId, setElementoId] = useState(null)
  const [historial, setHistorial] = useState([])
  const [versionVista, setVersionVista] = useState(null) // id de la versión mostrada
  const [nombres, setNombres] = useState({})
  const [f, setF] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  // sentido resaltado entre el esquema y la tabla de pasos: al pasar el cursor (hover) o fijado con clic
  const [hover, setHover] = useState(null)
  const [fijo, setFijo] = useState(null)
  const activo = fijo ?? hover
  const resalte = {
    activo,
    onEntrar: setHover,
    onSalir: () => setHover(null),
    onClick: (g) => setFijo((x) => (x === g ? null : g)),
  }

  useEffect(() => {
    repo
      .elementosTipo('BIELVA', 'ZC')
      .then(({ elementos }) => {
        setElementos(elementos)
        setElementoId((id) => id ?? elementos[0]?.id ?? null)
      })
      .catch((e) => setMensaje({ tipo: 'error', texto: e.message }))
    repo.perfiles().then(setNombres).catch(() => {})
  }, [])

  const elemento = elementos.find((e) => e.id === elementoId)
  const ficha = historial.find((v) => v.id === versionVista) ?? null

  const cargar = useCallback(
    async (idMostrar) => {
      if (!elemento) return
      const vs = await repo.versiones(elemento.id)
      setHistorial(vs)
      const mostrar = vs.find((v) => v.id === idMostrar) ?? vs[0] ?? null
      setVersionVista(mostrar?.id ?? null)
      setF(formDesdeParametros(mostrar ? mostrar.parametros : parametrosIniciales(elemento)))
    },
    [elemento],
  )

  useEffect(() => {
    setMensaje(null)
    cargar().catch((e) => setMensaje({ tipo: 'error', texto: e.message }))
  }, [cargar])

  const resultado = useMemo(() => {
    if (!f || !tabla[f.varillaT] || !tabla[f.varillaL] || num(f.sepT) <= 0 || num(f.sepL) <= 0) return null
    const p = parametrosDesdeForm(f)
    const calc = analizarZapataCorrida({ ...p, varillas: tabla })
    return {
      parametros: p,
      calc,
      generador: aceroZapata(p.verificacion.ml, calc),
      despiece: p.verificacion.tramos.length ? despieceReal(p.verificacion.tramos, calc, tabla) : null,
    }
  }, [f, tabla])

  if (!varillas.length || !f) return <p className="p-4 text-sm text-cc-suave">Cargando…</p>

  const editable = !ficha || ficha.estado === 'borrador'
  const cambios = resultado && (!ficha || !mismo(resultado.parametros, ficha.parametros))
  const rol = perfil?.rol
  const esCapturista = ficha && perfil && ficha.capturado_por === perfil.id
  const ultima = historial[0]
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))

  const contenido = () => ({
    parametros: resultado.parametros,
    resultados: {
      kg_ml: resultado.calc.kgMl,
      kg_ml_neto: resultado.calc.kgMlNeto,
      acero_kg_ml: resultado.calc.acero,
      generador: { ml: resultado.parametros.verificacion.ml, kg: resultado.generador.kg },
    },
    pasos: resultado.calc.pasos,
  })

  async function accion(fn, exito) {
    setOcupado(true)
    setMensaje(null)
    try {
      const fila = await fn()
      await cargar(fila.id)
      setMensaje({ tipo: 'ok', texto: exito })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setOcupado(false)
    }
  }

  const guardar = () =>
    ficha
      ? accion(() => repo.guardarBorrador(ficha.id, contenido()), `Borrador v${ficha.version} guardado`)
      : accion(() => repo.crearVersion(elemento.id, 1, contenido()), 'Ficha v1 creada como borrador')
  const nuevaVersion = () =>
    accion(() => repo.crearVersion(elemento.id, (ultima?.version ?? 0) + 1, contenido()), `Versión v${(ultima?.version ?? 0) + 1} creada como borrador`)
  const estado = (e, texto) => accion(() => repo.cambiarEstado(ficha.id, e), texto)

  const selVarilla = (k) => (
    <Seleccion value={f[k]} disabled={!editable} onChange={(e) => set(k)(e.target.value)}>
      {varillas.map((v) => (
        <option key={v.id} value={v.id}>
          #{v.id} ({Number(v.kg_m).toFixed(3)} kg/m)
        </option>
      ))}
    </Seleccion>
  )
  const numero = (k, paso = 0.01) => (
    <Entrada type="number" step={paso} min="0" value={f[k]} disabled={!editable} onChange={(e) => set(k)(e.target.value)} className="num" />
  )

  const ref = num(f.referencia)
  const cuadra = resultado && ref > 0 && Math.abs(resultado.generador.kg - ref) < 0.005
  const quien = (id) => nombres[id]?.nombre ?? '—'

  return (
    <div className="grid gap-4">
      {/* Barra de la ficha: elemento, versión, estado y acciones */}
      <Tarjeta className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-cc-suave">Elemento</span>
          <Seleccion value={elementoId ?? ''} onChange={(e) => setElementoId(e.target.value)} style={{ width: 'auto' }}>
            {elementos.map((e) => (
              <option key={e.id} value={e.id}>{e.codigo}</option>
            ))}
          </Seleccion>
        </label>
        {historial.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-cc-suave">Versión</span>
            <Seleccion value={versionVista ?? ''} onChange={(e) => cargar(e.target.value)} style={{ width: 'auto' }}>
              {historial.map((v) => (
                <option key={v.id} value={v.id}>v{v.version} · {ESTADO[v.estado].nombre}</option>
              ))}
            </Seleccion>
          </label>
        )}
        {ficha ? <Chip color={ESTADO[ficha.estado].color}>{ESTADO[ficha.estado].nombre}</Chip> : <span className="text-sm" style={{ color: '#f0b866' }}>Sin guardar todavía</span>}
        {cambios && editable && <span className="text-sm" style={{ color: '#f0b866' }}>● Cambios sin guardar</span>}

        <div className="ml-auto flex flex-wrap gap-2">
          {editable && (
            <Boton variante="pri" disabled={ocupado || !cambios || rol === 'lectura'} onClick={guardar}>
              {ficha ? 'Guardar borrador' : 'Guardar como borrador v1'}
            </Boton>
          )}
          {ficha?.estado === 'borrador' && (
            <Boton
              disabled={ocupado || cambios || esCapturista || !['revision', 'aprobacion'].includes(rol)}
              title={esCapturista ? 'Otra persona debe revisar lo que tú capturaste' : undefined}
              onClick={() => estado('revisado', 'Ficha marcada como revisada')}
            >
              Marcar revisada
            </Boton>
          )}
          {ficha?.estado === 'revisado' && (
            <>
              <Boton disabled={ocupado || esCapturista || !['revision', 'aprobacion'].includes(rol)} onClick={() => estado('borrador', 'Ficha regresada a borrador')}>
                Regresar a borrador
              </Boton>
              <Boton variante="pri" disabled={ocupado || esCapturista || rol !== 'aprobacion'} onClick={() => estado('aprobado', 'Ficha aprobada y congelada')}>
                Aprobar
              </Boton>
            </>
          )}
          {ficha?.estado === 'aprobado' && ficha.id === ultima?.id && (
            <Boton disabled={ocupado || rol === 'lectura'} onClick={nuevaVersion}>
              Crear versión nueva
            </Boton>
          )}
        </div>
      </Tarjeta>

      {ficha && (
        <p className="-mt-2 text-xs text-cc-suave">
          Capturó <b className="text-cc-texto">{quien(ficha.capturado_por)}</b>
          {ficha.revisado_por && <> · revisó <b className="text-cc-texto">{quien(ficha.revisado_por)}</b></>}
          {ficha.aprobado_por && <> · aprobó <b className="text-cc-texto">{quien(ficha.aprobado_por)}</b> el {new Date(ficha.aprobado_en).toLocaleString('es-MX')}</>}
          {' · '}actualizada {new Date(ficha.actualizado_en).toLocaleString('es-MX')}
          {esCapturista && ficha.estado !== 'aprobado' && <> · <span style={{ color: '#f0b866' }}>otra persona debe revisarla y aprobarla</span></>}
        </p>
      )}
      {mensaje && <Aviso color={mensaje.tipo === 'error' ? 'rojo' : 'verde'}>{mensaje.texto}</Aviso>}
      {ficha?.estado === 'aprobado' && (
        <p className="-mt-2 text-xs text-cc-suave">Esta versión está aprobada y congelada. Para cambiarla, crea una versión nueva.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <form className="grid content-start gap-3" onSubmit={(e) => e.preventDefault()}>
          <p className="text-xs text-cc-suave">
            {elemento?.descripcion} · análisis por 1.00 ml · fuente: {elemento?.fuente}
          </p>
          <Grupo titulo="Sección">
            <Campo etiqueta="Ancho (m)">{numero('ancho')}</Campo>
            <Campo etiqueta="Peralte (m)">{numero('peralte')}</Campo>
          </Grupo>
          <Grupo titulo="Sentido corto (transversal)">
            <Campo etiqueta="Varilla">{selVarilla('varillaT')}</Campo>
            <Campo etiqueta="Separación (m)">{numero('sepT')}</Campo>
          </Grupo>
          <Grupo titulo="Sentido largo (longitudinal)">
            <Campo etiqueta="Varilla">{selVarilla('varillaL')}</Campo>
            <Campo etiqueta="Separación (m)">{numero('sepL')}</Campo>
          </Grupo>
          <Grupo titulo="Criterios">
            <Campo etiqueta="Recubrimiento por lado (m)">{numero('recubrimiento', 0.005)}</Campo>
            <Campo etiqueta="Gancho por lado (m)">{numero('gancho')}</Campo>
            <Campo etiqueta="Desperdicio (%)">{numero('desperdicio', 0.5)}</Campo>
          </Grupo>
          <Grupo titulo="Verificación contra Neodata">
            <Campo etiqueta="ml de zapata">{numero('ml')}</Campo>
            <Campo etiqueta="Cantidad en Neodata (kg)">{numero('referencia')}</Campo>
            <div className="col-span-2">
              <Campo etiqueta="Tramos medidos para el despiece real (m)">
                <Entrada value={f.tramos} disabled={!editable} onChange={(e) => set('tramos')(e.target.value)} className="num" />
              </Campo>
            </div>
          </Grupo>
        </form>

        {resultado && (
          <div className="grid min-w-0 content-start gap-4">
            <EsquemaZapata parametros={resultado.parametros} calc={resultado.calc} tabla={tabla} {...resalte} />
            <Pasos resultado={resultado} codigo={elemento?.codigo} {...resalte} />
            {ref > 0 && (
              <div style={{ ...avisoStyle(cuadra ? 'verde' : 'rojo'), padding: '10px 14px' }}>
                <b style={{ color: cuadra ? '#34d399' : '#f87171' }}>{cuadra ? '✓ Cuadra con Neodata' : '✗ No cuadra con Neodata'}</b>
                <span className="num ml-2 text-cc-suave">
                  ficha {fmt(resultado.generador.kg)} kg · Neodata {fmt(ref)} kg
                  {!cuadra && ` · Δ ${fmt(resultado.generador.kg - ref)} kg`}
                </span>
              </div>
            )}
            {resultado.despiece && <Despiece despiece={resultado.despiece} calc={resultado.calc} desperdicio={num(f.desperdicio)} />}
          </div>
        )}
      </div>
    </div>
  )
}

const encabezadoTabla = { fontSize: 10, fontWeight: 700, color: 'var(--cc-tenue)', textTransform: 'uppercase', letterSpacing: '.6px' }
const filaSub = { background: 'rgba(255,255,255,0.04)', ...encabezadoTabla }
const lineaFila = { borderTop: '1px solid var(--cc-borde)' }

function Pasos({ resultado, codigo, activo, onEntrar, onSalir, onClick }) {
  // a qué sentido pertenece cada fila (los pasos 1-3 son el corto, 4-6 el largo)
  const grupos = []
  let g = null
  for (const p of resultado.calc.pasos) {
    if (p.tipo === 'sub') g = p.texto.startsWith('Sentido corto') ? 'corto' : 'largo'
    else if (p.tipo === 'total' || p.tipo === 'nota') g = null
    grupos.push(g)
  }
  return (
    <Tarjeta className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left" style={encabezadoTabla}>
            <th className="w-8 px-3 py-3"></th>
            <th className="px-3 py-3">Paso</th>
            <th className="px-3 py-3">Cálculo</th>
            <th className="px-3 py-3 text-right">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {resultado.calc.pasos.map((p, i) => {
            const grupo = grupos[i]
            const vivo = grupo && activo === grupo
            const lazo = grupo
              ? {
                  onMouseEnter: () => onEntrar(grupo),
                  onMouseLeave: onSalir,
                  onClick: () => onClick(grupo),
                  style: { cursor: 'pointer', ...(vivo ? { background: `${COLOR_SENTIDO[grupo]}22`, boxShadow: `inset 3px 0 0 ${COLOR_SENTIDO[grupo]}` } : null) },
                }
              : {}
            return p.tipo === 'sub' ? (
              <tr key={i} {...lazo} style={{ ...filaSub, ...lazo.style }}>
                <td colSpan={4} className="px-3 py-1.5">
                  <span style={{ color: COLOR_SENTIDO[grupo] }}>● </span>
                  {p.texto}
                </td>
              </tr>
            ) : (
              <tr
                key={i}
                {...lazo}
                style={{
                  ...lineaFila,
                  ...(p.tipo === 'total' ? { background: 'rgba(29,158,117,0.10)', fontWeight: 700 } : null),
                  ...(p.tipo === 'nota' ? { color: 'var(--cc-suave)' } : null),
                  ...lazo.style,
                }}
              >
                <td className="num px-3 py-1.5 text-xs text-cc-tenue">{p.tipo === 'total' ? 'Σ' : p.id ?? ''}</td>
                <td className="px-3 py-1.5">{p.texto}</td>
                <td className="num px-3 py-1.5 text-xs text-cc-suave">{p.formula}</td>
                <td className="num whitespace-nowrap px-3 py-1.5 text-right">{p.resultado}</td>
              </tr>
            )
          })}
          <tr style={filaSub}>
            <td colSpan={4} className="px-3 py-1.5">Aplicado al generador</td>
          </tr>
          <tr style={{ ...lineaFila, fontWeight: 700, background: 'rgba(29,158,117,0.14)' }}>
            <td className="num px-3 py-2.5 text-xs text-cc-tenue">→</td>
            <td className="px-3 py-2.5">Acero de {codigo}</td>
            <td className="num px-3 py-2.5 text-xs font-normal text-cc-suave">{resultado.generador.formula}</td>
            <td className="num whitespace-nowrap px-3 py-2.5 text-right" style={{ color: '#3ddba6' }}>{fmt(resultado.generador.kg)} kg</td>
          </tr>
        </tbody>
      </table>
    </Tarjeta>
  )
}

function Despiece({ despiece, calc, desperdicio }) {
  return (
    <Tarjeta>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--cc-borde)' }}>
        <Seccion>Comparativo informativo: despiece real por tramos</Seccion>
        <p className="mt-1 text-xs text-cc-suave">
          Cada tramo armado por separado, ganchos solo en los extremos. No incluye traslapes ni anclajes en esquinas. No modifica la cantidad del generador.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left" style={encabezadoTabla}>
              <th className="px-3 py-2">Tramo</th>
              <th className="px-3 py-2 text-right">L (m)</th>
              <th className="px-3 py-2 text-right">Varillas cortas</th>
              <th className="px-3 py-2 text-right">Largo varilla larga</th>
              <th className="px-3 py-2 text-right">kg</th>
            </tr>
          </thead>
          <tbody>
            {despiece.filas.map((t, i) => (
              <tr key={i} style={lineaFila}>
                <td className="num px-3 py-1.5">{i + 1}</td>
                <td className="num px-3 py-1.5 text-right">{fmt(t.L)}</td>
                <td className="num px-3 py-1.5 text-right">{t.nT}</td>
                <td className="num px-3 py-1.5 text-right">{fmt(t.lenL)}</td>
                <td className="num px-3 py-1.5 text-right">{fmt(t.kg)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid var(--cc-borde)', fontWeight: 600 }}>
              <td className="px-3 py-1.5">Despiece real</td>
              <td className="num px-3 py-1.5 text-right">{fmt(despiece.ml)}</td>
              <td colSpan={2}></td>
              <td className="num px-3 py-1.5 text-right">{fmt(despiece.kgReal)}</td>
            </tr>
            <tr>
              <td className="px-3 py-1.5" colSpan={4}>Análisis por metro ({fmt(despiece.ml)} ml × {fmt(calc.kgMl)} kg/ml)</td>
              <td className="num px-3 py-1.5 text-right">{fmt(despiece.kgPorMetro)}</td>
            </tr>
            <tr style={{ color: '#f0b866' }}>
              <td className="px-3 py-1.5" colSpan={4}>Diferencia (lo que cubre el método por metro además del {fmt(desperdicio)} % de desperdicio)</td>
              <td className="num px-3 py-1.5 text-right">
                {fmt(despiece.diferencia)} · {despiece.kgReal > 0 ? fmt(r2((despiece.diferencia / despiece.kgReal) * 100)) : '—'} %
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Tarjeta>
  )
}