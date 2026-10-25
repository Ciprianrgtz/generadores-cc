import { useState } from 'react'
import { fmt } from '../dominio/redondeo'
import { COLOR_SENTIDO } from './coloresSentido'
import { Segmentos, Seccion, Tarjeta } from './ui'
import { diametroM, isometrica, posicionesLongitudinales, posicionesTransversales } from '../dominio/fichas/zapataGeometria'

const ROJO = COLOR_SENTIDO.corto
const AZUL = COLOR_SENTIDO.largo

/**
 * Esquema interactivo de la zapata corrida: se redibuja con cada dato de la ficha.
 * Solo coloca las varillas que la ficha ya contó (nunca calcula cantidades).
 * Pasar el cursor o hacer clic en un sentido lo resalta aquí y en la tabla de pasos.
 */
export default function EsquemaZapata({ parametros: p, calc, tabla, activo, onEntrar, onSalir, onClick }) {
  const [vista, setVista] = useState('planta')
  const [concreto, setConcreto] = useState(true)

  const L = calc.criterios.longitudAnalisis
  const B = p.seccion.ancho
  const H = p.seccion.peralte
  if (!(B > 0) || !(H > 0)) return null

  const d = {
    L, B, H,
    rec: calc.criterios.recubrimiento,
    gancho: calc.criterios.gancho,
    sepT: p.transversal.separacion,
    sepL: p.longitudinal.separacion,
    t: posicionesTransversales(L, p.transversal.separacion),
    l: posicionesLongitudinales(B, p.longitudinal.separacion, calc.criterios.recubrimiento),
    dT: diametroM(tabla[p.transversal.varilla]),
    dL: diametroM(tabla[p.longitudinal.varilla]),
  }
  const ev = (g) => ({ onMouseEnter: () => onEntrar(g), onMouseLeave: onSalir, onClick: () => onClick(g) })

  const paso = (id) => calc.pasos.find((x) => x.id === id)
  const sentidos = [
    { id: 'corto', nombre: 'Sentido corto', varilla: p.transversal.varilla, sep: d.sepT, pasos: ['1', '2', '3'], color: ROJO },
    { id: 'largo', nombre: 'Sentido largo', varilla: p.longitudinal.varilla, sep: d.sepL, pasos: ['4', '5', '6'], color: AZUL },
  ]

  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--cc-borde)' }}>
        <Seccion>Esquema · se redibuja con tus datos</Seccion>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <Segmentos opciones={[['planta', 'Planta'], ['iso', 'Isométrico']]} valor={vista} onCambio={setVista} />
          {vista === 'iso' && (
            <label className="flex items-center gap-1 text-xs text-cc-suave">
              <input type="checkbox" checked={concreto} onChange={(e) => setConcreto(e.target.checked)} />
              Concreto
            </label>
          )}
        </div>
      </div>

      <div className="px-2 pt-2">
        {vista === 'planta' ? <Planta d={d} activo={activo} ev={ev} /> : <Isometrico d={d} activo={activo} ev={ev} concreto={concreto} />}
      </div>

      <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
        {sentidos.map((s) => {
          const [n, len, peso] = s.pasos.map(paso)
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={activo === s.id}
              {...ev(s.id)}
              className="rounded-xl px-3 py-2 text-left"
              style={{ border: `2px solid ${activo === s.id ? s.color : 'var(--cc-borde)'}`, background: activo === s.id ? `${s.color}1f` : 'rgba(255,255,255,0.03)', cursor: 'pointer', color: 'var(--cc-texto)' }}
            >
              <b className="text-xs" style={{ color: s.color }}>
                <span className="uppercase tracking-wider">● {s.nombre}</span> · #{s.varilla} @ {fmt(s.sep)} m
              </b>
              <div className="num mt-1 grid gap-0.5 text-xs text-cc-suave">
                <span>N° var = {n.formula} = <b>{n.resultado}</b></span>
                <span>Largo c/u = {len.formula} = <b>{len.resultado}</b></span>
                <span>Peso con desperdicio = <b>{peso.resultado}</b></span>
              </div>
            </button>
          )
        })}
      </div>
      <p className="px-4 py-3 text-xs text-cc-suave" style={{ borderTop: '1px solid var(--cc-borde)' }}>
        Dibujo esquemático a escala del metro de análisis ({fmt(L)} m × {fmt(B)} m). Sirve para no confundir los sentidos; las cantidades salen de la tabla de pasos.
        {d.t.fraccion > 0 && <> La varilla punteada es la fracción ({fmt(d.t.fraccion)} pza) que el análisis por metro sí cuenta.</>}
      </p>
    </Tarjeta>
  )
}

