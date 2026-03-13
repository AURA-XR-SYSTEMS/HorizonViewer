import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import AuraPin from '@/components/AuraPin'
import LocationPanel from '@/components/LocationPanel'
import TimelineCarousel from '@/components/TimelineCarousel'
import TimelineZone from '@/components/TimelineZone'
import { calculatePinPosition } from '@/lib/pinPosition'
import type { AuraLocation, ProjectConfig } from '@/types'

interface AuraViewerProps {
  config: ProjectConfig
}

interface OpenPanel {
  location: AuraLocation
}

export default function AuraViewer({ config }: AuraViewerProps) {
  const { views, locations } = config

  const [currentViewId, setCurrentViewId] = useState(views[0]?.id ?? 1)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 1920, height: 1080 })
  const [openPanels, setOpenPanels] = useState<OpenPanel[]>([])
  const [timelineExpanded, setTimelineExpanded] = useState(false)
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [carouselIndex, setCarouselIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)

  const currentView = useMemo(
    () => views.find((view) => view.id === currentViewId),
    [views, currentViewId]
  )

  useEffect(() => {
    const updateContainerSize = () => {
      if (!containerRef.current) return

      setContainerSize({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      })
    }

    updateContainerSize()
    window.addEventListener('resize', updateContainerSize)

    return () => {
      window.removeEventListener('resize', updateContainerSize)
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)

      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
    const CARD_WIDTH = 144
    const CARD_GAP = 12
    const ARROW_WIDTH = 40
    const ARROW_GAP = 12
    const SIDE_PADDING = 48

    const availableWidth =
      windowWidth - 2 * SIDE_PADDING - 2 * ARROW_WIDTH - 2 * ARROW_GAP

    const maxCardsThatFit = Math.floor(
      (availableWidth + CARD_GAP) / (CARD_WIDTH + CARD_GAP)
    )
    const maxVisibleCards = Math.max(2, Math.min(10, maxCardsThatFit, views.length))
    const maxIndex = Math.max(0, views.length - maxVisibleCards)

    if (direction === 'left') {
      setCarouselIndex((prev) => Math.max(0, prev - 1))
    } else {
      setCarouselIndex((prev) => Math.min(maxIndex, prev + 1))
    }
  }

  return (
    <div className="bg-aura-black text-text-primary relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: currentView ? `url(${currentView.imageUrl})` : undefined,
        }}
      >
        {locations.map((location) => {
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

          return (
            <AuraPin
              key={location.id}
              location={location}
              left={pinPos.left}
              top={pinPos.top}
              isVisible={true}
              isSelected={openPanels.some((panel) => panel.location.id === location.id)}
              onClick={(loc) => {
                const isAlreadyOpen = openPanels.some(
                  (panel) => panel.location.id === loc.id
                )

                if (isAlreadyOpen) {
                  setOpenPanels((prev) =>
                    prev.filter((panel) => panel.location.id !== loc.id)
                  )
                } else {
                  setOpenPanels((prev) => [...prev, { location: loc }])
                }
              }}
            />
          )
        })}
      </div>

      {openPanels.map((panel) => {
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

      <div className="rounded-pill bg-surface-overlay absolute top-4 left-4 z-10 px-3 py-2 text-sm">
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
          onSelectView={(viewId) => setCurrentViewId(viewId)}
          onScrollLeft={() => scrollCarousel('left')}
          onScrollRight={() => scrollCarousel('right')}
        />
      </TimelineZone>
    </div>
  )
}
