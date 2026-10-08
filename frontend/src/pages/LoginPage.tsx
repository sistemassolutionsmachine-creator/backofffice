import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode, FileText, Camera, ShieldCheck, ArrowRight, KeyRound } from 'lucide-react'
import { Button } from '../components/ui'
import { PinInput, PIN_LARGO } from '../components/PinInput'
import { iniciarSesion, rutaDeRol } from '../utils/auth'
import { useData } from '../store/DataContext'

const features = [
  { icon: QrCode, text: 'Identificación de equipos por código QR' },
  { icon: Camera, text: 'Evidencia fotográfica antes y después' },
  { icon: FileText, text: 'Reportes PDF con consecutivo automático' },
  { icon: ShieldCheck, text: 'Roles y permisos por tipo de usuario' },
]

export function LoginPage() {
  const navigate = useNavigate()
  const { recargar } = useData()
  const [usuario, setUsuario] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  const entrar = async (usuarioActual: string, pinActual: string) => {
    if (entrando) return
    setEntrando(true)
    setError(null)
    try {
      const u = await iniciarSesion(usuarioActual, pinActual)
      // Los datos se cargan al montar la aplicación, cuando aún no había
      // sesión: hay que pedirlos ahora que existe el token.
      void recargar()
      navigate(rutaDeRol(u.rol), { replace: true })
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo iniciar sesión. Intente de nuevo.',
      )
      setPin('')
    } finally {
      setEntrando(false)
    }
  }

  const onPinChange = (valor: string) => {
    setPin(valor)
    setError(null)
    // Al completar los 4 dígitos se valida automáticamente
    if (valor.length === PIN_LARGO) void entrar(usuario, valor)
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Panel de marca */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-ink-950 px-6 py-8 text-white sm:px-10 lg:w-1/2 lg:py-12">
        <div className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full bg-brand-600/10 blur-3xl" />
        {/* Marca de agua con el isotipo */}
        <img
          src={`${import.meta.env.BASE_URL}icon.png`}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -bottom-24 w-[26rem] rotate-12 opacity-10 select-none lg:w-[32rem]"
        />

        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg">
            <img
              src={`${import.meta.env.BASE_URL}icon.png`}
              alt="Solutions Machine"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="leading-tight">
            <p className="font-bold">Solutions Machine</p>
            <p className="text-xs tracking-wide text-zinc-400 uppercase">
              Gestión de Activos
            </p>
          </div>
        </div>

        <div className="relative mt-10 lg:mt-0">
          <h1 className="max-w-md text-3xl font-extrabold tracking-tight sm:text-4xl">
            Control total de sus activos y{' '}
            <span className="text-brand-500">mantenimientos</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400">
            Centralice el historial de servicios, revisiones y evidencias de cada
            equipo con trazabilidad completa desde cualquier dispositivo.
          </p>
          <ul className="mt-8 hidden space-y-4 lg:block">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-zinc-300">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                  <Icon className="size-4 text-brand-500" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-10 hidden text-xs text-zinc-500 lg:block">
          © 2026 Solutions Machine · Portal de Backoffice
        </p>
      </div>

      {/* Formulario */}
      <div className="flex flex-1 items-center justify-center bg-zinc-100 px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
            Iniciar sesión
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Ingrese su usuario y PIN de acceso.
          </p>

          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              void entrar(usuario, pin)
            }}
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                Usuario
              </label>
              <input
                value={usuario}
                onChange={(e) => {
                  setUsuario(e.target.value)
                  setError(null)
                }}
                placeholder="admin, tecnico o cliente"
                autoComplete="username"
                autoCapitalize="none"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-center text-sm font-medium text-zinc-700">
                PIN de acceso
              </label>
              <PinInput value={pin} onChange={onPinChange} error={Boolean(error)} />
            </div>
            {error && (
              <p className="rounded-lg bg-brand-50 px-3 py-2 text-center text-xs font-semibold text-brand-700">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full py-3" disabled={entrando}>
              {entrando ? 'Verificando…' : 'Ingresar al portal'}
              {!entrando && <ArrowRight className="size-4" />}
            </Button>

            {/* Ayuda demo */}
            <div className="rounded-xl bg-white p-3 text-xs text-zinc-500 ring-1 ring-zinc-200">
              <p className="flex items-center gap-1.5 font-semibold text-zinc-700">
                <KeyRound className="size-3.5" />
                Usuarios de demostración · PIN 1234
              </p>
              <p className="mt-1 font-mono">admin · portal administrativo</p>
              <p className="font-mono">tecnico · escáner y reportes</p>
              <p className="font-mono">cliente · inventario e historial</p>
            </div>
          </form>

          <p className="mt-8 text-center text-xs text-zinc-400">
            Acceso restringido a usuarios autorizados de Solutions Machine.
          </p>
        </div>
      </div>
    </div>
  )
}
