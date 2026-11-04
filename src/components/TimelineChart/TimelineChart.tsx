import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { daysBetween, startOfDay, startOfMonth, startOfWeek } from '../../lib/dates.ts'
import { formatDate, formatDuration, formatNumber } from '../../lib/format.ts'
import { bookHref } from '../../lib/router.ts'
import type { BookSpan } from '../../lib/stats.ts'
import './timeline-chart.css'

interface Props {
  title: string
  description: string
  spans: BookSpan[]
}

const ROW_H = 24
const BAR_H = 14
const AXIS_H = 28
/** Narrowest day: below this the chart scrolls instead of squeezing. */
const MIN_DAY_PX = 6
const PAD = 8
/** Number of categorical color slots defined in index.css (--cat-1 … --cat-8). */
const COLORS = 8

const dayLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' })
const yearLabel = new Intl.DateTimeFormat(undefined, { year: 'numeric' })

interface TickUnit {
  /** Approximate length in days, to decide whether labels fit. */
  days: number
  minPx: number
  first: (d: Date) => Date
  next: (d: Date) => Date
  label: (d: Date) => string
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)

const TICK_UNITS: TickUnit[] = [
  { days: 1, minPx: 56, first: startOfDay, next: (d) => addDays(d, 1), label: dayLabel.format },
  { days: 7, minPx: 56, first: startOfWeek, next: (d) => addDays(d, 7), label: dayLabel.format },
  {
    days: 30.4,
    minPx: 80,
    first: startOfMonth,
    next: (d) => addMonths(d, 1),
    label: monthLabel.format,
  },
  {
    days: 91,
    minPx: 80,
    first: (d) => new Date(d.getFullYear(), d.getMonth() - (d.getMonth() % 3), 1),
    next: (d) => addMonths(d, 3),
    label: monthLabel.format,
  },
  {
    days: 365,
    minPx: 48,
    first: (d) => new Date(d.getFullYear(), 0, 1),
    next: (d) => new Date(d.getFullYear() + 1, 0, 1),
    label: yearLabel.format,
  },
]

function days(n: number): string {
  return `${formatNumber(n)} ${n === 1 ? 'day' : 'days'}`
}

function periodText(span: BookSpan): string {
  return span.days === 1
    ? formatDate(span.start)
    : `${formatDate(span.start)} – ${formatDate(span.end)}`
}

