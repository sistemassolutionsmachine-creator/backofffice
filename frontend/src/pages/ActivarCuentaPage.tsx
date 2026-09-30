import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from '../components/ui'
import { PinInput, PIN_LARGO } from '../components/PinInput'
import { api, setToken } from '../api/client'
import { rutaDeRol } from '../utils/auth'

/**
 * Pantalla del enlace de activación.
 *
 * El PIN nunca viaja por correo: el usuario lo define aquí y el enlace queda
 * inutilizado al confirmarlo.
 */
export function ActivarCuentaPage() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [estado, setEstado] = useState<'verificando' | 'listo' | 'invalido'>(
    'verificando',
  )
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!token) {
      setEstado('invalido')
      setError('El enlace está incompleto.')
      return
    }
    let vigente = true
    api
      .verificarActivacion(token)
      .then((r) => {
        if (!vigente) return
        setNombre(r.nombre)
        setEstado('listo')
      })
      .catch((e) => {
        if (!vigente) return
        setError(e instanceof Error ? e.message : 'Este enlace no es válido.')
        setEstado('invalido')
      })
    return () => {
      vigente = false
    }
  }, [token])

  const confirmar = async () => {
    if (!token || guardando) return
    if (pin !== confirmacion) {
      setError('Los dos PIN no coinciden. Vuelva a intentarlo.')
      setConfirmacion('')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const r = await api.activar(token, pin)
      setToken(r.token)
      sessionStorage.setItem('sm-usuario', JSON.stringify(r.usuario))
      navigate(rutaDeRol(r.usuario.rol), { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo definir el PIN.')
      setPin('')
      setConfirmacion('')
    } finally {
      setGuardando(false)
    }
  }

  const paso = pin.length < PIN_LARGO ? 'elegir' : 'confirmar'

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink-950 px-6 py-10">
      <div className="pointer-events-none fixed -top-32 -right-32 size-96 rounded-full bg-brand-600/20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -left-24 size-96 rounded-full bg-brand-600/10 blur-3xl" />
      <img
        src="/icon.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed -right-20 -bottom-20 w-80 rotate-12 opacity-10 select-none"
      />

      <div className="relative w-full max-w-sm">
        <div className="flex items-center justify-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg">
            <img
              src="/icon.png"
              alt="Solutions Machine"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="leading-tight text-white">
            <p className="font-bold">Solutions Machine</p>
            <p className="text-xs tracking-wide text-zinc-400 uppercase">
              Activación de cuenta
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-2xl">
          {estado === 'verificando' && (
            <p className="py-8 text-center text-sm text-zinc-500">
              Comprobando el enlace…
            </p>
          )}

          {estado === 'invalido' && (
            <div className="py-4 text-center">
              <h1 className="text-lg font-bold text-zinc-900">Enlace no válido</h1>
              <p className="mt-2 text-sm text-zinc-500">{error}</p>
              <Button
                variant="secondary"
                className="mt-5 w-full"
                onClick={() => navigate('/login')}
              >
                Ir al inicio de sesión
              </Button>
            </div>
          )}

          {estado === 'listo' && (
            <>
              <div className="text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="size-6" />
                </span>
                <h1 className="mt-3 text-lg font-bold text-zinc-900">
                  Hola, {nombre}
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  {paso === 'elegir'
                    ? 'Elija un PIN de 4 dígitos para entrar al portal.'
                    : 'Repita el PIN para confirmarlo.'}
                </p>
              </div>

              <div className="mt-6">
                {paso === 'elegir' ? (
                  <PinInput
                    value={pin}
                    onChange={(v) => {
                      setPin(v)
                      setError(null)
                    }}
                    error={Boolean(error)}
                  />
                ) : (
                  <PinInput
                    value={confirmacion}
                    onChange={(v) => {
                      setConfirmacion(v)
                      setError(null)
                      if (v.length === PIN_LARGO) {
                        // Se confirma en cuanto se completa el segundo PIN.
                        setTimeout(() => {
                          if (v === pin) void confirmar()
                          else {
                            setError('Los dos PIN no coinciden. Vuelva a intentarlo.')
                            setConfirmacion('')
                          }
                        }, 150)
                      }
                    }}
                    error={Boolean(error)}
                  />
                )}
              </div>

              {error && (
                <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-center text-xs font-semibold text-brand-700">
                  {error}
                </p>
              )}

              {paso === 'confirmar' && (
                <button
                  type="button"
                  onClick={() => {
                    setPin('')
                    setConfirmacion('')
                    setError(null)
                  }}
                  className="mt-4 w-full text-center text-xs font-semibold text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline"
                >
                  Elegir otro PIN
                </button>
              )}

              <Button
                className="mt-5 w-full py-3"
                disabled={
                  guardando || pin.length < PIN_LARGO || confirmacion.length < PIN_LARGO
                }
                onClick={() => void confirmar()}
              >
                {guardando ? 'Guardando…' : 'Activar mi cuenta'}
                {!guardando && <ArrowRight className="size-4" />}
              </Button>

              <p className="mt-4 text-center text-[11px] text-zinc-400">
                Evite combinaciones obvias como 1234 o cuatro dígitos iguales.
              </p>
            </>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-zinc-500">
          <ShieldCheck className="size-3.5" />
          Este enlace es de un solo uso y caduca en 48 horas
        </p>
      </div>
    </div>
  )
}
