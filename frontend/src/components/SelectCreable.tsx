import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, LoaderCircle, Plus, Search, Trash2 } from 'lucide-react'
import { cx } from './ui'

const normalizar = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/** Sin espacios sobrantes y con mayúscula inicial, como el resto del catálogo. */
const limpiar = (s: string) => {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.charAt(0).toLocaleUpperCase('es') + t.slice(1)
}

type Item = { tipo: 'opcion'; valor: string } | { tipo: 'crear'; valor: string }

/**
 * Selector con buscador y creación de valores nuevos.
 *
 * Al escribir filtra la lista (sin distinguir mayúsculas ni tildes). Si el
 * texto no coincide exactamente con ninguna opción, ofrece crearlo; si
 * coincide, elige la existente en lugar de duplicarla.
 *
 * Las opciones que ningún equipo usa se pueden eliminar desde el propio
 * panel; las que están en uso muestran su conteo y no se pueden borrar.
 */
export function SelectCreable({
  value,
  onChange,
  opciones,
  conteos,
  onEliminar,
  ariaLabel,
  placeholderBusqueda = 'Buscar o crear…',
  sustantivo = 'opción',
}: {
  value: string
  onChange: (valor: string) => void
  opciones: string[]
  /** Equipos que usan cada valor: se muestra a la derecha de la opción. */
  conteos?: Map<string, number>
  /** Elimina una opción sin uso. Si no se indica, no se ofrece borrar. */
  onEliminar?: (valor: string) => Promise<void>
  ariaLabel: string
  placeholderBusqueda?: string
  /** "sistema", "tipo"…: se usa en los textos del panel. */
  sustantivo?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [query, setQuery] = useState('')
  const [activo, setActivo] = useState(0)
  // Valores creados en esta sesión, para que sigan en la lista.
  const [propias, setPropias] = useState<string[]>([])
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  const usos = (v: string) => conteos?.get(normalizar(v)) ?? 0
  const eliminable = (v: string) => Boolean(onEliminar) && usos(v) === 0

  const raiz = useRef<HTMLDivElement>(null)
  const buscador = useRef<HTMLInputElement>(null)
  const lista = useRef<HTMLUListElement>(null)
  const idLista = useId()
  const idOpcion = (i: number) => `${idLista}-${i}`

  const todas = useMemo(() => {
    const r = [...opciones]
    for (const p of [...propias, value]) {
      if (p && !r.some((o) => normalizar(o) === normalizar(p))) r.push(p)
    }
    return r
  }, [opciones, propias, value])

  const items = useMemo<Item[]>(() => {
    const q = normalizar(query)
    const filtradas = todas
      .filter((o) => !q || normalizar(o).includes(q))
      .map((valor) => ({ tipo: 'opcion' as const, valor }))
    const texto = limpiar(query)
    const exacta = todas.some((o) => normalizar(o) === normalizar(texto))
    return texto && !exacta ? [...filtradas, { tipo: 'crear', valor: texto }] : filtradas
  }, [todas, query])

  const abrir = () => {
    setQuery('')
    setConfirmando(null)
    setErrorEliminar(null)
    setActivo(Math.max(0, todas.indexOf(value)))
    setAbierto(true)
  }
  const cerrar = () => {
    if (!eliminando) setAbierto(false)
  }

  const eliminar = async (valor: string) => {
    if (!onEliminar || eliminando) return
    setEliminando(true)
    setErrorEliminar(null)
    try {
      await onEliminar(valor)
      setPropias((p) => p.filter((o) => o !== valor))
      // Si era el valor elegido, pasa al siguiente disponible.
      if (valor === value) onChange(todas.find((o) => o !== valor) ?? '')
      setConfirmando(null)
      setActivo(0)
      buscador.current?.focus()
    } catch (e) {
      setErrorEliminar(e instanceof Error ? e.message : 'No se pudo eliminar')
    } finally {
      setEliminando(false)
    }
  }

  const elegir = (item: Item) => {
    if (item.tipo === 'crear') {
      setPropias((p) => [...p, item.valor])
    }
    onChange(item.valor)
    cerrar()
  }

  // Foco en el buscador al abrir y cierre al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return
    buscador.current?.focus()
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) cerrar()
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])

  // Mantiene visible la opción activa al moverse con el teclado.
  useEffect(() => {
    if (abierto) document.getElementById(idOpcion(activo))?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, abierto])

  const teclado = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((a) => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (confirmando) void eliminar(confirmando)
      else if (items[activo]) elegir(items[activo])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (confirmando) setConfirmando(null)
      else cerrar()
    } else if (e.key === 'Delete') {
      // Suprimir sobre una opción sin uso pide confirmar su eliminación.
      const item = items[activo]
      if (item?.tipo === 'opcion' && eliminable(item.valor)) {
        e.preventDefault()
        setConfirmando(item.valor)
      }
    }
  }

  return (
    <div ref={raiz} className="relative">
      {/* Campo cerrado: muestra el valor elegido */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`${ariaLabel}: ${value || 'sin elegir'}`}
        onClick={() => (abierto ? cerrar() : abrir())}
        className={cx(
          'flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm transition-colors',
          abierto
            ? 'border-brand-500 ring-2 ring-brand-500/20'
            : 'border-zinc-300 hover:border-zinc-400',
        )}
      >
        <span className={cx('truncate', value ? 'text-zinc-900' : 'text-zinc-400')}>
          {value || `Elegir ${sustantivo}…`}
        </span>
        <ChevronDown
          className={cx('size-4 shrink-0 text-zinc-400 transition-transform', abierto && 'rotate-180')}
        />
      </button>

      {abierto && (
        <div className="anim-entrada absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/10">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3.5">
            <Search className="size-4 shrink-0 text-zinc-400" />
            <input
              ref={buscador}
              role="combobox"
              aria-expanded
              aria-controls={idLista}
              aria-activedescendant={items[activo] ? idOpcion(activo) : undefined}
              aria-label={`Buscar o crear ${sustantivo}`}
              value={query}
              maxLength={80}
              onChange={(e) => {
                setQuery(e.target.value)
                setActivo(0)
              }}
              onKeyDown={teclado}
              placeholder={placeholderBusqueda}
              className="w-full bg-transparent py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
          </div>

          <ul
            ref={lista}
            id={idLista}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-64 overflow-y-auto overscroll-contain p-1.5"
          >
            {items.map((item, i) => {
              const elegido = item.tipo === 'opcion' && item.valor === value
              const n = item.tipo === 'opcion' ? usos(item.valor) : 0

              // Confirmación en la misma fila, sin abrir otra ventana.
              if (item.tipo === 'opcion' && confirmando === item.valor) {
                return (
                  <li
                    key={`confirmar-${item.valor}`}
                    id={idOpcion(i)}
                    role="option"
                    aria-selected={elegido}
                    className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-brand-900">
                      ¿Eliminar <span className="font-semibold">«{item.valor}»</span>?
                    </span>
                    <button
                      type="button"
                      disabled={eliminando}
                      onClick={() => void eliminar(item.valor)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      {eliminando && <LoaderCircle className="size-3 motion-safe:animate-spin" />}
                      Eliminar
                    </button>
                    <button
                      type="button"
                      disabled={eliminando}
                      onClick={() => {
                        setConfirmando(null)
                        buscador.current?.focus()
                      }}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-white disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </li>
                )
              }

              return (
                <li
                  key={`${item.tipo}-${item.valor}`}
                  id={idOpcion(i)}
                  role="option"
                  aria-selected={elegido}
                  onPointerMove={() => setActivo(i)}
                  onClick={() => elegir(item)}
                  className={cx(
                    'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors',
                    i === activo && 'bg-zinc-100',
                    // Fija abajo: sigue visible aunque haya muchas coincidencias.
                    item.tipo === 'crear' &&
                      'sticky bottom-0 mt-1 border-t border-zinc-100 bg-white pt-2.5 font-semibold text-brand-700 shadow-[0_-8px_12px_-8px_rgba(0,0,0,0.08)]',
                    item.tipo === 'crear' && i === activo && 'bg-brand-50',
                  )}
                >
                  {item.tipo === 'crear' ? (
                    <>
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-50">
                        <Plus className="size-3.5" />
                      </span>
                      <span className="min-w-0 truncate">
                        Crear <span className="text-zinc-900">«{item.valor}»</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Check
                        className={cx('size-4 shrink-0', elegido ? 'text-brand-600' : 'text-transparent')}
                      />
                      <span
                        className={cx('min-w-0 flex-1 truncate', elegido ? 'font-semibold text-zinc-900' : 'text-zinc-700')}
                      >
                        {item.valor}
                      </span>
                      {n > 0 ? (
                        <span
                          className="shrink-0 rounded-full bg-zinc-100 px-2 text-[11px] font-semibold text-zinc-500 tabular-nums"
                          title={`En uso por ${n} ${n === 1 ? 'equipo' : 'equipos'}: no se puede eliminar`}
                        >
                          {n}
                        </span>
                      ) : (
                        eliminable(item.valor) && (
                          <button
                            type="button"
                            aria-label={`Eliminar ${sustantivo} «${item.valor}»`}
                            title="Eliminar (ningún equipo lo usa)"
                            onClick={(e) => {
                              e.stopPropagation()
                              setErrorEliminar(null)
                              setConfirmando(item.valor)
                            }}
                            className={cx(
                              'shrink-0 rounded-lg p-1 text-zinc-400 transition-opacity hover:bg-brand-50 hover:text-brand-600',
                              // Visible al pasar el cursor o al navegar con el teclado; siempre en táctil.
                              i === activo ? 'opacity-100' : 'opacity-100 sm:opacity-0',
                            )}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )
                      )}
                    </>
                  )}
                </li>
              )
            })}
            {items.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-zinc-500">
                Escriba para crear un {sustantivo} nuevo
              </li>
            )}
          </ul>

          {errorEliminar && (
            <p role="alert" className="border-t border-brand-100 bg-brand-50 px-3.5 py-2 text-xs font-semibold text-brand-700">
              {errorEliminar}
            </p>
          )}
          <p className="border-t border-zinc-100 bg-zinc-50 px-3.5 py-2 text-[11px] text-zinc-500">
            ↑↓ moverse · Enter elegir · Esc cerrar
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Une el catálogo base con los valores ya usados en el inventario, sin
 * duplicados. Las opciones eliminadas desaparecen, salvo que algún equipo
 * las use (entonces siguen saliendo, porque forman parte del inventario).
 */
export function unirOpciones(base: string[], usados: string[], ocultos: string[] = []) {
  const oculto = new Set(ocultos.map(normalizar))
  const visibles = base.filter((b) => !oculto.has(normalizar(b)))
  const extra: string[] = []
  for (const u of usados) {
    const limpio = u?.trim()
    if (limpio && ![...visibles, ...extra].some((o) => normalizar(o) === normalizar(limpio))) {
      extra.push(limpio)
    }
  }
  // Los del inventario van después del catálogo base, en orden alfabético.
  return [...visibles, ...extra.sort((a, b) => a.localeCompare(b, 'es'))]
}

/** Cuántos equipos usan cada valor (sin distinguir mayúsculas ni tildes). */
export function contarUsos(usados: string[]) {
  const mapa = new Map<string, number>()
  for (const u of usados) {
    const clave = normalizar(u ?? '')
    if (clave) mapa.set(clave, (mapa.get(clave) ?? 0) + 1)
  }
  return mapa
}
