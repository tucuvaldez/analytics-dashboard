import { useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardForm from '../components/DashboardForm'
import { EmptyState, ErrorBanner, Modal, Pagination, Spinner } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import * as api from '../lib/api'
import { formatDate, formatNumber } from '../lib/format'
import type { Dashboard } from '../lib/types'
import { useFetch } from '../lib/useFetch'

type Scope = 'mine' | 'public'
const PAGE_SIZE = 9

export default function DashboardsPage() {
  const { user } = useAuth()
  const [scope, setScope] = useState<Scope>('mine')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Dashboard | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Dashboard | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, error, loading, reload } = useFetch(`dashboards:${scope}:${page}`, () =>
    api.listDashboards({ scope, page, limit: PAGE_SIZE }),
  )

  async function confirmDelete() {
    if (!deleting) return
    try {
      await api.deleteDashboard(deleting.id)
      setDeleting(null)
      // Went past the last page after deleting its only item: step back.
      if (data && data.data.length === 1 && page > 1) setPage(page - 1)
      else reload()
    } catch (err) {
      setActionError(api.errorMessage(err))
      setDeleting(null)
    }
  }

  const dashboards = data?.data ?? []

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboards</h1>
        <button className="btn-primary" onClick={() => setEditing('new')}>
          Nuevo dashboard
        </button>
      </div>

      <div className="mb-5 inline-flex rounded-lg border border-stone-300 p-0.5 dark:border-stone-700" role="tablist" aria-label="Filtro">
        {(['mine', 'public'] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={scope === s}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              scope === s ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900' : 'text-stone-600 dark:text-stone-400'
            }`}
            onClick={() => {
              setScope(s)
              setPage(1)
            }}
          >
            {s === 'mine' ? 'Mis dashboards' : 'Públicos'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <ErrorBanner message={actionError ?? (error ? api.errorMessage(error) : null)} />

        {!data && loading && <Spinner />}

        {data && dashboards.length === 0 && (
          <EmptyState title={scope === 'mine' ? 'Todavía no tenés dashboards' : 'No hay dashboards públicos'}>
            {scope === 'mine' && 'Creá el primero con el botón "Nuevo dashboard".'}
          </EmptyState>
        )}

        {dashboards.length > 0 && (
          <ul className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
            {dashboards.map((d) => {
              const isOwner = d.userId === user?.id
              return (
                <li key={d.id} className="card flex flex-col">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <Link to={`/dashboards/${d.id}`} className="text-base font-semibold hover:underline">
                      {d.name}
                    </Link>
                    <span
                      className={`badge shrink-0 ${
                        d.isPublic
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                      }`}
                    >
                      {d.isPublic ? 'Público' : 'Privado'}
                    </span>
                  </div>
                  <p className="mb-3 line-clamp-2 min-h-10 text-sm text-stone-600 dark:text-stone-400">
                    {d.description ?? 'Sin descripción'}
                  </p>
                  <div className="mt-auto flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                    <span>
                      {formatNumber(d._count?.dataPoints ?? 0)} puntos · {formatDate(d.createdAt)}
                    </span>
                    {isOwner && (
                      <span className="flex gap-2">
                        <button className="font-medium text-blue-700 hover:underline dark:text-blue-400" onClick={() => setEditing(d)} aria-label={`Editar ${d.name}`}>
                          Editar
                        </button>
                        <button className="font-medium text-red-700 hover:underline dark:text-red-400" onClick={() => setDeleting(d)} aria-label={`Eliminar ${d.name}`}>
                          Eliminar
                        </button>
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <Pagination page={page} totalPages={data?.meta?.totalPages ?? 1} onChange={setPage} />
      </div>

      {editing && (
        <DashboardForm
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            if (editing === 'new') await api.createDashboard(values)
            else await api.updateDashboard(editing.id, values)
            setActionError(null)
            if (editing === 'new' && scope !== 'mine') setScope('mine')
            reload()
          }}
        />
      )}

      {deleting && (
        <Modal title="Eliminar dashboard" onClose={() => setDeleting(null)}>
          <p className="mb-4 text-sm">
            ¿Eliminar <strong>{deleting.name}</strong>? Se borrarán también todos sus datos. Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setDeleting(null)}>
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
