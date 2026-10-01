import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Rango visible ("1–12 de 175") y controles anterior / siguiente. */
export function Paginacion({
  pagina,
  total,
  porPagina,
  onCambiar,
  sustantivo = 'equipos',
}: {
  /** Página actual, empezando en 0. */
  pagina: number
  total: number
  porPagina: number
  onCambiar: (pagina: number) => void
  sustantivo?: string
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const desde = pagina * porPagina + 1
  const hasta = Math.min((pagina + 1) * porPagina, total)
  const boton =
    'rounded-lg bg-white p-1.5 text-zinc-500 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-30'

  return (
    <div className="flex items-center justify-between px-0.5">
      <p className="text-xs font-semibold text-zinc-500">
        {total === 0 ? 'Sin resultados' : `${desde}–${hasta} de ${total} ${sustantivo}`}
      </p>
      {paginas > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Página anterior"
            disabled={pagina === 0}
            onClick={() => onCambiar(pagina - 1)}
            className={boton}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-1.5 text-xs font-semibold text-zinc-600 tabular-nums">
            {pagina + 1} / {paginas}
          </span>
          <button
            type="button"
            aria-label="Página siguiente"
            disabled={pagina >= paginas - 1}
            onClick={() => onCambiar(pagina + 1)}
            className={boton}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
