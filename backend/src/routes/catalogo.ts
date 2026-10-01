import { get, k, put, query } from '../lib/dynamo.js'
import { cuerpo, exigir, malaPeticion, ok, type Peticion } from '../lib/http.js'
import type { CampoCatalogo, CatalogoEquipos, Equipo } from '../types.js'

const CAMPOS: CampoCatalogo[] = ['sistema', 'tipo']

/** Comparación sin mayúsculas, tildes ni espacios sobrantes. */
export const normalizar = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

async function leer(): Promise<CatalogoEquipos> {
  const item = await get<CatalogoEquipos>(k.catalogo())
  return { ocultos: { sistema: item?.ocultos?.sistema ?? [], tipo: item?.ocultos?.tipo ?? [] } }
}

export async function obtener(req: Peticion) {
  exigir(req)
  return ok(await leer())
}

interface CuerpoEliminar {
  campo?: string
  valor?: unknown
}

/**
 * Elimina una opción del catálogo.
 *
 * Solo si ningún equipo la usa: así ninguna ficha queda con un valor que ya
 * no existe en la lista.
 */
export async function eliminar(req: Peticion) {
  exigir(req, 'admin')
  const { campo, valor } = cuerpo<CuerpoEliminar>(req)

  if (!CAMPOS.includes(campo as CampoCatalogo)) throw malaPeticion('Campo de catálogo inválido')
  if (typeof valor !== 'string' || !valor.trim() || valor.length > 80) {
    throw malaPeticion('Indique la opción a eliminar')
  }
  const c = campo as CampoCatalogo
  const clave = normalizar(valor)

  const equipos = await query<Equipo>({ index: 'GSI2', pk: 'T#EQUIPO' })
  const enUso = equipos.filter((e) => normalizar(String(e[c] ?? '')) === clave).length
  if (enUso > 0) {
    throw malaPeticion(
      `No se puede eliminar «${valor.trim()}»: ${enUso} ${enUso === 1 ? 'equipo lo usa' : 'equipos lo usan'}.`,
    )
  }

  const catalogo = await leer()
  if (!catalogo.ocultos[c].some((o) => normalizar(o) === clave)) {
    catalogo.ocultos[c].push(valor.trim())
    await put({ ...k.catalogo(), ...catalogo })
  }
  return ok(catalogo)
}
