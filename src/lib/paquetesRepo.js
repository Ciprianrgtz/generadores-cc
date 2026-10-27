import { supabase } from './supabase'

// Catálogo de la oficina y paquetes de generadores. Los permisos los valida la
// base de datos (RLS); aquí solo se piden las operaciones.

const ok = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}

// Si la migración 0003 aún no se corrió, las tablas no existen: se explica en vez de mostrar un error crudo.
export function mensajeError(e) {
  const m = e.message ?? ''
  // un método de análisis nuevo se habilita con su migración: sin ella la base rechaza el valor
  if (/analisis_tipo_check/i.test(m)) return 'Ese método todavía no está habilitado en tu base: falta correr la migración más reciente de supabase/migrations en Supabase → SQL Editor.'
  return /does not exist|schema cache|could not find/i.test(m)
    ? 'Falta correr la migración 0003 (supabase/migrations/0003_catalogo_y_paquetes.sql) en Supabase → SQL Editor.'
    : m
}

// ---------------------------------------------------------------- catálogo
export async function catalogo() {
  const partidas = ok(await supabase.from('partidas').select('id, clave, descripcion, orden').order('orden').order('clave'))
  const conceptos = ok(await supabase.from('conceptos').select('partida_id').eq('activo', true))
  const cuenta = {}
  for (const c of conceptos) cuenta[c.partida_id] = (cuenta[c.partida_id] ?? 0) + 1
  // las partidas sin conceptos (p. ej. restos de una importación equivocada) no se muestran
  return partidas.map((p) => ({ ...p, conceptos: cuenta[p.id] ?? 0 })).filter((p) => p.conceptos > 0)
}

/** Catálogo completo para administrarlo: todas las partidas (aun las vacías) con sus conceptos en orden. */
export async function catalogoAdmin() {
  const partidas = ok(await supabase.from('partidas').select('id, clave, descripcion, orden').order('orden').order('clave'))
  const conceptos = ok(await supabase.from('conceptos').select('id, clave, descripcion, unidad, partida_id, orden').eq('activo', true).order('orden'))
  return partidas.map((p) => ({ ...p, conceptos: conceptos.filter((c) => c.partida_id === p.id) }))
}

// Los paquetes ya armados guardan su propia copia: borrar o cambiar algo del catálogo no los afecta.
export const actualizarPartidaCatalogo = async (id, { clave, descripcion }) =>
  ok(await supabase.from('partidas').update({ clave: clave.trim().toUpperCase(), descripcion: descripcion.trim() }).eq('id', id))
export const actualizarConceptoCatalogo = async (id, { clave, descripcion, unidad }) =>
  ok(
    await supabase
      .from('conceptos')
      .update({ clave: clave.trim().toUpperCase(), clave_origen: clave.trim().toUpperCase(), descripcion: descripcion.trim(), unidad: unidad.trim().toUpperCase() })
      .eq('id', id),
  )
export const eliminarConceptoCatalogo = async (id) => ok(await supabase.from('conceptos').delete().eq('id', id))
export async function eliminarPartidaCatalogo(id) {
  ok(await supabase.from('conceptos').delete().eq('partida_id', id))
  return ok(await supabase.from('partidas').delete().eq('id', id))
}

const norma = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()

/**
 * Agrega al catálogo las partidas y conceptos que aún no existen. A los que ya
 * estaban solo les actualiza su partida y su lugar en el orden (no toca su
 * descripción ni su unidad). Una partida ya existente se reconoce por su clave
 * o por su nombre.
 */
