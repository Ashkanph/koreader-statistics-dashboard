import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../Icon.tsx'
import './info-tip.css'

interface Props {
  /** Accessible name of the button, e.g. "About this chart". */
  label: string
  children: ReactNode
}

/**
 * A circled "?" that reveals an explanation panel: on hover with a mouse, and toggled by
 * click/tap (which also pins it open on desktop). Escape or a click outside closes it.
 */
export function InfoTip({ label, children }: Props) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const open = hovered || pinned

  // Keep the panel on screen: shift it sideways if its anchored position would overflow.
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!open || !panel) return
    panel.style.translate = ''
    const margin = 8
    const rect = panel.getBoundingClientRect()
    const max = document.documentElement.clientWidth - margin
    const shift = rect.left < margin ? margin - rect.left : rect.right > max ? max - rect.right : 0
    if (shift) panel.style.translate = `${Math.round(shift)}px 0`
  }, [open])

  useEffect(() => {
    if (!pinned) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setPinned(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [pinned])

  return (
    <div
      ref={rootRef}
      className="info-tip"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setPinned(false)
          setHovered(false)
        }
      }}
    >
      <button
        type="button"
        className="info-tip-button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (pinned) {
            // Close now, even though the mouse is still over the button.
            setPinned(false)
            setHovered(false)
          } else {
            setPinned(true)
          }
        }}
      >
        <Icon name="help" className="info-tip-icon" />
      </button>
      <div ref={panelRef} id={panelId} className="info-tip-panel" role="note" hidden={!open}>
        {children}
      </div>
    </div>
  )
}
