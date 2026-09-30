import { crearTokenActivacion } from '../lib/auth.js'
import { get, k, limpiar, nuevoId, put, query, remove, update } from '../lib/dynamo.js'
import { enlaceActivacion, enviarInvitacion } from '../lib/email.js'
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

/** Horas que dura el enlace de activación antes de caducar. */
const VIGENCIA_HORAS = 48

/** Nunca se exponen el hash del PIN ni el del enlace. */
function publico(u: UsuarioConPin): Usuario & { pendienteActivacion: boolean } {
  const { pinHash, activacionHash, activacionExpira, ...resto } = limpiar(u)
  void activacionHash
  void activacionExpira
  return { ...resto, pendienteActivacion: !pinHash }
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

/**
 * Prepara un enlace de activación y trata de enviarlo por correo.
 *
 * Si el correo no sale (SES en pruebas, usuario sin email...), se devuelve el
 * enlace para que el administrador lo entregue por otro medio: el alta del
 * usuario nunca queda bloqueada por un problema de correo.
 */
async function prepararInvitacion(
  usuario: UsuarioConPin,
  esRestablecimiento: boolean,
) {
  const { token, hash } = crearTokenActivacion()
  const expira = Math.floor(Date.now() / 1000) + VIGENCIA_HORAS * 3600

  await update(k.usuario(usuario.id), {
    activacionHash: hash,
    activacionExpira: expira,
  })

  const envio = await enviarInvitacion(
    usuario.email,
    usuario.nombre,
    token,
    esRestablecimiento,
  )

  return {
    correoEnviado: envio.enviado,
    motivo: envio.motivo,
    // Solo se revela al administrador autenticado que acaba de crear el alta.
    enlace: envio.enviado ? undefined : enlaceActivacion(token),
  }
}

export async function crear(req: Peticion) {
  exigir(req, 'admin')
  const datos = cuerpo<Partial<Usuario>>(req)

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
    email: datos.email?.trim() ?? '',
    rol: datos.rol ?? 'tecnico',
    empresaId: datos.rol === 'cliente' ? datos.empresaId : undefined,
    estado: datos.estado ?? 'activo',
    ultimoAcceso: null,
    // Sin PIN: lo define el propio usuario desde el enlace de activación.
    pinHash: '',
  }

  await put({
    ...k.usuario(usuario.id),
    GSI2PK: 'T#USUARIO',
    GSI2SK: nombreUsuario,
    ...usuario,
  })

  const invitacion = await prepararInvitacion(usuario, false)
  return creado({ ...publico(usuario), ...invitacion })
}

export async function actualizar(req: Peticion, id: string) {
  exigir(req, 'admin')
  const actual = await get<UsuarioConPin>(k.usuario(id))
  if (!actual) throw noEncontrado('Usuario no encontrado')

  const datos = cuerpo<Partial<Usuario>>(req)
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
    email: datos.email?.trim(),
    rol: datos.rol,
    estado: datos.estado,
    // Al dejar de ser cliente se descarta la empresa asignada.
    empresaId: rol === 'cliente' ? (datos.empresaId ?? actual.empresaId) : null,
  }
  if (nombreUsuario) patch.GSI2SK = nombreUsuario

  await update(k.usuario(id), patch)

  const actualizado = await get<UsuarioConPin>(k.usuario(id))
  return ok(publico(actualizado ?? actual))
}

/** Invalida el PIN actual y envía un enlace para definir uno nuevo. */
export async function reiniciarPin(req: Peticion, id: string) {
  exigir(req, 'admin')
  const actual = await get<UsuarioConPin>(k.usuario(id))
  if (!actual) throw noEncontrado('Usuario no encontrado')

  await update(k.usuario(id), { pinHash: '' })
  const invitacion = await prepararInvitacion(actual, true)

  return ok(invitacion)
}

export async function eliminar(req: Peticion, id: string) {
  const auth = exigir(req, 'admin')
  if (auth.sub === id) throw malaPeticion('No puede eliminar su propio usuario')
  await remove(k.usuario(id))
  return sinContenido()
}
