import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { Server, Building2, History, Users, FileText } from 'lucide-react'
import { LogoSM, cx } from '../ui'
import { useData } from '../../store/DataContext'

const nav = [
  { to: '/equipos', label: 'Equipos', icon: Server },
  { to: '/empresas', label: 'Empresas', icon: Building2 },
  { to: '/contratos', label: 'Contratos', icon: FileText },
  { to: '/historial', label: 'Historial', icon: History },
  { to: '/usuarios', label: 'Usuarios', icon: Users },
]

export function Sidebar({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate?: () => void
}) {
  const { equipos, empresas } = useData()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const empresaActiva = pathname === '/equipos' ? (params.get('empresa') ?? '') : null

  const cuenta = (empresaId: string) =>
    equipos.filter((e) => e.empresaId === empresaId).length

  return (
    <aside className={cx('flex-col overflow-hidden bg-ink-950 text-zinc-300', className)}>
      {/* Marca de agua con el isotipo */}
      <img
        src={`${import.meta.env.BASE_URL}icon.png`}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-20 w-72 -rotate-12 opacity-[0.07] select-none"
      />
      <div className="border-b border-white/10 px-5 py-5">
        <LogoSM />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cx(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/8 text-white'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-600" />
                  )}
                  <Icon className="size-5 shrink-0" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Filtro rápido por empresa */}
        <p className="mt-7 mb-2 px-3 text-[11px] font-bold tracking-widest text-zinc-500 uppercase">
          Empresas
        </p>
        <div className="space-y-0.5">
          <Link
            to="/equipos"
            onClick={onNavigate}
            className={cx(
              'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
              empresaActiva === ''
                ? 'font-semibold text-white'
                : 'text-zinc-400 hover:text-zinc-100',
            )}
          >
            Todas
            <span className="font-mono text-xs text-zinc-500">{equipos.length}</span>
          </Link>
          {empresas
            .filter((em) => cuenta(em.id) > 0)
            .map((em) => (
              <Link
                key={em.id}
                to={`/equipos?empresa=${em.id}`}
                onClick={onNavigate}
                className={cx(
                  'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  empresaActiva === em.id
                    ? 'font-semibold text-white'
                    : 'text-zinc-400 hover:text-zinc-100',
                )}
              >
                <span className="truncate">{em.nombre}</span>
                <span className="shrink-0 font-mono text-xs text-zinc-500">
                  {cuenta(em.id)}
                </span>
              </Link>
            ))}
        </div>
      </div>

      {/* Acciones principales */}
      <div className="space-y-2 border-t border-white/10 p-4">
        <Link
          to="/revisiones/nueva"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/40 transition-colors hover:bg-brand-700"
        >
          + Nueva revisión
        </Link>
        <Link
          to="/escanear"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/5"
        >
          Escanear QR
        </Link>
      </div>
    </aside>
  )
}
