import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'
import type { Peticion } from '../src/lib/http.js'

// Credenciales ficticias: se firma localmente y todo el transporte AWS se simula.
process.env.AWS_REGION = 'us-east-1'
process.env.AWS_ACCESS_KEY_ID = 'testing'
process.env.AWS_SECRET_ACCESS_KEY = 'testing'
process.env.BUCKET_REPORTES = 'reportes-test'
const { ddb } = await import('../src/lib/dynamo.js')
const { s3 } = await import('../src/lib/s3.js')
const rutas = await import('../src/routes/revisiones.js')

let revision: Record<string, any>
let archivos: Set<string>
let cambiarDuranteHead = false
mock.method(ddb, 'send', async (cmd: any) => {
  const p = cmd.input
  if (cmd.constructor.name === 'QueryCommand') return { Items: [structuredClone(revision)] }
  if (cmd.constructor.name === 'UpdateCommand') {
    const expected = p.ExpressionAttributeValues[':version']
    const coincide = p.ConditionExpression.includes('attribute_not_exists')
      ? revision.documentoVersion === undefined : revision.documentoVersion === expected
    if (!coincide) throw Object.assign(new Error('Concurrent write'), { name: 'ConditionalCheckFailedException' })
    for (const [alias, campo] of Object.entries(p.ExpressionAttributeNames)) {
      if (alias.startsWith('#c')) revision[campo as string] = p.ExpressionAttributeValues[alias.replace('#c', ':v')]
    }
    return { Attributes: structuredClone(revision) }
  }
  throw new Error(`Unexpected command ${cmd.constructor.name}`)
})
mock.method(s3, 'send', async (cmd: any) => {
  assert.equal(cmd.constructor.name, 'HeadObjectCommand')
  if (!archivos.has(cmd.input.Key)) throw Object.assign(new Error('Missing object'), { name: 'NotFound' })
  if (cambiarDuranteHead) revision.documentoVersion++
  return { ContentType: 'application/pdf', ContentLength: 1234 }
})

const req = (body: unknown = {}, rol: 'admin' | 'cliente' = 'admin', empresaId = 'em-1'): Peticion => ({
  metodo: 'POST', ruta: '/', segmentos: [], query: {}, body,
  auth: { sub: 'us-1', usuario: 'test', rol, empresaId, exp: 9999999999 },
})
const datos = (version: number, clave?: string) => ({ equipoId: 'eq-1', revisionId: 'rv-1', version, clave })
const obtener = async () => JSON.parse((await rutas.obtener(req(), 'eq-1', 'rv-1')).body)
const preparar = async (version: number) => JSON.parse((await rutas.urlSubidaPdf(req(datos(version)))).body)

beforeEach(() => {
  revision = {
    id: 'rv-1', equipoId: 'eq-1', empresaId: 'em-1', fecha: '2026-10-01', consecutivo: 'SM-2026-001',
    estado: 'completado', documentoVersion: 1, pdfKey: null,
    fotosEntrada: [], fotosSalida: [], firmaCliente: null,
    firmaTecnico: { nombre: 'Técnico Uno', estilo: 'clasica', fecha: '2026-10-01' },
  }
  archivos = new Set()
  cambiarDuranteHead = false
})

test('PDF no aparece disponible antes de terminar y confirmar la subida a S3', async () => {
  const { clave } = await preparar(1)
  assert.equal(revision.pdfKey, null)
  assert.equal((await obtener()).urls.pdf, null)
  await assert.rejects(rutas.confirmarPdf(req(datos(1, clave))), { statusCode: 400 })
  assert.equal(revision.pdfKey, null)
  archivos.add(clave)
  await rutas.confirmarPdf(req(datos(1, clave)))
  assert.equal(revision.pdfVersion, 1)
  const url = new URL((await obtener()).urls.pdf)
  assert.equal(decodeURIComponent(url.pathname), `/${clave}`)
})

test('firma del cliente invalida PDF técnico; versión con ambas firmas queda descargable', async () => {
  const anterior = await preparar(1)
  archivos.add(anterior.clave)
  await rutas.confirmarPdf(req(datos(1, anterior.clave)))
  await rutas.firmarCliente(req({ nombre: 'Cliente Uno', cargo: 'Jefe', estilo: 'moderna' }, 'cliente'), 'eq-1', 'rv-1')
  assert.equal(revision.documentoVersion, 2)
  assert.equal((await obtener()).urls.pdf, null)
  await assert.rejects(rutas.confirmarPdf(req(datos(1, anterior.clave))), { statusCode: 409 })
  const nuevo = await preparar(2)
  assert.notEqual(nuevo.clave, anterior.clave)
  archivos.add(nuevo.clave)
  await rutas.confirmarPdf(req(datos(2, nuevo.clave), 'cliente'))
  const detalle = await obtener()
  assert.equal(detalle.firmaTecnico.nombre, 'Técnico Uno')
  assert.equal(detalle.firmaCliente.nombre, 'Cliente Uno')
  assert.equal(decodeURIComponent(new URL(detalle.urls.pdf).pathname), `/${nuevo.clave}`)
})

test('no publica un PDF si el reporte cambia mientras se comprueba S3', async () => {
  const { clave } = await preparar(1)
  archivos.add(clave)
  cambiarDuranteHead = true
  await assert.rejects(rutas.confirmarPdf(req(datos(1, clave))), { statusCode: 409 })
  assert.equal(revision.pdfKey, null)
})

test('se rechazan claves de otro reporte y usuarios de otra empresa', async () => {
  await assert.rejects(rutas.confirmarPdf(req(datos(1, 'reportes/otro.pdf'))), { statusCode: 400 })
  await assert.rejects(rutas.urlSubidaPdf(req(datos(1), 'cliente', 'em-ajena')), { statusCode: 403 })
})

test('reportes antiguos sin versión pueden volver a archivarse con confirmación', async () => {
  delete revision.documentoVersion
  revision.pdfKey = 'reportes/em-1/antiguo.pdf'
  assert.equal((await obtener()).urls.pdf, null)
  const { clave } = await preparar(0)
  archivos.add(clave)
  await rutas.confirmarPdf(req(datos(0, clave)))
  assert.equal(revision.pdfVersion, 0)
  assert.equal(decodeURIComponent(new URL((await obtener()).urls.pdf).pathname), `/${clave}`)
})
