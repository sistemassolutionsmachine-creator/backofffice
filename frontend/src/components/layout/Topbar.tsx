import { Link, useNavigate } from 'react-router-dom'
import { Bell, LogOut, Menu, QrCode } from 'lucide-react'
import { Avatar } from '../ui'
import { cerrarSesion } from '../../utils/auth'

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const navigate = useNavigate()

  const salir = () => {
    cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <img
              src={`${import.meta.env.BASE_URL}icon.png`}
              alt="Solutions Machine"
              className="size-8 shrink-0 object-contain"
            />
            <div>
              <p className="text-sm leading-none font-bold text-zinc-900">
                Solutions <span className="text-brand-600">Machine</span>
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Gestión de Activos</p>
            </div>
          </div>
          <p className="hidden text-sm text-zinc-500 lg:block">
            Portal de Backoffice · Mantenimiento y Activos
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            to="/escanear"
            className="hidden items-center gap-2 rounded-xl bg-ink-950 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-800 sm:inline-flex"
          >
            <QrCode className="size-4" />
            Escanear QR
          </Link>
          <button
            type="button"
            className="relative rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
            aria-label="Notificaciones"
          >
            <Bell className="size-5" />
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand-600 ring-2 ring-white" />
          </button>
          <Avatar nombre="Valentina Marín" className="size-8 bg-brand-600 sm:size-9" />
          <button
            type="button"
            onClick={salir}
            title="Cerrar sesión"
            className="flex items-center gap-1.5 rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <LogOut className="size-5" />
            <span className="hidden text-sm font-semibold lg:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  )
}
