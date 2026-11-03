// Generates KOReader-style statistics databases for testing. The schema is copied from
// KOReader's statistics.koplugin/main.lua (DB_SCHEMA_VERSION 20221111).
//
// Usage: node fixtures.mjs <output-dir>
// Also importable: makeFixtures(dir) returns { dir, expected }.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import initSqlJs from 'sql.js'

const SCHEMA = `
CREATE TABLE book (
  id integer PRIMARY KEY autoincrement, title text, authors text, notes integer,
  last_open integer, highlights integer, pages integer, series text, language text,
  md5 text, total_read_time integer, total_read_pages integer);
CREATE UNIQUE INDEX book_title_authors_md5 ON book(title, authors, md5);
CREATE TABLE page_stat_data (
  id_book integer, page integer NOT NULL DEFAULT 0, start_time integer NOT NULL DEFAULT 0,
  duration integer NOT NULL DEFAULT 0, total_pages integer NOT NULL DEFAULT 0,
  UNIQUE (id_book, page, start_time), FOREIGN KEY(id_book) REFERENCES book(id));
CREATE INDEX page_stat_data_start_time ON page_stat_data(start_time);
CREATE TABLE numbers (number INTEGER PRIMARY KEY);
WITH RECURSIVE counter AS (SELECT 1 as N UNION ALL SELECT N + 1 FROM counter WHERE N < 1000)
  INSERT INTO numbers SELECT N AS number FROM counter;
CREATE VIEW page_stat AS
  SELECT id_book, first_page + idx - 1 AS page, start_time, duration / (last_page - first_page + 1) AS duration
  FROM (
    SELECT id_book, page, total_pages, pages, start_time, duration,
      ((page - 1) * pages) / total_pages + 1 AS first_page,
      max(((page - 1) * pages) / total_pages + 1, (page * pages) / total_pages) AS last_page,
      idx
    FROM page_stat_data
    JOIN book ON book.id = id_book
    JOIN (SELECT number as idx FROM numbers) AS N ON idx <= (last_page - first_page + 1)
  );
PRAGMA user_version=20221111;
`

// [title, authors, series, language, pages, share of pages to read, days ago started]
const BOOKS = [
  ['The library at mount Char', 'Scott Hawkins', 'N/A', 'en', 304, 1, 400],
  ['The zero stone', 'Andre Norton', 'Murdoc Jern #1', 'en', 183, 0.97, 300],
  ['The man who bridged the mist', 'Kij Johnson', 'N/A', 'en', 612, 0.76, 200],
  ['Hyperion', 'Dan Simmons', 'Hyperion Cantos #1', 'en', 256, 1, 150],
  // MuPDF used to leave a trailing NUL in PDF metadata; KOReader keeps such rows.
  ['KOReader Quickstart Guide', 'N/A', 'N/A', 'N/A', 40, 1, 90],
  ["Cat's craddle", 'Kurt Vonnegut Jr.', 'N/A', 'en', 220, 0.35, 60],
  // Read up to today, so the current streak is non-zero.
  ['A short stay in hell', 'Steven L. Peck', 'N/A', 'en', 105, 0.55, 25],
]

