import { useState } from 'react'
import { LoaderCircle, ShieldAlert } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './ui'

/**
 * Confirmación por escritura, al estilo de GitHub: la acción solo se habilita
 * cuando el texto escrito coincide exactamente con la frase indicada.
 */
export function ConfirmarFraseModal({
  titulo,
  descripcion,
  frase,
  textoBoton,
  onConfirmar,
  onCerrar,
}: {
  titulo: string
  descripcion: string
  frase: string
  textoBoton: string
  onConfirmar: (confirmacion: string) => Promise<void>
  onCerrar: () => void
}) {
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const coincide = texto.trim() === frase

  const confirmar = async () => {
    if (!coincide || ocupado) return
    setOcupado(true)
    setError(null)
    try {
      await onConfirmar(texto.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción')
      setOcupado(false)
    }
  }

  return (
    <Modal titulo={titulo} onCerrar={ocupado ? undefined : onCerrar}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void confirmar()
        }}
      >
        <div className="mt-4 flex gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-brand-600" />
          <p className="leading-relaxed">{descripcion}</p>
        </div>

        <label className="mt-5 block text-sm text-zinc-700">
          Para confirmar, escriba{' '}
          <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs font-bold text-zinc-900 select-all">
            {frase}
          </code>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={ocupado}
            aria-label={`Escriba ${frase} para confirmar`}
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 font-mono text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
        </label>

        {error && (
          <p role="alert" className="mt-3 text-sm text-brand-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <Button variant="secondary" className="flex-1" disabled={ocupado} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={!coincide || ocupado}>
            {ocupado && <LoaderCircle className="size-4 motion-safe:animate-spin" />}
            {textoBoton}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
