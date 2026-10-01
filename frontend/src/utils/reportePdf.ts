import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface DatosReportePdf {
  consecutivo: string
  motivo: string
  equipo?: {
    codigo: string
    nombre: string
    modelo: string
    serial: string
    ubicacion: string
  }
  tipoEquipo: string | null
  inspeccionVisual: { item: string; estado: string; obs: string }[]
  rutina: { item: string; estado: string; obs: string }[]
  medicionesMecanicas: { tipo: string; etiqueta: string; v1: string; v2: string }[]
  medicionesElectricas: {
    componente: string
    vab: string
    vbc: string
    vca: string
    il1: string
    il2: string
    il3: string
  }[]
  monitoreo: string
  analisis: string
  correctivos: string
  observaciones: string
  fotosEntrada: string[]
  fotosSalida: string[]
  /** Firma del técnico que ejecutó el servicio. */
  firma?: { nombre: string; font: string; fecha?: string } | null
  /** Firma de quien recibe por parte del cliente, si ya firmó. */
  firmaCliente?: {
    nombre: string
    cargo?: string
    font: string
    fecha?: string
  } | null
}

const BRAND: [number, number, number] = [230, 58, 73]
const INK: [number, number, number] = [24, 24, 27]
const M = 12 // margen (mm)

/** Convierte un object URL de foto a JPEG dataURL redimensionado. */
async function fotoAJpeg(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('img'))
      img.src = url
    })
    const max = 900
    const escala = Math.min(1, max / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * escala)
    canvas.height = Math.round(img.height * escala)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return {
      data: canvas.toDataURL('image/jpeg', 0.8),
      w: canvas.width,
      h: canvas.height,
    }
  } catch {
    throw new Error('No se pudo cargar una evidencia para el PDF. Intente nuevamente.')
  }
}

/** Dibuja la firma caligráfica en un canvas y la devuelve como imagen PNG. */
async function firmaAImagen(
  nombre: string,
  font: string,
): Promise<{ data: string; w: number; h: number } | null> {
  try {
    await document.fonts.load(`64px ${font}`)
    const canvas = document.createElement('canvas')
    let ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.font = `64px ${font}`
    const ancho = Math.ceil(ctx.measureText(nombre).width)
    canvas.width = ancho + 40
    canvas.height = 110
    ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.font = `64px ${font}`
    ctx.fillStyle = '#1c1c22'
    ctx.textBaseline = 'middle'
    ctx.fillText(nombre, 20, 58)
    return { data: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height }
  } catch {
    return null
  }
}

/**
 * Construye el PDF del reporte.
 *
 * Devuelve el archivo como Blob para poder archivarlo en S3, y opcionalmente
 * lo descarga en el dispositivo del técnico.
 */
