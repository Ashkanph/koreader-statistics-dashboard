// All bucketing uses the browser's local time zone, like KOReader's 'localtime' queries.

const pad = (n: number) => String(n).padStart(2, '0')

const DAY_MS = 86_400_000

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "YYYY-MM-DD" for a Unix timestamp in seconds. */
export function dayKey(ts: number): string {
  return keyOf(new Date(ts * 1000))
}

/** Local midnight of the given date. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Monday of the week containing the date, at local midnight. */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d)
  const offset = (day.getDay() + 6) % 7 // Monday = 0
  day.setDate(day.getDate() - offset)
  return day
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export type Granularity = 'day' | 'week' | 'month'

export function bucketStart(d: Date, granularity: Granularity): Date {
  if (granularity === 'day') return startOfDay(d)
  if (granularity === 'week') return startOfWeek(d)
  return startOfMonth(d)
}

export function nextBucket(d: Date, granularity: Granularity): Date {
  const next = new Date(d)
  if (granularity === 'day') next.setDate(next.getDate() + 1)
  else if (granularity === 'week') next.setDate(next.getDate() + 7)
  else next.setMonth(next.getMonth() + 1)
  return next
}

export function bucketKey(d: Date): string {
  return keyOf(d)
}

/** Whole calendar days between two local dates, ignoring DST shifts. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)
}

/** Parse a "YYYY-MM-DD" key back into a local date. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
