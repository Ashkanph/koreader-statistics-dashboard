import { useMemo } from 'react'
import { BooksTable } from '../components/BooksTable.tsx'
import { ReadingCharts } from '../components/ReadingCharts.tsx'
import { StatTiles, type Stat } from '../components/StatTiles.tsx'
import { useFocusOnMount } from '../lib/focus.ts'
import { formatDate, formatDuration, formatNumber, formatPercent } from '../lib/format.ts'
import { summarize } from '../lib/stats.ts'
import type { Library } from '../lib/types.ts'

function days(n: number): string {
  return `${formatNumber(n)} ${n === 1 ? 'day' : 'days'}`
}

export function Dashboard({ library }: { library: Library }) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const summary = useMemo(() => summarize(library.books, library.events), [library])

  const stats: Stat[] = [
    { label: 'Books', value: formatNumber(summary.books) },
    {
      label: 'Read books (more than 95%)',
      value: formatNumber(summary.finishedBooks),
      detail: `${formatPercent(summary.books ? summary.finishedBooks / summary.books : 0)} of books`,
    },
    {
      label: 'Total reading time',
      value: formatDuration(summary.totalTime),
      detail: summary.firstRead ? `since ${formatDate(summary.firstRead)}` : undefined,
    },
    { label: 'Pages read', value: formatNumber(summary.readPages) },
    {
      label: 'Reading days',
      value: formatNumber(summary.readingDays),
      detail: summary.lastRead ? `last on ${formatDate(summary.lastRead)}` : undefined,
    },
    { label: 'Average per reading day', value: formatDuration(summary.avgPerReadingDay) },
    { label: 'Average time per page', value: formatDuration(summary.avgPerPage) },
    {
      label: 'Most reading in a day',
      value: summary.bestDay ? formatDuration(summary.bestDay.seconds) : '—',
      detail: summary.bestDay ? formatDate(summary.bestDay.date) : undefined,
    },
    { label: 'Longest streak', value: days(summary.longestStreak) },
    { label: 'Current streak', value: days(summary.currentStreak) },
    { label: 'Highlights', value: formatNumber(summary.highlights) },
    { label: 'Notes', value: formatNumber(summary.notes) },
  ]

  return (
    <>
      <div className="page-heading">
        <h1 ref={headingRef} tabIndex={-1}>
          Your reading
        </h1>
        <p className="muted">
          From <span className="file-name">{library.fileName}</span>
        </p>
      </div>

      <section className="section" aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="visually-hidden">
          Overview
        </h2>
        <StatTiles stats={stats} label="Reading overview" />
        <p className="footnote">
          In this app, a book counts as fully read when 95% of pages have reading time recorded.
          KOReader keeps its own “finished” status in each book's metadata file, which isn't part of
          this database.
        </p>
      </section>

      <ReadingCharts events={library.events} idPrefix="all" />

      <BooksTable books={library.books} />
    </>
  )
}
