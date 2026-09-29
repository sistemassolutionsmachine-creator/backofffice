import { get, k, limpiar, nuevoId, put, query, remove, update } from '../lib/dynamo.js'
import {
  creado,
  cuerpo,
  exigir,
  malaPeticion,
  noEncontrado,
  ok,
  sinContenido,
  type Peticion,
} from '../lib/http.js'
import type { Empresa, Equipo } from '../types.js'

export async function listar(req: Peticion) {
  const auth = exigir(req)

  // El cliente solo puede ver su propia empresa.
  if (auth.rol === 'cliente') {
    if (!auth.empresaId) return ok([])
    const empresa = await get<Empresa>(k.empresa(auth.empresaId))
    return ok(empresa ? [limpiar(empresa)] : [])
  }

  const empresas = await query<Empresa>({ index: 'GSI2', pk: 'T#EMPRESA' })
  return ok(empresas.map(limpiar))
}

export async function obtener(req: Peticion, id: string) {
  const auth = exigir(req)
  if (auth.rol === 'cliente' && auth.empresaId !== id) throw noEncontrado()

  const empresa = await get<Empresa>(k.empresa(id))
  if (!empresa) throw noEncontrado('Empresa no encontrada')
  return ok(limpiar(empresa))
}

function validar(d: Partial<Empresa>) {
  if (!d.nombre?.trim()) throw malaPeticion('El nombre de la empresa es obligatorio')
}

export async function crear(req: Peticion) {
  exigir(req, 'admin')
  const datos = cuerpo<Omit<Empresa, 'id'>>(req)
  validar(datos)

  const empresa: Empresa = {
    id: nuevoId('em'),
    nombre: datos.nombre.trim(),
    nit: datos.nit ?? '',
    contacto: datos.contacto ?? '',
    telefono: datos.telefono ?? '',
    ciudad: datos.ciudad ?? '',
  }

  await put({
    ...k.empresa(empresa.id),
    GSI2PK: 'T#EMPRESA',
    GSI2SK: empresa.nombre.toLowerCase(),
    ...empresa,
  })
  return creado(empresa)
}

export async function actualizar(req: Peticion, id: string) {
  exigir(req, 'admin')
  const actual = await get<Empresa>(k.empresa(id))
  if (!actual) throw noEncontrado('Empresa no encontrada')

  const datos = cuerpo<Partial<Empresa>>(req)
  const patch: Record<string, unknown> = {
    nombre: datos.nombre?.trim(),
    nit: datos.nit,
    contacto: datos.contacto,
    telefono: datos.telefono,
    ciudad: datos.ciudad,
  }
  if (datos.nombre?.trim()) patch.GSI2SK = datos.nombre.trim().toLowerCase()

  await update(k.empresa(id), patch)
  return ok({ ...actual, ...datos, id })
}

export async function eliminar(req: Peticion, id: string) {
  exigir(req, 'admin')

  // Regla de negocio: no se borra una empresa que todavía tiene equipos.
  const equipos = await query<Equipo>({
    index: 'GSI1',
    pk: `EMPRESA#${id}`,
    sk: 'EQUIPO#',
  })
  if (equipos.length > 0) {
    throw malaPeticion(
      `No se puede eliminar: la empresa tiene ${equipos.length} equipo(s) registrado(s).`,
    )
  }

  await remove(k.empresa(id))
  return sinContenido()
}
