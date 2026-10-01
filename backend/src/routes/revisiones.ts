import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { randomUUID } from 'node:crypto'
import {
  TABLE,
  ddb,
  get,
  k,
  limpiar,
  nuevoId,
  put,
  query,
  update,
} from '../lib/dynamo.js'
import {
  creado,
  ErrorHttp,
  cuerpo,
  exigir,
  malaPeticion,
  noEncontrado,
  ok,
  prohibido,
  type Peticion,
} from '../lib/http.js'
import { claveEvidencia, clavePdf, comprobarPdf, urlDeDescarga, urlDeSubida } from '../lib/s3.js'
import type { EstadoEquipo, Equipo, Revision } from '../types.js'

const ESTADOS_EQUIPO: EstadoEquipo[] = ['operativo', 'mantenimiento', 'fuera_servicio']

/** undefined si no viene en la petición; error si viene con un valor desconocido. */
function leerEstadoEquipo(valor: unknown): EstadoEquipo | null | undefined {
  if (valor === undefined) return undefined
  if (valor === null) return null
  if (!ESTADOS_EQUIPO.includes(valor as EstadoEquipo)) {
    throw malaPeticion('Estado del equipo inválido')
  }
  return valor as EstadoEquipo
}

/**
 * Al cerrar un servicio, el equipo toma el estado en que lo dejó el técnico.
 * Solo si es su intervención más reciente: completar un reporte atrasado no
 * debe pisar lo que registró una visita posterior.
 */
async function reflejarEnEquipo(revision: Revision) {
  if (revision.estado !== 'completado' || !revision.estadoEquipo) return
  const equipo = await get<Equipo>(k.equipo(revision.equipoId))
  if (!equipo || (equipo.ultimaRevision && revision.fecha < equipo.ultimaRevision)) return
  await update(k.equipo(equipo.id), { estado: revision.estadoEquipo })
}

/** Escritura condicional: un PDF antiguo nunca puede publicar sobre firmas nuevas. */
async function guardarVersion(actual: Revision, patch: Record<string, unknown>) {
  const campos = Object.entries(patch).filter(([, v]) => v !== undefined)
  const names: Record<string, string> = { '#version': 'documentoVersion' }
  const values: Record<string, unknown> = { ':version': actual.documentoVersion ?? 0 }
  campos.forEach(([campo, valor], i) => { names[`#c${i}`] = campo; values[`:v${i}`] = valor })
  try {
    const r = await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: k.revision(actual.equipoId, actual.fecha, actual.id),
      UpdateExpression: `SET ${campos.map((_, i) => `#c${i} = :v${i}`).join(', ')}`,
      ConditionExpression: actual.documentoVersion === undefined
        ? 'attribute_exists(PK) AND attribute_not_exists(#version)'
        : '#version = :version',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: actual.documentoVersion === undefined
        ? Object.fromEntries(Object.entries(values).filter(([key]) => key !== ':version'))
        : values,
      ReturnValues: 'ALL_NEW',
    }))
    return limpiar(r.Attributes as unknown as Revision)
  } catch (e) {
    if (e instanceof Error && e.name === 'ConditionalCheckFailedException') {
      throw new ErrorHttp(409, 'El reporte cambió. Vuelva a intentar con la versión actualizada.')
    }
    throw e
  }
}

async function buscarRevision(req: Peticion, equipoId: string, revisionId: string) {
  const auth = exigir(req)
  const lista = await query<Revision>({ pk: `EQUIPO#${equipoId}`, sk: 'REVISION#' })
  const revision = lista.find((r) => r.id === revisionId)
  if (!revision) throw noEncontrado('Revisión no encontrada')
  if (auth.rol === 'cliente' && (!auth.empresaId || revision.empresaId !== auth.empresaId)) throw prohibido()
  return revision
}

/**
 * Consecutivo irrepetible (SM-2026-00153).
 * `ADD` en DynamoDB es atómico: dos técnicos que cierren un reporte en el
 * mismo instante nunca obtienen el mismo número.
 */
