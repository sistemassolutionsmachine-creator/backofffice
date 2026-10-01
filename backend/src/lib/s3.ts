import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Las fotos y los PDF viajan del navegador a S3 con URLs prefirmadas.
 * Lambda solo firma la URL (milisegundos), nunca transporta los archivos:
 * menos tiempo de ejecución facturado y sin el límite de 6 MB de payload.
 */

export const BUCKET = process.env.BUCKET_REPORTES ?? ''

export const s3 = new S3Client({})

export async function comprobarPdf(clave: string) {
  const archivo = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: clave }))
  return archivo.ContentType === 'application/pdf' && (archivo.ContentLength ?? 0) > 0
}

const MINUTOS = 60

export async function urlDeSubida(clave: string, contentType: string) {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: clave, ContentType: contentType }),
    { expiresIn: 15 * MINUTOS },
  )
}

export async function urlDeDescarga(clave: string) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: clave }), {
    expiresIn: 15 * MINUTOS,
  })
}

/** Rutas ordenadas por empresa/equipo para facilitar auditoría y ciclo de vida. */
export function claveEvidencia(
  empresaId: string,
  equipoId: string,
  revisionId: string,
  momento: 'entrada' | 'salida',
  nombre: string,
) {
  return `evidencias/${empresaId}/${equipoId}/${revisionId}/${momento}/${nombre}`
}

export function clavePdf(empresaId: string, consecutivo: string) {
  return `reportes/${empresaId}/${consecutivo}.pdf`
}
