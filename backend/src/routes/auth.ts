import { crearToken, hashPin, tokenCoincide, verificarPin } from '../lib/auth.js'
import { get, k, limpiar, query, update } from '../lib/dynamo.js'
import {
  cuerpo,
  exigir,
  malaPeticion,
  noAutorizado,
  ok,
  type Peticion,
} from '../lib/http.js'
import { limpiarIntentos, minutosDeBloqueo, registrarFallo } from '../lib/intentos.js'
import { ErrorHttp } from '../lib/http.js'
import type { UsuarioConPin } from '../types.js'

interface CuerpoLogin {
  usuario?: string
  pin?: string
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

export async function login(req: Peticion) {
  const { usuario, pin } = cuerpo<CuerpoLogin>(req)
  if (!usuario || !pin) throw malaPeticion('Usuario y PIN son obligatorios')

  const nombreUsuario = usuario.trim().toLowerCase()

  // Freno a la fuerza bruta antes de tocar la base de datos.
  const bloqueo = await minutosDeBloqueo(nombreUsuario)
  if (bloqueo > 0) {
    throw new ErrorHttp(
      429,
      `Demasiados intentos fallidos. Intente de nuevo en ${bloqueo} minuto(s).`,
    )
  }

  const registro = await buscarPorUsuario(nombreUsuario)

  // Mismo mensaje para usuario inexistente y PIN errado: no filtra qué falló.
  if (!registro || !registro.pinHash || !verificarPin(pin, registro.pinHash)) {
    const r = await registrarFallo(nombreUsuario)
    if (r.bloqueado) {
      throw new ErrorHttp(
        429,
        `Demasiados intentos fallidos. Intente de nuevo en ${r.minutos} minutos.`,
      )
    }
    throw noAutorizado(
      `Usuario o PIN incorrectos. Le quedan ${r.restantes} intento(s).`,
    )
  }

  if (registro.estado !== 'activo') {
    throw noAutorizado('Este usuario está inactivo. Contacte al administrador.')
  }

  await limpiarIntentos(nombreUsuario)

  const hoy = new Date().toISOString().slice(0, 10)
  await update(k.usuario(registro.id), { ultimoAcceso: hoy })

  const { pinHash, activacionHash, activacionExpira, ...usuarioPublico } =
    limpiar(registro)
  void pinHash
  void activacionHash
  void activacionExpira

  return ok({
    token: crearToken(usuarioPublico),
    usuario: { ...usuarioPublico, ultimoAcceso: hoy },
  })
}

/** Permite al frontend validar la sesión guardada al recargar la página. */
export async function sesion(req: Peticion) {
  const auth = exigir(req)
  return ok({
    id: auth.sub,
    usuario: auth.usuario,
    rol: auth.rol,
    empresaId: auth.empresaId,
  })
}

/* ---------- Activación de cuenta ---------- */

interface CuerpoActivacion {
  token?: string
  pin?: string
}

async function usuarioDelToken(token: string) {
  if (!token) throw malaPeticion('Enlace inválido')

  // Los enlaces son de un solo uso, así que se busca entre los pendientes.
  const usuarios = await query<UsuarioConPin>({ index: 'GSI2', pk: 'T#USUARIO' })
  const ahora = Math.floor(Date.now() / 1000)

  const usuario = usuarios.find(
    (u) => u.activacionHash && tokenCoincide(token, u.activacionHash),
  )

  if (!usuario) {
    throw new ErrorHttp(
      410,
      'Este enlace ya fue utilizado o no es válido. Solicite uno nuevo al administrador.',
    )
  }
  if (!usuario.activacionExpira || usuario.activacionExpira < ahora) {
    throw new ErrorHttp(
      410,
      'Este enlace caducó. Solicite uno nuevo al administrador.',
    )
  }
  return usuario
}

/** Comprueba el enlace antes de pedirle el PIN al usuario. */
export async function verificarActivacion(req: Peticion) {
  const { token } = cuerpo<CuerpoActivacion>(req)
  const usuario = await usuarioDelToken(token ?? '')
  return ok({ nombre: usuario.nombre, usuario: usuario.usuario })
}

/** El usuario define su propio PIN; el enlace queda inutilizado. */
export async function activar(req: Peticion) {
  const { token, pin } = cuerpo<CuerpoActivacion>(req)
  if (!pin || !/^\d{4}$/.test(pin)) {
    throw malaPeticion('El PIN debe tener exactamente 4 dígitos')
  }
  if (/^(\d)\1{3}$/.test(pin) || pin === '1234' || pin === '0123') {
    throw malaPeticion('Ese PIN es demasiado fácil de adivinar. Elija otro.')
  }

  const usuario = await usuarioDelToken(token ?? '')

  await update(k.usuario(usuario.id), {
    pinHash: hashPin(pin),
    activacionHash: null,
    activacionExpira: null,
    estado: 'activo',
  })
  await limpiarIntentos(usuario.usuario)

  const actualizado = await get<UsuarioConPin>(k.usuario(usuario.id))
  if (!actualizado) throw noAutorizado()

  const { pinHash, activacionHash, activacionExpira, ...usuarioPublico } =
    limpiar(actualizado)
  void pinHash
  void activacionHash
  void activacionExpira

  return ok({ token: crearToken(usuarioPublico), usuario: usuarioPublico })
}
