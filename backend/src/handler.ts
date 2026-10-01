import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda'
import {
  ErrorHttp,
  json,
  leerAuth,
  noEncontrado,
  sinContenido,
  type Peticion,
  type Respuesta,
} from './lib/http.js'
import * as auth from './routes/auth.js'
import * as catalogo from './routes/catalogo.js'
import * as contratos from './routes/contratos.js'
import * as empresas from './routes/empresas.js'
import * as equipos from './routes/equipos.js'
import * as revisiones from './routes/revisiones.js'
import * as usuarios from './routes/usuarios.js'

/**
 * Una sola Lambda atiende toda la API.
 *
 * Con este volumen de tráfico, un único contenedor tibio responde todas las
 * rutas: menos arranques en frío, menos recursos que desplegar y todo dentro
 * del millón de invocaciones gratuitas al mes.
 */

async function enrutar(req: Peticion): Promise<Respuesta> {
  const [recurso, a, b, c] = req.segmentos
  const m = req.metodo

  switch (recurso) {
    case 'salud':
      return json(200, { ok: true, fecha: new Date().toISOString() })

    case 'auth':
      if (a === 'login' && m === 'POST') return auth.login(req)
      if (a === 'sesion' && m === 'GET') return auth.sesion(req)
      if (a === 'activar' && b === 'verificar' && m === 'POST') {
        return auth.verificarActivacion(req)
      }
      if (a === 'activar' && !b && m === 'POST') return auth.activar(req)
      break

    case 'empresas':
      if (!a && m === 'GET') return empresas.listar(req)
      if (!a && m === 'POST') return empresas.crear(req)
      if (a && m === 'GET') return empresas.obtener(req, a)
      if (a && (m === 'PUT' || m === 'PATCH')) return empresas.actualizar(req, a)
      if (a && m === 'DELETE') return empresas.eliminar(req, a)
      break

    case 'catalogo':
      if (!a && m === 'GET') return catalogo.obtener(req)
      if (a === 'eliminar' && m === 'POST') return catalogo.eliminar(req)
      break

    case 'contratos':
      if (!a && m === 'GET') return contratos.listar(req)
      if (!a && m === 'POST') return contratos.crear(req)
      if (a && (m === 'PUT' || m === 'PATCH')) return contratos.actualizar(req, a)
      if (a && m === 'DELETE') return contratos.eliminar(req, a)
      break

    case 'equipos':
      if (!a && m === 'GET') return equipos.listar(req)
      if (!a && m === 'POST') return equipos.crear(req)
      if (a === 'importar' && m === 'POST') return equipos.importar(req)
      if (a === 'codigo' && b && m === 'GET') return equipos.porCodigo(req, b)
      if (a && !b && m === 'GET') return equipos.obtener(req, a)
      if (a && (m === 'PUT' || m === 'PATCH')) return equipos.actualizar(req, a)
      if (a && m === 'DELETE') return equipos.eliminar(req, a)
      break

    case 'revisiones':
      if (!a && m === 'GET') return revisiones.listar(req)
      if (!a && m === 'POST') return revisiones.crear(req)
      if (a === 'evidencias' && m === 'POST') return revisiones.urlSubidaEvidencia(req)
      if (a === 'pdf' && m === 'POST') return revisiones.urlSubidaPdf(req)
      if (a === 'pdf' && b === 'confirmar' && m === 'PUT') return revisiones.confirmarPdf(req)
      // /revisiones/<equipoId>/<revisionId>
      if (a && b && c === 'firmar' && m === 'POST') {
        return revisiones.firmarCliente(req, a, b)
      }
      if (a && b && !c && m === 'GET') return revisiones.obtener(req, a, b)
      if (a && b && (m === 'PUT' || m === 'PATCH')) {
        return revisiones.actualizar(req, a, b)
      }
      break

    case 'usuarios':
      if (!a && m === 'GET') return usuarios.listar(req)
      if (!a && m === 'POST') return usuarios.crear(req)
      // La firma es del propio usuario: va antes que la edición por id.
      if (a === 'firma' && m === 'PUT') return usuarios.guardarFirma(req)
      if (a && b === 'pin' && m === 'POST') return usuarios.reiniciarPin(req, a)
      if (a && (m === 'PUT' || m === 'PATCH')) return usuarios.actualizar(req, a)
      if (a && m === 'DELETE') return usuarios.eliminar(req, a)
      break
  }

  throw noEncontrado(`Ruta no encontrada: ${m} /${req.segmentos.join('/')}`)
}

export async function handler(
  evento: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const metodo = evento.requestContext.http.method

  // CloudFront sirve el frontend y la API bajo el mismo dominio: sin CORS.
  if (metodo === 'OPTIONS') return sinContenido()

  const ruta = (evento.rawPath ?? '/').replace(/^\/api/, '')
  const segmentos = ruta.split('/').filter(Boolean)

  let body: unknown = null
  if (evento.body) {
    try {
      const crudo = evento.isBase64Encoded
        ? Buffer.from(evento.body, 'base64').toString()
        : evento.body
      body = JSON.parse(crudo)
    } catch {
      return json(400, { error: 'El cuerpo de la petición no es JSON válido' })
    }
  }

  const req: Peticion = {
    metodo,
    ruta,
    segmentos,
    query: evento.queryStringParameters ?? {},
    body,
    auth: leerAuth(evento.headers ?? {}),
  }

  try {
    return await enrutar(req)
  } catch (e) {
    if (e instanceof ErrorHttp) {
      return json(e.statusCode, { error: e.message })
    }
    // Los detalles quedan en CloudWatch; el cliente nunca ve trazas internas.
    console.error('Error no controlado', {
      ruta: req.ruta,
      metodo: req.metodo,
      error: e,
    })
    return json(500, { error: 'Error interno del servidor' })
  }
}
