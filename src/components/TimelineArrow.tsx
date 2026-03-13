import { ChevronLeft, ChevronRight } from './TimelineChevron'

interface TimelineArrowProps {
  direction: 'left' | 'right'
  expanded: boolean
  enabled: boolean
  onClick: () => void
}

const ARROW_EXPANDED_SIZE = 40
const ARROW_COLLAPSED_SIZE = 6

export function TimelineArrow({
  direction,
  expanded,
  enabled,
  onClick,
}: TimelineArrowProps) {
  const arrowSize = expanded ? ARROW_EXPANDED_SIZE : ARROW_COLLAPSED_SIZE
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-aura-black flex items-center justify-center transition-all duration-300 ${
        expanded
          ? 'rounded-pill shadow-card hover:bg-aura-white h-10 w-10 bg-white/90 hover:scale-105'
          : 'rounded-pill h-1.5 w-1.5 bg-white/40 hover:bg-white/60'
      } ${
        enabled
          ? expanded
            ? 'hover:bg-aura-white bg-white/90 hover:scale-105'
            : 'bg-white/40 hover:bg-white/60'
          : 'pointer-events-none bg-transparent opacity-0'
      }`}
      style={{
        width: arrowSize,
        height: arrowSize,
      }}
    >
      {expanded && (direction === 'left' ? <ChevronLeft /> : <ChevronRight />)}
    </button>
  )
}