async function siguienteConsecutivo(): Promise<string> {
  const anio = new Date().getFullYear()
  const r = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `CONTADOR#${anio}`, SK: 'META' },
      UpdateExpression: 'ADD #v :uno',
      ExpressionAttributeNames: { '#v': 'valor' },
      ExpressionAttributeValues: { ':uno': 1 },
      ReturnValues: 'UPDATED_NEW',
    }),
  )
  const n = Number(r.Attributes?.valor ?? 1)
  return `SM-${anio}-${String(n).padStart(5, '0')}`
}

export async function listar(req: Peticion) {
  const auth = exigir(req)
  const limite = Math.min(Number(req.query.limite ?? 100), 200)

  // Historial de un equipo concreto.
  if (req.query.equipo) {
    const equipo = await get<Equipo>(k.equipo(req.query.equipo))
    if (!equipo) throw noEncontrado('Equipo no encontrado')
    if (auth.rol === 'cliente' && equipo.empresaId !== auth.empresaId) throw prohibido()

    const revisiones = await query<Revision>({
      pk: `EQUIPO#${req.query.equipo}`,
      sk: 'REVISION#',
      ascendente: false,
      limite,
    })
    return ok(revisiones.map(limpiar))
  }

  // El cliente siempre queda acotado a su empresa.
  const empresaId = auth.rol === 'cliente' ? auth.empresaId : req.query.empresa

  const revisiones = empresaId
    ? await query<Revision>({
        index: 'GSI1',
        pk: `EMPRESA#${empresaId}`,
        sk: 'REVISION#',
        ascendente: false,
        limite,
      })
    : await query<Revision>({
        index: 'GSI2',
        pk: 'T#REVISION',
        ascendente: false,
        limite,
      })

  return ok(revisiones.map(limpiar))
}

export async function obtener(req: Peticion, equipoId: string, revisionId: string) {
  const auth = exigir(req)
  const revisiones = await query<Revision>({ pk: `EQUIPO#${equipoId}`, sk: 'REVISION#' })
  const revision = revisiones.find((r) => r.id === revisionId)
  if (!revision) throw noEncontrado('Revisión no encontrada')
  if (auth.rol === 'cliente' && revision.empresaId !== auth.empresaId) throw prohibido()

  // Enlaces temporales para ver las evidencias y descargar el PDF.
  const [fotosEntrada, fotosSalida, pdfUrl] = await Promise.all([
    Promise.all(revision.fotosEntrada.map(urlDeDescarga)),
    Promise.all(revision.fotosSalida.map(urlDeDescarga)),
    revision.pdfKey && revision.pdfVersion === (revision.documentoVersion ?? 0)
      ? urlDeDescarga(revision.pdfKey) : Promise.resolve(null),
  ])

  return ok({ ...limpiar(revision), urls: { fotosEntrada, fotosSalida, pdf: pdfUrl } })
}

