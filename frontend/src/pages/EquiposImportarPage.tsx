import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react'
import { Button, Card, PageHeader, cx } from '../components/ui'
import { useData } from '../store/DataContext'
import { ContratoSelect } from '../components/ContratoSelect'
import { Selector } from '../components/Selector'
import { api, type ResultadoImportacion } from '../api/client'
import {
  COLUMNAS,
  descargarPlantilla,
  leerArchivoEquipos,
  type LecturaArchivo,
} from '../utils/plantillaEquipos'
import { nombreVisible } from '../types'

export function EquiposImportarPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { empresas, recargar } = useData()
  const inputRef = useRef<HTMLInputElement>(null)

  const [empresaId, setEmpresaId] = useState(params.get('empresa') ?? '')
  const [contratoId, setContratoId] = useState(params.get('contrato') ?? '')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [lectura, setLectura] = useState<LecturaArchivo | null>(null)
  const [actualizarExistentes, setActualizarExistentes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)

  const empresa = empresas.find((e) => e.id === empresaId)

  const elegirArchivo = async (f: File | null) => {
    setError(null)
    setLectura(null)
    setResultado(null)
    setArchivo(f)
    if (!f) return

    try {
      const leido = await leerArchivoEquipos(f)
      if (leido.faltantes.length > 0) {
        throw new Error(
          `Al archivo le faltan columnas obligatorias: ${leido.faltantes.join(', ')}`,
        )
      }
      if (leido.filas.length === 0) {
        throw new Error('No se encontraron equipos en el archivo')
      }
      setLectura(leido)
    } catch (e) {
      setArchivo(null)
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo')
    }
  }

  const importar = async () => {
    if (!lectura || !empresaId || !contratoId || cargando) return
    setCargando(true)
    setError(null)
    try {
      const r = await api.equipos.importar(
        empresaId,
        lectura.filas.map((f) => f.datos),
        actualizarExistentes,
        contratoId,
      )
      setResultado(r)
      await recargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la carga')
    } finally {
      setCargando(false)
    }
  }

  /* ---------- Resumen final ---------- */
  if (resultado) {
    const conProblemas = resultado.errores + resultado.omitidos
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Card className="p-6 text-center sm:p-8">
          <span
            className={cx(
              'mx-auto flex size-14 items-center justify-center rounded-full',
              conProblemas === 0
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-amber-50 text-amber-600',
            )}
          >
            {conProblemas === 0 ? (
              <CheckCircle2 className="size-8" />
            ) : (
              <AlertTriangle className="size-8" />
            )}
          </span>
          <h1 className="mt-4 text-xl font-bold text-zinc-900">Carga finalizada</h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            {resultado.empresa} · {resultado.total} filas procesadas
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { n: resultado.creados, t: 'Creados', c: 'text-emerald-600' },
              { n: resultado.actualizados, t: 'Actualizados', c: 'text-sky-600' },
              { n: resultado.omitidos, t: 'Omitidos', c: 'text-amber-600' },
              { n: resultado.errores, t: 'Con error', c: 'text-brand-600' },
            ].map((x) => (
              <div key={x.t} className="rounded-xl bg-zinc-50 p-3">
                <p className={cx('text-2xl font-bold tabular-nums', x.c)}>{x.n}</p>
                <p className="text-xs text-zinc-500">{x.t}</p>
              </div>
            ))}
          </div>

          {resultado.detalle.length > 0 && (
            <div className="mt-6 text-left">
              <p className="text-sm font-bold text-zinc-900">Filas que requieren atención</p>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-zinc-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-zinc-50 text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Fila</th>
                      <th className="px-3 py-2 font-semibold">Código</th>
                      <th className="px-3 py-2 font-semibold">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {resultado.detalle.map((d) => (
                      <tr key={`${d.fila}-${d.codigo}`}>
                        <td className="px-3 py-2 tabular-nums text-zinc-500">{d.fila}</td>
                        <td className="px-3 py-2 font-mono text-zinc-700">
                          {d.codigo || '—'}
                        </td>
                        <td className="px-3 py-2 text-zinc-600">{d.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="secondary"
              onClick={() => {
                setResultado(null)
                setArchivo(null)
                setLectura(null)
              }}
            >
              Cargar otro archivo
            </Button>
            <Button onClick={() => navigate(`/equipos?empresa=${empresaId}`)}>
              Ver los equipos
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  /* ---------- Formulario ---------- */
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        to="/equipos"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        Equipos
      </Link>

      <PageHeader
        title="Importar equipos"
        subtitle="Cargue el cuadro de equipos desde una hoja de cálculo o un archivo CSV"
      />

      {/* Paso 1: plantilla */}
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <FileSpreadsheet className="size-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-zinc-900">¿Primera vez?</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Descargue la plantilla con las columnas correctas, las instrucciones
              y una fila de ejemplo.
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          className="shrink-0"
          onClick={() => void descargarPlantilla()}
        >
          <Download className="size-4" />
          Descargar plantilla
        </Button>
      </Card>

      {/* Paso 2: empresa */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-ink-950 text-[11px] font-bold text-white">
            1
          </span>
          <h2 className="text-sm font-bold text-zinc-900">Empresa de destino</h2>
        </div>
        <p className="mt-1 ml-8 text-xs text-zinc-500">
          Todos los equipos del archivo quedarán asignados a esta empresa. Por eso
          la plantilla no incluye una columna de empresa.
        </p>
        <Selector
          className="mt-3"
          ariaLabel="Empresa de destino"
          value={empresaId}
          onChange={(v) => { setEmpresaId(v); setContratoId('') }}
          placeholder="Seleccione una empresa…"
          opciones={empresas.map((em) => ({ valor: em.id, etiqueta: em.nombre }))}
        />
        <div className="mt-4"><ContratoSelect empresaId={empresaId} value={contratoId} onChange={setContratoId} /></div>
      </Card>

      {/* Paso 3: archivo */}
      <Card className={cx('p-4 sm:p-5', !empresaId && 'pointer-events-none opacity-40')}>
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-ink-950 text-[11px] font-bold text-white">
            2
          </span>
          <h2 className="text-sm font-bold text-zinc-900">Archivo de equipos</h2>
        </div>
        <p className="mt-1 ml-8 text-xs text-zinc-500">
          Acepta Excel (.xlsx, .xls) y CSV. Se reconocen las columnas aunque estén
          en otro orden.
        </p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-4 py-8 text-zinc-500 transition-colors hover:border-brand-400 hover:text-brand-600"
        >
          <Upload className="size-6" />
          <span className="text-sm font-semibold">
            {archivo ? archivo.name : 'Elegir archivo'}
          </span>
          {archivo && (
            <span className="text-xs text-zinc-400">Toque para cambiarlo</span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            void elegirArchivo(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
      </Card>

      {error && (
        <Card className="border-brand-200 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-brand-700">{error}</p>
        </Card>
      )}

      {/* Paso 4: revisión previa */}
      {lectura && empresa && (
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-ink-950 text-[11px] font-bold text-white">
              3
            </span>
            <h2 className="text-sm font-bold text-zinc-900">Revisión previa</h2>
          </div>
          <p className="mt-1 ml-8 text-xs text-zinc-500">
            Se cargarán <span className="font-bold text-zinc-900">{lectura.filas.length}</span>{' '}
            equipos en <span className="font-bold text-zinc-900">{empresa.nombre}</span>.
          </p>

          {lectura.columnasIgnoradas.length > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Se ignorarán estas columnas del archivo porque no corresponden a
              ningún campo: {lectura.columnasIgnoradas.join(', ')}
            </p>
          )}

          {/* Muestra de las primeras filas */}
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">QR</th>
                  <th className="px-3 py-2 font-semibold">Equipo</th>
                  <th className="px-3 py-2 font-semibold">Ubicación</th>
                  <th className="px-3 py-2 font-semibold">Marca</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {lectura.filas.slice(0, 5).map((f) => (
                  <tr key={f.fila}>
                    <td className="px-3 py-2 font-mono font-semibold text-zinc-900">
                      {f.datos.codigo || '—'}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {nombreVisible({
                        nombre: f.datos.nombre ?? '',
                        tipo: f.datos.tipo ?? '',
                      }) || '—'}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {f.datos.ubicacion || '—'}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">{f.datos.marca || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lectura.filas.length > 5 && (
            <p className="mt-2 text-center text-xs text-zinc-400">
              y {lectura.filas.length - 5} equipos más
            </p>
          )}

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl bg-zinc-50 p-3">
            <input
              type="checkbox"
              checked={actualizarExistentes}
              onChange={(e) => setActualizarExistentes(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-zinc-300 accent-brand-600"
            />
            <span className="text-xs text-zinc-600">
              <span className="font-semibold text-zinc-900">
                Actualizar los equipos que ya existan
              </span>
              <br />
              Si un código QR ya está registrado, se actualizan sus datos
              conservando su contrato original e historial de revisiones. Sin marcar, esas filas se
              omiten.
            </span>
          </label>

          {!contratoId && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <span className="font-semibold">
                  Falta el contrato de ingreso (paso 1).
                </span>{' '}
                Todos los equipos del archivo quedan demarcados bajo ese contrato.{' '}
                <Link
                  to={`/contratos?empresa=${empresaId}`}
                  className="font-semibold text-brand-700 underline-offset-2 hover:underline"
                >
                  Crear un contrato para {empresa.nombre}
                </Link>{' '}
                si aún no tiene uno activo.
              </span>
            </p>
          )}

          <Button
            className="mt-4 w-full py-3"
            disabled={cargando || !contratoId}
            onClick={() => void importar()}
          >
            <Upload className="size-4" />
            {cargando
              ? 'Cargando…'
              : !contratoId
                ? 'Elija el contrato de ingreso para importar'
                : `Importar ${lectura.filas.length} equipos a ${empresa.nombre}`}
          </Button>
        </Card>
      )}

      {/* Referencia de columnas */}
      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-bold text-zinc-900">Columnas de la plantilla</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 pr-4 font-semibold">Columna</th>
                <th className="py-2 pr-4 font-semibold">Obligatorio</th>
                <th className="py-2 font-semibold">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {COLUMNAS.map((c) => (
                <tr key={c.campo}>
                  <td className="py-2 pr-4 font-mono font-semibold text-zinc-900">
                    {c.titulo}
                  </td>
                  <td className="py-2 pr-4">
                    {c.obligatorio ? (
                      <span className="font-semibold text-brand-600">Sí</span>
                    ) : (
                      <span className="text-zinc-400">Opcional</span>
                    )}
                  </td>
                  <td className="py-2 text-zinc-600">{c.ayuda}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
