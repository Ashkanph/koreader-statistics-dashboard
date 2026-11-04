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

export interface ProgressPoint {
  /** Calendar days since the book was first opened: 0 = before reading, 1 = end of the first day. */
  day: number
  /** 0..100 */
  progress: number
}

export interface ProgressCurve {
  bookId: number
  title: string
  points: ProgressPoint[]
  /** Days until the last new page was read. */
  daysToFinish: number
  /** Day on which the book first reached 50% (null if it never did). */
  daysToHalf: number | null
  finalProgress: number
}

/**
 * Progress over time for each finished book: cumulative distinct pages read at the end of each
 * reading day. A curve ends on the day its last new page was read, so later re-reading doesn't
 * stretch it.
 */
export function progressCurves(books: Book[], firstReads: Map<number, number[]>): ProgressCurve[] {
  const curves: ProgressCurve[] = []
  for (const book of books) {
    const times = firstReads.get(book.id)
    if (!book.finished || !times?.length || book.pages <= 0) continue
    const start = startOfDay(new Date(times[0] * 1000))
    const points: ProgressPoint[] = [{ day: 0, progress: 0 }]
    let read = 0
    for (const ts of times) {
      read++
      const day = daysBetween(start, new Date(ts * 1000)) + 1
      const progress = Math.min((read / book.pages) * 100, 100)
      const last = points[points.length - 1]
      if (last.day === day) {
        last.progress = progress
        continue
      }
      // Stay flat through days without reading, so breaks show as breaks rather than as a
      // slow slope: the day before reading resumes still has the previous progress.
      if (day - 1 > last.day) points.push({ day: day - 1, progress: last.progress })
      points.push({ day, progress })
    }
    const last = points[points.length - 1]
    curves.push({
      bookId: book.id,
      title: book.title,
      points,
      daysToFinish: last.day,
      daysToHalf: points.find((p) => p.progress >= 50)?.day ?? null,
      finalProgress: last.progress,
    })
  }
  return curves.sort((a, b) => a.daysToFinish - b.daysToFinish || a.title.localeCompare(b.title))
}

export interface BookSpan {
  bookId: number
  title: string
  /** Local midnight of the first and last day with reading activity. */
  start: Date
  end: Date
  /** Calendar days from the first to the last reading day, both included. */
  days: number
  /** Days with reading activity, as offsets from `start` (0 = the first day), ascending. */
  readingDays: number[]
  seconds: number
}

/** First and last reading day of each book, sorted by when reading started. */
export function bookSpans(books: Book[], events: ReadingEvent[]): BookSpan[] {
  const dayKeys = new Map<number, Set<string>>()
  const seconds = new Map<number, number>()
  for (const e of events) {
    let keys = dayKeys.get(e.bookId)
    if (!keys) dayKeys.set(e.bookId, (keys = new Set()))
    keys.add(dayKey(e.start))
    seconds.set(e.bookId, (seconds.get(e.bookId) ?? 0) + e.duration)
  }
  const spans: BookSpan[] = []
  for (const book of books) {
    const keys = dayKeys.get(book.id)
    if (!keys?.size) continue
    const days = [...keys].sort().map(parseDayKey)
    const start = days[0]
    const end = days[days.length - 1]
    spans.push({
      bookId: book.id,
      title: book.title,
      start,
      end,
      days: daysBetween(start, end) + 1,
      readingDays: days.map((d) => daysBetween(start, d)),
      seconds: seconds.get(book.id) ?? 0,
    })
  }
  return spans.sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title),
  )
}