export async function crear(req: Peticion) {
  const auth = exigir(req, 'tecnico', 'admin')
  const datos = cuerpo<Partial<Revision>>(req)

  if (!datos.equipoId) throw malaPeticion('Debe indicar el equipo revisado')

  const equipo = await get<Equipo>(k.equipo(datos.equipoId))
  if (!equipo) throw noEncontrado('Equipo no encontrado')

  const id = nuevoId('rv')
  const fecha = datos.fecha ?? new Date().toISOString().slice(0, 10)
  const consecutivo = await siguienteConsecutivo()

  const revision: Revision = {
    id,
    consecutivo,
    equipoId: equipo.id,
    empresaId: equipo.empresaId,
    tipo: datos.tipo ?? 'preventivo',
    tecnico: datos.tecnico ?? auth.usuario,
    tecnicoId: auth.sub,
    fecha,
    estado: datos.estado ?? 'en_proceso',
    motivo: datos.motivo ?? '',
    tipoEquipo: datos.tipoEquipo ?? null,
    inspeccionVisual: datos.inspeccionVisual ?? [],
    rutina: datos.rutina ?? [],
    medicionesMecanicas: datos.medicionesMecanicas ?? [],
    medicionesElectricas: datos.medicionesElectricas ?? [],
    monitoreo: datos.monitoreo ?? '',
    analisis: datos.analisis ?? '',
    correctivos: datos.correctivos ?? '',
    observaciones: datos.observaciones ?? '',
    fotosEntrada: datos.fotosEntrada ?? [],
    fotosSalida: datos.fotosSalida ?? [],
    pdfKey: null,
    estadoEquipo: leerEstadoEquipo(datos.estadoEquipo) ?? null,
    documentoVersion: 1,
    firmaTecnico: datos.firmaTecnico ?? null,
    firmaCliente: null,
  }

  await put({
    ...k.revision(revision.equipoId, fecha, id),
    GSI1PK: `EMPRESA#${revision.empresaId}`,
    GSI1SK: `REVISION#${fecha}#${id}`,
    GSI2PK: 'T#REVISION',
    GSI2SK: `${fecha}#${id}`,
    ...revision,
  })

  // El equipo refleja siempre su última intervención.
  await update(k.equipo(equipo.id), { ultimaRevision: fecha })
  await reflejarEnEquipo(revision)

  return creado(revision)
}

export async function actualizar(req: Peticion, equipoId: string, revisionId: string) {
  exigir(req, 'tecnico', 'admin')
  const revisiones = await query<Revision>({ pk: `EQUIPO#${equipoId}`, sk: 'REVISION#' })
  const actual = revisiones.find((r) => r.id === revisionId)
  if (!actual) throw noEncontrado('Revisión no encontrada')
  if (actual.firmaCliente) throw malaPeticion('No se puede editar un reporte firmado por el cliente')

  const datos = cuerpo<Partial<Revision>>(req)
  const patch: Record<string, unknown> = {
    estado: datos.estado,
    inspeccionVisual: datos.inspeccionVisual,
    rutina: datos.rutina,
    medicionesMecanicas: datos.medicionesMecanicas,
    medicionesElectricas: datos.medicionesElectricas,
    monitoreo: datos.monitoreo,
    analisis: datos.analisis,
    correctivos: datos.correctivos,
    observaciones: datos.observaciones,
    fotosEntrada: datos.fotosEntrada,
    fotosSalida: datos.fotosSalida,
    firmaTecnico: datos.firmaTecnico,
    estadoEquipo: leerEstadoEquipo(datos.estadoEquipo),
    documentoVersion: (actual.documentoVersion ?? 0) + 1,
  }

  const completa = datos.estado === 'completado' && actual.estado !== 'completado'
  if (completa && !(patch.estadoEquipo ?? actual.estadoEquipo)) {
    throw malaPeticion('Indique en qué estado queda el equipo antes de completar el reporte')
  }

  const guardada = await guardarVersion(actual, patch)
  await reflejarEnEquipo(guardada)
  return ok(guardada)
}

/* ---------- Evidencias y PDF ---------- */

interface CuerpoSubida {
  equipoId?: string
  revisionId?: string
  momento?: 'entrada' | 'salida'
  nombre?: string
  contentType?: string
  version?: number
  clave?: string
}

/** Devuelve una URL prefirmada para que el navegador suba la foto directo a S3. */
export async function urlSubidaEvidencia(req: Peticion) {
  exigir(req, 'tecnico', 'admin')
  const { equipoId, revisionId, momento, nombre, contentType } =
    cuerpo<CuerpoSubida>(req)

  if (!equipoId || !revisionId || !momento || !nombre) {
    throw malaPeticion('Faltan datos para generar la URL de subida')
  }

  const equipo = await get<Equipo>(k.equipo(equipoId))
  if (!equipo) throw noEncontrado('Equipo no encontrado')

  const clave = claveEvidencia(
    equipo.empresaId,
    equipoId,
    revisionId,
    momento,
    `${Date.now()}-${nombre.replace(/[^\w.-]/g, '_')}`,
  )
  const url = await urlDeSubida(clave, contentType ?? 'image/jpeg')
  return ok({ url, clave })
}