const Cota = ({ x1, y1, x2, y2, tx, ty, texto, anchor = 'middle', color = 'var(--cc-suave)' }) => (
  <g stroke={color} strokeWidth="1" fill={color}>
    <line x1={x1} y1={y1} x2={x2} y2={y2} />
    <line x1={x1 - (y2 === y1 ? 0 : 4)} y1={y1 - (y2 === y1 ? 4 : 0)} x2={x1 + (y2 === y1 ? 0 : 4)} y2={y1 + (y2 === y1 ? 4 : 0)} />
    <line x1={x2 - (y2 === y1 ? 0 : 4)} y1={y2 - (y2 === y1 ? 4 : 0)} x2={x2 + (y2 === y1 ? 0 : 4)} y2={y2 + (y2 === y1 ? 4 : 0)} />
    <text x={tx} y={ty} textAnchor={anchor} stroke="none" className="num" fontSize="12">{texto}</text>
  </g>
)

function Planta({ d, activo, ev }) {
  const s = Math.min(400 / d.L, 250 / d.B)
  const x0 = 100
  const y0 = 66
  const W = d.L * s
  const Hh = d.B * s
  const X = (x) => x0 + x * s
  const Y = (y) => y0 + y * s
  const op = (g) => (activo && activo !== g ? 0.18 : 1)
  const grosor = (g, dm) => Math.max(2.6, dm * s) * (activo === g ? 1.8 : 1)
  const ult = d.t.xs[d.t.xs.length - 1] ?? 0
  const yUlt = d.l.ys[d.l.ys.length - 1] ?? 0

  return (
    <svg viewBox={`0 0 ${x0 + W + 150} ${y0 + Hh + 80}`} className="w-full" role="img" aria-label="Planta del metro de análisis de la zapata corrida">
      {/* sección: el metro de análisis es un corte de una zapata más larga */}
      <rect x={x0} y={y0} width={W} height={Hh} fill="rgba(255,255,255,0.05)" className="stroke-cc-texto" strokeWidth="1.5" />
      <rect x={X(d.rec)} y={Y(d.rec)} width={Math.max(W - 2 * d.rec * s, 0)} height={Math.max(Hh - 2 * d.rec * s, 0)} fill="none" className="stroke-cc-tenue" strokeDasharray="4 3" />

      {/* sentido corto (rojo): cruzan el ancho, repartidas en el metro */}
      <g opacity={op('corto')} className="cursor-pointer" {...ev('corto')}>
        {d.t.xs.map((x, i) => {
          const dir = x > d.L / 2 + 1e-9 ? -1 : 1
          const g = Math.min(d.gancho * s, W * 0.5)
          const off = 8 // los ganchos se separan un poco del borde para no taparse con las longitudinales de las orillas
          return (
            <g key={i} stroke={ROJO} strokeWidth={grosor('corto', d.dT)} strokeLinecap="round" fill="none">
              <title>{`Sentido corto · varilla ${i + 1} · cruza los ${fmt(d.B)} m del ancho`}</title>
              <polyline points={`${X(x) + dir * g},${Y(d.rec) + off} ${X(x)},${Y(d.rec) + off} ${X(x)},${Y(d.B - d.rec) - off} ${X(x) + dir * g},${Y(d.B - d.rec) - off}`} strokeLinejoin="round" />
              <line x1={X(x)} y1={Y(d.rec)} x2={X(x)} y2={Y(d.rec) + off} />
              <line x1={X(x)} y1={Y(d.B - d.rec) - off} x2={X(x)} y2={Y(d.B - d.rec)} />
            </g>
          )
        })}
        {d.t.fraccion > 0 && (
          <line x1={X(Math.min(ult + d.sepT, d.L))} y1={Y(d.rec)} x2={X(Math.min(ult + d.sepT, d.L))} y2={Y(d.B - d.rec)} stroke={ROJO} strokeWidth="2.6" strokeDasharray="6 5" opacity="0.7">
            <title>{`Fracción de varilla: ${fmt(d.t.fraccion)} pza`}</title>
          </line>
        )}
        {d.t.xs.map((x, i) => (
          <text key={i} x={X(x)} y={y0 - 8} textAnchor="middle" fontSize="11" fill={ROJO} className="num">{i + 1}</text>
        ))}
      </g>

      {/* sentido largo (azul): corren a lo largo del metro, repartidas en el ancho */}
      <g opacity={op('largo')} className="cursor-pointer" {...ev('largo')}>
        {d.l.ys.map((y, i) => (
          <g key={i} stroke={AZUL} strokeWidth={grosor('largo', d.dL)} strokeLinecap="round" fill="none">
            <title>{`Sentido largo · varilla ${i + 1} · corre los ${fmt(d.L)} m del metro`}</title>
            <polyline points={`${X(d.rec)},${y === yUlt ? Y(y) - Math.min(d.gancho * s, Hh / 2) : Y(y)} ${X(d.rec)},${Y(y)} ${X(d.L)},${Y(y)}`} strokeLinejoin="round" />
          </g>
        ))}
        {d.l.ys.map((y, i) => (
          <text key={i} x={X(d.L) + 10} y={Y(y) + 4} fontSize="11" fill={AZUL} className="num">{i + 1}</text>
        ))}
        {d.l.fraccion > 0 && (
          <text x={X(d.L) + 10} y={Y(yUlt) + 20} fontSize="11" fill={AZUL} className="num">+{fmt(d.l.fraccion)}</text>
        )}
      </g>

      {/* cotas */}
      <Cota x1={X(0)} y1={y0 - 34} x2={X(d.L)} y2={y0 - 34} tx={X(d.L / 2)} ty={y0 - 42} texto={`${fmt(d.L)} m · metro de análisis`} />
      <Cota x1={X(d.L) + 46} y1={Y(0)} x2={X(d.L) + 46} y2={Y(d.B)} tx={X(d.L) + 54} ty={Y(d.B / 2) + 4} texto={`${fmt(d.B)} m`} anchor="start" />
      {d.t.xs.length > 1 && (
        <Cota x1={X(d.t.xs[0])} y1={Y(d.B) + 26} x2={X(d.t.xs[1])} y2={Y(d.B) + 26} tx={(X(d.t.xs[0]) + X(d.t.xs[1])) / 2} ty={Y(d.B) + 44} texto={`@ ${fmt(d.sepT)}`} color={ROJO} />
      )}
      {d.l.ys.length > 1 && (
        <Cota x1={x0 - 30} y1={Y(d.l.ys[0])} x2={x0 - 30} y2={Y(d.l.ys[1])} tx={x0 - 38} ty={(Y(d.l.ys[0]) + Y(d.l.ys[1])) / 2 + 4} texto={`@ ${fmt(d.sepL)}`} anchor="end" color={AZUL} />
      )}
      <text x={x0 + W / 2} y={Y(d.B) + 70} textAnchor="middle" fontSize="11" className="fill-cc-tenue">
        {`Los bordes izquierdo y derecho son cortes: la zapata sigue más allá del metro.`}
      </text>
    </svg>
  )
}

