import type { TargetedMouseEvent } from 'preact'
import type { AuraLocation } from '@/types'

interface AuraPinProps {
  location: AuraLocation
  left: string
  top: string
  isVisible: boolean
  isSelected: boolean
  onClick: (location: AuraLocation) => void
}

export default function AuraPin({
  location,
  left,
  top,
  isVisible,
  isSelected,
  onClick,
}: AuraPinProps) {
  const handlePinClick = (e: TargetedMouseEvent<SVGSVGElement>) => {
    e.stopPropagation()
    onClick(location)
  }

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-full transition-opacity duration-150"
      style={{
        left,
        top,
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      <svg
        onClick={handlePinClick}
        className={`cursor-pointer transition-transform duration-150 ${
          isSelected ? 'scale-125' : 'hover:scale-110'
        }`}
        width="24"
        height="28"
        viewBox="0 0 24 28"
        style={{ filter: 'drop-shadow(var(--shadow-pin))' }}
      >
        <path
          d="M12 26 L2 4 L22 4 Z"
          fill={isSelected ? 'var(--color-pin-fill-selected)' : 'var(--color-pin-fill)'}
          stroke="var(--color-pin-stroke)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
