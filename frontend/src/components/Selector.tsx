import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cx } from './ui'

export interface OpcionSelector {
  valor: string
  etiqueta: string
  /** Texto secundario a la derecha (un conteo, un código…). */
  detalle?: ReactNode
  /** Clase de color para el puntico de estado (bg-emerald-500…). */
  punto?: string
}

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Con más opciones que esto, el panel incluye un buscador. */
const UMBRAL_BUSQUEDA = 8

/**
 * Deja visible la opción dentro de su lista. A diferencia de
 * `scrollIntoView`, no desplaza la página: si lo hiciera, la opción se
 * movería bajo el cursor y el clic caería en otro sitio.
 */
export function desplazarLista(lista: HTMLElement | null, opcion: HTMLElement | null) {
  if (!lista || !opcion) return
  const arriba = opcion.offsetTop
  const abajo = arriba + opcion.offsetHeight
  if (arriba < lista.scrollTop) lista.scrollTop = arriba
  else if (abajo > lista.scrollTop + lista.clientHeight) lista.scrollTop = abajo - lista.clientHeight
}

/**
 * Selector con el diseño del portal (reemplaza al `<select>` nativo).
 *
 * Mismo aspecto que el de Sistema y Tipo de equipo, pero sin crear ni
 * eliminar opciones. Se abre hacia arriba si no hay espacio debajo.
 */
export function Selector({
  value,
  onChange,
  opciones,
  placeholder = 'Seleccione…',
  ariaLabel,
  disabled,
  className,
  compacto,
}: {
  value: string
  onChange: (valor: string) => void
  opciones: OpcionSelector[]
  placeholder?: string
  ariaLabel: string
  disabled?: boolean
  className?: string
  /** Altura reducida, para filtros dentro de barras de herramientas. */
  compacto?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [arriba, setArriba] = useState(false)
  const [query, setQuery] = useState('')
  const [activo, setActivo] = useState(0)

  const raiz = useRef<HTMLDivElement>(null)
  const disparador = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const buscador = useRef<HTMLInputElement>(null)
  const lista = useRef<HTMLUListElement>(null)
  const porTeclado = useRef(false)
  const idLista = useId()
  const idOpcion = (i: number) => `${idLista}-${i}`

  const buscable = opciones.length > UMBRAL_BUSQUEDA
  const elegida = opciones.find((o) => o.valor === value)

  const visibles = useMemo(() => {
    const q = normalizar(query.trim())
    return q ? opciones.filter((o) => normalizar(o.etiqueta).includes(q)) : opciones
  }, [opciones, query])

  const abrir = () => {
    if (disabled) return
    // Hacia arriba si el panel no cabe debajo y hay más espacio encima.
    const r = disparador.current?.getBoundingClientRect()
    if (r) setArriba(window.innerHeight - r.bottom < 320 && r.top > window.innerHeight - r.bottom)
    setQuery('')
    setActivo(Math.max(0, opciones.findIndex((o) => o.valor === value)))
    setAbierto(true)
  }
  const cerrar = (devolverFoco = true) => {
    setAbierto(false)
    if (devolverFoco) disparador.current?.focus()
  }
  const elegir = (o: OpcionSelector) => {
    onChange(o.valor)
    cerrar()
  }

  useEffect(() => {
    if (!abierto) return
    ;(buscable ? buscador.current : panel.current)?.focus()
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) cerrar(false)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  // Al moverse con el teclado, desplaza solo la lista (nunca la página).
  useEffect(() => {
    if (!abierto || !porTeclado.current) return
    porTeclado.current = false
    desplazarLista(lista.current, document.getElementById(idOpcion(activo)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, abierto])

  const teclado = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') porTeclado.current = true
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((a) => Math.min(a + 1, visibles.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (visibles[activo]) elegir(visibles[activo])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cerrar()
    } else if (e.key === 'Tab') {
      cerrar(false)
    }
  }

  return (
    <div ref={raiz} className={cx('relative', className)}>
      <button
        ref={disparador}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`${ariaLabel}: ${elegida?.etiqueta ?? 'sin elegir'}`}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={(e) => {
          if (!abierto && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            abrir()
          }
        }}
        className={cx(
          'flex w-full items-center justify-between gap-2 rounded-xl border bg-white text-left text-sm transition-colors',
          compacto ? 'px-3 py-2' : 'px-3.5 py-2.5',
          disabled
            ? 'cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400'
            : abierto
              ? 'border-brand-500 ring-2 ring-brand-500/20'
              : 'border-zinc-300 hover:border-zinc-400',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {elegida?.punto && <span className={cx('size-2 shrink-0 rounded-full', elegida.punto)} />}
          <span className={cx('truncate', elegida ? (disabled ? 'text-zinc-500' : 'text-zinc-900') : 'text-zinc-400')}>
            {elegida?.etiqueta ?? placeholder}
          </span>
        </span>
        <ChevronDown
          className={cx('size-4 shrink-0 text-zinc-400 transition-transform', abierto && 'rotate-180')}
        />
      </button>

      {abierto && (
        <div
          ref={panel}
          tabIndex={-1}
          onKeyDown={teclado}
          className={cx(
            'anim-entrada absolute inset-x-0 z-30 min-w-48 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/10 focus:outline-none',
            arriba ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {buscable && (
            <div className="flex items-center gap-2 border-b border-zinc-100 px-3.5">
              <Search className="size-4 shrink-0 text-zinc-400" />
              <input
                ref={buscador}
                role="combobox"
                aria-expanded
                aria-controls={idLista}
                aria-activedescendant={visibles[activo] ? idOpcion(activo) : undefined}
                aria-label={`Buscar en ${ariaLabel}`}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActivo(0)
                }}
                placeholder="Buscar…"
                className="w-full bg-transparent py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
            </div>
          )}
          <ul
            ref={lista}
            id={idLista}
            role="listbox"
            aria-label={ariaLabel}
            aria-activedescendant={!buscable && visibles[activo] ? idOpcion(activo) : undefined}
            className="relative max-h-64 overflow-y-auto overscroll-contain p-1.5"
          >
            {visibles.map((o, i) => {
              const sel = o.valor === value
              return (
                <li
                  key={o.valor}
                  id={idOpcion(i)}
                  role="option"
                  aria-selected={sel}
                  onPointerMove={() => setActivo(i)}
                  onClick={() => elegir(o)}
                  className={cx(
                    'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors',
                    i === activo && 'bg-zinc-100',
                  )}
                >
                  <Check className={cx('size-4 shrink-0', sel ? 'text-brand-600' : 'text-transparent')} />
                  {o.punto && <span className={cx('size-2 shrink-0 rounded-full', o.punto)} />}
                  <span className={cx('min-w-0 flex-1 truncate', sel ? 'font-semibold text-zinc-900' : 'text-zinc-700')}>
                    {o.etiqueta}
                  </span>
                  {o.detalle != null && (
                    <span className="shrink-0 text-[11px] font-semibold text-zinc-400 tabular-nums">{o.detalle}</span>
                  )}
                </li>
              )
            })}
            {visibles.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-zinc-500">Sin coincidencias</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
