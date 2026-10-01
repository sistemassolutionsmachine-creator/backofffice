import { api } from '../api/client'
import { nombreVisible, type Revision } from '../types'
import { ESTILOS_FIRMA } from './firma'
import { generarReportePdf } from './reportePdf'

/** Repara también un archivado pendiente tras una interrupción o fallo de red. */
export async function archivarReporte(equipoId: string, revisionId: string) {
  const detalle = await api.revisiones.obtener(equipoId, revisionId)
  if (detalle.urls.pdf && detalle.pdfVersion === (detalle.documentoVersion ?? 0)) return detalle
  if (detalle.estado !== 'completado') throw new Error('El reporte todavía no ha sido completado')
  const equipo = await api.equipos.obtener(equipoId)
  const fuente = (estilo: string) => estilo === 'moderna'
    ? ESTILOS_FIRMA.moderna.font : ESTILOS_FIRMA.clasica.font
  const pdf = await generarReportePdf({
    ...detalle,
    equipo: { ...equipo, nombre: nombreVisible(equipo) },
    fotosEntrada: detalle.urls.fotosEntrada,
    fotosSalida: detalle.urls.fotosSalida,
    firma: detalle.firmaTecnico && {
      ...detalle.firmaTecnico, font: fuente(detalle.firmaTecnico.estilo),
    },
    firmaCliente: detalle.firmaCliente && {
      ...detalle.firmaCliente, font: fuente(detalle.firmaCliente.estilo),
    },
  })
  await api.revisiones.subirPdf(equipoId, revisionId, pdf, detalle.documentoVersion ?? 0)
  // La lectura devuelve la versión confirmada y una URL temporal nueva.
  const actualizado = await api.revisiones.obtener(equipoId, revisionId)
  if (!actualizado.urls.pdf) throw new Error('El reporte cambió durante el archivado. Intente de nuevo.')
  return actualizado
}

/** Siempre descarga el archivo confirmado en S3, no una copia del formulario. */
export async function descargarReporte(revision: Pick<Revision, 'equipoId' | 'id'>) {
  const actual = await archivarReporte(revision.equipoId, revision.id)
  const r = await fetch(actual.urls.pdf!, { cache: 'no-store' })
  if (!r.ok) throw new Error('No se pudo descargar el PDF de S3. Intente de nuevo.')
  const url = URL.createObjectURL(await r.blob())
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `${actual.consecutivo}.pdf`
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return actual
}
