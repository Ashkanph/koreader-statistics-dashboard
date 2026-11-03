import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { formatNumber, formatPercent } from '../../lib/format.ts'
import type { ProgressCurve } from '../../lib/stats.ts'
import { InfoTip } from '../InfoTip/InfoTip.tsx'
import './progress-chart.css'

interface Props {
  title: string
  /** Explanation shown in the "?" panel. */
  info: ReactNode
  curves: ProgressCurve[]
  height?: number
}

const MARGIN = { top: 28, right: 16, bottom: 44, left: 48 }
const DAYS_TITLE = 'Days since first opened'
const PROGRESS_TITLE = 'Progress'

/** Round axis maximum and step for a day count (1, 2, 5 × 10ⁿ steps, about 5 ticks). */
function dayScale(max: number): { max: number; step: number } {
  if (max <= 5) return { max: Math.max(max, 1), step: 1 }
  const raw = max / 5
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10
  return { max: Math.ceil(max / step) * step, step }
}

function days(n: number): string {
  return `${formatNumber(n)} ${n === 1 ? 'day' : 'days'}`
}

function finishText(curve: ProgressCurve): string {
  const reached =
    curve.finalProgress >= 100 ? 'Finished' : `Reached ${formatPercent(curve.finalProgress / 100)}`
  return `${reached} in ${days(curve.daysToFinish)}`
}

