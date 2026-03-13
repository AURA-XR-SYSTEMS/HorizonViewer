import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import AuraPin from '@/components/AuraPin';
import LocationPanel from '@/components/LocationPanel';
import { calculatePinPosition } from '@/lib/pinPosition';
import type { AuraLocation, ProjectConfig } from '@/types';

interface AuraViewerProps {
  config: ProjectConfig;
}

interface OpenPanel {
  location: AuraLocation;
  left: string;
  top: string;
}

export default function AuraViewer({ config }: AuraViewerProps) {
  const { views, locations } = config;

  const [currentViewId, setCurrentViewId] = useState(views[0]?.id ?? 1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 1920, height: 1080 });
  const [openPanels, setOpenPanels] = useState<OpenPanel[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  const currentView = useMemo(
    () => views.find((view) => view.id === currentViewId),
    [views, currentViewId]
  );

  useEffect(() => {
    const updateContainerSize = () => {
      if (!containerRef.current) return;

      setContainerSize({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      });
    };

    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);

    return () => {
      window.removeEventListener('resize', updateContainerSize);
    };
  }, []);

  useEffect(() => {
    if (!currentView?.imageUrl) return;

    const img = new Image();
    img.onload = () => {
      setImageNaturalSize({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.src = currentView.imageUrl;
  }, [currentView?.imageUrl]);

  useEffect(() => {
    setOpenPanels([]);
  }, [currentViewId]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-aura-black text-text-primary">
      <div
        ref={containerRef}
        className="absolute inset-0 bg-center bg-cover"
        style={{
          backgroundImage: currentView ? `url(${currentView.imageUrl})` : undefined,
        }}
      >
        {locations.map((location) => {
          const viewPosition = location.viewPositions.find(
            (position) => position.viewId === currentViewId
          );

          if (!viewPosition) return null;

          const pinPos = calculatePinPosition(
            viewPosition.x,
            viewPosition.y,
            containerSize,
            imageNaturalSize
          );

          if (!pinPos.visible) return null;

          return (
            <AuraPin
              key={location.id}
              location={location}
              left={pinPos.left}
              top={pinPos.top}
              isVisible={true}
              isSelected={openPanels.some((panel) => panel.location.id === location.id)}
              onClick={(loc, left, top) => {
                const isAlreadyOpen = openPanels.some((panel) => panel.location.id === loc.id);

                if (isAlreadyOpen) {
                  setOpenPanels((prev) =>
                    prev.filter((panel) => panel.location.id !== loc.id)
                  );
                } else {
                  setOpenPanels((prev) => [...prev, { location: loc, left, top }]);
                }
              }}
            />
          );
        })}
      </div>

      {openPanels.map((panel) => (
        <LocationPanel
          key={panel.location.id}
          location={panel.location}
          left={panel.left}
          top={panel.top}
        />
      ))}

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