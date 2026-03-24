import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ProjectConfig, AuraLocation } from './types';
import AuraPin from './AuraPin';
import ReviewTools from './ReviewTools';

interface AuraViewerProps {
  config: ProjectConfig;
}

const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);

const ChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const ChevronUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m18 15-6-6-6 6"/>
  </svg>
);

const AuraViewer: React.FC<AuraViewerProps> = ({ config }) => {
  const { views, transitions, locations } = config;

  const [currentViewId, setCurrentViewId] = useState(views[0]?.id || 1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeTransitionKey, setActiveTransitionKey] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [toolbarExpanded, setToolbarExpanded] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 1920, height: 1080 });
  const [openPanels, setOpenPanels] = useState<{ location: AuraLocation; left: string; top: string }[]>([]);

  // Video cache
  const videoCache = useRef<Map<string, HTMLVideoElement>>(new Map());
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTransitions = useMemo(
    () => transitions.filter(t => t.from === currentViewId),
    [transitions, currentViewId]
  );

  // Preload videos for transitions from the current view
  useEffect(() => {
    const cache = videoCache.current;
    const neededKeys = new Set(currentTransitions.map(t => t.key));

    for (const [key, video] of cache) {
      if (!neededKeys.has(key) && key !== activeTransitionKey) {
        video.pause();
        video.removeAttribute('src');
        video.load();
        cache.delete(key);
      }
    }

    for (const t of currentTransitions) {
      if (!cache.has(t.key)) {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.className = 'w-full h-full object-cover';
        video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:translateZ(0)';
        video.src = t.videoUrl;
        video.load();
        cache.set(t.key, video);
      }
    }
  }, [currentTransitions, activeTransitionKey]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  const calculatePinPosition = (pinX: number, pinY: number) => {
    if (containerSize.width === 0 || containerSize.height === 0) {
      return { left: `${pinX}%`, top: `${pinY}%`, visible: true };
    }

    const containerAspect = containerSize.width / containerSize.height;
    const imageAspect = imageNaturalSize.width / imageNaturalSize.height;

    let renderedWidth: number, renderedHeight: number, offsetX: number, offsetY: number;

    if (containerAspect > imageAspect) {
      renderedWidth = containerSize.width;
      renderedHeight = containerSize.width / imageAspect;
      offsetX = 0;
      offsetY = (containerSize.height - renderedHeight) / 2;
    } else {
      renderedHeight = containerSize.height;
      renderedWidth = containerSize.height * imageAspect;
      offsetX = (containerSize.width - renderedWidth) / 2;
      offsetY = 0;
    }

    const pixelX = offsetX + (pinX / 100) * renderedWidth;
    const pixelY = offsetY + (pinY / 100) * renderedHeight;

    const visible = pixelX >= 0 && pixelX <= containerSize.width &&
                    pixelY >= 0 && pixelY <= containerSize.height;

    return { left: `${pixelX}px`, top: `${pixelY}px`, visible };
  };

  const currentView = views.find(n => n.id === currentViewId);

  useEffect(() => {
    if (currentView?.imageUrl) {
      const img = new Image();
      img.onload = () => {
        setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = currentView.imageUrl;
    }
  }, [currentView?.imageUrl]);

  const handleTransition = useCallback((targetId: number) => {
    if (isTransitioning || targetId === currentViewId) return;

    const transitionKey = `${currentViewId}-${targetId}`;
    const video = videoCache.current.get(transitionKey);

    if (video) {
      // Keep current view's still visible — don't swap until video ends
      const container = videoContainerRef.current;
      if (container) {
        container.innerHTML = '';
        container.appendChild(video);
      }
      activeVideoRef.current = video;

      setActiveTransitionKey(transitionKey);
      setIsTransitioning(true);

      video.onended = () => {
        // Video finished — pause on last frame (it stays visible in DOM).
        // Swap the still behind it, wait for the image to load, then remove the video.
        video.pause();

        const targetView = views.find(v => v.id === targetId);
        if (targetView?.imageUrl) {
          const img = new Image();
          img.onload = () => {
            // Still is now painted behind the paused video — safe to remove
            setCurrentViewId(targetId);
            // Use rAF to ensure React has painted the new background before removing video
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setIsTransitioning(false);
                setActiveTransitionKey(null);
                activeVideoRef.current = null;
                if (container) container.innerHTML = '';
              });
            });
          };
          img.src = targetView.imageUrl;
        } else {
          setCurrentViewId(targetId);
          setIsTransitioning(false);
          setActiveTransitionKey(null);
          activeVideoRef.current = null;
          if (container) container.innerHTML = '';
        }
      };

      // Play immediately if buffered, otherwise wait for canplay
      const startPlayback = () => {
        video.play().catch(e => console.error("Video play failed:", e));
      };

      video.currentTime = 0;
      if (video.readyState >= 3) {
        // HAVE_FUTURE_DATA or better — play immediately
        startPlayback();
      } else {
        // Wait for enough data to play
        const onCanPlay = () => {
          video.removeEventListener('canplay', onCanPlay);
          startPlayback();
        };
        video.addEventListener('canplay', onCanPlay);
      }
    } else {
      setCurrentViewId(targetId);
    }
  }, [isTransitioning, currentViewId]);

  // Card dimensions
  const CARD_WIDTH = 144;
  const CARD_GAP = 12;
  const ARROW_WIDTH = 40;
  const ARROW_GAP = 12;
  const SIDE_PADDING = 48;

  const availableWidth = windowWidth - (2 * SIDE_PADDING) - (2 * ARROW_WIDTH) - (2 * ARROW_GAP);
  const maxCardsThatFit = Math.floor((availableWidth + CARD_GAP) / (CARD_WIDTH + CARD_GAP));
  const MAX_VISIBLE_CARDS = Math.max(2, Math.min(10, maxCardsThatFit, views.length));

  const scrollCarousel = (direction: 'left' | 'right') => {
    const maxIndex = Math.max(0, views.length - MAX_VISIBLE_CARDS);
    if (direction === 'left') {
      setCarouselIndex(prev => Math.max(0, prev - 1));
    } else {
      setCarouselIndex(prev => Math.min(maxIndex, prev + 1));
    }
  };

  const validCarouselIndex = Math.min(carouselIndex, Math.max(0, views.length - MAX_VISIBLE_CARDS));
  if (validCarouselIndex !== carouselIndex) {
    setCarouselIndex(validCarouselIndex);
  }

  const canScrollLeft = validCarouselIndex > 0;
  const canScrollRight = validCarouselIndex < views.length - MAX_VISIBLE_CARDS;

  const CARD_HEIGHT = 96;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">

      {/* Layer 0: Static View Image */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${currentView?.imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Layer 1: Location Pins (behind video) */}
      <div className="absolute inset-0 z-[5]">
        {locations.map(location => {
          const viewPosition = location.viewPositions.find(vp => vp.viewId === currentViewId);
          if (!viewPosition) return null;

          const pinPos = calculatePinPosition(viewPosition.x, viewPosition.y);
          if (!pinPos.visible) return null;

          return (
            <AuraPin
              key={location.id}
              location={location}
              left={pinPos.left}
              top={pinPos.top}
              isVisible={!isTransitioning}
              isSelected={openPanels.some(p => p.location.id === location.id)}
              onClick={(loc, left, top) => {
                const isAlreadyOpen = openPanels.some(p => p.location.id === loc.id);
                if (isAlreadyOpen) {
                  setOpenPanels(prev => prev.filter(p => p.location.id !== loc.id));
                } else {
                  setOpenPanels(prev => [...prev, { location: loc, left, top }]);
                }
              }}
            />
          );
        })}
      </div>

      {/* Panel Layer */}
      {!isTransitioning && openPanels.map(panel => (
        <div
          key={panel.location.id}
          className="absolute z-[9] rounded-xl overflow-hidden"
          style={{
            left: panel.left,
            top: panel.top,
            transform: 'translate(40px, -28px)',
            minWidth: '280px',
            maxWidth: '360px',
            background: 'rgba(60, 60, 60, 0.25)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(200, 200, 200, 0.4)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            transformOrigin: 'left top',
            animation: 'panelEmerge 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-white font-semibold text-sm tracking-wide">
              {panel.location.Name}
            </h3>
            {panel.location.Description?.Type && (
              <span className="text-white/50 text-xs uppercase tracking-wider">
                {panel.location.Description.Type}
              </span>
            )}
          </div>

          <div className="px-4 py-3 space-y-3">
            {panel.location.Description?.Short && (
              <p className="text-white/80 text-xs leading-relaxed">
                {panel.location.Description.Short}
              </p>
            )}

            {panel.location.Address && (
              <div className="flex items-start gap-2">
                <span className="text-white/40 text-xs uppercase tracking-wider w-16 flex-shrink-0">
                  Address
                </span>
                <span className="text-white/70 text-xs">
                  {panel.location.Address}
                </span>
              </div>
            )}

            {panel.location.Region && (
              <div className="flex items-start gap-2">
                <span className="text-white/40 text-xs uppercase tracking-wider w-16 flex-shrink-0">
                  Region
                </span>
                <span className="text-white/70 text-xs">
                  {panel.location.Region}
                </span>
              </div>
            )}

            {panel.location.Attributes && Object.keys(panel.location.Attributes).length > 0 && (
              <div className="pt-2 border-t border-white/10">
                <span className="text-white/40 text-xs uppercase tracking-wider block mb-2">
                  Details
                </span>
                <div className="space-y-1">
                  {Object.entries(panel.location.Attributes).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span className="text-white/50 text-xs w-24 flex-shrink-0">
                        {key}
                      </span>
                      <span className="text-white/80 text-xs font-medium">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Layer 2: Review Tools canvas overlay (behind video) */}
      <ReviewTools
        expanded={toolbarExpanded}
        onToggle={() => setToolbarExpanded(prev => !prev)}
        viewId={currentViewId}
        isTransitioning={isTransitioning}
        navExpanded={timelineExpanded}
        onNavToggle={() => setTimelineExpanded(prev => !prev)}
      />

      {/* Layer 3: Video container (on top of everything during transitions, pass-through when empty) */}
      <div
        ref={videoContainerRef}
        className="absolute inset-0 z-40"
        style={{
          willChange: 'transform',
          pointerEvents: isTransitioning ? 'auto' : 'none',
        }}
      />

      {/* Navigation - Centered Bottom Carousel */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2" style={{ zIndex: 10000 }}>
        <div className="flex flex-col items-center gap-1.5">

          <div className={`
            flex items-center transition-all duration-300 ease-out
            ${timelineExpanded ? 'gap-3' : 'gap-2'}
          `}>

            {canScrollLeft && timelineExpanded && (
              <button
                onClick={() => scrollCarousel('left')}
                disabled={isTransitioning}
                className="flex items-center justify-center shadow-lg hover:scale-105 transition-all duration-300 ease-out"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  background: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                }}
              >
                <ChevronLeft />
              </button>
            )}

            <div
              style={{
                overflow: 'hidden',
                width: timelineExpanded
                  ? MAX_VISIBLE_CARDS * CARD_WIDTH + (MAX_VISIBLE_CARDS - 1) * CARD_GAP + 20
                  : MAX_VISIBLE_CARDS * 6 + (MAX_VISIBLE_CARDS - 1) * 8,
                transition: 'width 300ms ease-out',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: timelineExpanded ? CARD_GAP : 8,
                  padding: timelineExpanded ? '10px 10px' : '0',
                  transform: timelineExpanded
                    ? `translateX(${-validCarouselIndex * (CARD_WIDTH + CARD_GAP)}px)`
                    : 'none',
                  transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1), gap 300ms ease-out, padding 300ms ease-out',
                }}
              >
                {(timelineExpanded ? views : views.slice(validCarouselIndex, validCarouselIndex + MAX_VISIBLE_CARDS)).map((node, index) => {
                  const actualIndex = timelineExpanded ? index : validCarouselIndex + index;
                  const isActive = node.id === currentViewId && !isTransitioning;
                  const isTarget = isTransitioning && transitions.some(t => t.key === activeTransitionKey && t.to === node.id);
                  const isInView = actualIndex >= validCarouselIndex && actualIndex < validCarouselIndex + MAX_VISIBLE_CARDS;

                  // Dock effect: active/target card grows, others shrink
                  const isBig = isActive || isTarget;
                  const cardW = timelineExpanded ? (isBig ? CARD_WIDTH * 1.15 : CARD_WIDTH * 0.9) : (isActive ? 10 : 6);
                  const cardH = timelineExpanded ? (isBig ? CARD_HEIGHT * 1.15 : CARD_HEIGHT * 0.9) : (isActive ? 10 : 6);
                  const borderRadius = timelineExpanded ? 12 : (isActive ? 5 : 3);

                  return (
                    <button
                      key={node.id}
                      onClick={() => handleTransition(node.id)}
                      disabled={isTransitioning}
                      className={`
                        relative overflow-hidden flex-shrink-0
                        ${timelineExpanded
                          ? 'shadow-lg hover:shadow-xl'
                          : `${isActive ? 'bg-white' : 'bg-white/50 hover:bg-white/80'}`
                        }
                        ${isTransitioning ? 'cursor-wait' : 'cursor-pointer'}
                      `}
                      style={{
                        width: cardW,
                        height: cardH,
                        borderRadius,
                        opacity: timelineExpanded ? (isInView ? 1 : 0) : 1,
                        border: timelineExpanded ? '1px solid rgba(255,255,255,0.2)' : 'none',
                        boxSizing: 'border-box',
                        transition: 'all 1.5s ease-out',
                      }}
                    >
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${node.imageUrl})`,
                          opacity: timelineExpanded ? 1 : 0,
                          transition: 'opacity 300ms ease-out',
                        }}
                      />
                      <div
                        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent"
                        style={{ opacity: timelineExpanded ? 1 : 0, transition: 'opacity 300ms ease-out' }}
                      />
                      <span
                        className="absolute top-2 left-3 font-bold tracking-tight leading-none text-white"
                        style={{
                          opacity: timelineExpanded ? 1 : 0,
                          transition: 'opacity 300ms ease-out',
                          fontSize: isBig ? 24 : 18,
                          textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        }}
                      >
                        {String(actualIndex + 1).padStart(2, '0')}
                      </span>
                      <span
                        className="absolute bottom-2 left-3 right-3 text-left font-normal truncate leading-tight text-white"
                        style={{
                          opacity: timelineExpanded ? 1 : 0,
                          transition: 'opacity 300ms ease-out',
                          fontSize: isBig ? 13 : 11,
                          textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        }}
                      >
                        {node.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {canScrollRight && timelineExpanded && (
              <button
                onClick={() => scrollCarousel('right')}
                disabled={isTransitioning}
                className="flex items-center justify-center shadow-lg hover:scale-105 transition-all duration-300 ease-out"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  background: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                }}
              >
                <ChevronRight />
              </button>
            )}

          </div>

        </div>
      </div>


    </div>
  );
};

export default AuraViewer;
