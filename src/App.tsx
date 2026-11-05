import { useState } from 'react'
import { AppLogo } from './components/AppLogo.tsx'
import { FileDrop } from './components/FileDrop.tsx'
import { Icon } from './components/Icon.tsx'
import { ThemeSwitcher } from './components/ThemeSwitcher.tsx'
import { DatabaseError, loadLibrary } from './lib/db.ts'
import { dashboardHref, useRoute } from './lib/router.ts'
import { useTheme } from './lib/theme.ts'
import type { Library } from './lib/types.ts'
import { BookPage } from './pages/BookPage.tsx'
import { Dashboard } from './pages/Dashboard.tsx'

const EXAMPLE_FILE = 'example-statistics.sqlite3'
const REPOSITORY_URL = 'https://github.com/Ashkanph/koreader-statistics-dashboard'

function App() {
  const [theme, setTheme] = useTheme()
  const route = useRoute()
  const [library, setLibrary] = useState<Library | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async (getFile: () => Promise<File>) => {
    setLoading(true)
    setError(null)
    try {
      setLibrary(await loadLibrary(await getFile()))
    } catch (e) {
      setError(
        e instanceof DatabaseError ? e.message : 'Something went wrong while reading the file.',
      )
      if (!(e instanceof DatabaseError)) console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const openFile = (file: File) => load(async () => file)

  // A sample database shipped in public/, for visitors without a KOReader device at hand.
  const openExample = () =>
    load(async () => {
      let response: Response
      try {
        response = await fetch(`${import.meta.env.BASE_URL}${EXAMPLE_FILE}`)
      } catch {
        throw new DatabaseError(
          "The example data couldn't be downloaded. Check your connection and try again.",
        )
      }
      if (!response.ok) {
        throw new DatabaseError(
          `The example data couldn't be downloaded (HTTP ${response.status}).`,
        )
      }
      return new File([await response.blob()], EXAMPLE_FILE)
    })

  const closeFile = () => {
    setLibrary(null)
    setError(null)
    window.location.hash = dashboardHref
  }

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          {library ? (
            <a href={dashboardHref} className="brand">
              <AppLogo size={24} className="brand-logo" />
              Reading statistics
            </a>
          ) : (
            <span className="brand">
              <AppLogo size={24} className="brand-logo" />
              Reading statistics
            </span>
          )}
          <div className="app-header-actions">
            {library && (
              <button type="button" className="button" onClick={closeFile}>
                Open another file
              </button>
            )}
            <ThemeSwitcher value={theme} onChange={setTheme} />
            {/* A new tab: leaving the page would drop the loaded file, which is only in memory. */}
            <a
              href={REPOSITORY_URL}
              className="button button-icon"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Source code on GitHub (opens in a new tab)"
              title="Source code on GitHub"
            >
              <Icon name="github" />
            </a>
          </div>
        </div>
      </header>

      <main id="main" className="app-main">
        {!library ? (
          <FileDrop onFile={openFile} onExample={openExample} loading={loading} error={error} />
        ) : route.name === 'book' ? (
          <BookPage library={library} bookId={route.bookId} />
        ) : (
          <Dashboard library={library} />
        )}
      </main>
    </>
  )
}

export default App
