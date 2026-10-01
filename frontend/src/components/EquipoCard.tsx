import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FileText, MapPin } from 'lucide-react'
import { Card, cx } from './ui'
import { fechaCorta } from '../utils/fechas'
import { nombreVisible } from '../types'
import type { EstadoEquipo, Equipo } from '../types'

const ESTADOS: Record<EstadoEquipo, { label: string; dot: string; text: string }> = {
  operativo: { label: 'Operativo', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  mantenimiento: { label: 'Mantenimiento', dot: 'bg-amber-500', text: 'text-amber-600' },
  fuera_servicio: { label: 'Fuera de servicio', dot: 'bg-brand-600', text: 'text-brand-700' },
}

/** Orden de prioridad: lo que falla va primero. */
export const PESO_ESTADO: Record<EstadoEquipo, number> = {
  fuera_servicio: 0,
  mantenimiento: 1,
  operativo: 2,
}

function footerDe(eq: Equipo): { label: string; valor: string } {
  if (eq.estado === 'fuera_servicio')
    return { label: 'Correctivo en curso', valor: `desde ${fechaCorta(eq.ultimaRevision)}` }
  if (eq.estado === 'mantenimiento')
    return { label: 'Revisión en curso', valor: fechaCorta(eq.ultimaRevision) }
  if (!eq.ultimaRevision) return { label: 'Última revisión', valor: '—' }
  return { label: 'Última revisión', valor: fechaCorta(eq.ultimaRevision) }
}

/**
 * Tarjeta de un equipo. La comparten el panel del administrador (navega a la
 * ficha) y el portal del cliente (abre la ficha en un panel).
 */
export function EquipoCard({
  eq,
  nRevisiones,
  empresaNombre,
  contratoNombre,
  indice,
  to,
  onClick,
}: {
  eq: Equipo
  nRevisiones: number
  /** Se muestra al buscar en todo el inventario, para ubicar el resultado. */
  empresaNombre?: string
  contratoNombre?: string
  /** Posición en la cuadrícula: define el retraso de la animación de entrada. */
  indice: number
  to?: string
  onClick?: () => void
}) {
  const est = ESTADOS[eq.estado]
  const footer = footerDe(eq)
  const estilo: CSSProperties = { animationDelay: `${Math.min(indice, 12) * 35}ms` }

  const contenido: ReactNode = (
    <Card
      className={cx(
        'group flex h-full flex-col p-4 text-left transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg',
        eq.estado === 'fuera_servicio' &&
          'border-brand-300 ring-1 ring-brand-200 hover:border-brand-400',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate rounded-md bg-zinc-100 px-2 py-1 font-mono text-[11px] font-bold text-zinc-600">
          {eq.codigo}
        </span>
        <span className={cx('flex shrink-0 items-center gap-1.5 text-[11px] font-semibold', est.text)}>
          <span className={cx('size-1.5 rounded-full', est.dot)} />
          {est.label}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-snug font-bold text-zinc-900 transition-colors group-hover:text-brand-700">
        {nombreVisible(eq)}
      </p>
      <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-zinc-500">
        <MapPin className="size-3 shrink-0 text-zinc-400" />
        <span className="truncate">{eq.ubicacion}</span>
      </p>
      {(eq.marca || eq.modelo) && (
        <p className="mt-0.5 truncate text-xs text-zinc-400">
          {[eq.marca, eq.modelo].filter(Boolean).join(' · ')}
        </p>
      )}
      {empresaNombre && (
        <p className="mt-1.5 truncate text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
          {empresaNombre}
        </p>
      )}

      <p
        className="mt-3 mb-4 truncate rounded-lg bg-zinc-50 px-2 py-1.5 text-xs font-medium text-zinc-600"
        title={contratoNombre}
      >
        {contratoNombre ?? 'Pendiente de contrato'}
      </p>
      <div className="mt-auto flex items-end justify-between gap-2 border-t border-zinc-100 pt-3">
        <span>
          <span className="block text-[10px] tracking-wide text-zinc-400 uppercase">
            {footer.label}
          </span>
          <span
            className={cx('block text-xs font-bold', eq.estado === 'operativo' ? 'text-zinc-900' : est.text)}
          >
            {footer.valor}
          </span>
        </span>
        <span
          className="flex items-center gap-1 text-xs text-zinc-400"
          title={`${nRevisiones} ${nRevisiones === 1 ? 'revisión registrada' : 'revisiones registradas'}`}
        >
          <FileText className="size-3.5" />
          {nRevisiones}
        </span>
      </div>
    </Card>
  )

  if (to) {
    return (
      <Link to={to} viewTransition className="anim-entrada block" style={estilo}>
        {contenido}
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ver ficha de ${nombreVisible(eq)} (${eq.codigo})`}
      className="anim-entrada block w-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      style={estilo}
    >
      {contenido}
    </button>
  )
}
