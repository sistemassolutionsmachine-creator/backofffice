import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cx } from './ui'

/** Dialog nativo: foco contenido, fondo inerte y retorno al control de origen. */
export function Modal({ titulo, children, onCerrar, ancho = 'md', encabezado }: {
  titulo: string
  children: ReactNode
  onCerrar?: () => void
  /** `lg` para fichas con más contenido. */
  ancho?: 'md' | 'lg'
  /** Contenido sobre el título (etiquetas de estado, código…). */
  encabezado?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const tituloId = useId()
  useEffect(() => {
    const dialog = ref.current!
    const anterior = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = anterior }
  }, [])
  return (
    <dialog ref={ref} aria-labelledby={tituloId}
      onCancel={(e) => { e.preventDefault(); onCerrar?.() }}
      // Clic en el fondo oscuro (fuera del contenido) cierra la ventana.
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar?.() }}
      className={cx(
        'm-auto max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto rounded-3xl border-0 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-ink-950/70 backdrop:backdrop-blur-sm',
        ancho === 'lg' ? 'max-w-2xl' : 'max-w-md',
      )}>
      <div className="relative p-6 sm:p-8">
        {onCerrar && <button type="button" aria-label="Cerrar ventana" onClick={onCerrar}
          className="absolute top-4 right-4 rounded-full p-2 text-zinc-400 hover:bg-zinc-100"><X className="size-4" /></button>}
        {encabezado && <div className="mb-3 pr-10">{encabezado}</div>}
        <h2 id={tituloId} className="pr-6 text-lg font-bold">{titulo}</h2>
        {children}
      </div>
    </dialog>
  )
}
