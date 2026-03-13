import { useEffect, useMemo, useState } from 'preact/hooks'
import AuraPin from '@/components/AuraPin'
import LocationPanel from '@/components/LocationPanel'
import TimelineCarousel from '@/components/TimelineCarousel'
import TimelineZone from '@/components/TimelineZone'
import { calculatePinPosition } from '@/lib/pinPosition'
import type { AuraLocation, ProjectConfig } from '@/types'
import {
  clampCarouselIndex,
  getTimelineLayout,
  getCarouselIndexForView,
} from '@/lib/timeline'
import { useViewerLayout } from '@/hooks/useViewerLayout'
import { useAuraTransitions } from '@/hooks/useAuraTransitions'

interface AuraViewerProps {
  config: ProjectConfig
}

interface OpenPanel {
  location: AuraLocation
}

interface VisibleLocationEnumerable {
  id: string
  location: AuraLocation
  left: string
  top: string
}

export default function AuraViewer({ config }: AuraViewerProps) {
  const { views, locations, transitions } = config

  const [currentViewId, setCurrentViewId] = useState(views[0]?.id ?? 1)
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 1920, height: 1080 })
  const [openPanels, setOpenPanels] = useState<OpenPanel[]>([])
  const [timelineExpanded, setTimelineExpanded] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const { containerRef, containerSize, windowWidth } = useViewerLayout()
  const {
    videoRefs,
    isTransitioning,
    activeTransitionKey,
    showStaticImage,
    transitionToView,
  } = useAuraTransitions({
    currentViewId,
    transitions,
    onViewChange: setCurrentViewId,
  })

  const currentView = useMemo(
    () => views.find((view) => view.id === currentViewId),
    [views, currentViewId]
  )

  const visibleLocations = useMemo<VisibleLocationEnumerable[]>(() => {
    return locations
      .map((location): VisibleLocationEnumerable | null => {
        const viewPosition = location.viewPositions.find(
          (position) => position.viewId === currentViewId
        )

        if (!viewPosition) return null

        const pinPos = calculatePinPosition(
          viewPosition.x,
          viewPosition.y,
          containerSize,
          imageNaturalSize
        )

        if (!pinPos.visible) return null

        return {
          id: location.id,
          location: location,
          left: pinPos.left,
          top: pinPos.top,
        }
      })
      .filter((item): item is VisibleLocationEnumerable => item !== null)
  }, [locations, currentViewId, containerSize, imageNaturalSize])

  useEffect(() => {
    setCarouselIndex((prev) => clampCarouselIndex(prev, windowWidth, views.length))
  }, [windowWidth, views.length])

  useEffect(() => {
    const selectedIndex = views.findIndex((view) => view.id === currentViewId)
    if (selectedIndex === -1) return

    setCarouselIndex((prev) =>
      getCarouselIndexForView(selectedIndex, prev, windowWidth, views.length)
    )
  }, [currentViewId, windowWidth, views])

  useEffect(() => {
    if (!currentView?.imageUrl) return

    const img = new Image()
    img.onload = () => {
      setImageNaturalSize({
        width: img.naturalWidth,
        height: img.naturalHeight,
      })
    }
    img.src = currentView.imageUrl
  }, [currentView?.imageUrl])

  useEffect(() => {
    setOpenPanels([])
  }, [currentViewId])

  const scrollCarousel = (direction: 'left' | 'right') => {
    const { maxIndex } = getTimelineLayout(windowWidth, views.length)

    if (direction === 'left') {
      setCarouselIndex((prev) => Math.max(0, prev - 1))
    } else {
      setCarouselIndex((prev) => Math.min(maxIndex, prev + 1))
    }
  }

  // preload transition videos
  useEffect(() => {
    transitions.forEach((t) => {
      const video = videoRefs.current[t.key]
      if (video) {
        video.load()
      }
    })
  }, [transitions])

  const isPanelOpen = (locationId: string) =>
    openPanels.some((panel) => panel.location.id === locationId)

  const togglePanel = (location: AuraLocation) => {
    setOpenPanels((prev) =>
      prev.some((panel) => panel.location.id === location.id)
        ? prev.filter((panel) => panel.location.id !== location.id)
        : [...prev, { location }]
    )
  }

  return (
    <div className="bg-aura-black text-text-primary relative h-full w-full overflow-hidden">
      {transitions.map((t) => (
        <div
          key={t.key}
          className={`absolute inset-0 ${activeTransitionKey === t.key ? 'z-10' : 'z-0'}`}
        >
          <video
            ref={(el) => {
              videoRefs.current[t.key] = el
            }}
            src={t.videoUrl}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="auto"
          />
        </div>
      ))}

      <div
        ref={containerRef}
        className={`absolute inset-0 z-20 bg-cover bg-center ${
          showStaticImage ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          backgroundImage: currentView ? `url(${currentView.imageUrl})` : undefined,
        }}
      >
        {visibleLocations.map(({ id, location, left, top }) => (
          <AuraPin
            key={id}
            location={location}
            left={left}
            top={top}
            isVisible={!isTransitioning}
            isSelected={isPanelOpen(id)}
            onClick={togglePanel}
          />
        ))}
      </div>

      {!isTransitioning && // hide panels during transition
        openPanels.map((panel) => {
          const viewPosition = panel.location.viewPositions.find(
            (position) => position.viewId === currentViewId
          )

          if (!viewPosition) {
            return null
          }

          const id = panel.location.id
          const pinPos = calculatePinPosition(
            viewPosition.x,
            viewPosition.y,
            containerSize,
            imageNaturalSize
          )

          if (!pinPos.visible) {
            return null
          }

          return (
            <LocationPanel
              key={id}
              location={panel.location}
              left={pinPos.left}
              top={pinPos.top}
            />
          )
        })}

      <div className="rounded-pill bg-surface-overlay absolute top-4 left-4 z-50 px-3 py-2 text-sm">
        Current view: {currentView?.name ?? 'Unknown'}
      </div>

      <TimelineZone
        expanded={timelineExpanded}
        onExpand={() => setTimelineExpanded(true)}
        onCollapse={() => setTimelineExpanded(false)}
      >
        <TimelineCarousel
          views={views}
          currentViewId={currentViewId}
          expanded={timelineExpanded}
          carouselIndex={carouselIndex}
          windowWidth={windowWidth}
          onSelectView={transitionToView}
          onScrollLeft={() => scrollCarousel('left')}
          onScrollRight={() => scrollCarousel('right')}
        />
      </TimelineZone>
    </div>
  )
}
