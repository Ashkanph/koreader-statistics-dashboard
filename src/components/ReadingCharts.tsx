import { useMemo, useState } from 'react'
import type { Granularity } from '../lib/dates.ts'
import { autoGranularity, byHourOfDay, byWeekday, timeSeries } from '../lib/stats.ts'
import type { BookSpan, ProgressCurve } from '../lib/stats.ts'
import type { ReadingEvent } from '../lib/types.ts'
import { BarChart, type BarDatum } from './BarChart.tsx'
import { ProgressChart } from './ProgressChart/ProgressChart.tsx'
import { TimelineChart } from './TimelineChart/TimelineChart.tsx'

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

const shortDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
// Options spelled out rather than dateStyle ('full'/'medium'), which needs Safari 14.1 / Firefox 79.
const longDay = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})
const shortMonth = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' })
const longMonth = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const mediumDay = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})
const weekdayLong = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short' })

// 2024-01-01 was a Monday; used only to get localized weekday names.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i))

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

interface Props {
  events: ReadingEvent[]
  idPrefix: string
  /** Progress curves of finished books; when given, the reading pace charts are shown. */
  curves?: ProgressCurve[]
  /** Reading period of each book; when given, the reading periods timeline is shown. */
  spans?: BookSpan[]
}

export function ReadingCharts({ events, idPrefix, curves, spans }: Props) {
  const [granularity, setGranularity] = useState<Granularity>(() => autoGranularity(events))

  const series: BarDatum[] = useMemo(
    () =>
      timeSeries(events, granularity).map((b) => {
        if (granularity === 'month') {
          return {
            label: shortMonth.format(b.start),
            fullLabel: longMonth.format(b.start),
            value: b.seconds,
          }
        }
        if (granularity === 'week') {
          return {
            label: shortDay.format(b.start),
            fullLabel: `Week of ${mediumDay.format(b.start)}`,
            value: b.seconds,
          }
        }
        return {
          label: shortDay.format(b.start),
          fullLabel: longDay.format(b.start),
          value: b.seconds,
        }
      }),
    [events, granularity],
  )

  const hours: BarDatum[] = useMemo(
    () =>
      byHourOfDay(events).map((value, hour) => ({
        label: String(hour).padStart(2, '0'),
        fullLabel: `${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}`,
        value,
      })),
    [events],
  )

  const weekdays: BarDatum[] = useMemo(
    () =>
      byWeekday(events).map((value, i) => ({
        label: weekdayShort.format(WEEKDAYS[i]),
        fullLabel: weekdayLong.format(WEEKDAYS[i]),
        value,
      })),
    [events],
  )

  const granularityName = GRANULARITIES.find((g) => g.value === granularity)?.label.toLowerCase()

  return (
    <section className="section" aria-labelledby={`${idPrefix}-charts`}>
      <div className="section-header">
        <h2 id={`${idPrefix}-charts`}>Reading activity</h2>
        <fieldset className="segmented">
          <legend className="visually-hidden">Reading time interval</legend>
          {GRANULARITIES.map((g) => (
            <label key={g.value}>
              <input
                type="radio"
                name={`${idPrefix}-granularity`}
                value={g.value}
                checked={granularity === g.value}
                onChange={() => setGranularity(g.value)}
              />
              <span>{g.label}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className="chart-grid">
        <div className="chart-wide">
          <BarChart
            title="Reading time"
            description={`Total reading time, ${granularityName}.`}
            data={series}
            labelHeader={
              granularity === 'month' ? 'Month' : granularity === 'week' ? 'Week' : 'Day'
            }
          />
        </div>
        <BarChart
          title="Time of day"
          description="Reading time by the hour you started each page."
          data={hours}
          labelHeader="Hour"
        />
        <BarChart
          title="Day of the week"
          description="Total reading time on each weekday."
          data={weekdays}
          labelHeader="Weekday"
        />
        {curves && (
          <>
            <div className="chart-wide">
              <ProgressChart
                title="Reading pace: progress by day"
                curves={curves}
                info={
                  <>
                    <p>
                      Compare how quickly you got through the books you've read more than 95% of.
                      Each line is one book: it starts on the day you first opened it and rises as
                      you read pages you hadn't read before.
                    </p>
                    <p>
                      Steeper lines mean you got through a larger share of the book each day; flat
                      stretches are breaks. Because progress is a percentage, a long and a short
                      book finished in the same number of days look the same.
                    </p>
                    <p>
                      <strong>About pages:</strong> page counts come from KOReader, not from the
                      printed book. They depend on the screen size, font, margins and file format,
                      so the same book can have a different number of pages on another device or
                      after you change the font.
                    </p>
                    <p>Point at or tap a line or a title to highlight that book.</p>
                  </>
                }
              />
            </div>
          </>
        )}
        {spans && (
          <div className="chart-wide">
            <TimelineChart
              title="Reading periods"
              description="When you started and last read each book. The light bar is the whole period; solid marks are the days you read it."
              spans={spans}
            />
          </div>
        )}
      </div>
    </section>
  )
}
