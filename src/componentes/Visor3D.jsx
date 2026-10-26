import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { analizarExcavacion } from '../dominio/excavacion'
import { fmt } from '../dominio/redondeo'
import { Tarjeta, Seccion } from './ui'

// Colores planos por tipo de pieza de excavación.
const COLORES = {
  zapata: 0xd9822b, // cepas de zapata
  trabe: 0xe0b84a, // contratrabes y trabes de liga
  banda: 0xa86f3c, // bandas de losa (0.25)
  delgada: 0x8c7356, // parte de 10 cm de losa y firme
}
const tipoDeRenglon = (f) => (/^Z/i.test(f.elemento) ? 'zapata' : 'trabe')
const NOMBRE_TIPO = {
  zapata: 'Cepa de zapata',
  trabe: 'Trabe de liga / contratrabe',
  banda: 'Banda de losa con talud',
  delgada: 'Losa 10 cm o firme',
}

/**
 * Piezas de excavación que se pueden dibujar: cada renglón o superficie que trae «huella»
 * en planta, con la profundidad que le toca según el análisis guardado.
 */
function piezasDeExcavacion(generadores = []) {
  const piezas = []
  let sinUbicar = 0
  let volumen = 0
  for (const g of generadores) {
    if (g.tipo !== 'excavacion' || !g.datos?.renglones) continue
    const r = analizarExcavacion({ ...g.datos, superficies: g.datos.superficies ?? [] })
    volumen += r.total
    for (const f of r.filas) {
      if (!f.valido) continue
      if (!f.huella?.length) sinUbicar++
      else
        piezas.push({
          huella: f.huella,
          profundidad: f.altoCepa,
          tipo: tipoDeRenglon(f),
          nombre: f.elemento,
          ubicacion: [f.eje && `Eje ${f.eje}`, f.entre && `entre ${f.entre}`].filter(Boolean).join(' · '),
          formula: f.formula,
          volumen: f.volumen,
          concepto: g.concepto?.clave,
        })
    }
    for (const s of r.areas) {
      if (!s.valido) continue
      if (!s.huella?.length) sinUbicar++
      else {
        const [nombre, parte] = s.descripcion.split(' · ')
        piezas.push({
          huella: s.huella,
          profundidad: s.espesor,
          tipo: s.espesor > 0.15 ? 'banda' : 'delgada',
          nombre: parte ? `${parte[0].toUpperCase()}${parte.slice(1)}` : nombre,
          ubicacion: parte ? nombre : '',
          formula: s.formula,
          volumen: s.volumen,
          concepto: g.concepto?.clave,
        })
      }
    }
  }
  return { piezas, sinUbicar, volumen }
}

/** Polígono con huecos → THREE.Shape. */
function forma([contorno, ...huecos]) {
  const s = new THREE.Shape(contorno.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const h of huecos) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
  return s
}

/**
 * Visor 3D ligero del proyecto: se arma con lo que ya se analizó.
 * Muestra el terreno (polígono en metros) y, debajo del nivel 0, la excavación:
 * cada pieza con su huella en planta y su profundidad. Colores planos y sin texturas.
 */
