// `no-inline` keeps the sprite a separate, cacheable file even though it's small: <use> can't
// reference symbols inside a data: URL, which is what Vite would inline it as otherwise.
import spriteUrl from '../assets/stat-icons.svg?url&no-inline'

/** Symbol ids in src/assets/stat-icons.svg. */
export type IconName =
  | 'book'
  | 'book-check'
  | 'clock'
  | 'pages'
  | 'calendar'
  | 'gauge'
  | 'stopwatch'
  | 'trophy'
  | 'flame'
  | 'bolt'
  | 'highlighter'
  | 'note'
  | 'progress'
  | 'hourglass'
  | 'flag'
  | 'bookmark'
  | 'help'
  | 'github'

/** Decorative icon: its text label or the parent's aria-label names it, so it's hidden from assistive tech. */
export function Icon({ name, className = 'icon' }: { name: IconName; className?: string }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <use href={`${spriteUrl}#${name}`} />
    </svg>
  )
}
