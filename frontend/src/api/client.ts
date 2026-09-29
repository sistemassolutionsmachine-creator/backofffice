import type {
  Empresa,
  Equipo,
  Revision,
  RevisionDetalle,
  Usuario,
} from '../types'

/**
 * Cliente de la API.
 *
 * CloudFront publica el portal y la API en el mismo dominio, así que basta con
 * rutas relativas: no hay CORS ni URLs que configurar por entorno.
 */

const BASE = '/api'
const CLAVE_TOKEN = 'sm-token'

export class ErrorApi extends Error {
  readonly status: number

  constructor(status: number, mensaje: string) {
    super(mensaje)
    this.status = status
  }
}

export function getToken() {
  return sessionStorage.getItem(CLAVE_TOKEN)
}

export function setToken(token: string) {
  sessionStorage.setItem(CLAVE_TOKEN, token)
}

export function limpiarToken() {
  sessionStorage.removeItem(CLAVE_TOKEN)
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'DELETE'

async function peticion<T>(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<T> {
  const token = getToken()
  const cabeceras: Record<string, string> = {}
  if (cuerpo !== undefined) cabeceras['content-type'] = 'application/json'
  if (token) cabeceras.authorization = `Bearer ${token}`

  let respuesta: Response
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
  } catch {
    throw new ErrorApi(0, 'Sin conexión con el servidor. Revise su red.')
  }

  if (respuesta.status === 204) return undefined as T

  const texto = await respuesta.text()
  let datos: unknown = null
  if (texto) {
    try {
      datos = JSON.parse(texto)
    } catch {
      datos = null
    }
  }

  if (!respuesta.ok) {
    // La sesión caducó: se limpia para que la aplicación vuelva al login.
    if (respuesta.status === 401) limpiarToken()
    const mensaje =
      (datos as { error?: string } | null)?.error ??
      `Error ${respuesta.status} al contactar el servidor`
    throw new ErrorApi(respuesta.status, mensaje)
  }

  return datos as T
}

const get = <T,>(ruta: string) => peticion<T>('GET', ruta)
const post = <T,>(ruta: string, cuerpo?: unknown) => peticion<T>('POST', ruta, cuerpo)
const put = <T,>(ruta: string, cuerpo: unknown) => peticion<T>('PUT', ruta, cuerpo)
const del = (ruta: string) => peticion<void>('DELETE', ruta)

/* ---------- Autenticación ---------- */

export interface RespuestaLogin {
  token: string
  usuario: Usuario
}

export const api = {
  login: (usuario: string, pin: string) =>
    post<RespuestaLogin>('/auth/login', { usuario, pin }),

  sesion: () =>
    get<{ id: string; usuario: string; rol: string; empresaId?: string }>(
      '/auth/sesion',
    ),

  /* ---------- Empresas ---------- */
  empresas: {
    listar: () => get<Empresa[]>('/empresas'),
    crear: (datos: Omit<Empresa, 'id'>) => post<Empresa>('/empresas', datos),
    actualizar: (id: string, datos: Partial<Empresa>) =>
      put<Empresa>(`/empresas/${id}`, datos),
    eliminar: (id: string) => del(`/empresas/${id}`),
  },

  /* ---------- Equipos ---------- */
  equipos: {
    listar: (empresaId?: string) =>
      get<Equipo[]>(empresaId ? `/equipos?empresa=${empresaId}` : '/equipos'),
    obtener: (id: string) => get<Equipo>(`/equipos/${id}`),
    porCodigo: (codigo: string) =>
      get<Equipo>(`/equipos/codigo/${encodeURIComponent(codigo)}`),
    crear: (datos: Omit<Equipo, 'id'>) => post<Equipo>('/equipos', datos),
    actualizar: (id: string, datos: Partial<Equipo>) =>
      put<Equipo>(`/equipos/${id}`, datos),
    eliminar: (id: string) => del(`/equipos/${id}`),
  },

  /* ---------- Revisiones ---------- */
  revisiones: {
    listar: (filtros: { empresa?: string; equipo?: string } = {}) => {
      const p = new URLSearchParams()
      if (filtros.empresa) p.set('empresa', filtros.empresa)
      if (filtros.equipo) p.set('equipo', filtros.equipo)
      const qs = p.toString()
      return get<Revision[]>(`/revisiones${qs ? `?${qs}` : ''}`)
    },
    obtener: (equipoId: string, id: string) =>
      get<RevisionDetalle>(`/revisiones/${equipoId}/${id}`),
    crear: (datos: Partial<Revision>) => post<Revision>('/revisiones', datos),
    actualizar: (equipoId: string, id: string, datos: Partial<Revision>) =>
      put<Revision>(`/revisiones/${equipoId}/${id}`, datos),

    /** Pide permiso para subir una foto y la envía directo a S3. */
    subirEvidencia: async (
      equipoId: string,
      revisionId: string,
      momento: 'entrada' | 'salida',
      archivo: Blob,
      nombre: string,
    ) => {
      const { url, clave } = await post<{ url: string; clave: string }>(
        '/revisiones/evidencias',
        { equipoId, revisionId, momento, nombre, contentType: archivo.type },
      )
      const r = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': archivo.type },
        body: archivo,
      })
      if (!r.ok) throw new ErrorApi(r.status, 'No se pudo subir la fotografía')
      return clave
    },

    /** Archiva el PDF del reporte en S3. */
    subirPdf: async (equipoId: string, revisionId: string, pdf: Blob) => {
      const { url, clave } = await post<{ url: string; clave: string }>(
        '/revisiones/pdf',
        { equipoId, revisionId },
      )
      const r = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/pdf' },
        body: pdf,
      })
      if (!r.ok) throw new ErrorApi(r.status, 'No se pudo archivar el PDF')
      return clave
    },
  },

  /* ---------- Usuarios ---------- */
  usuarios: {
    listar: () => get<Usuario[]>('/usuarios'),
    crear: (datos: Partial<Usuario> & { pin?: string }) =>
      post<Usuario>('/usuarios', datos),
    actualizar: (id: string, datos: Partial<Usuario> & { pin?: string }) =>
      put<Usuario>(`/usuarios/${id}`, datos),
    reiniciarPin: (id: string) => post<{ pin: string }>(`/usuarios/${id}/pin`),
    eliminar: (id: string) => del(`/usuarios/${id}`),
  },
}
