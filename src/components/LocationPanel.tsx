import type { AuraLocation } from '@/types';

interface LocationPanelProps {
  location: AuraLocation;
  left: string;
  top: string;
}

export default function LocationPanel({
  location,
  left,
  top,
}: LocationPanelProps) {
  return (
    <div
      className="absolute z-50 min-w-[280px] max-w-[360px] overflow-hidden rounded-panel border border-surface-glass-border bg-surface-glass shadow-panel backdrop-blur-[var(--blur-glass)]"
      style={{
        left,
        top,
        transform: 'translate(40px, -28px)',
        transformOrigin: 'left top',
        animation: 'panelEmerge 200ms var(--ease-out-bounce)',
      }}
    >
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold tracking-wide text-text-primary">
          {location.Name}
        </h3>
        {location.Description?.Type && (
          <span className="text-xs uppercase tracking-wider text-text-muted">
            {location.Description.Type}
          </span>
        )}
      </div>

      <div className="space-y-3 px-4 py-3">
        {location.Description?.Short && (
          <p className="text-xs leading-relaxed text-text-secondary">
            {location.Description.Short}
          </p>
        )}

        {location.Address && (
          <div className="flex items-start gap-2">
            <span className="w-16 shrink-0 text-xs uppercase tracking-wider text-text-faint">
              Address
            </span>
            <span className="text-xs text-text-tertiary">{location.Address}</span>
          </div>
        )}

        {location.Region && (
          <div className="flex items-start gap-2">
            <span className="w-16 shrink-0 text-xs uppercase tracking-wider text-text-faint">
              Region
            </span>
            <span className="text-xs text-text-tertiary">{location.Region}</span>
          </div>
        )}

        {location.Attributes && Object.keys(location.Attributes).length > 0 && (
          <div className="border-t border-white/10 pt-2">
            <span className="mb-2 block text-xs uppercase tracking-wider text-text-faint">
              Details
            </span>

            <div className="space-y-1">
              {Object.entries(location.Attributes).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="w-24 shrink-0 text-xs text-text-muted">{key}</span>
                  <span className="text-xs font-medium text-text-secondary">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}