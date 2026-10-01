import { useState } from 'react'
import { Check, PenLine, X } from 'lucide-react'
import { Button, cx } from './ui'
import {
  ESTILOS_FIRMA,
  getFirma,
  setFirma,
  type EstiloFirma,
  type Firma,
} from '../utils/firma'

interface Props {
  onGuardar: (firma: Firma) => void
  /** Si se puede cerrar sin firmar. El técnico está obligado; el cliente no. */
  onCerrar?: () => void
  titulo?: string
  descripcion?: string
  /** Pide también el cargo, necesario en la firma de recepción del cliente. */
  pedirCargo?: boolean
  nombreInicial?: string
  textoBoton?: string
}

/**
 * Creación de la firma digital.
 *
 * La usan tanto el técnico al entrar al portal como el cliente al firmar la
 * recepción de un reporte.
 */
export function FirmaModal({
  onGuardar,
  onCerrar,
  titulo = 'Cree su firma digital',
  descripcion = 'Se usará para firmar los reportes de mantenimiento.',
  pedirCargo = false,
  nombreInicial = '',
  textoBoton = 'Guardar mi firma',
}: Props) {
  const [guardada] = useState(() => getFirma())
  const [nombre, setNombre] = useState(guardada?.nombre ?? nombreInicial)
  const [cargo, setCargo] = useState(guardada?.cargo ?? '')
  const [estilo, setEstilo] = useState<EstiloFirma | null>(guardada?.estilo ?? null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valido =
    nombre.trim().length >= 3 && estilo !== null && (!pedirCargo || cargo.trim().length >= 2)

  const guardar = async () => {
    if (!valido || !estilo || guardando) return
    const firma: Firma = { nombre: nombre.trim(), estilo, cargo: cargo.trim() }
    setGuardando(true)
    setError(null)
    try {
      // Queda en el perfil del usuario: no se vuelve a pedir en cada sesión.
      await setFirma(firma)
      onGuardar(firma)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la firma')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <PenLine className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-zinc-900">{titulo}</h2>
              <p className="text-xs text-zinc-500">{descripcion}</p>
            </div>
          </div>
          {onCerrar && (
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              aria-label="Cerrar firma"
              className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">
            Nombre completo
          </label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Carlos Mendoza"
            autoFocus
            className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
        </div>

        {pedirCargo && (
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Cargo
            </label>
            <input
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ej: Jefe de Mantenimiento"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </div>
        )}

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-zinc-700">Estilo de firma</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(ESTILOS_FIRMA) as EstiloFirma[]).map((id) => {
              const e = ESTILOS_FIRMA[id]
              const activo = estilo === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setEstilo(id)}
                  className={cx(
                    'relative rounded-xl border px-3 py-4 text-center transition-all',
                    activo
                      ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500/30'
                      : 'border-zinc-300 bg-white hover:border-zinc-400',
                  )}
                >
                  {activo && (
                    <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-brand-600 text-white">
                      <Check className="size-3" />
                    </span>
                  )}
                  <span
                    className="block truncate text-3xl leading-tight text-ink-900"
                    style={{ fontFamily: e.font }}
                  >
                    {nombre.trim() || 'Su firma'}
                  </span>
                  <span className="mt-2 block text-xs font-semibold text-zinc-700">
                    {e.label}
                  </span>
                  <span className="block text-[11px] text-zinc-400">{e.descripcion}</span>
                </button>
              )
            })}
          </div>
        </div>

        {guardada && <p className="mt-4 text-xs text-zinc-500">Su firma guardada está lista. Puede reutilizarla o modificarla.</p>}
        {error && <p role="alert" className="mt-4 text-sm text-brand-700">{error}</p>}
        <Button onClick={() => void guardar()} disabled={!valido || guardando} className="mt-5 w-full py-3">
          <PenLine className="size-4" />
          {guardando ? 'Guardando…' : textoBoton}
        </Button>
      </div>
    </div>
  )
}
