import { useMemo } from 'preact/hooks';
import type { AuraView } from '@/types';

interface TimelineCarouselProps {
  views: AuraView[];
  currentViewId: number;
  expanded: boolean;
  carouselIndex: number;
  windowWidth: number;
  onSelectView: (viewId: number) => void;
  onScrollLeft: () => void;
  onScrollRight: () => void;
}

function ChevronLeft() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function TimelineCarousel({
  views,
  currentViewId,
  expanded,
  carouselIndex,
  windowWidth,
  onSelectView,
  onScrollLeft,
  onScrollRight,
}: TimelineCarouselProps) {
  const CARD_WIDTH = 144;
  const CARD_HEIGHT = 96;
  const CARD_GAP = 12;
  const ARROW_WIDTH = 40;
  const ARROW_GAP = 12;
  const SIDE_PADDING = 48;

  const availableWidth =
    windowWidth - 2 * SIDE_PADDING - 2 * ARROW_WIDTH - 2 * ARROW_GAP;

  const maxCardsThatFit = Math.floor((availableWidth + CARD_GAP) / (CARD_WIDTH + CARD_GAP));
  const maxVisibleCards = Math.max(2, Math.min(10, maxCardsThatFit, views.length));

  const validCarouselIndex = Math.min(
    carouselIndex,
    Math.max(0, views.length - maxVisibleCards)
  );

  const canScrollLeft = validCarouselIndex > 0;
  const canScrollRight = validCarouselIndex < views.length - maxVisibleCards;

  const visibleViews = useMemo(() => {
    if (!expanded) {
      return views.slice(validCarouselIndex, validCarouselIndex + maxVisibleCards);
    }
    return views;
  }, [expanded, views, validCarouselIndex, maxVisibleCards]);

  return (
    <div className="absolute inset-x-0 bottom-6 flex justify-center">
      <div
        className={`flex items-center transition-all duration-300 ${
          expanded ? 'gap-3' : 'gap-2'
        }`}
      >
        {canScrollLeft && (
          <button
            type="button"
            onClick={onScrollLeft}
            className={`flex items-center justify-center text-aura-black transition-all duration-300 ${
              expanded
                ? 'h-10 w-10 rounded-pill bg-white/90 shadow-card hover:scale-105 hover:bg-aura-white'
                : 'h-1.5 w-1.5 rounded-pill bg-white/40 hover:bg-white/60'
            }`}
          >
            {expanded && <ChevronLeft />}
          </button>
        )}

        <div
          className="overflow-hidden transition-all duration-300"
          style={{
            width: expanded
              ? maxVisibleCards * CARD_WIDTH + (maxVisibleCards - 1) * CARD_GAP + 20
              : maxVisibleCards * 6 + (maxVisibleCards - 1) * 8,
          }}
        >
          <div
            className="flex items-center transition-all duration-300"
            style={{
              gap: expanded ? `${CARD_GAP}px` : '8px',
              padding: expanded ? '10px 10px' : '0',
              transform: expanded
                ? `translateX(${-validCarouselIndex * (CARD_WIDTH + CARD_GAP)}px)`
                : 'none',
              transition:
                'transform 400ms cubic-bezier(0.4, 0, 0.2, 1), gap 300ms ease-out, padding 300ms ease-out',
            }}
          >
            {visibleViews.map((view, index) => {
              const actualIndex = expanded ? index : validCarouselIndex + index;
              const isActive = view.id === currentViewId;
              const isInWindow =
                actualIndex >= validCarouselIndex &&
                actualIndex < validCarouselIndex + maxVisibleCards;

              const width = expanded ? CARD_WIDTH : isActive ? 10 : 6;
              const height = expanded ? CARD_HEIGHT : isActive ? 10 : 6;
              const borderRadius = expanded ? 12 : isActive ? 5 : 3;

              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => onSelectView(view.id)}
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
                    className={`absolute left-3 top-2 leading-none tracking-tight ${
                      isActive ? 'text-2xl font-light text-aura-white' : 'text-xl font-light text-white/80'
                    }`}
                    style={{
                      opacity: expanded ? 1 : 0,
                      transition: 'opacity 300ms ease-out',
                    }}
                  >
                    {String(actualIndex + 1).padStart(2, '0')}
                  </span>

                  <span
                    className={`absolute bottom-2 left-3 right-3 truncate text-left leading-tight ${
                      isActive ? 'text-sm font-medium text-aura-white' : 'text-xs font-medium text-white/80'
                    }`}
                    style={{
                      opacity: expanded ? 1 : 0,
                      transition: 'opacity 300ms ease-out',
                    }}
                  >
                    {view.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {canScrollRight && (
          <button
            type="button"
            onClick={onScrollRight}
            className={`flex items-center justify-center text-aura-black transition-all duration-300 ${
              expanded
                ? 'h-10 w-10 rounded-pill bg-white/90 shadow-card hover:scale-105 hover:bg-aura-white'
                : 'h-1.5 w-1.5 rounded-pill bg-white/40 hover:bg-white/60'
            }`}
          >
            {expanded && <ChevronRight />}
          </button>
        )}
      </div>
    </div>
  );
}