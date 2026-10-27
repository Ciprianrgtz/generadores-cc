import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { analizarAfine } from '../dominio/afine'
import { analizarAreas } from '../dominio/areas'
import { analizarAcero } from '../dominio/acero'
import { analizarLongitud, CRITERIOS_LONGITUD } from '../dominio/longitud'
import { analizarPlantilla } from '../dominio/plantilla'
import { huellaPorEjes } from '../dominio/ejes'
import { analizarExcavacion } from '../dominio/excavacion'
import { fmt } from '../dominio/redondeo'
import { Tarjeta, Seccion } from './ui'

// Colores planos por tipo de pieza de excavación.
const COLORES = {
  zapata: 0xd9822b, // cepas de zapata
  trabe: 0xe0b84a, // contratrabes y trabes de liga
  banda: 0xa86f3c, // bandas de losa (0.25)
  delgada: 0x8c7356, // parte de 10 cm de losa y firme
  afine: 0x4fc3f7, // fondo y taludes que se afinan
  plantilla: 0xc3ccd2, // plantilla de concreto en el fondo de la cepa
  cimbra: 0xe8d3a2, // fronteras de cimbra a los lados del elemento
  acero: 0xd9674f, // elementos con su acero de refuerzo asignado
  area: 0xa77bdb, // áreas de un concepto que se paga por superficie
}
const tipoDeRenglon = (f) => (/^Z/i.test(f.elemento) ? 'zapata' : 'trabe')
const NOMBRE_TIPO = {
  zapata: 'Cepa de zapata',
  trabe: 'Trabe de liga / contratrabe',
  banda: 'Banda de losa con talud',
  delgada: 'Losa 10 cm o firme',
  afine: 'Afine de fondo y taludes',
  plantilla: 'Plantilla de concreto',
  cimbra: 'Cimbra (fronteras laterales)',
  acero: 'Elemento con acero (ficha)',
  area: 'Área',
}

/**
 * Piezas de excavación que se pueden dibujar: cada renglón o superficie que trae «huella»
 * en planta, con la profundidad que le toca según el análisis guardado.
 */
function piezasDeExcavacion(generadores = [], ejes) {
  const piezas = []
  const huellas = new Map() // por elemento|eje|entre, para ubicar el afine si no trae desfase
  let sinUbicar = 0
  let volumen = 0
  for (const g of generadores) {
    if (g.tipo !== 'excavacion' || !g.datos?.renglones) continue
    const r = analizarExcavacion({ ...g.datos, superficies: g.datos.superficies ?? [] })
    volumen += r.total
    for (const f of r.filas) {
      if (!f.valido) continue
      // la forma sale de los ejes del proyecto y de los datos del renglón; si no se puede, de su huella guardada
      const huella = huellaPorEjes(f, ejes, f.anchoCepa).huella ?? (f.huella?.length ? f.huella : null)
      if (!huella) sinUbicar++
      else {
        huellas.set(`${f.elemento}|${f.eje}|${f.entre}`, huella)
        piezas.push({
          huella,
          profundidad: f.altoCepa,
          tipo: tipoDeRenglon(f),
          nombre: f.elemento,
          ubicacion: [f.eje && `Eje ${f.eje}`, f.entre && `entre ${f.entre}`].filter(Boolean).join(' · '),
          formula: f.formula,
          volumen: f.volumen,
          concepto: g.concepto?.clave,
        })
      }
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
  return { piezas, sinUbicar, volumen, huellas }
}

/**
 * Superficies de afine: el fondo y las dos paredes de cada cepa que entra. Se ubican por ejes con
 * los ml del elemento; si la cepa no trae desfase, toman la forma de su renglón de excavación.
 */
function piezasDeAfine(generadores = [], ejes, huellas = new Map()) {
  const piezas = []
  let sinUbicar = 0
  let area = 0
  for (const g of generadores) {
    if (g.tipo !== 'afine' || !g.datos?.cepas) continue
    const r = analizarAfine({ cepas: g.datos.cepas })
    area += r.total
    for (const f of r.filas) {
      if (!f.valido || f.incluir === false) continue
      const porEjes = Number.isFinite(f.desfase) ? huellaPorEjes({ ...f, largo: f.ml }, ejes, f.ancho).huella : null
      const huella = porEjes ?? huellas.get(`${f.elemento}|${f.eje}|${f.entre}`)
      if (!huella) sinUbicar++
      else
        piezas.push({
          huella,
          profundidad: f.profundidad,
          tipo: 'afine',
          nombre: f.elemento,
          ubicacion: [f.eje && `Eje ${f.eje}`, f.entre && `entre ${f.entre}`].filter(Boolean).join(' · '),
          formula: f.formula,
          detalle: `Fondo ${fmt(f.fondo)} m² + taludes ${fmt(f.taludes)} m²`,
          concepto: g.concepto?.clave,
        })
    }
  }
  return { piezas, sinUbicar, area }
}

/** Nombre de un eje como letrero que siempre mira a la cámara. */
function etiqueta(texto, x, z) {
  const lienzo = document.createElement('canvas')
  lienzo.width = 128
  lienzo.height = 64
  const c = lienzo.getContext('2d')
  c.fillStyle = 'rgba(232,93,117,0.92)'
  c.beginPath()
  c.roundRect(4, 8, 120, 48, 22)
  c.fill()
  c.fillStyle = '#fff'
  c.font = 'bold 30px sans-serif'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(texto, 64, 33)
  const tex = new THREE.CanvasTexture(lienzo)
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }))
  s.scale.set(1.0, 0.5, 1)
  s.position.set(x, 0.3, z)
  s.renderOrder = 10
  s.userData.textura = tex
  return s
}

