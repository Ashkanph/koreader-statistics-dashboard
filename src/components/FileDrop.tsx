import { useId, useRef, useState, type DragEvent } from 'react'
import { AppLogo } from './AppLogo.tsx'
import { Icon, type IconName } from './Icon.tsx'

// What the dashboard shows. Also the main indexable text of the site: search engines only ever
// see this page, since the dashboard needs the visitor's own file.
const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'clock',
    title: 'Reading time',
    text: 'Per day, week or month, by hour of the day and by weekday.',
  },
  {
    icon: 'flame',
    title: 'Habits and streaks',
    text: 'Reading days, your longest and current streak, and your biggest reading day.',
  },
  {
    icon: 'gauge',
    title: 'Reading pace',
    text: 'How quickly you got through each book you finished.',
  },
  {
    icon: 'calendar',
    title: 'Reading periods',
    text: 'When you started and last read each book, on one timeline.',
  },
  {
    icon: 'book',
    title: 'Every book',
    text: 'Progress, pages, time spent, highlights and notes, with a page for each book.',
  },
]

interface Props {
  onFile: (file: File) => void
  /** Loads the bundled example database. */
  onExample: () => void
  loading: boolean
  error: string | null
}

export function FileDrop({ onFile, onExample, loading, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const hintId = useId()
  const errorId = useId()

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file && !loading) onFile(file)
  }

  return (
    <section className="file-drop-wrapper" aria-labelledby="file-drop-title">
      <AppLogo size={72} className="hero-logo" />
      <h1 id="file-drop-title">KOReader Statistics Dashboard</h1>
      <p className="lead">
        See your reading habits from{' '}
        <a
          href="https://github.com/koreader/koreader/"
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          KOReader<span className="visually-hidden"> (opens in a new tab)</span>
        </a>
        's statistics database, right in your browser.
      </p>
      <p>No server, No backend, No tracking!</p>

      <div className="example-card">
        <div className="example-card-text">
          <h2 className="example-card-title">New to KOReader?</h2>
          <p>Explore what the dashboard shows with a sample reading history.</p>
        </div>
        <button type="button" className="button" onClick={onExample} disabled={loading}>
          Try with example data
        </button>
      </div>

      <p className="file-drop-divider">
        <span>or use your own file</span>
      </p>

      <div
        className={`file-drop${dragging ? ' is-dragging' : ''}`}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={handleDrop}
      >
        <svg className="file-drop-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        <p className="file-drop-title">
          {loading ? 'Reading your statistics…' : 'Drop your statistics.sqlite3 file here'}
        </p>
        <p className="file-drop-or" aria-hidden="true">
          or
        </p>
        <button
          type="button"
          className="button button-primary"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`}
        >
          Choose file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".sqlite3,.sqlite,.db,application/vnd.sqlite3,application/x-sqlite3"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
            e.target.value = '' // allow choosing the same file again
          }}
        />
        <p id={hintId} className="file-drop-hint">
          You'll find it on your device at <code>koreader/settings/statistics.sqlite3</code>. The
          file is read locally and never leaves your device.
        </p>
      </div>

      <div aria-live="polite">
        {loading && <p className="visually-hidden">Reading your statistics…</p>}
      </div>
      {error && (
        <div id={errorId} className="alert" role="alert">
          <strong>The statistics couldn't be loaded.</strong> {error}
        </div>
      )}

      <section className="features" aria-labelledby="features-title">
        <h2 id="features-title">What you'll see</h2>
        <ul>
          {FEATURES.map((f) => (
            <li key={f.title}>
              <Icon name={f.icon} className="features-icon" />
              <div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}
