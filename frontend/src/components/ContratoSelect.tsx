import { Link } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { Selector } from './Selector'

export function ContratoSelect({ empresaId, value, onChange }: {
  empresaId: string
  value: string
  onChange: (id: string) => void
}) {
  const { contratos } = useData()
  const disponibles = contratos.filter((c) => c.empresaId === empresaId && c.estado === 'activo')
  return (
    <div className="block text-sm font-medium text-zinc-700">
      <span className="mb-1.5 block">Contrato de ingreso (opcional)</span>
      <Selector
        ariaLabel="Contrato de ingreso"
        disabled={!empresaId}
        value={value}
        onChange={onChange}
        placeholder={empresaId ? 'Sin contrato por ahora' : 'Elija primero la empresa'}
        opciones={[
          { valor: '', etiqueta: 'Sin contrato por ahora' },
          ...disponibles.map((c) => ({ valor: c.id, etiqueta: `${c.codigo} · ${c.nombre}` })),
        ]}
      />
      {empresaId && disponibles.length === 0 && (
        <span className="mt-2 block text-xs font-normal text-zinc-500">
          Esta empresa no tiene contratos activos. Puede continuar sin contrato o{' '}
          <Link className="font-semibold text-brand-700" to={`/contratos?empresa=${empresaId}`}>crear uno</Link>.
        </span>
      )}
    </div>
  )
}
