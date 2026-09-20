import { useState, type FormEvent } from 'react'
import { errorMessage, fieldErrors, type DashboardInput } from '../lib/api'
import type { Dashboard } from '../lib/types'
import { ErrorBanner, FieldError, Modal } from './ui'

interface Props {
  initial?: Dashboard
  onSubmit: (values: DashboardInput) => Promise<void>
  onClose: () => void
}

/** Create/edit dashboard dialog. */
export default function DashboardForm({ initial, onSubmit, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setErrors({})
    try {
      await onSubmit({ name, description: description.trim() ? description : null, isPublic })
      onClose()
    } catch (err) {
      setErrors(fieldErrors(err))
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={initial ? 'Editar dashboard' : 'Nuevo dashboard'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner message={error} />
        <div>
          <label htmlFor="dash-name" className="label">
            Nombre
          </label>
          <input id="dash-name" className="input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} required />
          <FieldError message={errors.name} />
        </div>
        <div>
          <label htmlFor="dash-desc" className="label">
            Descripción <span className="font-normal text-stone-500">(opcional)</span>
          </label>
          <textarea
            id="dash-desc"
            className="input"
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <FieldError message={errors.description} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          Público (visible para otros usuarios)
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
