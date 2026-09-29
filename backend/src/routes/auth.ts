import { crearToken, verificarPin } from '../lib/auth.js'
import { k, limpiar, query, update } from '../lib/dynamo.js'
import {
  cuerpo,
  exigir,
  malaPeticion,
  noAutorizado,
  ok,
  type Peticion,
} from '../lib/http.js'
import type { UsuarioConPin } from '../types.js'

interface CuerpoLogin {
  usuario?: string
  pin?: string
}

export async function login(req: Peticion) {
  const { usuario, pin } = cuerpo<CuerpoLogin>(req)
  if (!usuario || !pin) throw malaPeticion('Usuario y PIN son obligatorios')

  const [registro] = await query<UsuarioConPin>({
    index: 'GSI2',
    pk: 'T#USUARIO',
    sk: usuario.trim().toLowerCase(),
    exacto: true,
  })

  // Mismo mensaje para usuario inexistente y PIN errado: no filtra qué falló.
  if (!registro || !verificarPin(pin, registro.pinHash)) throw noAutorizado()
  if (registro.estado !== 'activo') {
    throw noAutorizado('Este usuario está inactivo. Contacte al administrador.')
  }

  const hoy = new Date().toISOString().slice(0, 10)
  await update(k.usuario(registro.id), { ultimoAcceso: hoy })

  const { pinHash, ...usuarioPublico } = limpiar(registro)
  void pinHash

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
