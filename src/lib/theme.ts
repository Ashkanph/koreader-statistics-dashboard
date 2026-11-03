import { useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

// Keep in sync with the inline script in index.html, which applies the theme before first paint.
const STORAGE_KEY = 'theme'

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Storage can be unavailable (e.g. privacy mode); fall back to the system theme.
  }
  return 'system'
}

export function useTheme(): [ThemePreference, (theme: ThemePreference) => void] {
  const [theme, setTheme] = useState<ThemePreference>(readPreference)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
    try {
      if (theme === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Ignore: the preference just won't persist.
    }
  }, [theme])

  return [theme, setTheme]
}
