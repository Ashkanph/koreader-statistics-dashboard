import type { Database, SqlValue } from 'sql.js'
import { dayKey } from './dates.ts'
import type { Book, Library, ReadingEvent } from './types.ts'

/** A problem with the selected file, with a message that can be shown to the user. */
export class DatabaseError extends Error {}

const SQLITE_HEADER = 'SQLite format 3\u0000'

async function openDatabase(bytes: Uint8Array): Promise<Database> {
  // Loaded lazily so the ~1 MB WebAssembly module isn't part of the initial bundle.
  const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm-browser.wasm?url'),
  ])
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  return new SQL.Database(bytes)
}

function rows(db: Database, sql: string): SqlValue[][] {
  return db.exec(sql)[0]?.values ?? []
}

/** KOReader stores "N/A" for unknown metadata. */
function text(value: SqlValue): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).replace(/\0/g, '').trim()
  return s === '' || s === 'N/A' ? null : s
}

function num(value: SqlValue): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function loadLibrary(file: File): Promise<Library> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  const header = new TextDecoder('ascii').decode(bytes.subarray(0, 16))
  if (header !== SQLITE_HEADER) {
    throw new DatabaseError(
      'This file is not an SQLite database. Choose the statistics.sqlite3 file from your KOReader settings folder.',
    )
  }
  // KOReader usually puts the database in WAL mode. sql.js can't use WAL, so mark the
  // in-memory copy as a rollback-journal database (header bytes 18 and 19).
  bytes[18] = 1
  bytes[19] = 1

  let db: Database
  try {
    db = await openDatabase(bytes)
  } catch {
    throw new DatabaseError('The database could not be opened. The file may be damaged.')
  }

  try {
    return readLibrary(db, file.name)
  } catch (error) {
    if (error instanceof DatabaseError) throw error
    throw new DatabaseError(
      'The database could be opened, but its contents could not be read. The file may be damaged or come from an unsupported KOReader version.',
    )
  } finally {
    db.close()
  }
}

function readLibrary(db: Database, fileName: string): Library {
  const objects = new Set(
    rows(db, "SELECT name FROM sqlite_master WHERE type IN ('table', 'view')").map((r) =>
      String(r[0]),
    ),
  )
  if (!objects.has('book')) {
    throw new DatabaseError(
      "This SQLite file doesn't contain KOReader reading statistics. Choose the statistics.sqlite3 file from your KOReader settings folder.",
    )
  }
  if (!objects.has('page_stat_data') || !objects.has('page_stat')) {
    throw new DatabaseError(
      'This statistics database uses an old format. Open KOReader once with a recent version so it can upgrade the database, then try again.',
    )
  }

  // page_stat is KOReader's view that rescales page numbers to each book's current page
  // count. Using it keeps durations and distinct page counts identical to what KOReader shows.
  const events: ReadingEvent[] = rows(
    db,
    `SELECT id_book, start_time, sum(duration)
     FROM page_stat
     GROUP BY id_book, start_time
     HAVING sum(duration) > 0
     ORDER BY start_time`,
  ).map(([bookId, start, duration]) => ({
    bookId: Number(bookId),
    start: Number(start),
    duration: Number(duration),
  }))

  const readPagesByBook = new Map(
    rows(db, 'SELECT id_book, count(DISTINCT page) FROM page_stat GROUP BY id_book').map((r) => [
      Number(r[0]),
      Number(r[1]),
    ]),
  )

  const activity = new Map<
    number,
    { totalTime: number; firstRead: number; lastRead: number; days: Set<string> }
  >()
  for (const e of events) {
    let a = activity.get(e.bookId)
    if (!a) {
      a = { totalTime: 0, firstRead: e.start, lastRead: e.start, days: new Set() }
      activity.set(e.bookId, a)
    }
    a.totalTime += e.duration
    a.lastRead = e.start
    a.days.add(dayKey(e.start))
  }

  const books: Book[] = []
  for (const r of rows(
    db,
    `SELECT id, title, authors, series, language, pages, highlights, notes, md5, last_open
     FROM book`,
  )) {
    const id = Number(r[0])
    const a = activity.get(id)
    if (!a) continue
    const pages = num(r[5]) ?? 0
    const readPages = readPagesByBook.get(id) ?? 0
    books.push({
      id,
      title: text(r[1]) ?? 'Untitled',
      authors: text(r[2]),
      series: text(r[3]),
      language: text(r[4]),
      pages,
      readPages,
      progress: pages > 0 ? Math.min(readPages / pages, 1) : 0,
      finished: pages > 0 && readPages >= pages,
      highlights: num(r[6]),
      notes: num(r[7]),
      md5: text(r[8]),
      lastOpen: num(r[9]),
      totalTime: a.totalTime,
      firstRead: a.firstRead,
      lastRead: a.lastRead,
      readingDays: a.days.size,
    })
  }

  if (books.length === 0) {
    throw new DatabaseError(
      'This statistics database is valid but contains no reading activity yet.',
    )
  }

  return { fileName, books, events }
}
