import { useMemo } from 'preact/hooks'
import { CARD_GAP, CARD_HEIGHT, CARD_WIDTH, getTimelineLayout } from '@/lib/timeline'
import type { AuraView } from '@/types'
import { TimelineArrow } from './TimelineArrow'
import TimelineCard from './TimelineCard'

interface TimelineCarouselProps {
  views: AuraView[]
  currentViewId: number
  expanded: boolean
  carouselIndex: number
  windowWidth: number
  onSelectView: (viewId: number) => void
  onScrollLeft: () => void
  onScrollRight: () => void
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
  const { maxVisibleCards, maxIndex } = getTimelineLayout(windowWidth, views.length)
  const validCarouselIndex = Math.min(carouselIndex, maxIndex)

  const canScrollLeft = validCarouselIndex > 0
  const canScrollRight = validCarouselIndex < views.length - maxVisibleCards

  const visibleViews = useMemo(() => {
    if (!expanded) {
      return views.slice(validCarouselIndex, validCarouselIndex + maxVisibleCards)
    }
    return views
  }, [expanded, views, validCarouselIndex, maxVisibleCards])

  return (
    <div className="absolute inset-x-0 bottom-6 flex justify-center">
      <div
        className={`flex items-center transition-all duration-300 ${
          expanded ? 'gap-3' : 'gap-2'
        }`}
      >
        <TimelineArrow
          direction="left"
          expanded={expanded}
          enabled={canScrollLeft}
          onClick={onScrollLeft}
        />

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
              const actualIndex = expanded ? index : validCarouselIndex + index
              const isActive = view.id === currentViewId
              const isInWindow =
                actualIndex >= validCarouselIndex &&
                actualIndex < validCarouselIndex + maxVisibleCards

              const width = expanded ? CARD_WIDTH : isActive ? 10 : 6
              const height = expanded ? CARD_HEIGHT : isActive ? 10 : 6
              const borderRadius = expanded ? 12 : isActive ? 5 : 3

              return (
                <TimelineCard
                  key={view.id}
                  view={view}
                  displayIndex={actualIndex}
                  isActive={isActive}
                  expanded={expanded}
                  isInWindow={isInWindow}
                  width={width}
                  height={height}
                  borderRadius={borderRadius}
                  onClick={onSelectView}
                />
              )
            })}
          </div>
        </div>

        <TimelineArrow
          direction="right"
          expanded={expanded}
          enabled={canScrollRight}
          onClick={onScrollRight}
        />
      </div>
    </div>
  )
}
