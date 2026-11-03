const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 })
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function formatNumber(n: number): string {
  return integer.format(n)
}

export function formatPercent(ratio: number): string {
  return percent.format(ratio)
}

/** Human-readable duration, e.g. "12h 5m", "4m 30s". */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds)
  if (s < 60) return `${s}s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h === 0) {
    const rest = s % 60
    return rest && m < 10 ? `${m}m ${rest}s` : `${m}m`
  }
  return m ? `${integer.format(h)}h ${m}m` : `${integer.format(h)}h`
}

/** Unix timestamp in seconds, or a Date. */
export function formatDate(value: number | Date): string {
  return dateFormat.format(typeof value === 'number' ? new Date(value * 1000) : value)
}