export async function generarReportePdf(
  d: DatosReportePdf,
  opciones: { descargar?: boolean } = {},
): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4')
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  /* ---------- Encabezado ---------- */
  doc.setFillColor(...INK)
  doc.rect(0, 0, W, 26, 'F')
  doc.setFillColor(...BRAND)
  doc.rect(0, 26, W, 1.5, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('SOLUTIONS MACHINE', M, 11)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text('REPORTE MANTENIMIENTO PREVENTIVO · EQUIPOS AIRE ACONDICIONADO', M, 18)
  doc.text('Bogotá - Colombia', M, 23)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('DM-MTT-001 · Rev. 1', W - M, 11, { align: 'right' })
  doc.text(`Serial: ${d.consecutivo}`, W - M, 17, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(
    new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
    W - M,
    23,
    { align: 'right' },
  )

  let y = 33
  const finalY = () =>
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 4

  const estilosBase = {
    margin: { left: M, right: M },
    headStyles: { fillColor: INK, textColor: 255, fontSize: 8, fontStyle: 'bold' as const },
    bodyStyles: { fontSize: 8.5, textColor: [39, 39, 42] as [number, number, number] },
    alternateRowStyles: { fillColor: [247, 247, 248] as [number, number, number] },
    theme: 'grid' as const,
    styles: { lineColor: [220, 220, 224] as [number, number, number], lineWidth: 0.15 },
  }

  /* ---------- Datos del servicio y del equipo ---------- */
  autoTable(doc, {
    ...estilosBase,
    startY: y,
    head: [['Motivo de la visita', 'Tipo de equipo', 'Identificación', 'Modelo', 'Serial', 'Ubicación']],
    body: [
      [
        d.motivo,
        d.tipoEquipo ?? '-',
        d.equipo?.codigo ?? '-',
        d.equipo?.modelo ?? '-',
        d.equipo?.serial ?? '-',
        d.equipo?.ubicacion ?? '-',
      ],
    ],
  })
  y = finalY()

  /* ---------- Estado del equipo ---------- */
  autoTable(doc, {
    ...estilosBase,
    startY: y,
    head: [['ESTADO DEL EQUIPO · Inspección visual', 'Estado', 'Observaciones']],
    body: d.inspeccionVisual.map((r) => [r.item, r.estado, r.obs || '-']),
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 20, halign: 'center' } },
  })
  y = finalY()

  /* ---------- Rutina ---------- */
  autoTable(doc, {
    ...estilosBase,
    startY: y,
    head: [['RUTINA DE MANTENIMIENTO GENERAL', 'Check', 'Observaciones']],
    body: d.rutina.map((r) => [r.item, r.estado, r.obs || '-']),
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 20, halign: 'center' } },
  })
  y = finalY()

  /* ---------- Mediciones mecánicas ---------- */
  if (d.medicionesMecanicas.length) {
    autoTable(doc, {
      ...estilosBase,
      startY: y,
      head: [['MEDICIONES MECÁNICAS', 'De', 'Sum / Alta', 'Ret / Baja']],
      body: d.medicionesMecanicas.map((m) => [m.tipo, m.etiqueta || '-', m.v1 || '-', m.v2 || '-']),
    })
    y = finalY()
  }

  /* ---------- Mediciones eléctricas ---------- */
  if (d.medicionesElectricas.length) {
    autoTable(doc, {
      ...estilosBase,
      startY: y,
      head: [['MEDICIONES ELÉCTRICAS · Componente', 'V AB', 'V BC', 'V CA', 'I L1', 'I L2', 'I L3']],
      body: d.medicionesElectricas.map((m) => [
        m.componente || '-',
        m.vab || '-',
        m.vbc || '-',
        m.vca || '-',
        m.il1 || '-',
        m.il2 || '-',
        m.il3 || '-',
      ]),
    })
    y = finalY()
  }

  /* ---------- Secciones de texto ---------- */
  const parrafos: [string, string][] = [
    ['FUNCIONAMIENTO MONITOREO', d.monitoreo],
    ['ANÁLISIS OPERACIÓN', d.analisis],
    ['CORRECTIVOS SUGERIDOS', d.correctivos],
    ['OBSERVACIONES ADICIONALES', d.observaciones],
  ]
  for (const [titulo, texto] of parrafos) {
    autoTable(doc, {
      ...estilosBase,
      startY: y,
      head: [[titulo]],
      body: [[texto.trim() || '-']],
    })
    y = finalY()
  }

  /* ---------- Evidencia fotográfica ---------- */
  const bloquesFotos: [string, string[]][] = [
    ['EVIDENCIA FOTOGRÁFICA · ENTRADA (ANTES)', d.fotosEntrada],
    ['EVIDENCIA FOTOGRÁFICA · SALIDA (DESPUÉS)', d.fotosSalida],
  ]
  const anchoFoto = (W - M * 2 - 6) / 2

  for (const [titulo, fotos] of bloquesFotos) {
    if (!fotos.length) continue
    if (y + 14 > H - M) {
      doc.addPage()
      y = M
    }
    doc.setFillColor(...INK)
    doc.rect(M, y, W - M * 2, 7, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(titulo, M + 2, y + 4.7)
    y += 10

    let x = M
    let altoFila = 0
    for (const url of fotos) {
      const foto = await fotoAJpeg(url)
      if (!foto) continue
      const h = Math.min(anchoFoto * (foto.h / foto.w), 90)
      if (y + h > H - M) {
        doc.addPage()
        y = M
        x = M
        altoFila = 0
      }
      doc.addImage(foto.data, 'JPEG', x, y, anchoFoto, h)
      doc.setDrawColor(200, 200, 205)
      doc.rect(x, y, anchoFoto, h)
      altoFila = Math.max(altoFila, h)
      if (x === M) {
        x = M + anchoFoto + 6
      } else {
        x = M
        y += altoFila + 5
        altoFila = 0
      }
    }
    if (x !== M) y += altoFila + 5
    y += 2
  }

  /* ---------- Firmas ---------- */
  const altoFirma = 42
  if (y + altoFirma + 12 > H - M) {
    doc.addPage()
    y = M
  }
  doc.setFillColor(...INK)
  doc.rect(M, y, W - M * 2, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('COMO SOPORTE DE LA VISITA, FIRMAN', M + 2, y + 4.7)
  y += 10

  const anchoCol = (W - M * 2 - 6) / 2
  const formatear = (iso?: string) =>
    new Date(iso ? `${iso}T12:00:00` : Date.now()).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

  const [imgTecnico, imgCliente] = await Promise.all([
    d.firma ? firmaAImagen(d.firma.nombre, d.firma.font) : Promise.resolve(null),
    d.firmaCliente
      ? firmaAImagen(d.firmaCliente.nombre, d.firmaCliente.font)
      : Promise.resolve(null),
  ])

  const cajas = [
    {
      x: M,
      titulo: 'REPRESENTANTE DEL CLIENTE',
      firma: d.firmaCliente
        ? {
            nombre: d.firmaCliente.nombre,
            pie: d.firmaCliente.cargo
              ? `${d.firmaCliente.cargo} · ${formatear(d.firmaCliente.fecha)}`
              : `Firmado digitalmente · ${formatear(d.firmaCliente.fecha)}`,
            img: imgCliente,
          }
        : null,
    },
    {
      x: M + anchoCol + 6,
      titulo: 'REPRESENTANTE SOLUTIONS MACHINE',
      firma: d.firma
        ? {
            nombre: d.firma.nombre,
            pie: `Firmado digitalmente · ${formatear(d.firma.fecha)}`,
            img: imgTecnico,
          }
        : null,
    },
  ]

  for (const caja of cajas) {
    doc.setDrawColor(200, 200, 205)
    doc.rect(caja.x, y, anchoCol, altoFirma)
    doc.setTextColor(120, 120, 128)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.text(caja.titulo, caja.x + 3, y + 5)

    const centroX = caja.x + anchoCol / 2
    const lineaY = y + altoFirma - 11

    if (caja.firma) {
      const img = caja.firma.img
      if (img) {
        const alto = 13
        const ancho = Math.min(alto * (img.w / img.h), anchoCol - 14)
        doc.addImage(img.data, 'PNG', centroX - ancho / 2, lineaY - alto - 1, ancho, alto)
      }
      doc.setDrawColor(120, 120, 128)
      doc.line(caja.x + 10, lineaY, caja.x + anchoCol - 10, lineaY)
      doc.setTextColor(39, 39, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(caja.firma.nombre, centroX, lineaY + 4.5, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(120, 120, 128)
      doc.text(caja.firma.pie, centroX, lineaY + 8.5, { align: 'center' })
    } else {
      doc.setTextColor(160, 160, 168)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.text('Pendiente por firmar', centroX, y + altoFirma / 2 - 2, { align: 'center' })
      doc.setDrawColor(120, 120, 128)
      doc.line(caja.x + 10, lineaY, caja.x + anchoCol - 10, lineaY)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.text('Nombre y firma', centroX, lineaY + 4.5, { align: 'center' })
    }
  }
  y += altoFirma + 6

  /* ---------- Pie de página ---------- */
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setTextColor(140, 140, 148)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(`Solutions Machine · Reporte ${d.consecutivo}`, M, H - 6)
    doc.text(`Página ${p} de ${paginas}`, W - M, H - 6, { align: 'right' })
  }

  if (opciones.descargar) doc.save(`Reporte-${d.consecutivo}.pdf`)
  return doc.output('blob')
}
