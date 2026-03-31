import type { AuraView } from '@/types'
interface TimelineCardProps {
  view: AuraView
  displayIndex: number
  isActive: boolean
  expanded: boolean
  isInWindow: boolean
  width: number
  height: number
  borderRadius: number
  onClick: (viewId: number) => void
}

export default function TimelineCard({
  view,
  displayIndex,
  isActive,
  expanded,
  isInWindow,
  width,
  height,
  borderRadius,
  onClick,
}: TimelineCardProps) {
  return (
    <button
      key={view.id}
      type="button"
      data-testid={`timeline-card-${view.id}`}
      onClick={() => onClick(view.id)}
      className={`relative shrink-0 overflow-hidden transition-all duration-300 ${
        expanded
          ? 'shadow-card hover:scale-105'
          : isActive
            ? 'bg-aura-white'
            : 'bg-white/50 hover:bg-white/80'
      }`}
      style={{
        width,
        height,
        borderRadius,
        opacity: expanded ? (isInWindow ? 1 : 0) : 1,
        border: expanded && isActive ? '2px solid white' : 'none',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${view.imageUrl})`,
          opacity: expanded ? 1 : 0,
          transition: 'opacity 300ms ease-out',
        }}
      />

      <div
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
        style={{
          opacity: expanded ? 1 : 0,
          transition: 'opacity 300ms ease-out',
        }}
      />

      <span
        className={`absolute top-2 left-3 leading-none tracking-tight ${
          isActive
            ? 'text-aura-white text-2xl font-light'
            : 'text-xl font-light text-white/80'
        }`}
        style={{
          opacity: expanded ? 1 : 0,
          transition: 'opacity 300ms ease-out',
        }}
      >
        {String(displayIndex + 1).padStart(2, '0')}
      </span>

      <span
        className={`absolute right-3 bottom-2 left-3 truncate text-left leading-tight ${
          isActive
            ? 'text-aura-white text-sm font-medium'
            : 'text-xs font-medium text-white/80'
        }`}
        style={{
          opacity: expanded ? 1 : 0,
          transition: 'opacity 300ms ease-out',
        }}
      >
        {view.name}
      </span>
    </button>
  )
}