export function TimelineChart({ title, description, spans }: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrolledToEnd = useRef(false)
  const lastPointer = useRef('mouse')
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [scroll, setScroll] = useState({ left: 0, top: 0 })
  const [active, setActive] = useState<number | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [tableOpen, setTableOpen] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipSize, setTooltipSize] = useState({ w: 0, h: 0 })
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
      setHeight(entry.contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const labelW = width < 560 ? 120 : 200
  const origin = useMemo(() => (spans.length ? spans[0].start : new Date()), [spans])
  const totalDays = spans.length ? Math.max(...spans.map((s) => daysBetween(origin, s.end))) + 1 : 1
  const dayPx = Math.max(MIN_DAY_PX, (width - labelW - 2 * PAD) / totalDays)
  const plotW = Math.round(totalDays * dayPx + 2 * PAD)
  const plotH = spans.length * ROW_H
  const x = (offset: number) => PAD + offset * dayPx
  const offsets = useMemo(() => spans.map((s) => daysBetween(origin, s.start)), [spans, origin])

  // Open on the most recent books: they are the ones at the end of the timeline.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || width === 0 || scrolledToEnd.current) return
    scrolledToEnd.current = true
    el.scrollLeft = el.scrollWidth
    el.scrollTop = el.scrollHeight
    setScroll({ left: el.scrollLeft, top: el.scrollTop })
  }, [width])

  const tooltipKey = active === null ? null : spans[active]?.bookId
  const followsPointer = pointer !== null
  useLayoutEffect(() => {
    const el = tooltipRef.current
    if (!el) return
    const size = { w: el.offsetWidth, h: el.offsetHeight }
    setTooltipSize((old) => (old.w === size.w && old.h === size.h ? old : size))
  }, [tooltipKey, followsPointer])

  const unit =
    TICK_UNITS.find((u) => u.days * dayPx >= u.minPx) ?? TICK_UNITS[TICK_UNITS.length - 1]
  const ticks = useMemo(() => {
    const end = addDays(origin, totalDays)
    const result: { date: Date; offset: number }[] = []
    for (let d = unit.first(origin); d < end; d = unit.next(d)) {
      if (d >= origin) result.push({ date: d, offset: daysBetween(origin, d) })
    }
    return result
  }, [origin, totalDays, unit])

  // Thousands of rectangles: build them once per layout, not on every pointer move.
  const bars = useMemo(
    () =>
      spans.map((s, i) => {
        const y = i * ROW_H + (ROW_H - BAR_H) / 2
        const start = offsets[i]
        const dayW = Math.max(dayPx - (dayPx >= 4 ? 1 : 0), 1)
        const at = (offset: number) => PAD + offset * dayPx
        return (
          <g key={s.bookId} style={{ fill: `var(--cat-${(i % COLORS) + 1})` }}>
            <rect
              className="timeline-span"
              x={at(start)}
              y={y}
              width={Math.max(s.days * dayPx, 2)}
              height={BAR_H}
              rx={3}
            />
            {s.readingDays.map((d) => (
              <rect
                key={d}
                className="timeline-day"
                x={at(start + d)}
                y={y}
                width={dayW}
                height={BAR_H}
                rx={1}
              />
            ))}
          </g>
        )
      }),
    [spans, offsets, dayPx],
  )

  const activeSpan = active === null ? null : spans[active]

  // Without a pointer (keyboard focus), anchor the tooltip to the end of the bar.
  let tooltipPos = pointer
  if (!tooltipPos && active !== null && activeSpan) {
    const barEnd = labelW + x(offsets[active] + activeSpan.days) - scroll.left
    const y = AXIS_H + active * ROW_H + (ROW_H - BAR_H) / 2 - scroll.top
    tooltipPos =
      y >= AXIS_H && y <= height
        ? { x: Math.min(Math.max(barEnd, labelW + 16), width - 16), y }
        : null
  }

  // Keep the tooltip inside the chart: centered on the point where it fits, and below the row
  // when there's no room above it.
  const tooltipStyle = tooltipPos
    ? {
        left: Math.min(Math.max(tooltipPos.x - tooltipSize.w / 2, 0), width - tooltipSize.w),
        top:
          tooltipPos.y - tooltipSize.h - 8 >= 0
            ? tooltipPos.y - tooltipSize.h - 8
            : tooltipPos.y + BAR_H + 8,
      }
    : undefined

  const focusRow = (i: number) => {
    setActive(i)
    setPointer(null)
    const el = scrollRef.current
    if (!el) return
    const start = x(offsets[i])
    const end = x(offsets[i] + spans[i].days)
    const visible = el.clientWidth - labelW
    if (start < el.scrollLeft || end > el.scrollLeft + visible) {
      el.scrollLeft = Math.max(0, Math.min(start - 24, end - visible + 24))
    }
  }

  const relative = (e: { clientX: number; clientY: number }) => {
    const rect = frameRef.current?.getBoundingClientRect()
    return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : null
  }

  const first = spans[0]
  const last = spans[spans.length - 1]

  return (
    <figure className="chart card timeline-chart">
      <figcaption>
        <h3 id={titleId}>{title}</h3>
        <p id={descId} className="chart-description">
          {description}
        </p>
      </figcaption>

      {spans.length === 0 ? (
        <p className="chart-empty">No reading activity yet.</p>
      ) : (
        <>
          <div ref={frameRef} className="timeline-frame">
            <div
              ref={scrollRef}
              className="timeline-scroll"
              role="region"
              tabIndex={0}
              aria-labelledby={titleId}
              aria-describedby={descId}
              onScroll={(e) => {
                setScroll({ left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop })
                setPointer(null)
              }}
              onPointerLeave={() => {
                setActive(null)
                setPointer(null)
              }}
            >
              <div
                className="timeline-grid"
                style={{ gridTemplateColumns: `${labelW}px ${plotW}px` }}
              >
                <div className="timeline-corner" style={{ height: AXIS_H }}>
                  Book
                </div>
                <svg className="timeline-axis" width={plotW} height={AXIS_H} aria-hidden="true">
                  {ticks.map((t) => (
                    <g key={t.offset}>
                      <line
                        className="chart-baseline"
                        x1={x(t.offset)}
                        x2={x(t.offset)}
                        y1={AXIS_H - 6}
                        y2={AXIS_H}
                      />
                      <text className="chart-tick" x={x(t.offset) + 4} y={AXIS_H - 10}>
                        {unit.label(t.date)}
                      </text>
                    </g>
                  ))}
                  <line
                    className="chart-baseline"
                    x1={0}
                    x2={plotW}
                    y1={AXIS_H - 0.5}
                    y2={AXIS_H - 0.5}
                  />
                </svg>

                <ol className="timeline-labels">
                  {spans.map((s, i) => (
                    <li key={s.bookId} style={{ height: ROW_H }}>
                      <a
                        href={bookHref(s.bookId)}
                        className={active === i ? 'is-active' : undefined}
                        style={{ scrollMarginTop: AXIS_H }}
                        title={s.title}
                        onFocus={() => focusRow(i)}
                        onBlur={() => setActive(null)}
                        onPointerEnter={() => {
                          setActive(i)
                          setPointer(null)
                        }}
                      >
                        <span
                          className="timeline-key"
                          style={{ background: `var(--cat-${(i % COLORS) + 1})` }}
                          aria-hidden="true"
                        />
                        <span className="timeline-title">{s.title}</span>
                        <span className="visually-hidden">
                          , {periodText(s)}, {days(s.days)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>

                <svg className="timeline-plot" width={plotW} height={plotH} aria-hidden="true">
                  {ticks.map((t) => (
                    <line
                      key={t.offset}
                      className="chart-gridline"
                      x1={x(t.offset)}
                      x2={x(t.offset)}
                      y1={0}
                      y2={plotH}
                    />
                  ))}
                  {active !== null && (
                    <rect
                      className="timeline-row-hover"
                      x={0}
                      y={active * ROW_H}
                      width={plotW}
                      height={ROW_H}
                    />
                  )}
                  {bars}
                  {spans.map((s, i) => (
                    <rect
                      key={s.bookId}
                      className="timeline-hit"
                      x={0}
                      y={i * ROW_H}
                      width={plotW}
                      height={ROW_H}
                      onPointerDown={(e) => (lastPointer.current = e.pointerType)}
                      onPointerMove={(e) => {
                        setActive(i)
                        setPointer(relative(e))
                      }}
                      onClick={(e) => {
                        // On touch, the first tap shows the details and the second opens the book.
                        if (lastPointer.current === 'touch' && active !== i) {
                          setActive(i)
                          setPointer(relative(e))
                          return
                        }
                        window.location.hash = bookHref(s.bookId)
                      }}
                    />
                  ))}
                </svg>
              </div>
            </div>

            {activeSpan && tooltipPos && (
              <div
                ref={tooltipRef}
                className="chart-tooltip timeline-tooltip"
                style={tooltipStyle}
                aria-hidden="true"
              >
                <strong>{activeSpan.title}</strong>
                <span>{periodText(activeSpan)}</span>
                <span>
                  {days(activeSpan.days)}, read on {days(activeSpan.readingDays.length)} ·{' '}
                  {formatDuration(activeSpan.seconds)}
                </span>
              </div>
            )}
          </div>

          <p className="visually-hidden">
            {formatNumber(spans.length)} books, from {first.title} started on{' '}
            {formatDate(first.start)} to {last.title} started on {formatDate(last.start)}.
          </p>

          <details className="chart-table" onToggle={(e) => setTableOpen(e.currentTarget.open)}>
            <summary>Show data table</summary>
            {tableOpen && (
              <div className="table-scroll" tabIndex={0} role="region" aria-label={`${title} data`}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Book</th>
                      <th scope="col">First read</th>
                      <th scope="col">Last read</th>
                      <th scope="col" className="num">
                        Period
                      </th>
                      <th scope="col" className="num">
                        Reading days
                      </th>
                      <th scope="col" className="num">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {spans.map((s) => (
                      <tr key={s.bookId}>
                        <th scope="row">{s.title}</th>
                        <td>{formatDate(s.start)}</td>
                        <td>{formatDate(s.end)}</td>
                        <td className="num">{days(s.days)}</td>
                        <td className="num">{formatNumber(s.readingDays.length)}</td>
                        <td className="num">{formatDuration(s.seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        </>
      )}
    </figure>
  )
}
