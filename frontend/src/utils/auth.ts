import { api, limpiarToken, setToken } from '../api/client'
import type { Usuario } from '../types'

export type Rol = 'admin' | 'tecnico' | 'cliente'

const CLAVE_USUARIO = 'sm-usuario'

export function getUsuario(): Usuario | null {
  try {
    const raw = sessionStorage.getItem(CLAVE_USUARIO)
    return raw ? (JSON.parse(raw) as Usuario) : null
  } catch {
    return null
  }
}

export function getRol(): Rol | null {
  return getUsuario()?.rol ?? null
}

/** Empresa a la que pertenece el usuario cliente. */
export function getEmpresaDelCliente(): string | null {
  const u = getUsuario()
  return u?.rol === 'cliente' ? (u.empresaId ?? null) : null
}

export async function iniciarSesion(usuario: string, pin: string): Promise<Usuario> {
  const r = await api.login(usuario.trim().toLowerCase(), pin)
  setToken(r.token)
  sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(r.usuario))
  return r.usuario
}

export function cerrarSesion() {
  limpiarToken()
  sessionStorage.removeItem(CLAVE_USUARIO)
  sessionStorage.removeItem('sm-firma')
}

export function rutaDeRol(rol: Rol): string {
  if (rol === 'admin') return '/equipos'
  if (rol === 'tecnico') return '/tecnico/escanear'
  return '/cliente'
}
