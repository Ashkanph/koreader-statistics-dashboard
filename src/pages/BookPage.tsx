import { useMemo } from 'react'
import { ProgressBar } from '../components/ProgressBar.tsx'
import { ReadingCharts } from '../components/ReadingCharts.tsx'
import { StatTiles, type Stat } from '../components/StatTiles.tsx'
import { useFocusOnMount } from '../lib/focus.ts'
import { formatDate, formatDuration, formatNumber, formatPercent } from '../lib/format.ts'
import { dashboardHref } from '../lib/router.ts'
import { summarize } from '../lib/stats.ts'
import type { Book, Library } from '../lib/types.ts'

function days(n: number): string {
  return `${formatNumber(n)} ${n === 1 ? 'day' : 'days'}`
}

function BackLink() {
  return (
    <a href={dashboardHref} className="back-link">
      <span aria-hidden="true">←</span> All books
    </a>
  )
}

export function BookPage({ library, bookId }: { library: Library; bookId: number }) {
  const book = library.books.find((b) => b.id === bookId)
  return book ? <BookDetails key={book.id} library={library} book={book} /> : <BookNotFound />
}

function BookNotFound() {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  return (
    <>
      <BackLink />
      <h1 ref={headingRef} tabIndex={-1}>
        Book not found
      </h1>
      <p>This book isn't in the loaded statistics database, or has no reading activity.</p>
    </>
  )
}

function BookDetails({ library, book }: { library: Library; book: Book }) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const events = useMemo(
    () => library.events.filter((e) => e.bookId === book.id),
    [library, book.id],
  )
  const summary = useMemo(() => summarize([book], events), [book, events])

  const perPage = book.readPages ? book.totalTime / book.readPages : 0
  const pagesLeft = Math.max(book.pages - book.readPages, 0)

  const stats: Stat[] = [
    {
      label: 'Progress',
      value: formatPercent(book.progress),
      detail: <ProgressBar value={book.progress} />,
    },
    {
      label: 'Pages read',
      value: formatNumber(book.readPages),
      detail: `of ${formatNumber(book.pages)} pages`,
    },
    { label: 'Total reading time', value: formatDuration(book.totalTime) },
    {
      label: 'Estimated time left',
      value: book.finished ? 'Finished' : perPage ? formatDuration(pagesLeft * perPage) : '—',
      detail: book.finished ? undefined : `${formatNumber(pagesLeft)} pages to go`,
    },
    { label: 'Reading days', value: formatNumber(book.readingDays) },
    { label: 'Average per reading day', value: formatDuration(summary.avgPerReadingDay) },
    { label: 'Average time per page', value: perPage ? formatDuration(perPage) : '—' },
    {
      label: 'Most reading in a day',
      value: summary.bestDay ? formatDuration(summary.bestDay.seconds) : '—',
      detail: summary.bestDay ? formatDate(summary.bestDay.date) : undefined,
    },
    { label: 'Longest streak', value: days(summary.longestStreak) },
    { label: 'First read', value: book.firstRead ? formatDate(book.firstRead) : '—' },
    { label: 'Last read', value: book.lastRead ? formatDate(book.lastRead) : '—' },
    { label: 'Highlights', value: book.highlights === null ? '—' : formatNumber(book.highlights) },
    { label: 'Notes', value: book.notes === null ? '—' : formatNumber(book.notes) },
  ]

  const details: [string, string | null][] = [
    ['Author(s)', book.authors],
    ['Series', book.series],
    ['Language', book.language],
    ['Last opened', book.lastOpen ? formatDate(book.lastOpen) : null],
    ['Partial MD5', book.md5],
  ]

  return (
    <>
      <BackLink />
      <div className="page-heading">
        <h1 ref={headingRef} tabIndex={-1}>
          {book.title}
          {book.finished && <span className="badge">Finished</span>}
        </h1>
        {book.authors && <p className="book-authors">{book.authors}</p>}
      </div>

      <section className="section" aria-labelledby="book-overview-heading">
        <h2 id="book-overview-heading" className="visually-hidden">
          Overview
        </h2>
        <StatTiles stats={stats} label={`Reading overview for ${book.title}`} />
      </section>

      <ReadingCharts events={events} idPrefix={`book-${book.id}`} />

      <section className="section" aria-labelledby="book-details-heading">
        <h2 id="book-details-heading">Book details</h2>
        <dl className="details-list card">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={label === 'Partial MD5' ? 'mono' : undefined}>
                {value ?? <span className="muted">Not available</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  )
}
