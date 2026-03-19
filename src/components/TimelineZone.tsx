import { useEffect, useRef } from 'preact/hooks'
import type { ComponentChildren } from 'preact'

interface TimelineZoneProps {
  expanded: boolean
  onExpand: () => void
  onCollapse: () => void
  collapseDelay?: number
  children: ComponentChildren
}

/* note: `expanded` prop is available. It is not explicitly needed but may be useful later for internal styling */
export default function TimelineZone({
  onExpand,
  onCollapse,
  collapseDelay = 1000,
  children,
}: TimelineZoneProps) {
  const collapseTimeoutRef = useRef<number | null>(null)

  const clearCollapseTimeout = () => {
    if (collapseTimeoutRef.current !== null) {
      window.clearTimeout(collapseTimeoutRef.current)
      collapseTimeoutRef.current = null
    }
  }

  const handleMouseEnter = () => {
    clearCollapseTimeout()
    onExpand()
  }

  const handleMouseLeave = () => {
    clearCollapseTimeout()
    collapseTimeoutRef.current = window.setTimeout(() => {
      onCollapse()
      collapseTimeoutRef.current = null
    }, collapseDelay)
  }

  useEffect(() => {
    return () => {
      clearCollapseTimeout()
    }
  }, [])

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[10000]"
      style={{ height: 'var(--spacing-hotzone-height)' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  )
}