export function ProgressChart({ title, info, curves, height = 300 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLUListElement>(null)
  const [width, setWidth] = useState(0)
  const [hovered, setHovered] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [tableOpen, setTableOpen] = useState(false)
  const titleId = useId()
  const summaryId = useId()

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const active = hovered ?? pinned
  const activeCurve = curves.find((c) => c.bookId === active)

  // Keep the highlighted name visible in the legend when a line is hovered.
  useEffect(() => {
    if (active === null || !legendRef.current) return
    const item = legendRef.current.querySelector<HTMLElement>(`[data-book="${active}"]`)
    const list = legendRef.current
    if (!item) return
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight
    }
  }, [active])

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 0)
  const plotH = height - MARGIN.top - MARGIN.bottom
  const dayAxis = dayScale(Math.max(1, ...curves.map((c) => c.daysToFinish)))
  const dayTicks = Array.from(
    { length: dayAxis.max / dayAxis.step + 1 },
    (_, i) => i * dayAxis.step,
  )
  const progressTicks = [0, 25, 50, 75, 100]

  const xMax = dayAxis.max
  const yMax = 100
  const xTicks = dayTicks
  const yTicks = progressTicks
  const xLabel = (v: number) => formatNumber(v)
  const yLabel = (v: number) => `${v}%`
  const sx = (v: number) => MARGIN.left + (v / xMax) * plotW
  const sy = (v: number) => MARGIN.top + plotH - (v / yMax) * plotH
  const point = (day: number, progress: number) => [sx(day), sy(progress)]
  const pathOf = (c: ProgressCurve) =>
    c.points
      .map((p, i) => {
        const [x, y] = point(p.day, p.progress)
        return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join('')

  // The active line is drawn last so it sits on top.
  const ordered = activeCurve ? [...curves.filter((c) => c.bookId !== active), activeCurve] : curves

  const togglePin = (bookId: number) => setPinned(pinned === bookId ? null : bookId)

  const activeEnd = activeCurve ? point(activeCurve.daysToFinish, activeCurve.finalProgress) : null
  const tooltipPos = pointer ?? (activeEnd ? { x: activeEnd[0], y: activeEnd[1] } : null)

  const fastest = curves[0]
  const slowest = curves[curves.length - 1]
  const summary = curves.length
    ? `${formatNumber(curves.length)} books. Fastest: ${fastest.title}, ${days(fastest.daysToFinish)}. Slowest: ${slowest.title}, ${days(slowest.daysToFinish)}.`
    : 'No books above 95% progress yet.'

  return (
    <figure className="chart card progress-chart">
      <figcaption className="chart-heading">
        <h3 id={titleId}>{title}</h3>
        <InfoTip label={`About the “${title}” chart`}>{info}</InfoTip>
      </figcaption>

      {curves.length === 0 ? (
        <p className="chart-empty">
          No books with more than 95% progress yet. Books appear here once you've read nearly all of
          their pages.
        </p>
      ) : (
        <>
          <div
            ref={containerRef}
            className="chart-plot"
            style={{ height }}
            role="img"
            aria-labelledby={`${titleId} ${summaryId}`}
            onPointerLeave={() => {
              setHovered(null)
              setPointer(null)
            }}
          >
            <span id={summaryId} className="visually-hidden">
              {summary}
            </span>
            {width > 0 && (
              <svg width={width} height={height} aria-hidden="true">
                {yTicks.map((t) => (
                  <g key={`y${t}`}>
                    <line
                      className={t === 0 ? 'chart-baseline' : 'chart-gridline'}
                      x1={MARGIN.left}
                      x2={MARGIN.left + plotW}
                      y1={sy(t)}
                      y2={sy(t)}
                    />
                    <text
                      className="chart-tick"
                      x={MARGIN.left - 8}
                      y={sy(t)}
                      dy="0.32em"
                      textAnchor="end"
                    >
                      {yLabel(t)}
                    </text>
                  </g>
                ))}
                {xTicks.map((t) => (
                  <text
                    key={`x${t}`}
                    className="chart-tick"
                    x={sx(t)}
                    y={MARGIN.top + plotH + 18}
                    textAnchor="middle"
                  >
                    {xLabel(t)}
                  </text>
                ))}
                <text className="chart-axis-title" x={MARGIN.left - 8} y={14}>
                  {PROGRESS_TITLE}
                </text>
                <text
                  className="chart-axis-title"
                  x={MARGIN.left + plotW}
                  y={height - 6}
                  textAnchor="end"
                >
                  {DAYS_TITLE}
                </text>

                {ordered.map((c) => {
                  const state =
                    active === null ? '' : c.bookId === active ? ' is-active' : ' is-dimmed'
                  return <path key={c.bookId} className={`progress-line${state}`} d={pathOf(c)} />
                })}
                {activeEnd && (
                  <circle className="progress-end" cx={activeEnd[0]} cy={activeEnd[1]} r={4} />
                )}
                {/* Wide invisible strokes: easier to hover than the 2px lines. */}
                {ordered.map((c) => (
                  <path
                    key={`hit${c.bookId}`}
                    className="progress-hit"
                    d={pathOf(c)}
                    onPointerEnter={() => setHovered(c.bookId)}
                    onPointerMove={(e) => {
                      const rect = containerRef.current?.getBoundingClientRect()
                      if (rect) setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                    }}
                    onPointerLeave={() => setHovered(null)}
                    onClick={() => togglePin(c.bookId)}
                  />
                ))}
              </svg>
            )}

            {activeCurve && tooltipPos && (
              <div
                className={`chart-tooltip align-${tooltipPos.x < width * 0.25 ? 'start' : tooltipPos.x > width * 0.75 ? 'end' : 'center'}`}
                style={{ left: tooltipPos.x, top: tooltipPos.y }}
                aria-hidden="true"
              >
                <strong>{finishText(activeCurve)}</strong>
                <span>{activeCurve.title}</span>
              </div>
            )}
          </div>

          <ul ref={legendRef} className="progress-legend" aria-label="Books in the chart">
            {curves.map((c) => (
              <li key={c.bookId} data-book={c.bookId}>
                <button
                  type="button"
                  className={active === null ? '' : c.bookId === active ? 'is-active' : 'is-dimmed'}
                  aria-pressed={pinned === c.bookId}
                  onPointerEnter={() => setHovered(c.bookId)}
                  onPointerLeave={() => setHovered(null)}
                  onFocus={() => setHovered(c.bookId)}
                  onBlur={() => setHovered(null)}
                  onClick={() => togglePin(c.bookId)}
                >
                  <span className="legend-key" aria-hidden="true" />
                  <span className="legend-title">{c.title}</span>
                  <span className="legend-value">{days(c.daysToFinish)}</span>
                </button>
              </li>
            ))}
          </ul>

          <details className="chart-table" onToggle={(e) => setTableOpen(e.currentTarget.open)}>
            <summary>Show data table</summary>
            {tableOpen && (
              <div className="table-scroll" tabIndex={0} role="region" aria-label={`${title} data`}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Book</th>
                      <th scope="col" className="num">
                        Days to 50%
                      </th>
                      <th scope="col" className="num">
                        Days to finish
                      </th>
                      <th scope="col" className="num">
                        Progress
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {curves.map((c) => (
                      <tr key={c.bookId}>
                        <th scope="row">{c.title}</th>
                        <td className="num">{c.daysToHalf ?? '—'}</td>
                        <td className="num">{formatNumber(c.daysToFinish)}</td>
                        <td className="num">{formatPercent(c.finalProgress / 100)}</td>
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