function Isometrico({ d, activo, ev, concreto }) {
  const proy = (x, y, z) => isometrica(x, y, z)
  const esquinas = [0, d.L].flatMap((x) => [0, d.B].flatMap((y) => [0, d.H].map((z) => proy(x, y, z))))
  const minx = Math.min(...esquinas.map((e) => e.px))
  const maxx = Math.max(...esquinas.map((e) => e.px))
  const miny = Math.min(...esquinas.map((e) => e.py))
  const maxy = Math.max(...esquinas.map((e) => e.py))
  const k = Math.min((640 * 0.8) / (maxx - minx), (300 * 0.7) / (maxy - miny))
  const ox = 320 - (k * (minx + maxx)) / 2
  const oy = 148 - (k * (miny + maxy)) / 2
  const pt = (x, y, z) => {
    const { px, py } = proy(x, y, z)
    return [ox + k * px, oy + k * py]
  }
  const pts = (arr) => arr.map(([x, y, z]) => pt(x, y, z).join(',')).join(' ')
  const op = (g) => (activo && activo !== g ? 0.18 : 1)
  const grosor = (g, dm) => Math.max(2.6, dm * k) * (activo === g ? 1.8 : 1)

  // capas: el sentido corto va abajo y el largo encima (indicativo)
  const zT = d.rec + d.dT / 2
  const zL = d.rec + d.dT + d.dL / 2
  const gancho = (z) => Math.max(0.02, Math.min(d.gancho, d.H - d.rec - z))
  const recortado = d.gancho > d.H - d.rec - zL + 1e-9

  const ult = d.t.xs[d.t.xs.length - 1] ?? 0
  const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const lL = m(pt(0, d.B, 0), pt(d.L, d.B, 0))
  const lB = m(pt(d.L, 0, 0), pt(d.L, d.B, 0))
  const lH = m(pt(0, d.B, 0), pt(0, d.B, d.H))
  const cara = concreto ? 0.2 : 0

  return (
    <svg viewBox="0 0 640 300" className="w-full" role="img" aria-label="Vista isométrica de la zapata corrida con su parrilla">
      {/* aristas ocultas */}
      <g className="stroke-cc-tenue" strokeDasharray="4 3" fill="none">
        <polyline points={pts([[d.L, 0, 0], [0, 0, 0], [0, d.B, 0]])} />
        <polyline points={pts([[0, 0, 0], [0, 0, d.H]])} />
      </g>

      {/* sentido corto: transversales, capa inferior */}
      <g opacity={op('corto')} className="cursor-pointer" {...ev('corto')}>
        {d.t.xs.map((x, i) => {
          const h = gancho(zT)
          return (
            <polyline key={i} fill="none" stroke={ROJO} strokeWidth={grosor('corto', d.dT)} strokeLinecap="round" strokeLinejoin="round"
              points={pts([[x, d.rec, zT + h], [x, d.rec, zT], [x, d.B - d.rec, zT], [x, d.B - d.rec, zT + h]])}>
              <title>{`Sentido corto · varilla ${i + 1}`}</title>
            </polyline>
          )
        })}
        {d.t.fraccion > 0 && (
          <polyline fill="none" stroke={ROJO} strokeWidth="2.6" strokeDasharray="6 5" opacity="0.7" strokeLinecap="round"
            points={pts([[Math.min(ult + d.sepT, d.L), d.rec, zT], [Math.min(ult + d.sepT, d.L), d.B - d.rec, zT]])} />
        )}
      </g>

      {/* sentido largo: longitudinales, capa superior */}
      <g opacity={op('largo')} className="cursor-pointer" {...ev('largo')}>
        {d.l.ys.map((y, i) => (
          <polyline key={i} fill="none" stroke={AZUL} strokeWidth={grosor('largo', d.dL)} strokeLinecap="round" strokeLinejoin="round"
            points={pts([[d.rec, y, zL + gancho(zL)], [d.rec, y, zL], [d.L, y, zL]])}>
            <title>{`Sentido largo · varilla ${i + 1}`}</title>
          </polyline>
        ))}
      </g>

      {/* concreto translúcido encima de la parrilla */}
      <g className="stroke-cc-suave" strokeWidth="1.3" strokeLinejoin="round" pointerEvents="none">
        <polygon points={pts([[0, 0, d.H], [d.L, 0, d.H], [d.L, d.B, d.H], [0, d.B, d.H]])} fill="#94a3b8" fillOpacity={cara} />
        <polygon points={pts([[0, d.B, 0], [d.L, d.B, 0], [d.L, d.B, d.H], [0, d.B, d.H]])} fill="#64748b" fillOpacity={cara * 1.4} />
        <polygon points={pts([[d.L, 0, 0], [d.L, d.B, 0], [d.L, d.B, d.H], [d.L, 0, d.H]])} fill="#8fa3b0" fillOpacity={cara * 1.4} />
      </g>

      <g className="num fill-cc-suave" fontSize="12">
        <text x={lL[0] - 22} y={lL[1] + 24} textAnchor="middle">{fmt(d.L)} m</text>
        <text x={lB[0] + 24} y={lB[1] + 24} textAnchor="middle">{fmt(d.B)} m</text>
        <text x={lH[0] - 10} y={lH[1] + 4} textAnchor="end">{fmt(d.H)} m</text>
      </g>
      {recortado && (
        <text x="320" y="292" textAnchor="middle" fontSize="11" className="fill-cc-tenue">
          {`Gancho de ${fmt(d.gancho)} m: en el dibujo se recorta al peralte disponible (${fmt(Math.max(d.H - d.rec - zL, 0))} m).`}
        </text>
      )}
    </svg>
  )
}