export async function importarCatalogo({ partidas, conceptos }) {
  const existentesP = ok(await supabase.from('partidas').select('id, clave, descripcion'))
  const porClave = new Map(existentesP.map((p) => [p.clave, p]))
  const porNombre = new Map(existentesP.map((p) => [norma(p.descripcion), p]))
  const ids = {}
  const nuevasP = []
  for (const p of partidas) {
    const previa = porClave.get(p.clave) ?? porNombre.get(norma(p.descripcion))
    if (previa) ids[p.clave] = previa.id
    else nuevasP.push(p)
  }
  if (nuevasP.length) {
    const creadas = ok(
      await supabase.from('partidas').insert(nuevasP.map((p) => ({ clave: p.clave, descripcion: p.descripcion, orden: p.orden }))).select('id, clave'),
    )
    for (const p of creadas) ids[p.clave] = p.id
  }
  // el orden de las partidas existentes también se acomoda al del reporte
  for (const p of partidas) ok(await supabase.from('partidas').update({ orden: p.orden }).eq('id', ids[p.clave]))

  const antes = ok(await supabase.from('conceptos').select('clave, descripcion, unidad'))
  const existentes = new Map(antes.map((c) => [c.clave, c]))
  let nuevos = 0
  const filas = conceptos.map((c) => {
    const previo = existentes.get(c.clave)
    if (!previo) nuevos++
    return {
      clave: c.clave,
      clave_origen: c.clave,
      descripcion: previo?.descripcion ?? c.descripcion,
      unidad: previo?.unidad ?? c.unidad,
      partida_id: ids[c.partida],
      orden: c.orden,
    }
  })
  for (let i = 0; i < filas.length; i += 200) {
    ok(await supabase.from('conceptos').upsert(filas.slice(i, i + 200), { onConflict: 'clave' }))
  }
  return { nuevos, reubicados: conceptos.length - nuevos }
}

// ---------------------------------------------------------------- paquetes
export async function listarPaquetes() {
  const paquetes = ok(
    await supabase.from('paquetes').select('id, nombre, estado, creado_en, proyecto:proyectos(clave, nombre)').order('creado_en', { ascending: false }),
  )
  const conceptos = ok(await supabase.from('paquete_conceptos').select('paquete_id, estado'))
  const cuenta = {}
  for (const c of conceptos) {
    const x = (cuenta[c.paquete_id] ??= { total: 0, listos: 0 })
    x.total++
    if (c.estado === 'listo') x.listos++
  }
  return paquetes.map((p) => ({ ...p, ...(cuenta[p.id] ?? { total: 0, listos: 0 }) }))
}

/** partidaIds = las del catálogo que entran; [] crea el paquete vacío (para armarlo a mano o importar el Excel). */
export async function crearPaquete(nombre, partidaIds = []) {
  return ok(await supabase.rpc('crear_paquete', { p_nombre: nombre, p_partidas: partidaIds }))
}

export const renombrarPaquete = async (id, nombre) => ok(await supabase.from('paquetes').update({ nombre }).eq('id', id))
export const archivarPaquete = async (id, archivado) =>
  ok(await supabase.from('paquetes').update({ estado: archivado ? 'archivado' : 'activo' }).eq('id', id))
/** Borra el paquete con todas sus partidas y conceptos. El proyecto y sus zapatas se quedan. */
export const eliminarPaquete = async (id) => ok(await supabase.from('paquetes').delete().eq('id', id))

export async function paquete(id) {
  const cabecera = ok(await supabase.from('paquetes').select('id, nombre, estado, proyecto:proyectos(clave, nombre)').eq('id', id).single())
  const partidas = ok(await supabase.from('paquete_partidas').select('*').eq('paquete_id', id).order('orden'))
  const filas = ok(await supabase.from('paquete_conceptos').select('*, generador:generadores(cantidad, unidad)').eq('paquete_id', id).order('orden'))
  // la cantidad del análisis guardado (o null si el concepto no se ha analizado)
  const conceptos = filas.map(({ generador, ...c }) => {
    const g = Array.isArray(generador) ? generador[0] : generador
    return { ...c, cantidad: g?.cantidad != null ? Number(g.cantidad) : null }
  })
  return { cabecera, partidas, conceptos }
}

export const moverConcepto = async (id, dir) => ok(await supabase.rpc('mover_paquete_concepto', { p_id: id, p_dir: dir }))
export const moverPartida = async (id, dir) => ok(await supabase.rpc('mover_paquete_partida', { p_id: id, p_dir: dir }))
/** Nota libre de un concepto del paquete (por qué difiere de Neodata, criterio usado…). Vacía = sin nota. */
export const guardarNota = async (id, nota) => ok(await supabase.from('paquete_conceptos').update({ nota: nota.trim() || null }).eq('id', id))
export const cambiarEstadoConcepto = async (id, estado) => ok(await supabase.from('paquete_conceptos').update({ estado }).eq('id', id))
export const quitarConcepto = async (id) => ok(await supabase.from('paquete_conceptos').delete().eq('id', id))
export const quitarPartida = async (id) => ok(await supabase.from('paquete_partidas').delete().eq('id', id))

