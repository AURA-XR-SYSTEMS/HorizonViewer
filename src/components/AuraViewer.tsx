import { useMemo, useState } from 'preact/hooks';
import type { ProjectConfig } from '../types';

interface AuraViewerProps {
  config: ProjectConfig;
}

export default function AuraViewer({ config }: AuraViewerProps) {
  const { views } = config;
  const [currentViewId, setCurrentViewId] = useState(views[0]?.id ?? 1);

  const currentView = useMemo(
    () => views.find((view) => view.id === currentViewId),
    [views, currentViewId]
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-aura-black text-text-primary">
      <div
        className="absolute inset-0 bg-center bg-cover"
        style={{
          backgroundImage: currentView ? `url(${currentView.imageUrl})` : undefined,
        }}
      />

      <div className="absolute left-4 top-4 z-10 rounded-pill bg-surface-overlay px-3 py-2 text-sm">
        Current view: {currentView?.name ?? 'Unknown'}
      </div>

      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {views.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => setCurrentViewId(view.id)}
            className={`rounded-pill px-4 py-2 text-sm transition ${
              view.id === currentViewId
                ? 'bg-aura-white text-aura-black'
                : 'bg-surface-overlay text-text-secondary hover:text-text-primary'
            }`}
          >
            {view.name}
          </button>
        ))}
      </div>
    </div>
  );
}