import QRCode from 'qrcode'
import JSZip from 'jszip'
import type { Empresa, Equipo } from '../types'

/**
 * Generación de las etiquetas QR que se pegan en cada equipo.
 *
 * La etiqueta lleva el nombre de la empresa y el identificador sobre el
 * código, de modo que el técnico sepa qué está escaneando incluso si la
 * cámara falla o la etiqueta se deteriora.
 */

/** Dominio del portal. Los QR apuntan aquí, así que debe ser el de producción. */
const PORTAL = 'https://d2u9ifgrghgtoq.cloudfront.net'

export function urlDeEquipo(codigo: string) {
  return `${PORTAL}/t/${codigo}`
}

/* ---------- Composición de la etiqueta ---------- */

const ANCHO = 1000
const MARGEN = 70
const ROJO = '#d21f30'
const TINTA = '#18181b'
const GRIS = '#52525b'

/** Parte el texto en varias líneas para que quepa en el ancho disponible. */
function repartirEnLineas(
  ctx: CanvasRenderingContext2D,
  texto: string,
  anchoMax: number,
): string[] {
  const palabras = texto.split(/\s+/)
  const lineas: string[] = []
  let actual = ''

  for (const palabra of palabras) {
    const tentativa = actual ? `${actual} ${palabra}` : palabra
    if (ctx.measureText(tentativa).width <= anchoMax || !actual) {
      actual = tentativa
    } else {
      lineas.push(actual)
      actual = palabra
    }
  }
  if (actual) lineas.push(actual)
  return lineas.slice(0, 2)
}

/**
 * Dibuja la etiqueta completa y la devuelve como PNG.
 *
 * El alto se calcula según las líneas que ocupe el nombre de la empresa, así
 * que todas las etiquetas quedan proporcionadas sin espacios muertos.
 */
export async function generarEtiquetaQr(
  codigo: string,
  nombreEmpresa: string,
): Promise<Blob> {
  // El QR se genera aparte y luego se compone sobre el lienzo.
  const qrDataUrl = await QRCode.toDataURL(urlDeEquipo(codigo), {
    width: 760,
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  })

  const qr = new Image()
  await new Promise<void>((res, rej) => {
    qr.onload = () => res()
    qr.onerror = () => rej(new Error('No se pudo generar el código QR'))
    qr.src = qrDataUrl
  })

  // Medición previa para saber cuántas líneas ocupa el nombre.
  const medidor = document.createElement('canvas').getContext('2d')
  if (!medidor) throw new Error('El navegador no permite generar la etiqueta')
  medidor.font = '600 40px Inter, Arial, sans-serif'
  const lineasEmpresa = repartirEnLineas(
    medidor,
    nombreEmpresa.toUpperCase(),
    ANCHO - MARGEN * 2,
  )

  const altoCabecera = 10 + 48 + lineasEmpresa.length * 52 + 96
  const alto = altoCabecera + qr.height + MARGEN

  const canvas = document.createElement('canvas')
  canvas.width = ANCHO
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('El navegador no permite generar la etiqueta')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, ANCHO, alto)

  // Franja superior con el color de la marca.
  ctx.fillStyle = ROJO
  ctx.fillRect(0, 0, ANCHO, 10)

  ctx.textAlign = 'center'
  const centro = ANCHO / 2
  let y = 10 + 62

  // Nombre de la empresa
  ctx.fillStyle = GRIS
  ctx.font = '600 40px Inter, Arial, sans-serif'
  for (const linea of lineasEmpresa) {
    ctx.fillText(linea, centro, y)
    y += 52
  }

  // Identificador del equipo
  ctx.fillStyle = TINTA
  ctx.font = '800 82px "Courier New", monospace'
  ctx.fillText(codigo, centro, y + 62)

  // Código QR
  ctx.drawImage(qr, centro - qr.width / 2, altoCabecera)

  return new Promise<Blob>((res, rej) => {
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('No se pudo crear la imagen'))),
      'image/png',
    )
  })
}

function descargar(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  enlace.click()
  URL.revokeObjectURL(url)
}

/** Descarga la etiqueta de un solo equipo. */
export async function descargarEtiquetaQr(codigo: string, nombreEmpresa: string) {
  const blob = await generarEtiquetaQr(codigo, nombreEmpresa)
  descargar(blob, `QR-${codigo}.png`)
}

/**
 * Descarga todas las etiquetas de una empresa en un único archivo comprimido.
 *
 * Se genera en el navegador: no hay que pedirle nada al servidor ni esperar
 * a que prepare un paquete.
 */
export async function descargarEtiquetasDeEmpresa(
  empresa: Empresa,
  equipos: Equipo[],
  onProgreso?: (hechos: number, total: number) => void,
) {
  if (equipos.length === 0) throw new Error('Esta empresa no tiene equipos')

  const zip = new JSZip()
  const carpeta = zip.folder(`QR ${empresa.nombre}`)
  if (!carpeta) throw new Error('No se pudo preparar el archivo')

  for (const [i, eq] of equipos.entries()) {
    const blob = await generarEtiquetaQr(eq.codigo, empresa.nombre)
    // El nombre del archivo incluye el equipo para identificarlo sin abrirlo.
    const limpio = eq.nombre.replace(/[^\w\s-]/g, '').trim().slice(0, 40)
    carpeta.file(`${eq.codigo} - ${limpio}.png`, blob)
    onProgreso?.(i + 1, equipos.length)
  }

  const contenido = await zip.generateAsync({ type: 'blob' })
  const fecha = new Date().toISOString().slice(0, 10)
  descargar(contenido, `QR ${empresa.nombre} ${fecha}.zip`)
}
