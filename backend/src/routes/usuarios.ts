import { hashPin } from '../lib/auth.js'
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
import type { Usuario, UsuarioConPin } from '../types.js'

const PIN_POR_DEFECTO = '1234'

/** Nunca se expone el hash del PIN. */
function publico(u: UsuarioConPin): Usuario {
  const { pinHash, ...resto } = limpiar(u)
  void pinHash
  return resto
}

export async function listar(req: Peticion) {
  exigir(req, 'admin')
  const usuarios = await query<UsuarioConPin>({ index: 'GSI2', pk: 'T#USUARIO' })
  return ok(usuarios.map(publico))
}

async function buscarPorUsuario(usuario: string) {
  const [u] = await query<UsuarioConPin>({
    index: 'GSI2',
    pk: 'T#USUARIO',
    sk: usuario.trim().toLowerCase(),
    exacto: true,
  })
  return u ?? null
}

export async function crear(req: Peticion) {
  exigir(req, 'admin')
  const datos = cuerpo<Partial<Usuario> & { pin?: string }>(req)

  if (!datos.nombre?.trim()) throw malaPeticion('El nombre es obligatorio')
  if (!datos.usuario?.trim()) throw malaPeticion('El usuario de acceso es obligatorio')
  if (datos.rol === 'cliente' && !datos.empresaId) {
    throw malaPeticion('Un usuario cliente debe tener una empresa asignada')
  }

  const nombreUsuario = datos.usuario.trim().toLowerCase()
  if (await buscarPorUsuario(nombreUsuario)) {
    throw malaPeticion(`El usuario "${nombreUsuario}" ya está en uso`)
  }

  const usuario: UsuarioConPin = {
    id: nuevoId('us'),
    nombre: datos.nombre.trim(),
    usuario: nombreUsuario,
    email: datos.email ?? '',
    rol: datos.rol ?? 'tecnico',
    empresaId: datos.rol === 'cliente' ? datos.empresaId : undefined,
    estado: datos.estado ?? 'activo',
    ultimoAcceso: null,
    pinHash: hashPin(datos.pin ?? PIN_POR_DEFECTO),
  }

  await put({
    ...k.usuario(usuario.id),
    GSI2PK: 'T#USUARIO',
    GSI2SK: nombreUsuario,
    ...usuario,
  })
  return creado(publico(usuario))
}

export async function actualizar(req: Peticion, id: string) {
  exigir(req, 'admin')
  const actual = await get<UsuarioConPin>(k.usuario(id))
  if (!actual) throw noEncontrado('Usuario no encontrado')

  const datos = cuerpo<Partial<Usuario> & { pin?: string }>(req)
  const nombreUsuario = datos.usuario?.trim().toLowerCase()

  if (nombreUsuario && nombreUsuario !== actual.usuario) {
    if (await buscarPorUsuario(nombreUsuario)) {
      throw malaPeticion(`El usuario "${nombreUsuario}" ya está en uso`)
    }
  }

  const rol = datos.rol ?? actual.rol
  if (rol === 'cliente' && !(datos.empresaId ?? actual.empresaId)) {
    throw malaPeticion('Un usuario cliente debe tener una empresa asignada')
  }

  const patch: Record<string, unknown> = {
    nombre: datos.nombre?.trim(),
    usuario: nombreUsuario,
    email: datos.email,
    rol: datos.rol,
    estado: datos.estado,
    // Al dejar de ser cliente se descarta la empresa asignada.
    empresaId: rol === 'cliente' ? (datos.empresaId ?? actual.empresaId) : null,
  }
  if (nombreUsuario) patch.GSI2SK = nombreUsuario
  if (datos.pin) patch.pinHash = hashPin(datos.pin)

  await update(k.usuario(id), patch)
  return ok(publico({ ...actual, ...datos, id } as UsuarioConPin))
}

/** Restablece el PIN al valor por defecto y lo devuelve una única vez. */
export async function reiniciarPin(req: Peticion, id: string) {
  exigir(req, 'admin')
  const actual = await get<UsuarioConPin>(k.usuario(id))
  if (!actual) throw noEncontrado('Usuario no encontrado')

  await update(k.usuario(id), { pinHash: hashPin(PIN_POR_DEFECTO) })
  return ok({ pin: PIN_POR_DEFECTO })
}

export async function eliminar(req: Peticion, id: string) {
  const auth = exigir(req, 'admin')
  if (auth.sub === id) throw malaPeticion('No puede eliminar su propio usuario')
  await remove(k.usuario(id))
  return sinContenido()
}
