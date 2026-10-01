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
  prohibido,
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
    enlace: enlaceActivacion(token),
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

/* ---------- Superadministrador ---------- */

/** Frase que hay que escribir para desactivar o revocar a un superadministrador. */
export const fraseDesactivar = (usuario: string) => `desactivar ${usuario}`
export const fraseRevocar = (usuario: string) => `revocar ${usuario}`

const esSuperActivo = (u: UsuarioConPin | null | undefined) =>
  Boolean(u && u.superadmin && u.rol === 'admin' && u.estado === 'activo')

async function todos() {
  return query<UsuarioConPin>({ index: 'GSI2', pk: 'T#USUARIO' })
}

/**
 * Un superadministrador solo lo gestiona otro superadministrador. Así un
 * administrador común no puede desactivarlo, cambiarle el PIN (el enlace de
 * respaldo le daría acceso a su cuenta) ni eliminarlo.
 */
async function exigirGestionDe(req: Peticion, objetivo: UsuarioConPin) {
  if (!objetivo.superadmin) return
  const actor = await get<UsuarioConPin>(k.usuario(exigir(req, 'admin').sub))
  if (!esSuperActivo(actor)) {
    throw prohibido('Solo un superadministrador puede modificar a otro superadministrador')
  }
}

interface CuerpoActualizacion extends Partial<Usuario> {
  /** Texto escrito por el administrador para confirmar acciones sensibles. */
  confirmacion?: string
}

export async function actualizar(req: Peticion, id: string) {
  const auth = exigir(req, 'admin')
  const actual = await get<UsuarioConPin>(k.usuario(id))
  if (!actual) throw noEncontrado('Usuario no encontrado')

  const datos = cuerpo<CuerpoActualizacion>(req)
  await exigirGestionDe(req, actual)

  const rolFinal = datos.rol ?? actual.rol
  const estadoFinal = datos.estado ?? actual.estado
  const eraSuper = Boolean(actual.superadmin)
  const seraSuper =
    rolFinal === 'admin' &&
    estadoFinal === 'activo' &&
    (typeof datos.superadmin === 'boolean' ? datos.superadmin : eraSuper)
  const confirmacion = typeof datos.confirmacion === 'string' ? datos.confirmacion.trim() : ''

  if (!eraSuper && seraSuper) {
    // El primero lo designa cualquier administrador; después, solo un superadministrador.
    const lista = await todos()
    const actor = lista.find((u) => u.id === auth.sub)
    if (lista.some(esSuperActivo) && !esSuperActivo(actor)) {
      throw prohibido('Solo un superadministrador puede designar a otro')
    }
    if (!actual.pinHash) {
      throw malaPeticion('El usuario debe activar su cuenta antes de ser superadministrador')
    }
  }

  if (eraSuper && !seraSuper) {
    const desactiva = actual.estado === 'activo' && estadoFinal === 'inactivo'
    const frase = desactiva ? fraseDesactivar(actual.usuario) : fraseRevocar(actual.usuario)
    if (confirmacion !== frase) {
      throw malaPeticion(`Para continuar escriba exactamente: ${frase}`)
    }
    const restantes = (await todos()).filter((u) => u.id !== id && esSuperActivo(u))
    if (restantes.length === 0) {
      throw malaPeticion(
        'Es el único superadministrador activo. Designe otro antes de continuar.',
      )
    }
  }

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
    superadmin: seraSuper,
  }
  if (nombreUsuario) patch.GSI2SK = nombreUsuario

  await update(k.usuario(id), patch)

  const actualizado = await get<UsuarioConPin>(k.usuario(id))
  return ok(publico(actualizado ?? actual))
}

interface CuerpoFirma {
  nombre?: string
  estilo?: string
  cargo?: string
}

/**
 * Guarda la firma digital del propio usuario.
 *
 * Así el técnico la define una sola vez y no se le vuelve a pedir en cada
 * sesión; el cliente igual al firmar recepciones.
 */
export async function guardarFirma(req: Peticion) {
  const auth = exigir(req)
  const { nombre, estilo, cargo } = cuerpo<CuerpoFirma>(req)

  if (typeof nombre !== 'string' || nombre.trim().length < 3 || nombre.trim().length > 150) {
    throw malaPeticion('El nombre de la firma es obligatorio')
  }
  if (estilo !== 'clasica' && estilo !== 'moderna') {
    throw malaPeticion('Debe elegir un estilo de firma válido')
  }
  if (cargo !== undefined && (typeof cargo !== 'string' || cargo.length > 150)) {
    throw malaPeticion('El cargo no es válido')
  }
  const actual = await get<UsuarioConPin>(k.usuario(auth.sub))
  if (!actual || actual.estado !== 'activo') throw noEncontrado('Usuario activo no encontrado')

  const firma = {
    nombre: nombre.trim(),
    estilo,
    cargo: cargo?.trim() || undefined,
  }

  await update(k.usuario(auth.sub), { firma })

  return ok(publico({ ...actual, firma }))
}

/** Invalida el PIN actual y envía un enlace para definir uno nuevo. */
export async function reiniciarPin(req: Peticion, id: string) {
  exigir(req, 'admin')
  const actual = await get<UsuarioConPin>(k.usuario(id))
  if (!actual) throw noEncontrado('Usuario no encontrado')
  await exigirGestionDe(req, actual)

  await update(k.usuario(id), { pinHash: '' })
  const invitacion = await prepararInvitacion(actual, true)

  return ok(invitacion)
}

export async function eliminar(req: Peticion, id: string) {
  const auth = exigir(req, 'admin')
  if (auth.sub === id) throw malaPeticion('No puede eliminar su propio usuario')
  const actual = await get<UsuarioConPin>(k.usuario(id))
  if (!actual) throw noEncontrado('Usuario no encontrado')
  if (actual.superadmin) {
    throw malaPeticion('Un superadministrador no se puede eliminar. Revoque primero ese rol.')
  }
  await remove(k.usuario(id))
  return sinContenido()
}
