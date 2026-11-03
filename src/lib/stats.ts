import {
  bucketKey,
  bucketStart,
  dayKey,
  daysBetween,
  nextBucket,
  parseDayKey,
  startOfDay,
  type Granularity,
} from './dates.ts'
import type { Book, ReadingEvent } from './types.ts'

export interface Summary {
  books: number
  finishedBooks: number
  totalTime: number
  readPages: number
  readingDays: number
  avgPerReadingDay: number
  avgPerPage: number
  longestStreak: number
  currentStreak: number
  bestDay: { date: Date; seconds: number } | null
  firstRead: number | null
  lastRead: number | null
  highlights: number
  notes: number
}

export function dailyTotals(events: ReadingEvent[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const e of events) {
    const key = dayKey(e.start)
    totals.set(key, (totals.get(key) ?? 0) + e.duration)
  }
  return totals
}

/** Longest run of consecutive reading days, and the run that ends today or yesterday. */
function streaks(dayKeys: string[]): { longest: number; current: number } {
  if (dayKeys.length === 0) return { longest: 0, current: 0 }
  const days = dayKeys.sort().map(parseDayKey)
  let longest = 1
  let run = 1
  for (let i = 1; i < days.length; i++) {
    run = daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
  }
  const sinceLast = daysBetween(days[days.length - 1], startOfDay(new Date()))
  return { longest, current: sinceLast <= 1 ? run : 0 }
}

export function summarize(books: Book[], events: ReadingEvent[]): Summary {
  const totals = dailyTotals(events)
  const totalTime = events.reduce((sum, e) => sum + e.duration, 0)
  const readPages = books.reduce((sum, b) => sum + b.readPages, 0)

  let bestDay: Summary['bestDay'] = null
  for (const [key, seconds] of totals) {
    if (!bestDay || seconds > bestDay.seconds) bestDay = { date: parseDayKey(key), seconds }
  }
  const { longest, current } = streaks([...totals.keys()])

  return {
    books: books.length,
    finishedBooks: books.filter((b) => b.finished).length,
    totalTime,
    readPages,
    readingDays: totals.size,
    avgPerReadingDay: totals.size ? totalTime / totals.size : 0,
    avgPerPage: readPages ? totalTime / readPages : 0,
    longestStreak: longest,
    currentStreak: current,
    bestDay,
    firstRead: events.length ? events[0].start : null,
    lastRead: events.length ? events[events.length - 1].start : null,
    highlights: books.reduce((sum, b) => sum + (b.highlights ?? 0), 0),
    notes: books.reduce((sum, b) => sum + (b.notes ?? 0), 0),
  }
}

export interface Bucket {
  key: string
  start: Date
  seconds: number
}

/** Picks a granularity that keeps the number of bars readable for the span of the data. */
export function autoGranularity(events: ReadingEvent[]): Granularity {
  if (events.length === 0) return 'day'
  const span = daysBetween(
    new Date(events[0].start * 1000),
    new Date(events[events.length - 1].start * 1000),
  )
  if (span <= 60) return 'day'
  if (span <= 730) return 'week'
  return 'month'
}

/** Reading time per day/week/month, including empty buckets between the first and last event. */
export function timeSeries(events: ReadingEvent[], granularity: Granularity): Bucket[] {
  if (events.length === 0) return []
  const totals = new Map<string, number>()
  for (const e of events) {
    const key = bucketKey(bucketStart(new Date(e.start * 1000), granularity))
    totals.set(key, (totals.get(key) ?? 0) + e.duration)
  }
  const buckets: Bucket[] = []
  const last = bucketStart(new Date(events[events.length - 1].start * 1000), granularity)
  for (
    let d = bucketStart(new Date(events[0].start * 1000), granularity);
    d <= last;
    d = nextBucket(d, granularity)
  ) {
    const key = bucketKey(d)
    buckets.push({ key, start: d, seconds: totals.get(key) ?? 0 })
  }
  return buckets
}

/** Reading time per hour of the day (index 0 = midnight). */
export function byHourOfDay(events: ReadingEvent[]): number[] {
  const hours = new Array<number>(24).fill(0)
  for (const e of events) hours[new Date(e.start * 1000).getHours()] += e.duration
  return hours
}

/** Reading time per weekday (index 0 = Monday). */
export function byWeekday(events: ReadingEvent[]): number[] {
  const days = new Array<number>(7).fill(0)
  for (const e of events) days[(new Date(e.start * 1000).getDay() + 6) % 7] += e.duration
  return days
}
