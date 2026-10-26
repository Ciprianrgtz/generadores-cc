import { supabase } from './supabase'

// Proyectos y generadores. El orden de la app es PROYECTO → paquete de generadores
// → análisis de cada concepto. Los permisos los valida la base de datos (RLS).

const ok = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}

// Si la migración 0004 aún no se corrió, faltan tablas o columnas: se explica en vez de mostrar un error crudo.
export function mensajeError(e) {
  const m = e.message ?? ''
  if (/paquetes_un_paquete|ya tiene su paquete/i.test(m)) return 'Este proyecto ya tiene su paquete de generadores.'
  return /does not exist|schema cache|could not find|Could not choose/i.test(m)
    ? 'Falta correr la migración 0004 (supabase/migrations/0004_proyecto_primero_y_generadores.sql) en Supabase → SQL Editor.'
    : m
}

const claveDe = (nombre) =>
  nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'PROYECTO'

/** Proyectos con su paquete (si lo tiene) y el avance de sus conceptos. */
export async function listarProyectos() {
  const proyectos = ok(
    await supabase.from('proyectos').select('id, clave, nombre, estado, creado_en, paquetes(id, nombre, estado)').order('creado_en', { ascending: false }),
  )
  const conceptos = ok(await supabase.from('paquete_conceptos').select('paquete_id, estado'))
  const cuenta = {}
  for (const c of conceptos) {
    const x = (cuenta[c.paquete_id] ??= { total: 0, listos: 0 })
    x.total++
    if (c.estado === 'listo') x.listos++
  }
  return proyectos.map((p) => {
    const paquete = p.paquetes?.[0] ?? null
    return { ...p, paquete, ...(paquete ? (cuenta[paquete.id] ?? { total: 0, listos: 0 }) : { total: 0, listos: 0 }) }
  })
}

export async function crearProyecto(nombre) {
  const limpio = nombre.trim()
  if (!limpio) throw new Error('El proyecto necesita un nombre')
  const existentes = new Set(ok(await supabase.from('proyectos').select('clave')).map((p) => p.clave))
  const base = claveDe(limpio)
  let clave = base
  for (let n = 2; existentes.has(clave); n++) clave = `${base}-${n}`
  return ok(await supabase.from('proyectos').insert({ clave, nombre: limpio }).select().single())
}

export async function proyecto(id) {
  const p = ok(await supabase.from('proyectos').select('id, clave, nombre, estado, terreno, ejes, paquetes(id, nombre, estado)').eq('id', id).single())
  return { ...p, paquete: p.paquetes?.[0] ?? null }
}

export const guardarTerreno = async (proyectoId, terreno) => ok(await supabase.from('proyectos').update({ terreno }).eq('id', proyectoId))
export const guardarEjes = async (proyectoId, ejes) => ok(await supabase.from('proyectos').update({ ejes }).eq('id', proyectoId))

/** El paquete del proyecto se crea desde el catálogo (partidaIds) o vacío ([]). */
export async function crearPaqueteDelProyecto(proyectoId, nombre, partidaIds = []) {
  return ok(await supabase.rpc('crear_paquete', { p_nombre: nombre, p_partidas: partidaIds, p_proyecto_id: proyectoId }))
}

// ------------------------------------------------------------ generadores
export const asignarAnalisis = async (paqueteConceptoId, tipo) =>
  ok(await supabase.from('paquete_conceptos').update({ analisis_tipo: tipo || null }).eq('id', paqueteConceptoId))

export async function generador(paqueteConceptoId) {
  return ok(await supabase.from('generadores').select('*').eq('paquete_concepto_id', paqueteConceptoId).maybeSingle())
}

/** Guarda (o actualiza) el análisis de un concepto y marca el concepto "en proceso" si seguía pendiente. */
export async function guardarGenerador(paqueteConceptoId, { tipo, datos, cantidad, unidad, formula }) {
  const fila = ok(
    await supabase
      .from('generadores')
      .upsert({ paquete_concepto_id: paqueteConceptoId, tipo, datos, cantidad, unidad, formula }, { onConflict: 'paquete_concepto_id' })
      .select()
      .single(),
  )
  ok(await supabase.from('paquete_conceptos').update({ estado: 'en_proceso' }).eq('id', paqueteConceptoId).eq('estado', 'pendiente'))
  return fila
}

/** Todo lo analizado de un paquete: alimenta el visor 3D (cada concepto aporta su geometría). */
export async function generadoresDelPaquete(paqueteId) {
  const conceptos = ok(await supabase.from('paquete_conceptos').select('id, clave, descripcion').eq('paquete_id', paqueteId))
  const ids = conceptos.map((c) => c.id)
  if (!ids.length) return []
  const filas = ok(await supabase.from('generadores').select('paquete_concepto_id, tipo, datos, cantidad, unidad, actualizado_en').in('paquete_concepto_id', ids))
  return filas.map((g) => ({ ...g, concepto: conceptos.find((c) => c.id === g.paquete_concepto_id) }))
}
