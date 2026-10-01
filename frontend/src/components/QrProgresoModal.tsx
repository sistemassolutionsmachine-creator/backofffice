import { Archive, QrCode } from 'lucide-react'
import { Modal } from './Modal'

export interface ProgresoQr {
  hechos: number
  total: number
  fase: 'etiquetas' | 'comprimiendo'
  porcentaje: number
}

export function QrProgresoModal({ empresa, progreso }: { empresa: string; progreso: ProgresoQr }) {
  const comprimiendo = progreso.fase === 'comprimiendo'
  const porcentaje = Math.round(progreso.porcentaje)
  return (
    <Modal titulo="Preparando sus códigos QR">
      <p className="mt-1 text-sm text-zinc-500">{empresa}</p>
      <div role="status" aria-live="polite" className="py-7 text-center">
        <div className="relative mx-auto mb-5 flex size-28 items-center justify-center">
          <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#f4f4f5" strokeWidth="6" />
            <circle cx="50" cy="50" r="44" fill="none" stroke="#e63a49" strokeWidth="6" strokeLinecap="round"
              pathLength="100" strokeDasharray="100" strokeDashoffset={100 - porcentaje}
              className="motion-safe:transition-all motion-safe:duration-300" />
          </svg>
          <span className="flex size-20 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            {comprimiendo ? <Archive className="size-8 motion-safe:animate-pulse" /> : <QrCode className="size-9 motion-safe:animate-pulse" />}
          </span>
        </div>
        <p className="text-3xl font-bold tabular-nums">{porcentaje}<span className="text-lg text-zinc-400">%</span></p>
        <p className="mt-2 text-sm font-semibold">{comprimiendo ? 'Comprimiendo el archivo ZIP…' : 'Diseñando las etiquetas…'}</p>
        <p className="mt-1 text-xs text-zinc-500">{progreso.hechos} de {progreso.total} etiquetas listas</p>
      </div>
      <div role="progressbar" aria-label="Preparación del archivo QR" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}
        className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-brand-600 motion-safe:transition-all" style={{ width: `${porcentaje}%` }} />
      </div>
      <p className="mt-4 text-center text-xs leading-relaxed text-zinc-500">La descarga comenzará automáticamente.<br />Mantenga esta ventana abierta mientras terminamos.</p>
    </Modal>
  )
}
