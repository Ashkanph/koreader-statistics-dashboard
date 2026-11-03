/** One row of reading activity: time spent on a page, as recorded by KOReader. */
export interface ReadingEvent {
  bookId: number
  /** Unix timestamp (seconds) when the page was opened. */
  start: number
  /** Seconds spent on the page. */
  duration: number
}

export interface Book {
  id: number
  title: string
  authors: string | null
  series: string | null
  language: string | null
  /** Page count from the most recent time the book was opened. */
  pages: number
  /** Distinct pages read, rescaled to the current page count (same as KOReader). */
  readPages: number
  /** 0..1, readPages / pages, capped at 1. */
  progress: number
  finished: boolean
  highlights: number | null
  notes: number | null
  md5: string | null
  lastOpen: number | null
  /** Total seconds spent reading, including re-reads. */
  totalTime: number
  firstRead: number | null
  lastRead: number | null
  readingDays: number
}

export interface Library {
  fileName: string
  /** Books that have at least some reading activity. */
  books: Book[]
  /**
   * Per book: the time each distinct page was first read, sorted ascending. Its length is the
   * book's readPages.
   */
  firstReads: Map<number, number[]>
  /** All reading events, sorted by start time. */
  events: ReadingEvent[]
}
