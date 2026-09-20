import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import TimeSeriesChart from '../charts/TimeSeriesChart'
import DashboardForm from '../components/DashboardForm'
import { EmptyState, ErrorBanner, FieldError, Modal, Pagination, Spinner } from '../components/ui'
import * as api from '../lib/api'
import { formatDateTime, formatNumber } from '../lib/format'
import { useFetch } from '../lib/useFetch'

const CHART_POINTS = 100
const TABLE_PAGE_SIZE = 10

export default function DashboardDetailPage() {
  const { id = '' } = useParams()
  // `key` remounts the body when navigating between dashboards so no stale state leaks over.
  return <DashboardDetail key={id} id={id} />
}

function DashboardDetail({ id }: { id: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tablePage, setTablePage] = useState(1)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const dash = useFetch(`dash:${id}`, () => api.getDashboard(id))
  const chart = useFetch(`chart:${id}`, () => api.listDataPoints(id, { limit: CHART_POINTS, order: 'desc' }))
  const table = useFetch(`table:${id}:${tablePage}`, () => api.listDataPoints(id, { page: tablePage, limit: TABLE_PAGE_SIZE, order: 'desc' }))

  function reloadAll() {
    dash.reload()
    chart.reload()
    table.reload()
  }

  if (dash.error) {
    const notFound = dash.error instanceof api.ApiError && dash.error.status === 404
    return (
      <div className="space-y-4">
        <Link to="/" className="text-sm text-blue-700 hover:underline dark:text-blue-400">
          ← Volver
        </Link>
        {notFound ? <EmptyState title="Dashboard no encontrado">Puede que haya sido eliminado o sea privado.</EmptyState> : <ErrorBanner message={api.errorMessage(dash.error)} />}
      </div>
    )
  }
  if (!dash.data) return <Spinner />

  const d = dash.data.data
  const isOwner = d.userId === user?.id
  // API returns newest first; the chart wants chronological order.
  const points = [...(chart.data?.data ?? [])].reverse()
  const values = points.map((p) => p.value)
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null

  async function confirmDelete() {
    try {
      await api.deleteDashboard(id)
      navigate('/', { replace: true })
    } catch (err) {
      setActionError(api.errorMessage(err))
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-blue-700 hover:underline dark:text-blue-400">
          ← Dashboards
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
              {d.name}
              <span
                className={`badge ${d.isPublic ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'}`}
              >
                {d.isPublic ? 'Público' : 'Privado'}
              </span>
            </h1>
            {d.description && <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{d.description}</p>}
          </div>
          {isOwner && (
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setEditing(true)}>
                Editar
              </button>
              <button className="btn-danger" onClick={() => setDeleting(true)}>
                Eliminar
              </button>
            </div>
          )}
        </div>
      </div>

      <ErrorBanner message={actionError} />

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Puntos totales" value={formatNumber(d.dataPointsCount ?? 0)} />
        <Stat label={`Promedio (últimos ${Math.min(CHART_POINTS, values.length)})`} value={formatNumber(avg)} />
        <Stat label="Máximo" value={formatNumber(values.length ? Math.max(...values) : null)} />
        <Stat label="Último valor" value={formatNumber(points.length ? points[points.length - 1].value : null)} />
      </section>

      <section className={`card ${chart.loading && chart.data ? 'opacity-60' : ''}`}>
        <h2 className="mb-3 text-base font-semibold">Evolución</h2>
        {chart.error && <ErrorBanner message={api.errorMessage(chart.error)} />}
        {!chart.data && chart.loading && <Spinner />}
        {chart.data && points.length === 0 && (
          <EmptyState title="Este dashboard todavía no tiene datos">{isOwner && 'Agregá el primer dato con el formulario de abajo.'}</EmptyState>
        )}
        {points.length > 0 && <TimeSeriesChart points={points} />}
      </section>

      {isOwner && <AddDataPoint dashboardId={id} onAdded={() => { setTablePage(1); reloadAll() }} />}

      <section className={`card ${table.loading && table.data ? 'opacity-60' : ''}`}>
        <h2 className="mb-3 text-base font-semibold">Datos</h2>
        {table.error && <ErrorBanner message={api.errorMessage(table.error)} />}
        {table.data && table.data.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800">
                  <th className="th">Etiqueta</th>
                  <th className="th text-right">Valor</th>
                  <th className="th">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {table.data.data.map((p) => (
                  <tr key={p.id} className="border-b border-stone-100 last:border-0 dark:border-stone-800/60">
                    <td className="td">{p.label}</td>
                    <td className="td text-right tabular-nums">{formatNumber(p.value)}</td>
                    <td className="td text-stone-600 dark:text-stone-400">{formatDateTime(p.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {table.data && table.data.data.length === 0 && <p className="text-sm text-stone-600 dark:text-stone-400">Sin datos.</p>}
        <Pagination page={tablePage} totalPages={table.data?.meta?.totalPages ?? 1} onChange={setTablePage} />
      </section>

      {editing && (
        <DashboardForm
          initial={d}
          onClose={() => setEditing(false)}
          onSubmit={async (values) => {
            await api.updateDashboard(id, values)
            dash.reload()
          }}
        />
      )}

      {deleting && (
        <Modal title="Eliminar dashboard" onClose={() => setDeleting(false)}>
          <p className="mb-4 text-sm">
            ¿Eliminar <strong>{d.name}</strong>? Se borrarán también todos sus datos.
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setDeleting(false)}>
              Cancelar
            </button>
            <button className="btn-danger" onClick={confirmDelete}>
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card !p-4">
      <p className="text-xs text-stone-500 dark:text-stone-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function AddDataPoint({ dashboardId, onAdded }: { dashboardId: string; onAdded: () => void }) {
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [timestamp, setTimestamp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setErrors({})
    try {
      await api.addDataPoint(dashboardId, {
        label,
        value: Number(value),
        ...(timestamp && { timestamp: new Date(timestamp).toISOString() }),
      })
      setValue('')
      setTimestamp('')
      onAdded()
    } catch (err) {
      setError(api.errorMessage(err))
      setErrors(api.fieldErrors(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h2 className="mb-3 text-base font-semibold">Agregar dato</h2>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="dp-label" className="label">
            Etiqueta
          </label>
          <input id="dp-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} required placeholder="Ej: Ingresos" />
          <FieldError message={errors.label} />
        </div>
        <div>
          <label htmlFor="dp-value" className="label">
            Valor
          </label>
          <input id="dp-value" className="input" type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} required />
          <FieldError message={errors.value} />
        </div>
        <div>
          <label htmlFor="dp-ts" className="label">
            Fecha <span className="font-normal text-stone-500">(opcional)</span>
          </label>
          <input id="dp-ts" className="input" type="datetime-local" value={timestamp} onChange={(e) => setTimestamp(e.target.value)} />
          <FieldError message={errors.timestamp} />
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Agregando…' : 'Agregar'}
        </button>
      </form>
      <div className="mt-3">
        <ErrorBanner message={error} />
      </div>
    </section>
  )
}