/** Suma de áreas: cada área con forma, como una lámina a su nivel (el fondo de su excavación o el terreno). */
function piezasDeAreas(generadores = []) {
  const piezas = []
  let sinUbicar = 0
  let area = 0
  for (const g of generadores) {
    if (g.tipo !== 'areas' || !g.datos?.areas) continue
    const r = analizarAreas({ areas: g.datos.areas })
    area += r.total
    for (const f of r.filas) {
      if (!f.valido || f.incluir === false) continue
      if (!f.huella?.length) sinUbicar++
      else
        piezas.push({
          huella: f.huella,
          profundidad: (Number.isFinite(f.nivel) ? f.nivel : 0) + 0.02,
          grosor: 0.02,
          tipo: 'area',
          nombre: f.descripcion || 'Área',
          ubicacion: f.origen ? `De ${f.origen}` : '',
          formula: `${fmt(f.area)} m²`,
          concepto: g.concepto?.clave,
        })
    }
  }
  return { piezas, sinUbicar, area }
}

/** Plantilla: una placa del ancho del elemento + vuelo, en el fondo de la cepa, ubicada por ejes. */
function piezasDePlantilla(generadores = [], ejes) {
  const piezas = []
  let sinUbicar = 0
  let area = 0
  for (const g of generadores) {
    if (g.tipo !== 'plantilla' || !g.datos?.tramos) continue
    const r = analizarPlantilla({ tramos: g.datos.tramos, criterios: g.datos.criterios })
    area += r.total
    for (const f of r.filas) {
      if (!f.valido || f.incluir === false) continue
      const huella = huellaPorEjes({ ...f, largo: f.ml }, ejes, f.anchoPlantilla).huella
      if (!huella) sinUbicar++
      else
        piezas.push({
          huella,
          profundidad: Number.isFinite(f.profundidad) ? f.profundidad : r.criterios.espesor,
          grosor: r.criterios.espesor,
          tipo: 'plantilla',
          nombre: f.elemento,
          ubicacion: [f.eje && `Eje ${f.eje}`, f.entre && `entre ${f.entre}`].filter(Boolean).join(' · '),
          formula: f.formula,
          detalle: `Ancho ${fmt(f.anchoPlantilla)} m · espesor ${fmt(r.criterios.espesor)} m`,
          concepto: g.concepto?.clave,
        })
    }
  }
  return { piezas, sinUbicar, area }
}

