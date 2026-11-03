import { useEffect, useState } from 'react'

// Hash-based routing: works on any static host and needs no server configuration.

export type Route = { name: 'dashboard' } | { name: 'book'; bookId: number }

function parse(hash: string): Route {
  const match = /^#\/book\/(\d+)$/.exec(hash)
  return match ? { name: 'book', bookId: Number(match[1]) } : { name: 'dashboard' }
}

export const dashboardHref = '#/'

export function bookHref(bookId: number): string {
  return `#/book/${bookId}`
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
