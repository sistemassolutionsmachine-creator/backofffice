import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileText, Plus, Upload } from 'lucide-react'
import { Button, Card, PageHeader, SearchInput, cx } from '../components/ui'
import { useData } from '../store/DataContext'
import { Selector } from '../components/Selector'
import { nombreVisible, type Contrato } from '../types'

const inputCls = 'mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm'

export function ContratosPage() {
  const [params, setParams] = useSearchParams()
  const { empresas, contratos, equipos, addContrato, updateContrato, updateEquipo, error: errorDatos } = useData()
  const empresaId = params.get('empresa') ?? ''
  const empresa = empresas.find((e) => e.id === empresaId)
  const lista = contratos.filter((c) => c.empresaId === empresaId)
  const pendientes = equipos.filter((e) => e.empresaId === empresaId && !e.contratoId)
  const [editando, setEditando] = useState<Contrato | null>(null)
  const [formulario, setFormulario] = useState(false)
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [inicio, setInicio] = useState(new Date().toISOString().slice(0, 10))
  const [fin, setFin] = useState('')
  const [estado, setEstado] = useState<Contrato['estado']>('activo')
  const [destino, setDestino] = useState('')
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const visibles = pendientes.filter((e) => `${e.codigo} ${nombreVisible(e)} ${e.ubicacion}`.toLowerCase().includes(query.toLowerCase()))

  const abrir = (c?: Contrato) => {
    setEditando(c ?? null)
    setNombre(c?.nombre ?? '')
    setCodigo(c?.codigo ?? '')
    setInicio(c?.fechaInicio ?? new Date().toISOString().slice(0, 10))
    setFin(c?.fechaFin ?? '')
    setEstado(c?.estado ?? 'activo')
    setFormulario(true)
    setError(null)
    setAviso('')
  }

  const guardar = async () => {
    if (ocupado || !empresaId || !nombre.trim() || !inicio) return
    setOcupado(true)
    setError(null)
    try {
      const datos = { empresaId, nombre: nombre.trim(), codigo, fechaInicio: inicio, fechaFin: fin || null, estado }
      if (editando) await updateContrato(editando.id, datos)
      else {
        const nuevo = await addContrato(datos)
        setDestino(nuevo.id)
      }
      setFormulario(false)
      setAviso(editando ? 'Contrato actualizado.' : 'Contrato creado. Ya puede registrar o asignar sus equipos.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el contrato')
    } finally { setOcupado(false) }
  }

  const asignar = async () => {
    if (ocupado || !destino || !seleccion.length) return
    setOcupado(true)
    setError(null)
    setAviso('')
    let completados = 0
    try {
      // Cada escritura confirmada actualiza la interfaz. Si falla, se puede
      // continuar con los pendientes sin repetir los equipos ya asignados.
      for (const id of seleccion) {
        await updateEquipo(id, { contratoId: destino })
        completados++
        setSeleccion((s) => s.filter((x) => x !== id))
        setAviso(`${completados} de ${seleccion.length} equipos asignados…`)
      }
      setAviso(`${completados} equipos asignados al contrato.`)
    } catch (e) {
      setError(`${completados} asignados. ${e instanceof Error ? e.message : 'No se pudo completar la asignación'}. Puede reintentar los pendientes.`)
    } finally { setOcupado(false) }
  }

  return (
    <div className="space-y-5">
      <Link to={empresaId ? `/equipos?empresa=${empresaId}` : '/equipos'} className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500">
        <ArrowLeft className="size-4" /> Volver a equipos
      </Link>
      <PageHeader title="Contratos" subtitle={empresa?.nombre ?? 'Organice el inventario por empresa y contrato de ingreso.'}
        actions={<Button disabled={!empresaId || ocupado} onClick={() => abrir()}><Plus className="size-4" /> Nuevo contrato</Button>} />
      <div className="block max-w-lg text-sm font-medium text-zinc-700">
        <span className="mb-1.5 block">Empresa</span>
        <Selector
          ariaLabel="Empresa"
          value={empresaId}
          disabled={ocupado}
          placeholder="Seleccione una empresa…"
          opciones={empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre }))}
          onChange={(v) => {
            setParams(v ? { empresa: v } : {})
            setFormulario(false); setDestino(''); setSeleccion([]); setQuery(''); setError(null); setAviso('')
          }}
        />
      </div>
      {(error || errorDatos) && <p role="alert" className="rounded-xl bg-brand-50 p-4 text-sm text-brand-700">{error || errorDatos}</p>}
      {aviso && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{aviso}</p>}

      {formulario && (
        <Card className="p-5">
          <form onSubmit={(e) => { e.preventDefault(); void guardar() }}>
            <h2 className="font-bold text-zinc-900">{editando ? 'Editar contrato' : 'Nuevo contrato'}</h2>
            <fieldset disabled={ocupado} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-zinc-700">Nombre<input required maxLength={200} className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Mantenimiento HVAC 2026" /></label>
              <label className="text-sm text-zinc-700">Código<input disabled={!!editando} maxLength={80} className={inputCls} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Automático si se deja vacío" /></label>
              <label className="text-sm text-zinc-700">Fecha de inicio<input required type="date" className={inputCls} value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
              <label className="text-sm text-zinc-700">Fecha de fin (opcional)<input type="date" min={inicio} className={inputCls} value={fin} onChange={(e) => setFin(e.target.value)} /></label>
              <div className="text-sm text-zinc-700">
                <span className="mb-1.5 block">Estado</span>
                <Selector
                  ariaLabel="Estado del contrato"
                  value={estado}
                  onChange={(v) => setEstado(v as Contrato['estado'])}
                  opciones={[
                    { valor: 'activo', etiqueta: 'Activo', punto: 'bg-emerald-500' },
                    { valor: 'finalizado', etiqueta: 'Finalizado', punto: 'bg-zinc-400' },
                  ]}
                />
              </div>
            </fieldset>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" disabled={ocupado} onClick={() => setFormulario(false)}>Cancelar</Button>
              <Button type="submit" disabled={ocupado || !nombre.trim()}>{ocupado ? 'Guardando…' : 'Guardar contrato'}</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((c) => {
          const cantidad = equipos.filter((e) => e.contratoId === c.id).length
          const enlace = `empresa=${empresaId}&contrato=${c.id}`
          return (
            <Card key={c.id} className="flex flex-col overflow-hidden">
              <div className={cx('h-1', c.estado === 'activo' ? 'bg-brand-600' : 'bg-zinc-300')} />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center justify-between gap-3"><FileText className="size-5 text-brand-600" /><span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold">{c.estado === 'activo' ? 'Activo' : 'Finalizado'}</span></div>
                <p className="mt-4 break-words font-mono text-xs text-zinc-500">{c.codigo}</p>
                <h2 className="mt-1 text-lg font-bold text-zinc-900">{c.nombre}</h2>
                <p className="mt-2 text-xs text-zinc-500">{c.fechaInicio} → {c.fechaFin ?? 'Sin fecha de fin'}</p>
                <Link to={`/equipos?${enlace}`} className="mt-5 text-sm font-bold text-brand-700">Ver {cantidad} equipos →</Link>
                <div className="mt-4 flex flex-wrap gap-3 border-t border-zinc-100 pt-4 text-xs font-semibold text-zinc-600">
                  {c.estado === 'activo' && <>
                    <Link to={`/equipos/nuevo?${enlace}`} className="inline-flex items-center gap-1"><Plus className="size-3.5" /> Registrar</Link>
                    <Link to={`/equipos/importar?${enlace}`} className="inline-flex items-center gap-1"><Upload className="size-3.5" /> Importar</Link>
                  </>}
                  <button type="button" disabled={ocupado} onClick={() => abrir(c)}>Editar contrato</button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
      {empresaId && lista.length === 0 && !formulario && <Card className="p-8 text-center text-sm text-zinc-500">Cree el primer contrato de esta empresa para organizar sus equipos.</Card>}

      {pendientes.length > 0 && (
        <Card className="p-5">
          <h2 className="font-bold text-zinc-900">Inventario pendiente de asignación</h2>
          <p className="mt-1 text-sm text-zinc-500">{pendientes.length} equipos anteriores a los contratos. Seleccione cuáles ingresaron juntos y asígnelos a su contrato real.</p>
          <fieldset disabled={ocupado} className="mt-4 space-y-4">
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar equipos pendientes…" />
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={visibles.length > 0 && visibles.every((e) => seleccion.includes(e.id))} onChange={(e) => setSeleccion(e.target.checked ? [...new Set([...seleccion, ...visibles.map((x) => x.id)])] : seleccion.filter((id) => !visibles.some((x) => x.id === id)))} /> Seleccionar los {visibles.length} resultados</label>
            <div className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200">
              {visibles.map((e) => <label key={e.id} className="flex cursor-pointer items-center gap-3 p-3 text-sm hover:bg-zinc-50"><input type="checkbox" checked={seleccion.includes(e.id)} onChange={(ev) => setSeleccion((s) => ev.target.checked ? [...s, e.id] : s.filter((id) => id !== e.id))} /><span className="min-w-0"><span className="block truncate font-semibold">{nombreVisible(e)}</span><span className="block truncate text-xs text-zinc-500">{e.codigo} · {e.ubicacion}</span></span></label>)}
            </div>
            <div className="block text-sm font-medium">
              <span className="mb-1.5 block">Contrato de destino</span>
              <Selector
                ariaLabel="Contrato de destino"
                value={destino}
                onChange={setDestino}
                disabled={ocupado}
                placeholder="Seleccione un contrato activo…"
                opciones={lista
                  .filter((c) => c.estado === 'activo')
                  .map((c) => ({ valor: c.id, etiqueta: `${c.codigo} · ${c.nombre}` }))}
              />
            </div>
            <Button disabled={ocupado || !destino || !seleccion.length} onClick={() => void asignar()}>{ocupado ? 'Asignando…' : `Asignar ${seleccion.length} equipos`}</Button>
          </fieldset>
        </Card>
      )}
    </div>
  )
}
