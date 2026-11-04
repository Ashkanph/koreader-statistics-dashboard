import { useMemo } from 'react'
import { BooksTable } from '../components/BooksTable.tsx'
import { ReadingCharts } from '../components/ReadingCharts.tsx'
import { StatTiles, type Stat } from '../components/StatTiles/StatTiles.tsx'
import { useFocusOnMount } from '../lib/focus.ts'
import { formatDate, formatDuration, formatNumber, formatPercent } from '../lib/format.ts'
import { HIGHLIGHTS_INFO, NOTES_INFO, PAGES_INFO, READ_BOOKS_INFO } from '../lib/statInfo.ts'
import { bookSpans, progressCurves, summarize } from '../lib/stats.ts'
import type { Library } from '../lib/types.ts'

function days(n: number): string {
  return `${formatNumber(n)} ${n === 1 ? 'day' : 'days'}`
}

export function Dashboard({ library }: { library: Library }) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const summary = useMemo(() => summarize(library.books, library.events), [library])
  const curves = useMemo(() => progressCurves(library.books, library.firstReads), [library])
  const spans = useMemo(() => bookSpans(library.books, library.events), [library])

  const stats: Stat[] = [
    { label: 'Books', icon: 'book', value: formatNumber(summary.books) },
    {
      label: 'Read books (more than 95%)',
      icon: 'book-check',
      value: formatNumber(summary.finishedBooks),
      detail: `${formatPercent(summary.books ? summary.finishedBooks / summary.books : 0)} of books`,
      info: READ_BOOKS_INFO,
    },
    {
      label: 'Total reading time',
      icon: 'clock',
      value: formatDuration(summary.totalTime),
      detail: summary.firstRead ? `since ${formatDate(summary.firstRead)}` : undefined,
    },
    {
      label: 'Pages read',
      icon: 'pages',
      value: formatNumber(summary.readPages),
      info: PAGES_INFO,
    },
    {
      label: 'Reading days',
      icon: 'calendar',
      value: formatNumber(summary.readingDays),
      detail: summary.lastRead ? `last on ${formatDate(summary.lastRead)}` : undefined,
    },
    {
      label: 'Average per reading day',
      icon: 'gauge',
      value: formatDuration(summary.avgPerReadingDay),
    },
    {
      label: 'Average time per page',
      icon: 'stopwatch',
      value: formatDuration(summary.avgPerPage),
    },
    {
      label: 'Most reading in a day',
      icon: 'trophy',
      value: summary.bestDay ? formatDuration(summary.bestDay.seconds) : '—',
      detail: summary.bestDay ? formatDate(summary.bestDay.date) : undefined,
    },
    { label: 'Longest streak', icon: 'flame', value: days(summary.longestStreak) },
    { label: 'Current streak', icon: 'bolt', value: days(summary.currentStreak) },
    {
      label: 'Highlights',
      icon: 'highlighter',
      value: formatNumber(summary.highlights),
      info: HIGHLIGHTS_INFO,
    },
    { label: 'Notes', icon: 'note', value: formatNumber(summary.notes), info: NOTES_INFO },
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
      </section>

      <ReadingCharts events={library.events} idPrefix="all" curves={curves} spans={spans} />

      <BooksTable books={library.books} />
    </>
  )
}
