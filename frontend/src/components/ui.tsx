import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import type { EstadoEquipo, EstadoRevision, RolUsuario, TipoServicio } from '../types'

export function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/* ---------- Botones ---------- */

type ButtonProps = {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'dark'
  className?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
}

export function Button({
  children,
  variant = 'primary',
  className,
  onClick,
  type = 'button',
  disabled,
}: ButtonProps) {
  const variants = {
    primary:
      'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/30',
    secondary:
      'bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400',
    ghost: 'text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900',
    dark: 'bg-ink-900 text-white hover:bg-ink-800',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ---------- Superficies ---------- */

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-zinc-200 bg-white shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'brand' | 'ok' | 'warn'
}) {
  const tones = {
    neutral: 'bg-zinc-100 text-zinc-700',
    brand: 'bg-brand-50 text-brand-700',
    ok: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-700',
  }
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-zinc-900 sm:text-3xl">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
        </div>
        <div className={cx('rounded-xl p-2.5', tones[tone])}>{icon}</div>
      </div>
    </Card>
  )
}

/* ---------- Badges de estado ---------- */

export function EstadoEquipoBadge({ estado }: { estado: EstadoEquipo }) {
  const map = {
    operativo: { label: 'Operativo', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
    mantenimiento: { label: 'En mantenimiento', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
    fuera_servicio: { label: 'Fuera de servicio', cls: 'bg-brand-50 text-brand-700 ring-brand-200', dot: 'bg-brand-600' },
  }
  const s = map[estado]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        s.cls,
      )}
    >
      <span className={cx('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}

/** Colores y textos de los estados del equipo, compartidos por toda la app. */
export const ESTADO_EQUIPO: Record<
  EstadoEquipo,
  { label: string; dot: string; text: string }
> = {
  operativo: { label: 'Operativo', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  mantenimiento: { label: 'En mantenimiento', dot: 'bg-amber-500', text: 'text-amber-700' },
  fuera_servicio: { label: 'Fuera de servicio', dot: 'bg-brand-600', text: 'text-brand-700' },
}

/** Punto de color + estado. Sin dato (revisiones antiguas) muestra "Sin registrar". */
export function EstadoEquipoPunto({ estado }: { estado?: EstadoEquipo | null }) {
  if (!estado) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400">
        <span className="size-2 rounded-full border border-dashed border-zinc-300" />
        Sin registrar
      </span>
    )
  }
  const s = ESTADO_EQUIPO[estado]
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs font-semibold', s.text)}>
      <span className={cx('size-2 shrink-0 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}

export function EstadoRevisionBadge({ estado }: { estado: EstadoRevision }) {
  const map = {
    completado: { label: 'Completado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    en_proceso: { label: 'En proceso', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
    pendiente: { label: 'Pendiente', cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200' },
    borrador: { label: 'Borrador', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  }
  const s = map[estado]
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        s.cls,
      )}
    >
      {s.label}
    </span>
  )
}

export function TipoServicioBadge({ tipo }: { tipo: TipoServicio }) {
  const map = {
    preventivo: { label: 'Preventivo', cls: 'bg-sky-50 text-sky-700' },
    correctivo: { label: 'Correctivo', cls: 'bg-brand-50 text-brand-700' },
    revision: { label: 'Revisión', cls: 'bg-violet-50 text-violet-700' },
    instalacion: { label: 'Instalación', cls: 'bg-emerald-50 text-emerald-700' },
  }
  const s = map[tipo]
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
        s.cls,
      )}
    >
      {s.label}
    </span>
  )
}

export function RolBadge({ rol }: { rol: RolUsuario }) {
  const map = {
    admin: { label: 'Administrador', cls: 'bg-ink-900 text-white' },
    tecnico: { label: 'Técnico', cls: 'bg-sky-50 text-sky-700' },
    cliente: { label: 'Cliente', cls: 'bg-brand-50 text-brand-700' },
  }
  const s = map[rol]
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
        s.cls,
      )}
    >
      {s.label}
    </span>
  )
}

/* ---------- Varios ---------- */

export function Avatar({ nombre, className }: { nombre: string; className?: string }) {
  const initials = nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  return (
    <span
      className={cx(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-800 text-xs font-bold text-white',
        className,
      )}
    >
      {initials}
    </span>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pr-3 pl-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
      />
    </div>
  )
}

export function LogoSM({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-md">
        <img src={`${import.meta.env.BASE_URL}icon.png`} alt="Solutions Machine" className="h-full w-full object-contain" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">Solutions Machine</p>
          <p className="text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
            Gestión de Activos
          </p>
        </div>
      )}
    </div>
  )
}
