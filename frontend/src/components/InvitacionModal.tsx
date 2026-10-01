import { useState } from 'react'
import { Check, Copy, KeyRound, LoaderCircle, Mail, MailWarning } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './ui'

export interface EstadoInvitacion {
  nombre: string
  email?: string
  estado: 'confirmar' | 'enviando' | 'enviado' | 'alternativo' | 'error'
  enlace?: string
  motivo?: string
}

export function InvitacionModal({ invitacion, onCerrar, onConfirmar }: {
  invitacion: EstadoInvitacion
  onCerrar: () => void
  onConfirmar: () => void
}) {
  const [copiado, setCopiado] = useState(false)
  const [errorCopia, setErrorCopia] = useState('')
  const { estado, nombre, email, enlace, motivo } = invitacion
  const titulos = { confirmar: 'Restablecer PIN', enviando: 'Preparando invitación', enviado: 'Invitación enviada', alternativo: 'Invitación por enlace', error: 'No se pudo completar' }
  const copiar = async () => {
    if (!enlace) return
    try { await navigator.clipboard.writeText(enlace); setCopiado(true); setErrorCopia('') }
    catch { setErrorCopia('No se pudo copiar automáticamente. Seleccione y copie el enlace de abajo.') }
  }
  return (
    <Modal titulo={titulos[estado]} onCerrar={estado === 'enviando' ? undefined : onCerrar}>
      <div className="my-6 flex justify-center">
        <span className="flex size-20 items-center justify-center rounded-3xl bg-brand-50 text-brand-600">
          {estado === 'enviando' ? <LoaderCircle className="size-9 motion-safe:animate-spin" /> : estado === 'enviado' ? <Mail className="size-9" /> : estado === 'confirmar' ? <KeyRound className="size-9" /> : <MailWarning className="size-9" />}
        </span>
      </div>
      <div role="status" className="space-y-2 text-center text-sm leading-relaxed text-zinc-600">
        <p className="font-semibold text-zinc-900">{nombre}</p>
        {email && <p className="break-all text-xs">{email}</p>}
        {estado === 'confirmar' && <p>Se invalidará el PIN actual y se enviará un enlace para elegir uno nuevo.</p>}
        {estado === 'enviando' && <p>Generando el enlace y solicitando el envío del correo…</p>}
        {estado === 'enviado' && <p>El servicio de correo aceptó la invitación. Si no aparece en la bandeja de entrada, revise spam o comparta el enlace alternativo.</p>}
        {estado === 'alternativo' && <p>El correo no pudo enviarse. Puede compartir el enlace para que el usuario elija su PIN.</p>}
        {estado === 'error' && <p>{motivo}</p>}
      </div>
      {enlace && <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-xs font-bold text-zinc-700">Enlace alternativo de activación</p>
        <input aria-label="Enlace de activación" readOnly value={enlace} onFocus={(e) => e.currentTarget.select()}
          className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 font-mono text-xs text-zinc-600" />
        <p className="mt-2 text-xs text-zinc-500">Válido por 48 horas. Se puede usar una sola vez.</p>
        <Button variant="secondary" className="mt-3 w-full" onClick={() => void copiar()}>
          {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}{copiado ? 'Enlace copiado' : 'Copiar enlace'}
        </Button>
        {errorCopia && <p role="alert" className="mt-2 text-xs text-brand-700">{errorCopia}</p>}
      </div>}
      {estado === 'confirmar' ? <div className="mt-6 flex gap-2"><Button variant="secondary" className="flex-1" onClick={onCerrar}>Cancelar</Button><Button className="flex-1" onClick={onConfirmar}>Enviar invitación</Button></div>
        : estado !== 'enviando' && <Button className="mt-6 w-full" onClick={onCerrar}>Entendido</Button>}
    </Modal>
  )
}
