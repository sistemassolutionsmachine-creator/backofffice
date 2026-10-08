import { useState } from 'react'
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, QrCode } from 'lucide-react'
import { cerrarSesion, getRol } from '../../utils/auth'
import { getFirma, type Firma } from '../../utils/firma'
import { FirmaModal } from '../FirmaModal'

export function TecnicoLayout() {
  const navigate = useNavigate()
  const [firma, setFirmaLocal] = useState<Firma | null>(() => getFirma())

  if (getRol() !== 'tecnico') return <Navigate to="/t" replace />

  const salir = () => {
    cerrarSesion()
    navigate('/t', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img
              src={`${import.meta.env.BASE_URL}icon.png`}
              alt="Solutions Machine"
              className="size-9 shrink-0 object-contain"
            />
            <div className="leading-tight">
              <p className="text-sm font-bold text-zinc-900">Solutions Machine</p>
              <p className="text-[10px] font-semibold tracking-wide text-brand-600 uppercase">
                Modo técnico
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              to="/tecnico/escanear"
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-200"
            >
              <QrCode className="size-4" />
              <span className="hidden sm:inline">Escanear QR</span>
            </Link>
            <button
              type="button"
              onClick={salir}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-10 sm:px-6">
        <Outlet />
      </main>

      {/* La firma digital es obligatoria para trabajar */}
      {!firma && <FirmaModal onGuardar={setFirmaLocal} />}
    </div>
  )
}
