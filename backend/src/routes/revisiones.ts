import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
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
  cuerpo,
  exigir,
  malaPeticion,
  noEncontrado,
  ok,
  prohibido,
  type Peticion,
} from '../lib/http.js'
import { claveEvidencia, clavePdf, urlDeDescarga, urlDeSubida } from '../lib/s3.js'
import type { Equipo, Revision } from '../types.js'

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
    revision.pdfKey ? urlDeDescarga(revision.pdfKey) : Promise.resolve(null),
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

  return creado(revision)
}

export async function actualizar(req: Peticion, equipoId: string, revisionId: string) {
  exigir(req, 'tecnico', 'admin')
  const revisiones = await query<Revision>({ pk: `EQUIPO#${equipoId}`, sk: 'REVISION#' })
  const actual = revisiones.find((r) => r.id === revisionId)
  if (!actual) throw noEncontrado('Revisión no encontrada')

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
    pdfKey: datos.pdfKey,
    firmaTecnico: datos.firmaTecnico,
    firmaCliente: datos.firmaCliente,
  }

  await update(k.revision(equipoId, actual.fecha, revisionId), patch)
  return ok({ ...actual, ...datos })
}

/* ---------- Evidencias y PDF ---------- */

interface CuerpoSubida {
  equipoId?: string
  revisionId?: string
  momento?: 'entrada' | 'salida'
  nombre?: string
  contentType?: string
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
  const auth = exigir(req, 'tecnico', 'admin', 'cliente')
  const { equipoId, revisionId } = cuerpo<CuerpoSubida>(req)
  if (!equipoId || !revisionId) throw malaPeticion('Faltan datos del reporte')

  const revisiones = await query<Revision>({ pk: `EQUIPO#${equipoId}`, sk: 'REVISION#' })
  const revision = revisiones.find((r) => r.id === revisionId)
  if (!revision) throw noEncontrado('Revisión no encontrada')

  if (auth.rol === 'cliente' && revision.empresaId !== auth.empresaId) throw prohibido()

  const clave = clavePdf(revision.empresaId, revision.consecutivo)
  const url = await urlDeSubida(clave, 'application/pdf')
  await update(k.revision(equipoId, revision.fecha, revisionId), { pdfKey: clave })

  return ok({ url, clave })
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

  await update(k.revision(equipoId, revision.fecha, revisionId), { firmaCliente })
  return ok({ ...limpiar(revision), firmaCliente })
}
