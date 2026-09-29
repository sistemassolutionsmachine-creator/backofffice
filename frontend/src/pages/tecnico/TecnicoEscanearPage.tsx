import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, CameraOff, CheckCircle2, Keyboard, Zap } from 'lucide-react'
import { Button, Card, PageHeader } from '../../components/ui'
import { api } from '../../api/client'
import type { Equipo } from '../../types'

/* API BarcodeDetector (aún sin tipos en TS) */
interface QrDetectado {
  rawValue: string
}
interface DetectorQr {
  detect(video: HTMLVideoElement): Promise<QrDetectado[]>
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => DetectorQr

export function TecnicoEscanearPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const yaDetectado = useRef(false)
  const [detectado, setDetectado] = useState<string | null>(null)
  const [camaraLista, setCamaraLista] = useState(false)
  const [camaraError, setCamaraError] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [noEncontrado, setNoEncontrado] = useState(false)

  const abrirReporte = (eq: Equipo) => {
    if (yaDetectado.current) return
    yaDetectado.current = true
    setDetectado(eq.codigo)
    setTimeout(() => navigate(`/tecnico/reporte?equipo=${eq.id}`), 1000)
  }

  const onQrLeido = async (texto: string) => {
    // El QR codifica https://…/t/<codigo>; también acepta el código directo
    const match = texto.match(/\/t\/([\w-]+)/i)
    const cod = (match ? match[1] : texto).trim()
    try {
      const eq = await api.equipos.porCodigo(cod)
      abrirReporte(eq)
    } catch {
      setNoEncontrado(true)
    }
  }

  /* Activa la cámara trasera y, si el navegador lo soporta, lee el QR en vivo */
  useEffect(() => {
    let stream: MediaStream | undefined
    let intervalo: number | undefined
    let cancelado = false

    const iniciar = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelado || !videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
        setCamaraLista(true)

        const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
          .BarcodeDetector
        if (Detector) {
          const detector = new Detector({ formats: ['qr_code'] })
          intervalo = window.setInterval(async () => {
            const video = videoRef.current
            if (!video || video.readyState < 2 || yaDetectado.current) return
            try {
              const codigos = await detector.detect(video)
              if (codigos.length > 0) onQrLeido(codigos[0].rawValue)
            } catch {
              /* frame no legible, se reintenta */
            }
          }, 400)
        }
      } catch {
        if (!cancelado) setCamaraError(true)
      }
    }

    iniciar()
    return () => {
      cancelado = true
      if (intervalo) clearInterval(intervalo)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buscarCodigo = async () => {
    setNoEncontrado(false)
    try {
      const eq = await api.equipos.porCodigo(codigo.trim())
      navigate(`/tecnico/reporte?equipo=${eq.id}`)
    } catch {
      setNoEncontrado(true)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="Escanear código QR"
        subtitle="Apunte la cámara al QR del equipo para abrir su reporte de mantenimiento."
      />

      {/* Visor de cámara */}
      <Card className="overflow-hidden bg-ink-950 p-0">
        <div className="relative aspect-square sm:aspect-[4/3]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#2b2b33_0%,#0a0a0c_70%)]" />

          {/* Video en vivo de la cámara */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Marco de enfoque */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative size-56">
              <span className="absolute top-0 left-0 h-8 w-8 rounded-tl-lg border-t-4 border-l-4 border-brand-500" />
              <span className="absolute top-0 right-0 h-8 w-8 rounded-tr-lg border-t-4 border-r-4 border-brand-500" />
              <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-brand-500" />
              <span className="absolute right-0 bottom-0 h-8 w-8 rounded-br-lg border-r-4 border-b-4 border-brand-500" />
              {!detectado && camaraLista && (
                <span className="animate-scanline absolute inset-x-3 top-3 h-0.5 rounded-full bg-brand-500 shadow-[0_0_12px_2px_rgba(230,58,73,0.7)]" />
              )}
              {detectado && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-emerald-500/25 text-emerald-300 backdrop-blur-sm">
                  <CheckCircle2 className="size-12" />
                  <span className="text-sm font-bold">{detectado} detectado</span>
                </span>
              )}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-ink-950 to-transparent p-4">
            <p className="flex items-center gap-2 text-xs text-zinc-300">
              {camaraError ? (
                <>
                  <CameraOff className="size-4 text-brand-500" />
                  Sin acceso a la cámara. Permita el acceso o use el código manual.
                </>
              ) : camaraLista ? (
                <>
                  <Camera className="size-4 text-emerald-400" />
                  Cámara activa · apunte al QR del equipo
                </>
              ) : (
                <>
                  <Camera className="size-4" />
                  Activando cámara…
                </>
              )}
            </p>
            <button
              type="button"
              className="rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20"
              title="Linterna"
            >
              <Zap className="size-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Entrada manual */}
      <Card className="p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Keyboard className="size-4 text-zinc-500" />
          ¿QR ilegible? Ingrese el código manualmente
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value)
              setNoEncontrado(false)
            }}
            placeholder="Ej: SRV-001"
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 font-mono text-sm uppercase placeholder:font-sans placeholder:normal-case placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          />
          <Button variant="dark" onClick={() => void buscarCodigo()}>
            Buscar
          </Button>
        </div>
        {noEncontrado && (
          <p className="mt-2 text-xs font-semibold text-brand-700">
            No se encontró un equipo con ese código.
          </p>
        )}
      </Card>
    </div>
  )
}
