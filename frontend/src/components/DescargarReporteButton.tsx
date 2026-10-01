import { useState } from 'react'
import { Download, LoaderCircle } from 'lucide-react'
import type { Revision } from '../types'
import { descargarReporte } from '../utils/reporteArchivado'

export function DescargarReporteButton({ revision }: { revision: Revision }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actual, setActual] = useState(revision)
  if (revision.estado !== 'completado') return null
  const descargar = async () => {
    if (ocupado) return
    setOcupado(true)
    setError(null)
    try { setActual(await descargarReporte(revision)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo descargar el PDF') }
    finally { setOcupado(false) }
  }
  return (
    <div className="space-y-1">
      <button type="button" disabled={ocupado} onClick={() => void descargar()}
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60"
        aria-label={`Descargar PDF ${revision.consecutivo}`}>
        {ocupado ? <LoaderCircle className="size-4 motion-safe:animate-spin" /> : <Download className="size-4" />}
        {ocupado ? 'Preparando PDF…' : 'Descargar PDF'}
      </button>
      <p className="text-[11px] text-zinc-500">{revision.firmaCliente || actual.firmaCliente ? 'Técnico + cliente' : revision.firmaTecnico || actual.firmaTecnico ? 'Firmado por técnico' : 'Reporte de servicio'}</p>
      {error && <p role="alert" className="max-w-xs text-xs text-brand-700">{error}</p>}
    </div>
  )
}
