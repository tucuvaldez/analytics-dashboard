import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber } from '../lib/format'
import type { ReportDashboardStats } from '../lib/types'

interface TooltipProps {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: ReportDashboardStats }>
}

function BarTooltip({ active, payload }: TooltipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-md dark:border-stone-700 dark:bg-stone-900">
      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{formatNumber(row.sum)}</p>
      <p className="text-stone-600 dark:text-stone-400">
        {row.name} · {row.dataPoints} puntos
      </p>
    </div>
  )
}

/** Sum of values per dashboard. One series, so no legend; the table beside it has every number. */
export default function ReportBars({ rows }: { rows: ReportDashboardStats[] }) {
  return (
    <div className="h-56 w-full" role="img" aria-label="Suma de valores por dashboard">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} axisLine={{ stroke: 'var(--chart-grid)' }} tickLine={false} />
          <YAxis
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => formatNumber(v)}
          />
          <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--chart-grid)', opacity: 0.5 }} />
          <Bar dataKey="sum" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
