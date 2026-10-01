import { Link } from 'react-router-dom'
import { useData } from '../store/DataContext'

export function ContratoSelect({ empresaId, value, onChange }: {
  empresaId: string
  value: string
  onChange: (id: string) => void
}) {
  const { contratos } = useData()
  const disponibles = contratos.filter((c) => c.empresaId === empresaId && c.estado === 'activo')
  return (
    <label className="block text-sm font-medium text-zinc-700">
      Contrato de ingreso
      <select required disabled={!empresaId} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm">
        <option value="">Seleccione un contrato…</option>
        {disponibles.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
      </select>
      {empresaId && disponibles.length === 0 && (
        <span className="mt-2 block text-xs text-zinc-500">
          Esta empresa necesita un contrato activo.{' '}
          <Link className="font-semibold text-brand-700" to={`/contratos?empresa=${empresaId}`}>Crear contrato</Link>
        </span>
      )}
    </label>
  )
}
