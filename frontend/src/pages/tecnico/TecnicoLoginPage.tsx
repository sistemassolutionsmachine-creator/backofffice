import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, KeyRound, QrCode, ShieldCheck } from 'lucide-react'
import { Button } from '../../components/ui'
import { PinInput, PIN_LARGO } from '../../components/PinInput'
import { cerrarSesion, iniciarSesion } from '../../utils/auth'
import { api } from '../../api/client'
import { useData } from '../../store/DataContext'

export function TecnicoLoginPage() {
  const navigate = useNavigate()
  const { codigo } = useParams()
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
      if (u.rol !== 'tecnico') {
        cerrarSesion()
        throw new Error('Este acceso es exclusivo para técnicos.')
      }
      // Con la sesión recién creada, se cargan los datos del portal.
      void recargar()

      // Si se llegó escaneando un QR, se abre el reporte de ese equipo.
      if (codigo) {
        const equipo = await api.equipos.porCodigo(codigo)
        navigate(`/tecnico/reporte?equipo=${equipo.id}`, { replace: true })
      } else {
        navigate('/tecnico/escanear', { replace: true })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.')
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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink-950 px-6 py-10">
      <div className="pointer-events-none fixed -top-32 -right-32 size-96 rounded-full bg-brand-600/20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -left-24 size-96 rounded-full bg-brand-600/10 blur-3xl" />
      {/* Marca de agua con el isotipo */}
      <img
        src={`${import.meta.env.BASE_URL}icon.png`}
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed -right-20 -bottom-20 w-80 rotate-12 opacity-10 select-none"
      />

      <div className="relative w-full max-w-sm">
        {/* Marca */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg">
            <img
              src={`${import.meta.env.BASE_URL}icon.png`}
              alt="Solutions Machine"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="leading-tight text-white">
            <p className="font-bold">Solutions Machine</p>
            <p className="text-xs tracking-wide text-zinc-400 uppercase">
              Acceso técnico
            </p>
          </div>
        </div>

        {/* Equipo detectado por QR */}
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
          <QrCode className="size-4 shrink-0 text-brand-500" />
          <p className="text-sm text-zinc-300">
            {codigo ? (
              <>
                QR detectado:{' '}
                <span className="font-mono font-bold text-white uppercase">{codigo}</span>
              </>
            ) : (
              'Escanee el QR del equipo para iniciar el reporte'
            )}
          </p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void entrar(usuario, pin)
          }}
          className="mt-6 space-y-5 rounded-2xl bg-white p-6 shadow-2xl"
        >
          <div>
            <h1 className="text-lg font-bold text-zinc-900">Iniciar sesión</h1>
            <p className="text-sm text-zinc-500">
              Identifíquese para llenar el reporte de mantenimiento.
            </p>
          </div>

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
              placeholder="tecnico"
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
            {entrando ? 'Verificando…' : 'Ingresar y abrir reporte'}
            {!entrando && <ArrowRight className="size-4" />}
          </Button>

          {/* Ayuda demo */}
          <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500">
            <p className="flex items-center gap-1.5 font-semibold text-zinc-700">
              <KeyRound className="size-3.5" />
              Credenciales de demostración
            </p>
            <p className="mt-1 font-mono">Usuario: tecnico</p>
            <p className="font-mono">PIN: 1234</p>
          </div>
        </form>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-zinc-500">
          <ShieldCheck className="size-3.5" />
          Acceso restringido a técnicos autorizados
        </p>
      </div>
    </div>
  )
}