/**
 * Cimbra: las dos fronteras laterales de cada elemento que entra, del ancho del elemento (sin sobreancho),
 * a lo largo de sus ml y del alto indicado, apoyadas en su desplante. Se ubican por ejes.
 */
function piezasDeCimbra(generadores = [], ejes) {
  const piezas = []
  let sinUbicar = 0
  let ml = 0
  for (const g of generadores) {
    if (g.tipo !== 'longitud' || !g.datos?.tramos) continue
    const r = analizarLongitud({ tramos: g.datos.tramos })
    const alto = g.datos.criterios?.alto > 0 ? g.datos.criterios.alto : CRITERIOS_LONGITUD.alto
    ml += r.total
    for (const f of r.filas) {
      if (!f.valido || f.incluir === false) continue
      const huella = Number.isFinite(f.desplante) ? huellaPorEjes({ ...f, largo: f.ml }, ejes, f.ancho).huella : null
      if (!huella) sinUbicar++
      else
        piezas.push({
          huella,
          profundidad: f.desplante,
          alto,
          tipo: 'cimbra',
          nombre: f.elemento,
          ubicacion: [f.eje && `Eje ${f.eje}`, f.entre && `entre ${f.entre}`].filter(Boolean).join(' · '),
          formula: f.formula,
          detalle: `2 fronteras de ${fmt(f.ml)} m × ${fmt(alto)} m de alto sobre el desplante −${fmt(f.desplante)} m`,
          concepto: g.concepto?.clave,
        })
    }
  }
  return { piezas, sinUbicar, ml }
}

/**
 * Acero por ficha: el elemento (ancho × peralte de su ficha) sobre su desplante, en cada tramo que entra.
 * Marca qué zapatas ya tienen su acero asignado; las varillas están en el esquema de la ficha.
 */
function piezasDeAcero(generadores = [], ejes) {
  const piezas = []
  let sinUbicar = 0
  let kg = 0
  for (const g of generadores) {
    if (g.tipo !== 'acero_ficha' || !g.datos?.tramos || !(g.datos.ficha?.kgMl > 0)) continue
    const kgMl = g.datos.ficha.kgMl
    const peralte = g.datos.ficha.peralte
    const r = analizarAcero({ tramos: g.datos.tramos, ficha: { kgMl, porDiametro: {} } })
    kg += r.total
    for (const f of r.filas) {
      if (!f.valido || f.incluir === false) continue
      const huella = Number.isFinite(f.desplante) && peralte > 0 ? huellaPorEjes({ ...f, largo: f.ml }, ejes, f.ancho).huella : null
      if (!huella) sinUbicar++
      else
        piezas.push({
          huella,
          profundidad: f.desplante,
          grosor: peralte,
          tipo: 'acero',
          nombre: f.elemento,
          ubicacion: [f.eje && `Eje ${f.eje}`, f.entre && `entre ${f.entre}`].filter(Boolean).join(' · '),
          formula: `${fmt(f.total)} ml × ${fmt(kgMl, 6)} kg/ml = ${fmt(f.total * kgMl)} kg`,
          detalle: `Ficha v${g.datos.ficha.version} (${g.datos.ficha.estado}) · ${fmt(f.ancho)} × ${fmt(peralte)} m`,
          concepto: g.concepto?.clave,
        })
    }
  }
  return { piezas, sinUbicar, kg }
}

