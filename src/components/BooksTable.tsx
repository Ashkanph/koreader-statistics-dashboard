import { useId, useMemo, useState, type ReactNode } from 'react'
import { formatDate, formatDuration, formatNumber, formatPercent } from '../lib/format.ts'
import { bookHref } from '../lib/router.ts'
import type { Book } from '../lib/types.ts'
import { ProgressBar } from './ProgressBar.tsx'

type SortValue = string | number | null

interface Column {
  key: string
  header: string
  numeric?: boolean
  sortValue: (book: Book) => SortValue
  render: (book: Book) => ReactNode
}

const dash = (
  <>
    <span aria-hidden="true">—</span>
    <span className="visually-hidden">Not available</span>
  </>
)

const COLUMNS: Column[] = [
  {
    key: 'title',
    header: 'Title',
    sortValue: (b) => b.title.toLocaleLowerCase(),
    render: (b) => (
      <>
        <a href={bookHref(b.id)} className="book-link">
          {b.title}
        </a>
        {b.finished && <span className="badge">Finished</span>}
      </>
    ),
  },
  {
    key: 'authors',
    header: 'Author(s)',
    sortValue: (b) => b.authors?.toLocaleLowerCase() ?? null,
    render: (b) => b.authors ?? dash,
  },
  {
    key: 'series',
    header: 'Series',
    sortValue: (b) => b.series?.toLocaleLowerCase() ?? null,
    render: (b) => b.series ?? dash,
  },
  {
    key: 'language',
    header: 'Language',
    sortValue: (b) => b.language?.toLocaleLowerCase() ?? null,
    render: (b) => b.language ?? dash,
  },
  {
    key: 'progress',
    header: 'Progress',
    numeric: true,
    sortValue: (b) => b.progress,
    render: (b) => (
      <span className="progress-cell">
        <ProgressBar value={b.progress} />
        {formatPercent(b.progress)}
      </span>
    ),
  },
  {
    key: 'pages',
    header: 'Pages read',
    numeric: true,
    sortValue: (b) => b.readPages,
    render: (b) => `${formatNumber(b.readPages)} / ${formatNumber(b.pages)}`,
  },
  {
    key: 'time',
    header: 'Reading time',
    numeric: true,
    sortValue: (b) => b.totalTime,
    render: (b) => formatDuration(b.totalTime),
  },
  {
    key: 'days',
    header: 'Days',
    numeric: true,
    sortValue: (b) => b.readingDays,
    render: (b) => formatNumber(b.readingDays),
  },
  {
    key: 'perPage',
    header: 'Time per page',
    numeric: true,
    sortValue: (b) => (b.readPages ? b.totalTime / b.readPages : null),
    render: (b) => (b.readPages ? formatDuration(b.totalTime / b.readPages) : dash),
  },
  {
    key: 'highlights',
    header: 'Highlights',
    numeric: true,
    sortValue: (b) => b.highlights,
    render: (b) => (b.highlights === null ? dash : formatNumber(b.highlights)),
  },
  {
    key: 'notes',
    header: 'Notes',
    numeric: true,
    sortValue: (b) => b.notes,
    render: (b) => (b.notes === null ? dash : formatNumber(b.notes)),
  },
  {
    key: 'firstRead',
    header: 'First read',
    numeric: true,
    sortValue: (b) => b.firstRead,
    render: (b) => (b.firstRead ? formatDate(b.firstRead) : dash),
  },
  {
    key: 'lastRead',
    header: 'Last read',
    numeric: true,
    sortValue: (b) => b.lastRead,
    render: (b) => (b.lastRead ? formatDate(b.lastRead) : dash),
  },
]

type Direction = 'ascending' | 'descending'

function compare(a: SortValue, b: SortValue): number {
  // Missing values always sort last, whatever the direction.
  if (a === null) return b === null ? 0 : 1
  if (b === null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

export function BooksTable({ books }: { books: Book[] }) {
  const [sortKey, setSortKey] = useState('lastRead')
  const [direction, setDirection] = useState<Direction>('descending')
  const [query, setQuery] = useState('')
  const searchId = useId()
  const countId = useId()

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    const filtered = q
      ? books.filter((b) =>
          [b.title, b.authors, b.series].some((v) => v?.toLocaleLowerCase().includes(q)),
        )
      : books
    const column = COLUMNS.find((c) => c.key === sortKey) ?? COLUMNS[0]
    const sign = direction === 'ascending' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const va = column.sortValue(a)
      const vb = column.sortValue(b)
      if (va === null || vb === null) return compare(va, vb)
      return sign * compare(va, vb)
    })
  }, [books, query, sortKey, direction])

  const sortBy = (column: Column) => {
    if (column.key === sortKey) {
      setDirection(direction === 'ascending' ? 'descending' : 'ascending')
    } else {
      setSortKey(column.key)
      // Numbers and dates are most useful largest/newest first; text A→Z.
      setDirection(column.numeric ? 'descending' : 'ascending')
    }
  }

  return (
    <section className="section" aria-labelledby="books-heading">
      <div className="section-header">
        <h2 id="books-heading">Books</h2>
        <div className="search">
          <label htmlFor={searchId}>Search books</label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, author or series"
            aria-describedby={countId}
          />
        </div>
      </div>
      <p id={countId} className="muted" aria-live="polite">
        {rows.length === books.length
          ? `${formatNumber(books.length)} books`
          : `${formatNumber(rows.length)} of ${formatNumber(books.length)} books`}
      </p>

      <div className="table-scroll card" tabIndex={0} role="region" aria-labelledby="books-heading">
        <table className="data-table books-table">
          <caption className="visually-hidden">
            Books with reading activity. Column headers are buttons that sort the table.
          </caption>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={column.numeric && column.key !== 'progress' ? 'num' : undefined}
                  aria-sort={column.key === sortKey ? direction : undefined}
                >
                  <button type="button" className="sort-button" onClick={() => sortBy(column)}>
                    {column.header}
                    <span className="sort-indicator" aria-hidden="true">
                      {column.key === sortKey ? (direction === 'ascending' ? '▲' : '▼') : ''}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((book) => (
              <tr key={book.id}>
                {COLUMNS.map((column, i) =>
                  i === 0 ? (
                    <th key={column.key} scope="row">
                      {column.render(book)}
                    </th>
                  ) : (
                    <td key={column.key} className={column.numeric ? 'num' : undefined}>
                      {column.render(book)}
                    </td>
                  ),
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="empty">
                  No books match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
