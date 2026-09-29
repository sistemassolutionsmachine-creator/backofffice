import { get, k, limpiar, nuevoId, put, query, remove, update } from '../lib/dynamo.js'
import {
  creado,
  cuerpo,
  exigir,
  malaPeticion,
  noEncontrado,
  ok,
  prohibido,
  sinContenido,
  type Peticion,
} from '../lib/http.js'
import type { Equipo } from '../types.js'

function indices(eq: Equipo) {
  return {
    GSI1PK: `EMPRESA#${eq.empresaId}`,
    GSI1SK: `EQUIPO#${eq.codigo}`,
    GSI2PK: 'T#EQUIPO',
    GSI2SK: eq.codigo,
  }
}

export async function listar(req: Peticion) {
  const auth = exigir(req)

  // El cliente queda acotado a su empresa, aunque pida otra por query string.
  const empresaId = auth.rol === 'cliente' ? auth.empresaId : req.query.empresa

  const equipos = empresaId
    ? await query<Equipo>({ index: 'GSI1', pk: `EMPRESA#${empresaId}`, sk: 'EQUIPO#' })
    : await query<Equipo>({ index: 'GSI2', pk: 'T#EQUIPO' })

  return ok(equipos.map(limpiar))
}

export async function obtener(req: Peticion, id: string) {
  const auth = exigir(req)
  const equipo = await get<Equipo>(k.equipo(id))
  if (!equipo) throw noEncontrado('Equipo no encontrado')
  if (auth.rol === 'cliente' && equipo.empresaId !== auth.empresaId) throw prohibido()
  return ok(limpiar(equipo))
}

/** Resolución del QR: /api/equipos/codigo/SRV-001 */
export async function porCodigo(req: Peticion, codigo: string) {
  const auth = exigir(req)
  const [equipo] = await query<Equipo>({
    index: 'GSI2',
    pk: 'T#EQUIPO',
    sk: codigo.toUpperCase(),
    exacto: true,
  })
  if (!equipo) throw noEncontrado(`No existe un equipo con el código ${codigo}`)
  if (auth.rol === 'cliente' && equipo.empresaId !== auth.empresaId) throw prohibido()
  return ok(limpiar(equipo))
}

export async function crear(req: Peticion) {
  exigir(req, 'admin')
  const datos = cuerpo<Omit<Equipo, 'id'>>(req)

  if (!datos.codigo?.trim()) throw malaPeticion('El código del equipo es obligatorio')
  if (!datos.nombre?.trim()) throw malaPeticion('El nombre del equipo es obligatorio')
  if (!datos.empresaId) throw malaPeticion('Debe indicar la empresa del equipo')

  const codigo = datos.codigo.trim().toUpperCase()
  const [existente] = await query<Equipo>({
    index: 'GSI2',
    pk: 'T#EQUIPO',
    sk: codigo,
    exacto: true,
  })
  if (existente) throw malaPeticion(`Ya existe un equipo con el código ${codigo}`)

  const equipo: Equipo = {
    id: nuevoId('eq'),
    empresaId: datos.empresaId,
    codigo,
    nombre: datos.nombre.trim(),
    tipo: datos.tipo ?? '',
    marca: datos.marca ?? '',
    modelo: datos.modelo ?? '',
    serial: datos.serial ?? '',
    ubicacion: datos.ubicacion ?? '',
    fechaInstalacion: datos.fechaInstalacion ?? new Date().toISOString().slice(0, 10),
    estado: datos.estado ?? 'operativo',
    ultimaRevision: null,
    responsable: datos.responsable ?? '',
  }

  await put({ ...k.equipo(equipo.id), ...indices(equipo), ...equipo })
  return creado(equipo)
}

export async function actualizar(req: Peticion, id: string) {
  exigir(req, 'admin')
  const actual = await get<Equipo>(k.equipo(id))
  if (!actual) throw noEncontrado('Equipo no encontrado')

  const datos = cuerpo<Partial<Equipo>>(req)
  const fusionado: Equipo = {
    ...actual,
    ...datos,
    id,
    codigo: (datos.codigo ?? actual.codigo).trim().toUpperCase(),
  }

  await update(k.equipo(id), {
    empresaId: fusionado.empresaId,
    codigo: fusionado.codigo,
    nombre: fusionado.nombre,
    tipo: fusionado.tipo,
    marca: fusionado.marca,
    modelo: fusionado.modelo,
    serial: fusionado.serial,
    ubicacion: fusionado.ubicacion,
    fechaInstalacion: fusionado.fechaInstalacion,
    estado: fusionado.estado,
    responsable: fusionado.responsable,
    ...indices(fusionado),
  })
  return ok(fusionado)
}

export async function eliminar(req: Peticion, id: string) {
  exigir(req, 'admin')
  await remove(k.equipo(id))
  return sinContenido()
}