/** Small seeded PRNG so fixtures are identical on every run. */
function random(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** KOReader usually runs the DB in WAL mode; mark the file that way (header bytes 18 and 19). */
function asWal(bytes) {
  bytes[18] = 2
  bytes[19] = 2
  return bytes
}

function statisticsDb(SQL, { withEvents = true } = {}) {
  const db = new SQL.Database()
  db.exec(SCHEMA)
  const rand = random(42)
  const int = (min, max) => min + Math.floor(rand() * (max - min + 1))
  const now = new Date()

  BOOKS.forEach(([title, authors, series, language, pages, share, daysAgo], index) => {
    db.run('INSERT INTO book VALUES (NULL, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0, 0)', [
      title,
      authors,
      int(0, 5),
      int(0, 30),
      pages,
      series,
      language,
      Array.from({ length: 32 }, () => int(0, 15).toString(16)).join(''),
    ])
    if (!withEvents) return
    const id = index + 1
    const target = Math.round(pages * share)
    const isLast = index === BOOKS.length - 1
    let day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo)
    let page = 1
    while (page <= target) {
      const hour = [7, 8, 12, 21, 22, 23][int(0, 5)]
      let ts = Math.floor(
        new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, int(0, 59)).getTime() /
          1000,
      )
      // Never record reading in the future (sessions "today" may be scheduled after now).
      ts = Math.min(ts, Math.floor(now.getTime() / 1000) - 3 * 3600)
      // The last book gets one session a day, every day up to today.
      const sessionPages = isLast ? Math.max(1, Math.floor(target / (daysAgo + 1))) : int(5, 40)
      for (let i = 0; i < sessionPages && page <= target; i++) {
        const duration = int(20, 110)
        db.run('INSERT OR IGNORE INTO page_stat_data VALUES (?, ?, ?, ?, ?)', [
          id,
          page,
          ts,
          duration,
          pages,
        ])
        ts += duration
        page++
      }
      const gap = isLast ? 1 : [1, 1, 1, 2, 3, 7][int(0, 5)]
      day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + gap)
      if (day > now) day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    }
  })
  db.exec(
    'UPDATE book SET last_open = (SELECT max(start_time) FROM page_stat_data WHERE id_book = book.id)',
  )
  // A book that was opened but never read: the app must leave it out.
  db.run(
    "INSERT INTO book VALUES (NULL, 'Never read', 'Nobody', 0, 0, 0, 100, NULL, NULL, 'abc', 0, 0)",
  )
  return db
}

export async function makeFixtures(dir) {
  mkdirSync(dir, { recursive: true })
  const SQL = await initSqlJs()

  const db = statisticsDb(SQL)
  const expected = {
    books: Number(db.exec('SELECT count(DISTINCT id_book) FROM page_stat')[0].values[0][0]),
    pagesRead: Number(
      db.exec(
        'SELECT sum(n) FROM (SELECT count(DISTINCT page) n FROM page_stat GROUP BY id_book)',
      )[0].values[0][0],
    ),
    totalSeconds: Number(db.exec('SELECT sum(duration) FROM page_stat')[0].values[0][0]),
    // Same rule as the app (db.ts): more than 95% of pages read.
    finishedBooks: Number(
      db.exec(
        `SELECT count(*) FROM book JOIN (
           SELECT id_book, count(DISTINCT page) n FROM page_stat GROUP BY id_book
         ) s ON s.id_book = book.id WHERE pages > 0 AND 1.0 * n / pages > 0.95`,
      )[0].values[0][0],
    ),
  }
  writeFileSync(join(dir, 'statistics.sqlite3'), asWal(db.export()))
  db.close()

  const empty = statisticsDb(SQL, { withEvents: false })
  writeFileSync(join(dir, 'empty.sqlite3'), empty.export())
  empty.close()

  // Pre-20201010 schema: page_stat was a table and page_stat_data didn't exist.
  const old = new SQL.Database()
  old.exec(
    'CREATE TABLE book (id integer PRIMARY KEY, title text); CREATE TABLE page_stat (id_book integer, page integer, start_time integer, period integer);',
  )
  writeFileSync(join(dir, 'old-schema.sqlite3'), old.export())
  old.close()

  const other = new SQL.Database()
  other.exec('CREATE TABLE notes (id integer, body text)')
  writeFileSync(join(dir, 'other.sqlite3'), other.export())
  other.close()

  writeFileSync(join(dir, 'not-a-database.sqlite3'), 'definitely not sqlite\n')

  return { dir, expected }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2]
  if (!dir) {
    console.error('Usage: node fixtures.mjs <output-dir>')
    process.exit(1)
  }
  const { expected } = await makeFixtures(dir)
  console.log(`Fixtures written to ${dir}`, expected)
}
