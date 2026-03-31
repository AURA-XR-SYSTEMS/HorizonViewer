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
    debugEnabled,
    transitionDebug,
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

  const visibleLocationMap = useMemo(() => {
    return new Map(visibleLocations.map((item) => [item.id, item]))
  }, [visibleLocations])

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

  const isPanelOpen = (locationId: string) =>
    openPanels.some((panel) => panel.location.id === locationId)

  const togglePanel = (location: AuraLocation) => {
    setOpenPanels((prev) =>
      prev.some((panel) => panel.location.id === location.id)
        ? prev.filter((panel) => panel.location.id !== location.id)
        : [...prev, { location }]
    )
  }

  const transitionDebugEntries = transitions.map((transition) => ({
    transition,
    debugState: transitionDebug[transition.key],
  }))

  return (
    <div className="bg-aura-black text-text-primary relative h-full w-full overflow-hidden">
      {transitionDebugEntries.map(({ transition, debugState }) => (
        <div
          key={transition.key}
          data-testid={`transition-container-${transition.key}`}
          data-transition-key={transition.key}
          data-transition-active={String(activeTransitionKey === transition.key)}
          data-transition-loadedmetadata={String(debugState?.loadedMetadata ?? false)}
          data-transition-canplay={String(debugState?.canPlay ?? false)}
          data-transition-play-requested={String(debugState?.playRequested ?? false)}
          data-transition-play-attempted={String(debugState?.playAttempted ?? false)}
          data-transition-playing={String(debugState?.playing ?? false)}
          data-transition-advancing={String(debugState?.advancing ?? false)}
          data-transition-completion-fired={String(debugState?.completionFired ?? false)}
          data-transition-completion-signal={debugState?.completionSignal ?? ''}
          data-transition-committed-view-id={String(debugState?.committedViewId ?? '')}
          data-transition-current-time={String(debugState?.currentTime ?? 0)}
          data-transition-duration={String(debugState?.duration ?? '')}
          data-transition-error={debugState?.error ?? ''}
          data-transition-play-rejected={debugState?.playRejected ?? ''}
          data-transition-last-event={debugState?.lastEvent ?? ''}
          className={`absolute inset-0 ${activeTransitionKey === transition.key ? 'z-10' : 'z-0'}`}
        >
          <video
            ref={(el) => {
              videoRefs.current[transition.key] = el
            }}
            data-testid={`transition-video-${transition.key}`}
            src={transition.videoUrl}
            className="h-full w-full object-cover"
            muted
            defaultMuted
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
          const visibleLocation = visibleLocationMap.get(panel.location.id)
          if (!visibleLocation) return null
          const { id, location, left, top } = visibleLocation
          return <LocationPanel key={id} location={location} left={left} top={top} />
        })}

      <div className="rounded-pill bg-surface-overlay absolute top-4 left-4 z-50 px-3 py-2 text-sm">
        Current view: {currentView?.name ?? 'Unknown'}
      </div>

      {debugEnabled ? (
        <pre
          data-testid="transition-debug-overlay"
          className="absolute top-4 right-4 z-[60] max-w-[min(36rem,calc(100%-2rem))] overflow-auto rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-[11px] leading-5 text-white/85 backdrop-blur"
        >
          {JSON.stringify(
            {
              currentViewId,
              currentViewName: currentView?.name ?? null,
              activeTransitionKey,
              isTransitioning,
              showStaticImage,
              transitions: transitionDebug,
            },
            null,
            2
          )}
        </pre>
      ) : null}

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