export default function Visor3D({ terreno, generadores, altura = 360 }) {
  const caja = useRef(null)
  const [ver, setVer] = useState({ terreno: true, excavacion: true })
  const [sel, setSel] = useState(null) // pieza elegida con un clic
  const exc = useMemo(() => piezasDeExcavacion(generadores), [generadores])

  useEffect(() => {
    const el = caja.current
    if (!el) return
    const escena = new THREE.Scene()
    const render = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    render.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(render.domElement)
    render.domElement.style.display = 'block'

    const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)
    const controles = new OrbitControls(camara, render.domElement)
    controles.enableDamping = true

    escena.add(new THREE.AmbientLight(0xffffff, 0.9))
    const sol = new THREE.DirectionalLight(0xffffff, 1.1)
    sol.position.set(30, 60, 20)
    escena.add(sol)

    // plano (x, y) → escena (x, arriba, −y); la extrusión sube desde 0
    const extruir = (f, alto) => {
      const geo = new THREE.ExtrudeGeometry(f, { depth: alto, bevelEnabled: false })
      geo.rotateX(-Math.PI / 2)
      return geo
    }
    const hayExcavacion = ver.excavacion && exc.piezas.length > 0
    const todo = new THREE.Group()
    escena.add(todo)

    const v = terreno?.vertices
    if (v?.length >= 3 && ver.terreno) {
      const geo = extruir(forma([v]), 0.04)
      const placa = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1d9e75, transparent: true, opacity: hayExcavacion ? 0.18 : 0.55, depthWrite: !hayExcavacion }))
      todo.add(placa)
      todo.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x3ddba6 })))
    }
    const seleccionables = []
    if (hayExcavacion) {
      exc.piezas.forEach((pz, i) => {
        for (const pol of pz.huella) {
          const geo = extruir(forma(pol), pz.profundidad)
          geo.translate(0, -pz.profundidad, 0)
          const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORES[pz.tipo], transparent: true, opacity: 0.85 }))
          m.userData.pieza = i
          seleccionables.push(m)
          todo.add(m)
          todo.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x2b1d10, transparent: true, opacity: 0.6 })))
        }
      })
    }

    // selección: el cursor ilumina la pieza; un clic (sin arrastrar) la elige y muestra su ficha
    const rayo = new THREE.Raycaster()
    const puntero = new THREE.Vector2()
    let encima = null
    let elegida = null
    const pintar = () => {
      for (const m of seleccionables) {
        const i = m.userData.pieza
        m.material.emissive.setHex(i === elegida ? 0x3ddba6 : i === encima ? 0x555555 : 0x000000)
        m.material.emissiveIntensity = i === elegida ? 0.55 : 0.5
        m.material.opacity = elegida == null || i === elegida ? 0.85 : 0.35
      }
    }
    const tocar = (e) => {
      const r = render.domElement.getBoundingClientRect()
      puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      rayo.setFromCamera(puntero, camara)
      return rayo.intersectObjects(seleccionables, false)[0]?.object.userData.pieza ?? null
    }
    let inicio = null
    const alMover = (e) => {
      const i = tocar(e)
      if (i !== encima) {
        encima = i
        render.domElement.style.cursor = i == null ? 'grab' : 'pointer'
        pintar()
      }
    }
    const alBajar = (e) => (inicio = { x: e.clientX, y: e.clientY })
    const alSubir = (e) => {
      if (!inicio || Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 4) return // fue un arrastre
      elegida = tocar(e)
      pintar()
      setSel(elegida)
    }
    render.domElement.addEventListener('pointermove', alMover)
    render.domElement.addEventListener('pointerdown', alBajar)
    render.domElement.addEventListener('pointerup', alSubir)

    const centro = new THREE.Vector3(0, 0, 0)
    let tam = 20
    const caja3 = new THREE.Box3().setFromObject(todo)
    if (!caja3.isEmpty()) {
      caja3.getCenter(centro)
      const dim = caja3.getSize(new THREE.Vector3())
      tam = Math.max(dim.x, dim.z, 4)
    }
    const rejilla = new THREE.GridHelper(Math.ceil((tam * 1.8) / 5) * 5, Math.ceil((tam * 1.8) / 5), 0x4b5a55, 0x2a3431)
    rejilla.position.set(centro.x, hayExcavacion ? -1.2 : -0.01, centro.z)
    escena.add(rejilla)
    camara.position.set(centro.x + tam * 0.9, tam * 0.8, centro.z + tam * 1.2)
    controles.target.copy(centro)
    controles.update()

    const ajustar = () => {
      const w = el.clientWidth || 600
      render.setSize(w, altura)
      camara.aspect = w / altura
      camara.updateProjectionMatrix()
    }
    ajustar()
    const obs = new ResizeObserver(ajustar)
    obs.observe(el)

    let cuadro = 0
    const animar = () => {
      cuadro = requestAnimationFrame(animar)
      controles.update()
      render.render(escena, camara)
    }
    animar()

    return () => {
      cancelAnimationFrame(cuadro)
      obs.disconnect()
      render.domElement.removeEventListener('pointermove', alMover)
      render.domElement.removeEventListener('pointerdown', alBajar)
      render.domElement.removeEventListener('pointerup', alSubir)
      controles.dispose()
      escena.traverse((o) => {
        o.geometry?.dispose?.()
        if (o.material) [].concat(o.material).forEach((m) => m.dispose())
      })
      render.dispose()
      el.removeChild(render.domElement)
    }
  }, [terreno, exc, ver, altura])

  const casilla = (k, texto) => (
    <label className="flex items-center gap-1.5 text-xs text-cc-suave">
      <input type="checkbox" checked={ver[k]} onChange={(e) => { setSel(null); setVer({ ...ver, [k]: e.target.checked }) }} />
      {texto}
    </label>
  )
  const muestra = (color, texto) => (
    <span className="flex items-center gap-1 text-[11px] text-cc-suave">
      <span style={{ width: 10, height: 10, borderRadius: 2, background: `#${color.toString(16).padStart(6, '0')}` }} />
      {texto}
    </span>
  )

  return (
    <Tarjeta className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" style={{ borderBottom: '1px solid var(--cc-borde)' }}>
        <Seccion>Modelo 3D · se arma con lo que vas analizando</Seccion>
        {terreno?.vertices?.length > 0 && casilla('terreno', 'Terreno')}
        {exc.volumen > 0 && casilla('excavacion', `Excavación ${fmt(exc.volumen)} m³`)}
        {terreno?.area > 0 && (
          <span className="num ml-auto text-xs text-cc-suave">
            Terreno {fmt(terreno.area)} m² · perímetro {fmt(terreno.perimetro)} m
          </span>
        )}
      </div>
      <div className="relative">
        <div ref={caja} style={{ height: altura, cursor: 'grab' }} />
        {!terreno?.vertices?.length && !exc.piezas.length && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-sm text-cc-suave">
            Aún no hay nada analizado. Empieza por el terreno (limpia y despalme) y aquí aparece.
          </p>
        )}
        {ver.excavacion && exc.piezas.length > 0 && (
          <div className="pointer-events-none absolute left-3 top-2 grid gap-1 rounded-lg px-2 py-1.5" style={{ background: 'rgba(0,0,0,0.35)' }}>
            {muestra(COLORES.zapata, 'Cepa de zapata')}
            {muestra(COLORES.trabe, 'Trabe de liga / contratrabe')}
            {muestra(COLORES.banda, 'Banda de losa (0.25)')}
            {muestra(COLORES.delgada, 'Losa 10 cm y firme (0.10)')}
          </div>
        )}
        {sel != null && exc.piezas[sel] && <FichaPieza pieza={exc.piezas[sel]} />}
        {ver.excavacion && exc.sinUbicar > 0 && (
          <p className="pointer-events-none absolute bottom-2 left-3 text-[11px]" style={{ color: '#f0b866' }}>
            {exc.sinUbicar} renglón(es) de excavación sin ubicación en planta: suman al volumen pero no se dibujan.
          </p>
        )}
        <p className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-cc-tenue">Arrastra para girar · rueda para acercar{exc.piezas.length > 0 && ver.excavacion ? " · clic en una pieza para ver qué es" : ""}</p>
      </div>
    </Tarjeta>
  )
}

/** Ficha de la pieza elegida en el modelo: qué es, dónde va y cómo se calculó. */
function FichaPieza({ pieza }) {
  return (
    <div
      className="pointer-events-none absolute right-3 top-2 grid max-w-[340px] gap-1 rounded-xl px-3 py-2.5 text-xs"
      style={{ background: 'rgba(10,16,14,0.88)', border: '1px solid rgba(61,219,166,0.45)', color: '#e6efe9' }}
    >
      <span className="text-[10px] uppercase tracking-wider" style={{ color: '#3ddba6' }}>
        {NOMBRE_TIPO[pieza.tipo]}
        {pieza.concepto && ` · ${pieza.concepto}`}
      </span>
      <b className="text-sm">{pieza.nombre}</b>
      {pieza.ubicacion && <span style={{ color: '#a9b8b1' }}>{pieza.ubicacion}</span>}
      <span className="num" style={{ color: '#a9b8b1' }}>
        Profundidad {fmt(pieza.profundidad)} m
      </span>
      <span className="num mt-1">{pieza.formula}</span>
    </div>
  )
}