/**
 * URL prefirmada para subir el PDF final del reporte.
 *
 * El cliente también puede hacerlo, pero solo para reportes de su empresa:
 * al firmar, el documento se rehace para que incluya su firma.
 */
export async function urlSubidaPdf(req: Peticion) {
  exigir(req, 'tecnico', 'admin', 'cliente')
  const { equipoId, revisionId, version } = cuerpo<CuerpoSubida>(req)
  if (!equipoId || !revisionId) throw malaPeticion('Faltan datos del reporte')

  const revision = await buscarRevision(req, equipoId, revisionId)
  if (version !== (revision.documentoVersion ?? 0)) throw new ErrorHttp(409, 'El reporte cambió; genere nuevamente el PDF')
  if (revision.estado !== 'completado') throw malaPeticion('El reporte aún no está completo')
  const clave = `${clavePdf(revision.empresaId, revision.consecutivo)}/${version}/${randomUUID()}.pdf`
  const url = await urlDeSubida(clave, 'application/pdf')

  return ok({ url, clave })
}

/** Se publica después del PUT a S3, nunca al emitir la URL de subida. */
export async function confirmarPdf(req: Peticion) {
  exigir(req, 'tecnico', 'admin', 'cliente')
  const { equipoId, revisionId, version, clave } = cuerpo<CuerpoSubida>(req)
  if (!equipoId || !revisionId || typeof clave !== 'string') throw malaPeticion('Faltan datos del PDF')
  const revision = await buscarRevision(req, equipoId, revisionId)
  if (version !== (revision.documentoVersion ?? 0)) throw new ErrorHttp(409, 'El reporte tiene una firma o contenido más reciente')
  const prefijo = `${clavePdf(revision.empresaId, revision.consecutivo)}/${version}/`
  if (!clave.startsWith(prefijo) || !/^[\da-f-]{36}\.pdf$/.test(clave.slice(prefijo.length))) throw malaPeticion('La clave no corresponde al reporte')
  try {
    if (!await comprobarPdf(clave)) throw malaPeticion('El PDF subido está vacío o no es válido')
  } catch (e) {
    if (e instanceof Error && (e.name === 'NotFound' || e.name === 'NoSuchKey')) throw malaPeticion('La subida del PDF aún no se ha completado')
    throw e
  }
  return ok(await guardarVersion(revision, { pdfKey: clave, pdfVersion: version }))
}

/* ---------- Firma del cliente ---------- */

interface CuerpoFirma {
  nombre?: string
  cargo?: string
  estilo?: string
}

/**
 * El representante del cliente firma un reporte ya entregado.
 *
 * Solo puede firmar reportes completados de su propia empresa, y una única
 * vez: la firma es la constancia de que recibió el servicio.
 */
export async function firmarCliente(
  req: Peticion,
  equipoId: string,
  revisionId: string,
) {
  const auth = exigir(req, 'cliente')
  const { nombre, cargo, estilo } = cuerpo<CuerpoFirma>(req)

  if (!nombre?.trim()) throw malaPeticion('Debe indicar el nombre de quien firma')

  const revisiones = await query<Revision>({ pk: `EQUIPO#${equipoId}`, sk: 'REVISION#' })
  const revision = revisiones.find((r) => r.id === revisionId)
  if (!revision) throw noEncontrado('Reporte no encontrado')

  if (revision.empresaId !== auth.empresaId) throw prohibido()
  if (revision.estado !== 'completado') {
    throw malaPeticion('Este reporte todavía no ha sido entregado por el técnico')
  }
  if (revision.firmaCliente) {
    throw malaPeticion('Este reporte ya fue firmado')
  }

  const firmaCliente = {
    nombre: nombre.trim(),
    cargo: cargo?.trim() ?? '',
    estilo: estilo ?? 'clasica',
    fecha: new Date().toISOString().slice(0, 10),
  }

  return ok(await guardarVersion(revision, {
    firmaCliente,
    documentoVersion: (revision.documentoVersion ?? 0) + 1,
  }))
}
