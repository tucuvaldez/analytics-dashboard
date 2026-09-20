import type { DataPoint } from '../lib/types'

export const SERIES_VARS = ['--series-1', '--series-2', '--series-3', '--series-4'] as const
export const MAX_SERIES = SERIES_VARS.length

interface Row {
  day: string
  [key: string]: number | string | undefined
}

/**
 * Groups points into one series per label (colour follows the label's rank by frequency,
 * fixed order, never cycled) and one row per UTC day. Beyond 4 labels the rest are hidden
 * and reported, rather than inventing extra hues.
 */
export function buildSeries(points: DataPoint[]) {
  const counts = new Map<string, number>()
  for (const p of points) counts.set(p.label, (counts.get(p.label) ?? 0) + 1)
  // Keep the most-populated labels, then order them alphabetically so a label keeps its
  // colour as data is added (slot depends on the name, not on a shifting frequency rank).
  const labels = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_SERIES)
    .map(([label]) => label)
    .sort((a, b) => a.localeCompare(b))

  const byDay = new Map<string, Row>()
  for (const p of [...points].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    const idx = labels.indexOf(p.label)
    if (idx === -1) continue
    const day = p.timestamp.slice(0, 10)
    const row = byDay.get(day) ?? { day }
    const key = `s${idx}`
    row[key] = ((row[key] as number | undefined) ?? 0) + p.value
    byDay.set(day, row)
  }

  return { labels, rows: [...byDay.values()], hidden: counts.size - labels.length }
}
