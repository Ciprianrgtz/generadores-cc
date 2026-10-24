import { useCallback, useEffect, useMemo, useState } from 'react'
import { analizarZapataCorrida, aceroZapata, despieceReal, PARAMETROS_OFICINA } from '../dominio/fichas/zapataCorrida'
import { fmt, r2 } from '../dominio/redondeo'
import { varillasPorId } from '../lib/useVarillas'
import * as repo from '../lib/fichasRepo'

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
  borrador: { nombre: 'Borrador', clase: 'bg-st-sin' },
  revisado: { nombre: 'Revisado', clase: 'bg-st-ver' },
  aprobado: { nombre: 'Aprobado', clase: 'bg-st-ok' },
}

function Campo({ etiqueta, children }) {
  return (
    <label className="grid gap-1 text-xs text-slate-500">
      {etiqueta}
      {children}
    </label>
  )
}

const claseInput =
  'num w-full min-w-0 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-acento focus:outline-none disabled:bg-slate-100 disabled:text-slate-500'

function Grupo({ titulo, children }) {
  return (
    <fieldset className="grid grid-cols-2 gap-3 rounded-md border border-slate-300 p-3">
      <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{titulo}</legend>
      {children}
    </fieldset>
  )
}

const boton = 'rounded border px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40'
const botonPri = `${boton} border-acento bg-acento text-white`
const botonSec = `${boton} border-slate-300 bg-white text-slate-800`

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

  if (!varillas.length || !f) return <p className="p-4 text-sm text-slate-500">Cargando…</p>

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
    <select value={f[k]} disabled={!editable} onChange={(e) => set(k)(e.target.value)} className={claseInput}>
      {varillas.map((v) => (
        <option key={v.id} value={v.id}>
          #{v.id} ({Number(v.kg_m).toFixed(3)} kg/m)
        </option>
      ))}
    </select>
  )
  const numero = (k, paso = 0.01) => (
    <input type="number" step={paso} min="0" value={f[k]} disabled={!editable} onChange={(e) => set(k)(e.target.value)} className={claseInput} />
  )

  const ref = num(f.referencia)
  const cuadra = resultado && ref > 0 && Math.abs(resultado.generador.kg - ref) < 0.005
  const quien = (id) => nombres[id]?.nombre ?? '—'

  return (
    <div className="grid gap-4">
      {/* Barra de la ficha: elemento, versión, estado y acciones */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Elemento</span>
          <select value={elementoId ?? ''} onChange={(e) => setElementoId(e.target.value)} className={`${claseInput} w-auto`}>
            {elementos.map((e) => (
              <option key={e.id} value={e.id}>{e.codigo}</option>
            ))}
          </select>
        </label>
        {historial.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Versión</span>
            <select value={versionVista ?? ''} onChange={(e) => cargar(e.target.value)} className={`${claseInput} w-auto`}>
              {historial.map((v) => (
                <option key={v.id} value={v.id}>v{v.version} · {ESTADO[v.estado].nombre}</option>
              ))}
            </select>
          </label>
        )}
        {ficha ? (
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white ${ESTADO[ficha.estado].clase}`}>
            {ESTADO[ficha.estado].nombre}
          </span>
        ) : (
          <span className="text-sm text-st-par">Sin guardar todavía</span>
        )}
        {cambios && editable && <span className="text-sm text-st-par">● Cambios sin guardar</span>}

        <div className="ml-auto flex flex-wrap gap-2">
          {editable && (
            <button className={botonPri} disabled={ocupado || !cambios || rol === 'lectura'} onClick={guardar}>
              {ficha ? 'Guardar borrador' : 'Guardar como borrador v1'}
            </button>
          )}
          {ficha?.estado === 'borrador' && (
            <button
              className={botonSec}
              disabled={ocupado || cambios || esCapturista || !['revision', 'aprobacion'].includes(rol)}
              title={esCapturista ? 'Otra persona debe revisar lo que tú capturaste' : undefined}
              onClick={() => estado('revisado', 'Ficha marcada como revisada')}
            >
              Marcar revisada
            </button>
          )}
          {ficha?.estado === 'revisado' && (
            <>
              <button className={botonSec} disabled={ocupado || esCapturista || !['revision', 'aprobacion'].includes(rol)} onClick={() => estado('borrador', 'Ficha regresada a borrador')}>
                Regresar a borrador
              </button>
              <button className={botonPri} disabled={ocupado || esCapturista || rol !== 'aprobacion'} onClick={() => estado('aprobado', 'Ficha aprobada y congelada')}>
                Aprobar
              </button>
            </>
          )}
          {ficha?.estado === 'aprobado' && ficha.id === ultima?.id && (
            <button className={botonSec} disabled={ocupado || rol === 'lectura'} onClick={nuevaVersion}>
              Crear versión nueva
            </button>
          )}
        </div>
      </div>

      {ficha && (
        <p className="-mt-2 text-xs text-slate-500">
          Capturó <b>{quien(ficha.capturado_por)}</b>
          {ficha.revisado_por && <> · revisó <b>{quien(ficha.revisado_por)}</b></>}
          {ficha.aprobado_por && <> · aprobó <b>{quien(ficha.aprobado_por)}</b> el {new Date(ficha.aprobado_en).toLocaleString('es-MX')}</>}
          {' · '}actualizada {new Date(ficha.actualizado_en).toLocaleString('es-MX')}
          {esCapturista && ficha.estado !== 'aprobado' && <> · <span className="text-st-par">otra persona debe revisarla y aprobarla</span></>}
        </p>
      )}
      {mensaje && (
        <p className={`rounded border-l-4 bg-white px-3 py-2 text-sm ${mensaje.tipo === 'error' ? 'border-st-err text-st-err' : 'border-st-ok text-st-ok'}`}>
          {mensaje.texto}
        </p>
      )}
      {ficha?.estado === 'aprobado' && (
        <p className="-mt-2 text-xs text-slate-500">Esta versión está aprobada y congelada. Para cambiarla, crea una versión nueva.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <form className="grid content-start gap-3" onSubmit={(e) => e.preventDefault()}>
          <p className="text-xs text-slate-500">
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
                <input value={f.tramos} disabled={!editable} onChange={(e) => set('tramos')(e.target.value)} className={claseInput} />
              </Campo>
            </div>
          </Grupo>
        </form>

        {resultado && (
          <div className="grid min-w-0 content-start gap-4">
            <Pasos resultado={resultado} codigo={elemento?.codigo} />
            {ref > 0 && (
              <div className={`rounded-md border border-l-4 bg-white px-3 py-2 text-sm ${cuadra ? 'border-st-ok' : 'border-st-err'}`}>
                <b className={cuadra ? 'text-st-ok' : 'text-st-err'}>{cuadra ? '✓ Cuadra con Neodata' : '✗ No cuadra con Neodata'}</b>
                <span className="num ml-2 text-slate-600">
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

function Pasos({ resultado, codigo }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
            <th className="w-8 px-3 py-2"></th>
            <th className="px-3 py-2">Paso</th>
            <th className="px-3 py-2">Cálculo</th>
            <th className="px-3 py-2 text-right">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {resultado.calc.pasos.map((p, i) =>
            p.tipo === 'sub' ? (
              <tr key={i} className="bg-slate-100">
                <td colSpan={4} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{p.texto}</td>
              </tr>
            ) : (
              <tr key={i} className={`border-t border-slate-200 ${p.tipo === 'total' ? 'bg-sky-50 font-bold' : ''} ${p.tipo === 'nota' ? 'text-slate-500' : ''}`}>
                <td className="num px-3 py-1.5 text-xs text-slate-400">{p.tipo === 'total' ? 'Σ' : p.id ?? ''}</td>
                <td className="px-3 py-1.5">{p.texto}</td>
                <td className="num px-3 py-1.5 text-xs text-slate-500">{p.formula}</td>
                <td className="num whitespace-nowrap px-3 py-1.5 text-right">{p.resultado}</td>
              </tr>
            ),
          )}
          <tr className="bg-slate-100">
            <td colSpan={4} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Aplicado al generador</td>
          </tr>
          <tr className="border-t border-slate-200 font-bold">
            <td className="num px-3 py-2 text-xs text-slate-400">→</td>
            <td className="px-3 py-2">Acero de {codigo}</td>
            <td className="num px-3 py-2 text-xs font-normal text-slate-500">{resultado.generador.formula}</td>
            <td className="num whitespace-nowrap px-3 py-2 text-right">{fmt(resultado.generador.kg)} kg</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function Despiece({ despiece, calc, desperdicio }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white">
      <div className="border-b border-slate-200 px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Comparativo informativo: despiece real por tramos</h3>
        <p className="text-xs text-slate-500">
          Cada tramo armado por separado, ganchos solo en los extremos. No incluye traslapes ni anclajes en esquinas. No modifica la cantidad del generador.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2">Tramo</th>
              <th className="px-3 py-2 text-right">L (m)</th>
              <th className="px-3 py-2 text-right">Varillas cortas</th>
              <th className="px-3 py-2 text-right">Largo varilla larga</th>
              <th className="px-3 py-2 text-right">kg</th>
            </tr>
          </thead>
          <tbody>
            {despiece.filas.map((t, i) => (
              <tr key={i} className="border-t border-slate-200">
                <td className="num px-3 py-1.5">{i + 1}</td>
                <td className="num px-3 py-1.5 text-right">{fmt(t.L)}</td>
                <td className="num px-3 py-1.5 text-right">{t.nT}</td>
                <td className="num px-3 py-1.5 text-right">{fmt(t.lenL)}</td>
                <td className="num px-3 py-1.5 text-right">{fmt(t.kg)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-400 font-semibold">
              <td className="px-3 py-1.5">Despiece real</td>
              <td className="num px-3 py-1.5 text-right">{fmt(despiece.ml)}</td>
              <td colSpan={2}></td>
              <td className="num px-3 py-1.5 text-right">{fmt(despiece.kgReal)}</td>
            </tr>
            <tr>
              <td className="px-3 py-1.5" colSpan={4}>Análisis por metro ({fmt(despiece.ml)} ml × {fmt(calc.kgMl)} kg/ml)</td>
              <td className="num px-3 py-1.5 text-right">{fmt(despiece.kgPorMetro)}</td>
            </tr>
            <tr className="text-st-par">
              <td className="px-3 py-1.5" colSpan={4}>Diferencia (lo que cubre el método por metro además del {fmt(desperdicio)} % de desperdicio)</td>
              <td className="num px-3 py-1.5 text-right">
                {fmt(despiece.diferencia)} · {despiece.kgReal > 0 ? fmt(r2((despiece.diferencia / despiece.kgReal) * 100)) : '—'} %
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
