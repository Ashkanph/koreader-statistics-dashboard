import type { ReactNode } from 'react'

export interface Stat {
  label: string
  value: ReactNode
  detail?: ReactNode
}

export function StatTiles({ stats, label }: { stats: Stat[]; label: string }) {
  return (
    <dl className="stat-tiles" aria-label={label}>
      {stats.map((stat) => (
        <div className="stat-tile" key={stat.label}>
          <dt>{stat.label}</dt>
          <dd>
            <span className="stat-value">{stat.value}</span>
            {stat.detail && <span className="stat-detail">{stat.detail}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
