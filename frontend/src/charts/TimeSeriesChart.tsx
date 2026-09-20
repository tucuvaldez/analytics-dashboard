import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatNumber } from '../lib/format'
import type { DataPoint } from '../lib/types'

import { buildSeries, MAX_SERIES, SERIES_VARS } from './series'

const dayFormat = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
const formatDay = (day: string) => dayFormat.format(new Date(`${day}T00:00:00Z`))

interface TooltipProps {
  active?: boolean
  label?: unknown
  payload?: ReadonlyArray<{ dataKey?: string | number; value?: unknown }>
  labels?: string[]
}

/** One tooltip listing every series at the hovered day: value first (strong), name second. */
function ChartTooltip({ active, label, payload, labels = [] }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-md dark:border-stone-700 dark:bg-stone-900">
      <p className="mb-1 text-stone-500 dark:text-stone-400">{formatDay(String(label))}</p>
      {payload.map((p) => {
        const idx = Number(String(p.dataKey).slice(1))
        return (
          <p key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-3" style={{ background: `var(${SERIES_VARS[idx]})` }} aria-hidden />
            <strong className="text-sm text-stone-900 dark:text-stone-100">{formatNumber(Number(p.value))}</strong>
            <span className="text-stone-600 dark:text-stone-400">{labels[idx]}</span>
          </p>
        )
      })}
    </div>
  )
}

export default function TimeSeriesChart({ points }: { points: DataPoint[] }) {
  const { labels, rows, hidden } = buildSeries(points)
  if (rows.length === 0) return null

  return (
    <figure aria-label="Gráfico de evolución de los datos">
      {labels.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-700 dark:text-stone-300">
          {labels.map((l, i) => (
            <li key={l} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ background: `var(${SERIES_VARS[i]})` }} aria-hidden />
              {l}
            </li>
          ))}
        </ul>
      )}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={formatDay}
              tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v: number) => formatNumber(v)}
            />
            <Tooltip content={<ChartTooltip labels={labels} />} cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} />
            {labels.map((l, i) => (
              <Line
                key={l}
                type="monotone"
                dataKey={`s${i}`}
                name={l}
                stroke={`var(${SERIES_VARS[i]})`}
                strokeWidth={2}
                dot={rows.length <= 30 ? { r: 4, strokeWidth: 2, stroke: 'var(--chart-surface)', fill: `var(${SERIES_VARS[i]})` } : false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--chart-surface)' }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {hidden > 0 && (
        <figcaption className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Mostrando las {MAX_SERIES} series con más datos; {hidden} más en la tabla.
        </figcaption>
      )}
    </figure>
  )
}
