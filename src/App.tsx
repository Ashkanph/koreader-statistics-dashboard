import { useState } from 'react'
import { AppLogo } from './components/AppLogo.tsx'
import { FileDrop } from './components/FileDrop.tsx'
import { ThemeSwitcher } from './components/ThemeSwitcher.tsx'
import { DatabaseError, loadLibrary } from './lib/db.ts'
import { dashboardHref, useRoute } from './lib/router.ts'
import { useTheme } from './lib/theme.ts'
import type { Library } from './lib/types.ts'
import { BookPage } from './pages/BookPage.tsx'
import { Dashboard } from './pages/Dashboard.tsx'

function App() {
  const [theme, setTheme] = useTheme()
  const route = useRoute()
  const [library, setLibrary] = useState<Library | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openFile = async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      setLibrary(await loadLibrary(file))
    } catch (e) {
      setError(
        e instanceof DatabaseError ? e.message : 'Something went wrong while reading the file.',
      )
      if (!(e instanceof DatabaseError)) console.error(e)
    } finally {
      setLoading(false)
    }
  }

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
          </div>
        </div>
      </header>

      <main id="main" className="app-main">
        {!library ? (
          <FileDrop onFile={openFile} loading={loading} error={error} />
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
