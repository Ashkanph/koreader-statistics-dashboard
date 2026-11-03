import { useEffect, useRef } from 'react'

/**
 * Moves focus to the element (usually the page's h1) when a page mounts, so keyboard and
 * screen reader users land at the top of the new content after navigation.
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    ref.current?.focus({ preventScroll: true })
  }, [])
  return ref
}
