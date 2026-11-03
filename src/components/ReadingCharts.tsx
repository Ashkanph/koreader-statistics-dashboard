import { useMemo, useState } from 'react'
import type { Granularity } from '../lib/dates.ts'
import { autoGranularity, byHourOfDay, byWeekday, timeSeries } from '../lib/stats.ts'
import type { ReadingEvent } from '../lib/types.ts'
import { BarChart, type BarDatum } from './BarChart.tsx'

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

const shortDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const longDay = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' })
const shortMonth = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' })
const longMonth = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const mediumDay = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const weekdayLong = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short' })

// 2024-01-01 was a Monday; used only to get localized weekday names.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i))

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function ReadingCharts({ events, idPrefix }: { events: ReadingEvent[]; idPrefix: string }) {
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
      </div>
    </section>
  )
}