/** Las dos paredes largas de un contorno (las que se afinan como taludes). */
function paredesLargas(contorno) {
  const lados = contorno.map((a, i) => {
    const b = contorno[(i + 1) % contorno.length]
    return { a, b, largo: Math.hypot(b[0] - a[0], b[1] - a[1]) }
  })
  return lados.sort((x, y) => y.largo - x.largo).slice(0, 2)
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
export default function Visor3D({ terreno, ejes, generadores, altura = 360 }) {
  const caja = useRef(null)
  const motor = useRef(null) // escena, cámara y lo dibujado; se crea una vez y se reusa
  const [ver, setVer] = useState({ terreno: true, ejes: true, excavacion: true, afine: true, plantilla: true, areas: true, cimbra: true, acero: true })
  const [sel, setSel] = useState(null) // clave de la pieza elegida con un clic
  const exc = useMemo(() => piezasDeExcavacion(generadores, ejes), [generadores, ejes])
  const afi = useMemo(() => piezasDeAfine(generadores, ejes, exc.huellas), [generadores, ejes, exc])
  const pla = useMemo(() => piezasDePlantilla(generadores, ejes), [generadores, ejes])
  const are = useMemo(() => piezasDeAreas(generadores), [generadores])
  const cim = useMemo(() => piezasDeCimbra(generadores, ejes), [generadores, ejes])
  const ace = useMemo(() => piezasDeAcero(generadores, ejes), [generadores, ejes])
  // lo que se dibuja; la clave identifica la pieza aunque se vuelva a calcular al capturar
  const todas = useMemo(() => {
    const vistas = {}
    return [...(ver.excavacion ? exc.piezas : []), ...(ver.afine ? afi.piezas : []), ...(ver.plantilla ? pla.piezas : []), ...(ver.cimbra ? cim.piezas : []), ...(ver.acero ? ace.piezas : []), ...(ver.areas ? are.piezas : [])].map((p) => {
      const base = `${p.tipo}|${p.concepto}|${p.nombre}|${p.ubicacion}`
      const n = (vistas[base] = (vistas[base] ?? 0) + 1)
      return { ...p, clave: n > 1 ? `${base}|${n}` : base }
    })
  }, [exc, afi, pla, cim, ace, are, ver.excavacion, ver.afine, ver.plantilla, ver.cimbra, ver.acero, ver.areas])

  // 1) escena, cámara, controles y selección: una sola vez
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
    const contenido = new THREE.Group()
    escena.add(contenido)

    const m = { escena, camara, controles, contenido, seleccionables: [], todas: [], encima: null, elegida: null, encuadre: null, rejilla: null, pintar: null }
    motor.current = m

    // el cursor ilumina la pieza; un clic (sin arrastrar) la elige y muestra su ficha
    const rayo = new THREE.Raycaster()
    const puntero = new THREE.Vector2()
    const tocar = (e) => {
      const r = render.domElement.getBoundingClientRect()
      puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      rayo.setFromCamera(puntero, camara)
      const golpes = rayo.intersectObjects(m.seleccionables, false)
      // el afine va por dentro de la cepa: si el rayo lo toca, gana a la caja de excavación
      const g = golpes.find((x) => x.object.userData.tipo === 'afine' || x.object.userData.tipo === 'cimbra') ?? golpes[0]
      return g?.object.userData.clave ?? null
    }
    let inicio = null
    const alMover = (e) => {
      const k = tocar(e)
      if (k !== m.encima) {
        m.encima = k
        render.domElement.style.cursor = k == null ? 'grab' : 'pointer'
        m.pintar?.()
      }
    }
    const alBajar = (e) => (inicio = { x: e.clientX, y: e.clientY })
    const alSubir = (e) => {
      if (!inicio || Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 4) return // fue un arrastre
      m.elegida = tocar(e)
      m.pintar?.()
      setSel(m.elegida)
    }
    render.domElement.addEventListener('pointermove', alMover)
    render.domElement.addEventListener('pointerdown', alBajar)
    render.domElement.addEventListener('pointerup', alSubir)

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
        if (o.material) [].concat(o.material).forEach((x) => x.dispose())
      })
      render.dispose()
      el.removeChild(render.domElement)
      motor.current = null
    }
  }, [altura])

  // 2) lo dibujado: se rehace cada vez que cambia lo calculado (también el borrador que se está capturando)
  useEffect(() => {
    const m = motor.current
    if (!m) return
    const { contenido, escena, camara, controles } = m
    for (const o of [...contenido.children]) {
      contenido.remove(o)
      o.userData.textura?.dispose()
      o.geometry?.dispose?.()
      if (o.material) [].concat(o.material).forEach((x) => x.dispose())
    }
    m.seleccionables = []
    m.todas = todas

    // plano (x, y) → escena (x, arriba, −y); la extrusión sube desde 0
    const extruir = (f, alto) => {
      const geo = new THREE.ExtrudeGeometry(f, { depth: alto, bevelEnabled: false })
      geo.rotateX(-Math.PI / 2)
      return geo
    }
    const hayExcavacion = todas.length > 0
    const conAfine = todas.some((p) => p.tipo === 'afine' || p.tipo === 'cimbra' || p.tipo === 'acero') // piezas por dentro de la cepa

    const v = terreno?.vertices
    if (v?.length >= 3 && ver.terreno) {
      const geo = extruir(forma([v]), 0.04)
      contenido.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1d9e75, transparent: true, opacity: hayExcavacion ? 0.18 : 0.55, depthWrite: !hayExcavacion })))
      contenido.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x3ddba6 })))
    }
    // ejes del proyecto: líneas a ras de terreno con su nombre en las puntas
    const vs = ejes?.verticales ?? []
    const hs = ejes?.horizontales ?? []
    if (ver.ejes && (vs.length || hs.length)) {
      const xs = vs.map((e) => e.pos)
      const ys = hs.map((e) => e.pos)
      const [x1, x2] = xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 1]
      const [y1, y2] = ys.length ? [Math.min(...ys), Math.max(...ys)] : [0, 1]
      const sobra = 1.2
      const puntos = []
      for (const x of xs) puntos.push(new THREE.Vector3(x, 0.05, -(y1 - sobra)), new THREE.Vector3(x, 0.05, -(y2 + sobra)))
      for (const y of ys) puntos.push(new THREE.Vector3(x1 - sobra, 0.05, -y), new THREE.Vector3(x2 + sobra, 0.05, -y))
      const lineas = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(puntos), new THREE.LineDashedMaterial({ color: 0xe85d75, dashSize: 0.4, gapSize: 0.25 }))
      lineas.computeLineDistances()
      contenido.add(lineas)
      for (const e of vs) contenido.add(etiqueta(e.nombre, e.pos, -(y1 - sobra - 0.5)))
      for (const e of hs) contenido.add(etiqueta(e.nombre, x1 - sobra - 0.6, -e.pos))
    }
    // con el afine visible la excavación se aclara para que se vean el fondo y las paredes
    const opacidad = (tipo) => (tipo === 'afine' || tipo === 'plantilla' || tipo === 'cimbra' || tipo === 'acero' || tipo === 'area' ? 0.9 : conAfine ? 0.25 : 0.85)
    const agregar = (geo, pz) => {
      const malla = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: COLORES[pz.tipo],
          transparent: true,
          opacity: opacidad(pz.tipo),
          side: pz.tipo === 'afine' || pz.tipo === 'cimbra' ? THREE.DoubleSide : THREE.FrontSide,
          depthWrite: pz.tipo === 'afine' || pz.tipo === 'plantilla' || pz.tipo === 'cimbra' || pz.tipo === 'acero' || pz.tipo === 'area' || !conAfine,
        }),
      )
      malla.userData = { clave: pz.clave, tipo: pz.tipo }
      m.seleccionables.push(malla)
      contenido.add(malla)
    }
    for (const pz of todas) {
      for (const pol of pz.huella) {
        if (pz.tipo === 'cimbra') {
          // dos tablones verticales, uno por cada lado largo del elemento, sobre su desplante
          for (const { a, b, largo } of paredesLargas(pol[0])) {
            const frontera = new THREE.PlaneGeometry(largo, pz.alto)
            frontera.rotateY(Math.atan2(b[1] - a[1], b[0] - a[0]))
            frontera.translate((a[0] + b[0]) / 2, -pz.profundidad + pz.alto / 2, -(a[1] + b[1]) / 2)
            agregar(frontera, pz)
          }
          continue
        }
        if (pz.tipo !== 'afine') {
          // la plantilla es una placa de su grosor en el fondo; lo demás va del fondo al nivel 0
          const geo = extruir(forma(pol), pz.grosor ?? pz.profundidad)
          geo.translate(0, -pz.profundidad, 0)
          agregar(geo, pz)
          contenido.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x2b1d10, transparent: true, opacity: conAfine ? 0.25 : 0.6 })))
          continue
        }
        // fondo de la cepa, un poco arriba del fondo para que no se encime con la caja
        const fondo = new THREE.ShapeGeometry(forma(pol))
        fondo.rotateX(-Math.PI / 2)
        fondo.translate(0, -pz.profundidad + 0.01, 0)
        agregar(fondo, pz)
        // las dos paredes largas (taludes), de 0 al fondo
        for (const { a, b, largo } of paredesLargas(pol[0])) {
          const pared = new THREE.PlaneGeometry(largo, pz.profundidad)
          pared.rotateY(Math.atan2(b[1] - a[1], b[0] - a[0]))
          pared.translate((a[0] + b[0]) / 2, -pz.profundidad / 2, -(a[1] + b[1]) / 2)
          agregar(pared, pz)
        }
      }
    }

    m.pintar = () => {
      const hayElegida = m.elegida != null && m.todas.some((p) => p.clave === m.elegida)
      for (const malla of m.seleccionables) {
        const { clave, tipo } = malla.userData
        malla.material.emissive.setHex(clave === m.elegida ? 0x3ddba6 : clave === m.encima ? 0x555555 : 0x000000)
        malla.material.emissiveIntensity = clave === m.elegida ? 0.55 : 0.5
        malla.material.opacity = !hayElegida ? opacidad(tipo) : clave === m.elegida ? 0.9 : 0.15
      }
    }
    m.pintar()

    // la cámara se encuadra al abrir o si cambia el terreno; al capturar se queda donde está
    const caja3 = new THREE.Box3().setFromObject(contenido)
    const firma = `${JSON.stringify(terreno?.vertices ?? null)}|${caja3.isEmpty()}|${hayExcavacion}`
    if (m.encuadre === firma) return
    m.encuadre = firma
    const centro = new THREE.Vector3(0, 0, 0)
    let tam = 20
    if (!caja3.isEmpty()) {
      caja3.getCenter(centro)
      const dim = caja3.getSize(new THREE.Vector3())
      tam = Math.max(dim.x, dim.z, 4)
    }
    if (m.rejilla) {
      escena.remove(m.rejilla)
      m.rejilla.geometry.dispose()
      m.rejilla.material.dispose()
    }
    m.rejilla = new THREE.GridHelper(Math.ceil((tam * 1.8) / 5) * 5, Math.ceil((tam * 1.8) / 5), 0x4b5a55, 0x2a3431)
    m.rejilla.position.set(centro.x, hayExcavacion ? -1.2 : -0.01, centro.z)
    escena.add(m.rejilla)
    camara.position.set(centro.x + tam * 0.9, tam * 0.8, centro.z + tam * 1.2)
    controles.target.copy(centro)
    controles.update()
  }, [terreno, ejes, todas, ver.terreno, ver.ejes])

  const elegida = sel != null ? todas.find((p) => p.clave === sel) : null

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
        {(ejes?.verticales?.length > 0 || ejes?.horizontales?.length > 0) && casilla('ejes', 'Ejes')}
        {exc.volumen > 0 && casilla('excavacion', `Excavación ${fmt(exc.volumen)} m³`)}
        {afi.area > 0 && casilla('afine', `Afine ${fmt(afi.area)} m²`)}
        {pla.area > 0 && casilla('plantilla', `Plantilla ${fmt(pla.area)} m²`)}
        {ace.kg > 0 && casilla('acero', `Acero ${fmt(ace.kg)} kg`)}
        {cim.ml > 0 && casilla('cimbra', `Cimbra ${fmt(cim.ml)} ml`)}
        {are.area > 0 && casilla('areas', `Áreas ${fmt(are.area)} m²`)}
        {terreno?.area > 0 && (
          <span className="num ml-auto text-xs text-cc-suave">
            Terreno {fmt(terreno.area)} m² · perímetro {fmt(terreno.perimetro)} m
          </span>
        )}
      </div>
      <div className="relative">
        <div ref={caja} style={{ height: altura, cursor: 'grab' }} />
        {!terreno?.vertices?.length && !todas.length && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-sm text-cc-suave">
            Aún no hay nada analizado. Empieza por el terreno (limpia y despalme) y aquí aparece.
          </p>
        )}
        {todas.length > 0 && (
          <div className="pointer-events-none absolute left-3 top-2 grid gap-1 rounded-lg px-2 py-1.5" style={{ background: 'rgba(0,0,0,0.35)' }}>
            {muestra(COLORES.zapata, 'Cepa de zapata')}
            {muestra(COLORES.trabe, 'Trabe de liga / contratrabe')}
            {muestra(COLORES.banda, 'Banda de losa (0.25)')}
            {muestra(COLORES.delgada, 'Losa 10 cm y firme (0.10)')}
            {ver.afine && afi.piezas.length > 0 && muestra(COLORES.afine, 'Afine: fondo y taludes')}
            {ver.plantilla && pla.piezas.length > 0 && muestra(COLORES.plantilla, 'Plantilla de concreto')}
            {ver.acero && ace.piezas.length > 0 && muestra(COLORES.acero, 'Elemento con acero (ficha)')}
            {ver.cimbra && cim.piezas.length > 0 && muestra(COLORES.cimbra, 'Cimbra: fronteras laterales')}
            {ver.areas && are.piezas.length > 0 && muestra(COLORES.area, 'Áreas (membrana, firme…)')}
          </div>
        )}
        {elegida && <FichaPieza pieza={elegida} />}
        {ver.acero && ace.sinUbicar > 0 && (
          <p className="pointer-events-none absolute bottom-10 left-3 text-[11px]" style={{ color: '#f0b866' }}>
            {ace.sinUbicar} tramo(s) de acero sin ubicación en planta: suman a los kg pero no se dibujan.
          </p>
        )}
        {ver.cimbra && cim.sinUbicar > 0 && (
          <p className="pointer-events-none absolute bottom-6 left-3 text-[11px]" style={{ color: '#f0b866' }}>
            {cim.sinUbicar} tramo(s) de cimbra sin ubicación en planta: suman a los ml pero no se dibujan.
          </p>
        )}
        {ver.excavacion && exc.sinUbicar > 0 && (
          <p className="pointer-events-none absolute bottom-2 left-3 text-[11px]" style={{ color: '#f0b866' }}>
            {exc.sinUbicar} renglón(es) de excavación sin ubicación en planta: suman al volumen pero no se dibujan.
          </p>
        )}
        <p className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-cc-tenue">Arrastra para girar · rueda para acercar{todas.length > 0 ? " · clic en una pieza para ver qué es" : ""}</p>
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
      {pieza.tipo !== 'cimbra' && pieza.tipo !== 'acero' && (
        <span className="num" style={{ color: '#a9b8b1' }}>
          Profundidad {fmt(pieza.profundidad)} m
        </span>
      )}
      {pieza.detalle && <span className="num" style={{ color: '#a9b8b1' }}>{pieza.detalle}</span>}
      <span className="num mt-1">{pieza.formula}</span>
    </div>
  )
}
