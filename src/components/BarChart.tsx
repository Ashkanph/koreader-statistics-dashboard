import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { formatDuration } from '../lib/format.ts'

export interface BarDatum {
  /** Short label for the x axis. */
  label: string
  /** Full label for the tooltip and data table. */
  fullLabel: string
  /** Seconds. */
  value: number
}

interface Props {
  title: string
  description?: string
  data: BarDatum[]
  /** Column header for the label column of the data table. */
  labelHeader: string
  height?: number
}

const MARGIN = { top: 12, right: 8, bottom: 28, left: 44 }
const MAX_BAR = 24
const GAP = 2
const RADIUS = 4
const MIN_LABEL_SPACING = 56

// Tick steps in seconds, chosen so axis labels stay round: 1m … 1000h.
const STEPS = [
  60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 18000, 36000, 72000, 180000, 360000, 720000,
  1800000, 3600000,
]

function niceScale(max: number): { max: number; step: number } {
  if (max <= 0) return { max: 3600, step: 1800 }
  const step = STEPS.find((s) => max / s <= 4) ?? STEPS[STEPS.length - 1]
  return { max: Math.ceil(max / step) * step, step }
}

function axisLabel(seconds: number): string {
  if (seconds === 0) return '0'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const h = seconds / 3600
  return `${Number.isInteger(h) ? h.toLocaleString() : h.toFixed(1)}h`
}

/** Bar with a rounded data end and a square baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h)
  return `M${x},${y + h}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h}Z`
}

export function BarChart({ title, description, data, labelHeader, height = 220 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  const [tableOpen, setTableOpen] = useState(false)
  const titleId = useId()
  const descId = useId()
  const hintId = useId()

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 0)
  const plotH = height - MARGIN.top - MARGIN.bottom
  const n = data.length
  const band = n ? plotW / n : 0
  const barW = Math.min(MAX_BAR, Math.max(band - GAP, band * 0.5))
  const scale = niceScale(Math.max(0, ...data.map((d) => d.value)))
  const ticks = Array.from(
    { length: Math.round(scale.max / scale.step) + 1 },
    (_, i) => i * scale.step,
  )
  const y = (v: number) => MARGIN.top + plotH - (v / scale.max) * plotH
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / MIN_LABEL_SPACING))))

  const onKeyDown = (event: KeyboardEvent) => {
    if (!n) return
    const current = active ?? -1
    const next =
      event.key === 'ArrowRight'
        ? Math.min(current + 1, n - 1)
        : event.key === 'ArrowLeft'
          ? Math.max(current - 1, 0)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? n - 1
              : null
    if (next !== null) {
      event.preventDefault()
      setActive(next)
    }
  }

  const activeDatum = active !== null ? data[active] : undefined
  const tooltipX = active !== null ? MARGIN.left + band * (active + 0.5) : 0
  const tooltipAlign = tooltipX < width * 0.2 ? 'start' : tooltipX > width * 0.8 ? 'end' : 'center'

  return (
    <figure className="chart card">
      <figcaption>
        <h3 id={titleId}>{title}</h3>
        {description && (
          <p id={descId} className="chart-description">
            {description}
          </p>
        )}
      </figcaption>

      <div
        ref={containerRef}
        className="chart-plot"
        style={{ height }}
        tabIndex={0}
        role="group"
        aria-labelledby={titleId}
        aria-describedby={description ? `${descId} ${hintId}` : hintId}
        aria-roledescription="bar chart"
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        {width > 0 && (
          <svg width={width} height={height} aria-hidden="true">
            {ticks.map((t) => (
              <g key={t}>
                <line
                  className={t === 0 ? 'chart-baseline' : 'chart-gridline'}
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotW}
                  y1={y(t)}
                  y2={y(t)}
                />
                <text
                  className="chart-tick"
                  x={MARGIN.left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                >
                  {axisLabel(t)}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const x = MARGIN.left + band * i + (band - barW) / 2
              const h = (d.value / scale.max) * plotH
              return (
                <g key={i}>
                  {h > 0 && (
                    <path
                      className={`chart-bar${active === i ? ' is-active' : ''}`}
                      d={barPath(x, y(d.value), barW, Math.max(h, 1))}
                    />
                  )}
                  {i % labelEvery === 0 && (
                    <text
                      className="chart-tick"
                      x={MARGIN.left + band * (i + 0.5)}
                      y={height - MARGIN.bottom + 18}
                      textAnchor="middle"
                    >
                      {d.label}
                    </text>
                  )}
                  {/* Hit target: the whole column, not just the painted bar. */}
                  <rect
                    className="chart-hit"
                    x={MARGIN.left + band * i}
                    y={MARGIN.top}
                    width={band}
                    height={plotH}
                    onPointerEnter={() => setActive(i)}
                  />
                </g>
              )
            })}
          </svg>
        )}

        {activeDatum && (
          <div
            className={`chart-tooltip align-${tooltipAlign}`}
            style={{ left: tooltipX, top: y(activeDatum.value) }}
            aria-hidden="true"
          >
            <strong>{formatDuration(activeDatum.value)}</strong>
            <span>{activeDatum.fullLabel}</span>
          </div>
        )}
      </div>

      <p id={hintId} className="visually-hidden">
        Use the left and right arrow keys to read each bar, or open the data table below.
      </p>
      <p className="visually-hidden" aria-live="polite">
        {activeDatum ? `${activeDatum.fullLabel}: ${formatDuration(activeDatum.value)}` : ''}
      </p>

      <details className="chart-table" onToggle={(e) => setTableOpen(e.currentTarget.open)}>
        <summary>Show data table</summary>
        {tableOpen && (
          <div className="table-scroll" tabIndex={0} role="region" aria-label={`${title} data`}>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{labelHeader}</th>
                  <th scope="col" className="num">
                    Reading time
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={i}>
                    <th scope="row">{d.fullLabel}</th>
                    <td className="num">{formatDuration(d.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </figure>
  )
}
