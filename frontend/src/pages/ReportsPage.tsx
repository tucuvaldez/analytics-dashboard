import { useState, type FormEvent } from 'react'
import ReportBars from '../charts/ReportBars'
import { EmptyState, ErrorBanner, FieldError, Pagination, Spinner } from '../components/ui'
import * as api from '../lib/api'
import { formatDate, formatDateTime, formatNumber } from '../lib/format'
import { useFetch } from '../lib/useFetch'

const PAGE_SIZE = 8

export default function ReportsPage() {
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const reports = useFetch(`reports:${page}`, () => api.listReports({ page, limit: PAGE_SIZE }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>

      <GenerateReport
        onCreated={(id) => {
          setPage(1)
          setOpenId(id)
          reports.reload()
        }}
      />

      <section className={`card ${reports.loading && reports.data ? 'opacity-60' : ''}`}>
        <h2 className="mb-3 text-base font-semibold">Reportes generados</h2>
        {reports.error && <ErrorBanner message={api.errorMessage(reports.error)} />}
        {!reports.data && reports.loading && <Spinner />}
        {reports.data && reports.data.data.length === 0 && <EmptyState title="Todavía no generaste reportes" />}
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {reports.data?.data.map((r) => (
            <li key={r.id} className="py-3">
              <button
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={openId === r.id}
                onClick={() => setOpenId(openId === r.id ? null : r.id)}
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-stone-500 dark:text-stone-400">{formatDateTime(r.generatedAt)}</span>
              </button>
              {openId === r.id && <ReportDetail id={r.id} />}
            </li>
          ))}
        </ul>
        <Pagination page={page} totalPages={reports.data?.meta?.totalPages ?? 1} onChange={setPage} />
      </section>
    </div>
  )
}

function GenerateReport({ onCreated }: { onCreated: (id: string) => void }) {
  const dashboards = useFetch('dashboards:all', () => api.listDashboards({ scope: 'mine', limit: 100 }))
  const [name, setName] = useState('')
  const [dashboardId, setDashboardId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setErrors({})
    try {
      const res = await api.createReport({
        name,
        ...(dashboardId && { dashboardId }),
        // Date inputs give YYYY-MM-DD; make the range inclusive of the whole "to" day.
        ...(from && { from: new Date(`${from}T00:00:00`).toISOString() }),
        ...(to && { to: new Date(`${to}T23:59:59.999`).toISOString() }),
      })
      setName('')
      onCreated(res.data.id)
    } catch (err) {
      setError(api.errorMessage(err))
      setErrors(api.fieldErrors(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h2 className="mb-3 text-base font-semibold">Generar reporte</h2>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_1fr_auto] lg:items-end">
        <div>
          <label htmlFor="rep-name" className="label">
            Nombre
          </label>
          <input id="rep-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required />
          <FieldError message={errors.name} />
        </div>
        <div>
          <label htmlFor="rep-dash" className="label">
            Dashboard
          </label>
          <select id="rep-dash" className="input" value={dashboardId} onChange={(e) => setDashboardId(e.target.value)}>
            <option value="">Todos mis dashboards</option>
            {dashboards.data?.data.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rep-from" className="label">
            Desde
          </label>
          <input id="rep-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="rep-to" className="label">
            Hasta
          </label>
          <input id="rep-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          <FieldError message={errors.from} />
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Generando…' : 'Generar'}
        </button>
      </form>
      <div className="mt-3">
        <ErrorBanner message={error} />
      </div>
    </section>
  )
}

function ReportDetail({ id }: { id: string }) {
  const { data, error } = useFetch(`report:${id}`, () => api.getReport(id))
  if (error) return <div className="mt-3"><ErrorBanner message={api.errorMessage(error)} /></div>
  if (!data) return <Spinner />
  const report = data.data.data
  if (!report) return null

  const { period, summary, dashboards } = report
  return (
    <div className="mt-4 space-y-4" data-testid="report-detail">
      <p className="text-xs text-stone-500 dark:text-stone-400">
        Período: {period.from ? formatDate(period.from) : 'inicio'} – {period.to ? formatDate(period.to) : 'hoy'}
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-stone-100 p-3 dark:bg-stone-800">
          <p className="text-xs text-stone-500 dark:text-stone-400">Dashboards</p>
          <p className="text-xl font-semibold tabular-nums">{summary.dashboards}</p>
        </div>
        <div className="rounded-lg bg-stone-100 p-3 dark:bg-stone-800">
          <p className="text-xs text-stone-500 dark:text-stone-400">Puntos de datos</p>
          <p className="text-xl font-semibold tabular-nums">{formatNumber(summary.dataPoints)}</p>
        </div>
        <div className="rounded-lg bg-stone-100 p-3 dark:bg-stone-800">
          <p className="text-xs text-stone-500 dark:text-stone-400">Valor total</p>
          <p className="text-xl font-semibold tabular-nums">{formatNumber(summary.totalValue)}</p>
        </div>
      </div>
      {dashboards.length > 0 && <ReportBars rows={dashboards} />}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-200 dark:border-stone-800">
              <th className="th">Dashboard</th>
              <th className="th text-right">Puntos</th>
              <th className="th text-right">Suma</th>
              <th className="th text-right">Promedio</th>
              <th className="th text-right">Mín</th>
              <th className="th text-right">Máx</th>
            </tr>
          </thead>
          <tbody>
            {dashboards.map((d) => (
              <tr key={d.dashboardId} className="border-b border-stone-100 last:border-0 dark:border-stone-800/60">
                <td className="td">{d.name}</td>
                <td className="td text-right tabular-nums">{formatNumber(d.dataPoints)}</td>
                <td className="td text-right tabular-nums">{formatNumber(d.sum)}</td>
                <td className="td text-right tabular-nums">{formatNumber(d.avg)}</td>
                <td className="td text-right tabular-nums">{formatNumber(d.min)}</td>
                <td className="td text-right tabular-nums">{formatNumber(d.max)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
