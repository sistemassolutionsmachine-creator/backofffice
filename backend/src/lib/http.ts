import type { TokenPayload, RolUsuario } from '../types.js'
import { verificarToken } from './auth.js'

export interface Peticion {
  metodo: string
  ruta: string
  /** Segmentos de la ruta tras /api: ['equipos', 'eq-01'] */
  segmentos: string[]
  query: Record<string, string | undefined>
  body: unknown
  auth: TokenPayload | null
}

export interface Respuesta {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export function json(statusCode: number, data: unknown): Respuesta {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(data),
  }
}

export const ok = (data: unknown) => json(200, data)
export const creado = (data: unknown) => json(201, data)
export const sinContenido = (): Respuesta => ({
  statusCode: 204,
  headers: {},
  body: '',
})

/** Error de negocio con código HTTP. Lo captura el handler. */
export class ErrorHttp extends Error {
  constructor(
    readonly statusCode: number,
    mensaje: string,
  ) {
    super(mensaje)
  }
}

export const malaPeticion = (m: string) => new ErrorHttp(400, m)
export const noAutorizado = (m = 'Credenciales inválidas o sesión expirada') =>
  new ErrorHttp(401, m)
export const prohibido = (m = 'No tiene permisos para esta operación') =>
  new ErrorHttp(403, m)
export const noEncontrado = (m = 'Recurso no encontrado') => new ErrorHttp(404, m)

/** Exige sesión válida y, opcionalmente, uno de los roles indicados. */
export function exigir(req: Peticion, ...roles: RolUsuario[]): TokenPayload {
  if (!req.auth) throw noAutorizado()
  if (roles.length > 0 && !roles.includes(req.auth.rol)) throw prohibido()
  return req.auth
}

export function leerAuth(headers: Record<string, string | undefined>) {
  const raw = headers.authorization ?? headers.Authorization
  if (!raw?.startsWith('Bearer ')) return null
  return verificarToken(raw.slice(7))
}

export function cuerpo<T>(req: Peticion): T {
  if (req.body === null || typeof req.body !== 'object') {
    throw malaPeticion('Se esperaba un cuerpo JSON')
  }
  return req.body as T
}
