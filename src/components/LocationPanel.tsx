import type { AuraLocation } from '@/types'

interface LocationPanelProps {
  location: AuraLocation
  left: string
  top: string
}

export default function LocationPanel({ location, left, top }: LocationPanelProps) {
  return (
    <div
      className="rounded-panel border-surface-glass-border bg-surface-glass shadow-panel absolute z-50 max-w-[360px] min-w-[280px] overflow-hidden border backdrop-blur-[var(--blur-glass)]"
      style={{
        left,
        top,
        transform: 'translate(40px, -28px)',
        transformOrigin: 'left top',
        animation: 'panelEmerge 200ms var(--ease-out-bounce)',
      }}
    >
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-text-primary text-sm font-semibold tracking-wide">
          {location.Name}
        </h3>
        {location.Description?.Type && (
          <span className="text-text-muted text-xs tracking-wider uppercase">
            {location.Description.Type}
          </span>
        )}
      </div>

      <div className="space-y-3 px-4 py-3">
        {location.Description?.Short && (
          <p className="text-text-secondary text-xs leading-relaxed">
            {location.Description.Short}
          </p>
        )}

        {location.Address && (
          <div className="flex items-start gap-2">
            <span className="text-text-faint w-16 shrink-0 text-xs tracking-wider uppercase">
              Address
            </span>
            <span className="text-text-tertiary text-xs">{location.Address}</span>
          </div>
        )}

        {location.Region && (
          <div className="flex items-start gap-2">
            <span className="text-text-faint w-16 shrink-0 text-xs tracking-wider uppercase">
              Region
            </span>
            <span className="text-text-tertiary text-xs">{location.Region}</span>
          </div>
        )}

        {location.Attributes && Object.keys(location.Attributes).length > 0 && (
          <div className="border-t border-white/10 pt-2">
            <span className="text-text-faint mb-2 block text-xs tracking-wider uppercase">
              Details
            </span>

            <div className="space-y-1">
              {Object.entries(location.Attributes).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-text-muted w-24 shrink-0 text-xs">{key}</span>
                  <span className="text-text-secondary text-xs font-medium">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