/** Conceptos del catálogo de esa partida que todavía no están en el paquete. */
export async function conceptosDisponibles(paquetePartida, yaEnPaquete) {
  if (!paquetePartida.partida_id) return []
  const lista = ok(
    await supabase.from('conceptos').select('id, clave, descripcion, unidad').eq('partida_id', paquetePartida.partida_id).eq('activo', true).order('orden'),
  )
  const usados = new Set(yaEnPaquete.map((c) => c.concepto_id))
  return lista.filter((c) => !usados.has(c.id))
}

// ------------------------------------------- edición dentro del paquete
// Todo lo que se escribe en un paquete es editable y es copia propia de ese paquete:
// cambiarlo no toca el catálogo ni otras casas.
export async function actualizarPartida(id, { clave, descripcion }) {
  return ok(await supabase.from('paquete_partidas').update({ clave: clave.trim().toUpperCase(), descripcion: descripcion.trim() }).eq('id', id))
}

export async function agregarPartida(paqueteId, { clave, descripcion }, ultimoOrden) {
  return ok(
    await supabase
      .from('paquete_partidas')
      .insert({ paquete_id: paqueteId, clave: clave.trim().toUpperCase(), descripcion: descripcion.trim(), orden: ultimoOrden + 1 })
      .select()
      .single(),
  )
}

export async function actualizarConcepto(id, { clave, descripcion, unidad }) {
  return ok(
    await supabase.from('paquete_conceptos').update({ clave: clave.trim().toUpperCase(), descripcion: descripcion.trim(), unidad: unidad.trim().toUpperCase() }).eq('id', id),
  )
}

/**
 * Pasa al paquete lo que trae un reporte de Neodata (ya leído): las partidas y
 * conceptos que le faltan, al final y en el orden del reporte. Lo que ya está no
 * se toca. Los volúmenes no se leen: se calculan aquí con los generadores.
 */
export async function importarAlPaquete(paqueteId, { partidas, conceptos }, partidasActuales, conceptosActuales) {
  const norma = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
  const mapa = {} // clave del reporte → partida del paquete
  let ultimaPartida = Math.max(0, ...partidasActuales.map((p) => p.orden))
  let partidasNuevas = 0
  for (const p of partidas) {
    let previa = partidasActuales.find((x) => x.clave === p.clave || norma(x.descripcion) === norma(p.descripcion))
    if (!previa) {
      let clave = p.clave
      for (let n = 2; partidasActuales.some((x) => x.clave === clave); n++) clave = `${p.clave}${n}`
      previa = await agregarPartida(paqueteId, { clave, descripcion: p.descripcion }, ultimaPartida)
      partidasActuales.push(previa)
      ultimaPartida = previa.orden
      partidasNuevas++
    }
    mapa[p.clave] = previa
  }
  const ya = new Set(conceptosActuales.map((c) => c.clave))
  const ultimo = {}
  for (const c of conceptosActuales) ultimo[c.paquete_partida_id] = Math.max(ultimo[c.paquete_partida_id] ?? 0, c.orden)
  const filas = []
  for (const c of conceptos) {
    if (ya.has(c.clave)) continue
    const pp = mapa[c.partida]
    ultimo[pp.id] = (ultimo[pp.id] ?? 0) + 1
    filas.push({ paquete_id: paqueteId, paquete_partida_id: pp.id, clave: c.clave, descripcion: c.descripcion, unidad: c.unidad, orden: ultimo[pp.id] })
  }
  for (let i = 0; i < filas.length; i += 200) ok(await supabase.from('paquete_conceptos').insert(filas.slice(i, i + 200)))
  return { partidasNuevas, conceptosNuevos: filas.length, yaEstaban: conceptos.length - filas.length }
}

export async function agregarConcepto(paqueteId, paquetePartida, concepto, ultimoOrden) {
  return ok(
    await supabase.from('paquete_conceptos').insert({
      paquete_id: paqueteId,
      paquete_partida_id: paquetePartida.id,
      concepto_id: concepto.id ?? null,
      clave: concepto.clave,
      descripcion: concepto.descripcion,
      unidad: concepto.unidad,
      orden: ultimoOrden + 1,
    }),
  )
}
