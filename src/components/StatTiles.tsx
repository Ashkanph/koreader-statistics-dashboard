import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon.tsx'

export interface Stat {
  label: string
  icon: IconName
  value: ReactNode
  detail?: ReactNode
}

export function StatTiles({ stats, label }: { stats: Stat[]; label: string }) {
  return (
    <dl className="stat-tiles" aria-label={label}>
      {stats.map((stat) => (
        <div className="stat-tile" key={stat.label}>
          <dt>
            {stat.label}
            {/* Inside the dt (a <dl> group may only hold dt/dd); positioned in the tile's corner. */}
            <Icon name={stat.icon} className="stat-icon" />
          </dt>
          <dd>
            <span className="stat-value">{stat.value}</span>
            {stat.detail && <span className="stat-detail">{stat.detail}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
