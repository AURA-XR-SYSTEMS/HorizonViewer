import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ProjectConfig, AuraLocation, ViewNode } from './types';
import AuraPin from './AuraPin';
import ReviewTools from './ReviewTools';
import type { Session } from './lib/useSession';

interface AuraViewerProps {
  config: ProjectConfig;
  session: Session;
  /** Whether the signed-in account owns this scene, per the server. */
  canEdit: boolean;
  currentExportId?: string;
}

const MAX_CACHED_VIDEOS = 12;
const VIDEO_READY_TIMEOUT = 250;

const CARD_WIDTH = 144;
const CARD_HEIGHT = 96;
const CARD_GAP = 12;
const ARROW_WIDTH = 40;
const ARROW_GAP = 12;
const SIDE_PADDING = 48;

const ChevronLeft = () => (
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

const ChevronRight = () => (
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

const idle = (fn: () => void) =>
  typeof (window as any).requestIdleCallback === 'function'
    ? (window as any).requestIdleCallback(fn, { timeout: 2000 })
    : window.setTimeout(fn, 200);

const projectPin = (
  pinX: number,
  pinY: number,
  container: { width: number; height: number },
  image: { width: number; height: number }
) => {
  if (container.width === 0 || container.height === 0) {
    return { left: `${pinX}%`, top: `${pinY}%`, visible: true };
  }

  const containerAspect = container.width / container.height;
  const imageAspect = image.width / image.height;

  let renderedWidth: number, renderedHeight: number, offsetX: number, offsetY: number;

  if (containerAspect > imageAspect) {
    renderedWidth = container.width;
    renderedHeight = container.width / imageAspect;
    offsetX = 0;
    offsetY = (container.height - renderedHeight) / 2;
  } else {
    renderedHeight = container.height;
    renderedWidth = container.height * imageAspect;
    offsetX = (container.width - renderedWidth) / 2;
    offsetY = 0;
  }

  const pixelX = offsetX + (pinX / 100) * renderedWidth;
  const pixelY = offsetY + (pinY / 100) * renderedHeight;

  const visible =
    pixelX >= 0 && pixelX <= container.width && pixelY >= 0 && pixelY <= container.height;

  return { left: `${pixelX}px`, top: `${pixelY}px`, visible };
};

const AuraViewer: React.FC<AuraViewerProps> = ({
  config,
  session,
  canEdit,
  currentExportId,
}) => {
  const { views, transitions, locations } = config;

  const [currentViewId, setCurrentViewId] = useState(views[0]?.id || 1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeTransitionKey, setActiveTransitionKey] = useState<string | null>(null);
  const [fadeOutImage, setFadeOutImage] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [toolbarExpanded, setToolbarExpanded] = useState(true);
  const [viewport, setViewport] = useState({
    windowWidth: window.innerWidth,
    containerWidth: 0,
    containerHeight: 0,
  });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 1920, height: 1080 });
  const [openPanels, setOpenPanels] = useState<
    { location: AuraLocation; left: string; top: string }[]
  >([]);
  const [altLayerIndex, setAltLayerIndex] = useState<Record<number, number>>({});

  const videoCache = useRef<Map<string, HTMLVideoElement>>(new Map());
  const stillCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const warmQueue = useRef<string[]>([]);
  const warmingKey = useRef<string | null>(null);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentView = useMemo(
    () => views.find((v) => v.id === currentViewId),
    [views, currentViewId]
  );

  const currentTransitions = useMemo(
    () => transitions.filter((t) => t.from === currentViewId),
    [transitions, currentViewId]
  );

  // --- Still image cache ---
  const preloadStill = useCallback((url?: string) => {
    if (!url) return;
    if (stillCache.current.has(url)) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    stillCache.current.set(url, img);
  }, []);

  // --- Video cache (LRU, persistent across navigation) ---
  const acquireVideo = useCallback((key: string, url: string) => {
    const cache = videoCache.current;
    const existing = cache.get(key);
    if (existing) {
      cache.delete(key);
      cache.set(key, existing);
      return existing;
    }
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.className = 'w-full h-full object-cover';
    video.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:translateZ(0)';
    video.src = url;
    cache.set(key, video);
    return video;
  }, []);

  const evictExcess = useCallback((keep: Set<string>) => {
    const cache = videoCache.current;
    for (const key of Array.from(cache.keys())) {
      if (cache.size <= MAX_CACHED_VIDEOS) break;
      if (keep.has(key) || key === warmingKey.current) continue;
      const video = cache.get(key)!;
      video.pause();
      video.removeAttribute('src');
      video.load();
      cache.delete(key);
    }
  }, []);

  const pumpWarmQueue = useRef<() => void>(() => {});
  pumpWarmQueue.current = () => {
    if (warmingKey.current) return;
    const key = warmQueue.current.shift();
    if (!key) return;
    const video = videoCache.current.get(key);
    if (!video || video.readyState >= 4) {
      pumpWarmQueue.current();
      return;
    }
    warmingKey.current = key;
    const done = () => {
      video.removeEventListener('canplaythrough', done);
      video.removeEventListener('error', done);
      warmingKey.current = null;
      pumpWarmQueue.current();
    };
    video.addEventListener('canplaythrough', done);
    video.addEventListener('error', done);
    video.preload = 'auto';
    video.load();
  };

  // Hovering a card is a strong signal the user is about to click it.
  const prioritize = useCallback((key: string) => {
    const video = videoCache.current.get(key);
    if (!video || video.readyState >= 4) return;
    const queued = warmQueue.current.indexOf(key);
    if (queued >= 0) warmQueue.current.splice(queued, 1);
    warmQueue.current.unshift(key);
    if (video.preload !== 'auto') {
      video.preload = 'auto';
      video.load();
    }
  }, []);

  // On arrival, register outgoing transitions at metadata weight and warm them
  // one at a time so a single click never competes with four other downloads.
  useEffect(() => {
    const keys = currentTransitions.map((t) => t.key);
    for (const t of currentTransitions) acquireVideo(t.key, t.videoUrl);
    evictExcess(new Set(keys));

    warmQueue.current = keys.filter((k) => {
      const v = videoCache.current.get(k);
      return v && v.readyState < 4;
    });

    const handle = idle(() => pumpWarmQueue.current());
    return () => {
      if (typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, [currentTransitions, acquireVideo, evictExcess]);

  // Stills are small now; fetch the active one eagerly and the rest when idle.
  useEffect(() => {
    preloadStill(currentView?.imageUrl);
    const handle = idle(() => {
      for (const v of views) {
        preloadStill(v.thumbUrl);
        preloadStill(v.imageUrl);
        for (const alt of v.alternateLayers || []) preloadStill(alt.imageUrl);
      }
    });
    return () => {
      if (typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, [views, currentView?.imageUrl, preloadStill]);

  // Single rAF-throttled measure pass feeding one state object.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = containerRef.current;
      setViewport((prev) => {
        const next = {
          windowWidth: window.innerWidth,
          containerWidth: el ? el.offsetWidth : prev.containerWidth,
          containerHeight: el ? el.offsetHeight : prev.containerHeight,
        };
        return next.windowWidth === prev.windowWidth &&
          next.containerWidth === prev.containerWidth &&
          next.containerHeight === prev.containerHeight
          ? prev
          : next;
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const video of videoCache.current.values()) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      videoCache.current.clear();
    };
  }, []);

  const [videoExpanded, setVideoExpanded] = useState(false);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytDragRef = useRef<{
    isDragging: boolean;
    lastX: number;
    lastY: number;
    startX: number;
    startY: number;
    didDrag: boolean;
  }>({ isDragging: false, lastX: 0, lastY: 0, startX: 0, startY: 0, didDrag: false });

  const embed = currentView?.embed;
  const showEmbed = !!embed && embed.type === 'youtube360' && !isTransitioning;

  // Only pull in the YouTube API for projects that actually use an embed.
  const wantsEmbed = useMemo(
    () => views.some((v) => v.embed?.type === 'youtube360'),
    [views]
  );

  useEffect(() => {
    if (!wantsEmbed || (window as any).YT) return;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
  }, [wantsEmbed]);

  useEffect(() => {
    if (!showEmbed || !embed) {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
      return;
    }

    const createPlayer = () => {
      if (!ytContainerRef.current || ytPlayerRef.current) return;
      ytPlayerRef.current = new (window as any).YT.Player(ytContainerRef.current, {
        videoId: embed.videoId,
        playerVars: { enablejsapi: 1, playsinline: 1, rel: 0 },
      });
    };

    if ((window as any).YT && (window as any).YT.Player) {
      createPlayer();
    } else {
      (window as any).onYouTubeIframeAPIReady = createPlayer;
    }
  }, [showEmbed, embed]);

  const handleYtMouseDown = useCallback((e: React.MouseEvent) => {
    ytDragRef.current = {
      isDragging: true,
      lastX: e.clientX,
      lastY: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      didDrag: false,
    };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = ytDragRef.current;
      if (!d.isDragging || !ytPlayerRef.current) return;
      const deltaX = e.clientX - d.lastX;
      const deltaY = e.clientY - d.lastY;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      if (Math.abs(e.clientX - d.startX) > 5 || Math.abs(e.clientY - d.startY) > 5)
        d.didDrag = true;
      try {
        const props = ytPlayerRef.current.getSphericalProperties();
        if (props && typeof props.yaw === 'number') {
          ytPlayerRef.current.setSphericalProperties({
            yaw: props.yaw + deltaX * 0.3,
            pitch: Math.max(-90, Math.min(90, props.pitch + deltaY * 0.3)),
            roll: props.roll,
            fov: props.fov,
          });
        }
      } catch (_) {}
    };
    const onUp = () => {
      ytDragRef.current.isDragging = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleYtClick = useCallback(() => {
    if (!ytPlayerRef.current) return;
    const state = ytPlayerRef.current.getPlayerState();
    if (state === 1) {
      ytPlayerRef.current.pauseVideo();
    } else {
      ytPlayerRef.current.playVideo();
    }
  }, []);

  useEffect(() => {
    if (!currentView?.imageUrl) return;
    const img = new Image();
    img.onload = () =>
      setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = currentView.imageUrl;
  }, [currentView?.imageUrl]);

  const handleTransition = useCallback(
    (targetId: number) => {
      if (isTransitioning || targetId === currentViewId) return;

      const targetView = views.find((v) => v.id === targetId);
      const fromImage = currentView?.imageUrl ?? null;
      const transitionKey = `${currentViewId}-${targetId}`;
      const video = videoCache.current.get(transitionKey);

      // The destination still has the whole transition to arrive.
      preloadStill(targetView?.imageUrl);

      const crossfade = () => {
        setFadeOutImage(fromImage);
        setCurrentViewId(targetId);
        setIsTransitioning(false);
        setActiveTransitionKey(null);
        activeVideoRef.current = null;
        const container = videoContainerRef.current;
        if (container) container.replaceChildren();
      };

      if (!video) {
        crossfade();
        return;
      }

      setActiveTransitionKey(transitionKey);
      setIsTransitioning(true);
      setVideoExpanded(false);

      video.onended = () => {
        video.pause();
        const swap = () => {
          setCurrentViewId(targetId);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setIsTransitioning(false);
              setActiveTransitionKey(null);
              activeVideoRef.current = null;
              const container = videoContainerRef.current;
              if (container) container.replaceChildren();
            });
          });
        };

        const cached = targetView?.imageUrl
          ? stillCache.current.get(targetView.imageUrl)
          : undefined;
        if (cached && !cached.complete) {
          cached.addEventListener('load', swap, { once: true });
          cached.addEventListener('error', swap, { once: true });
        } else {
          swap();
        }
      };

      let settled = false;
      const play = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        video.removeEventListener('canplay', play);
        const container = videoContainerRef.current;
        if (container) container.replaceChildren(video);
        activeVideoRef.current = video;
        video.currentTime = 0;
        video.play().catch(() => {
          video.onended = null;
          crossfade();
        });
      };

      // Never sit on a blank frame waiting for bytes — fall back to a crossfade.
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        video.removeEventListener('canplay', play);
        video.onended = null;
        crossfade();
      }, VIDEO_READY_TIMEOUT);

      if (video.readyState >= 3) {
        play();
      } else {
        video.addEventListener('canplay', play);
        if (video.preload !== 'auto') {
          video.preload = 'auto';
          video.load();
        }
      }
    },
    [isTransitioning, currentViewId, views, currentView?.imageUrl, preloadStill]
  );

  const availableWidth =
    viewport.windowWidth - 2 * SIDE_PADDING - 2 * ARROW_WIDTH - 2 * ARROW_GAP;
  const maxCardsThatFit = Math.floor(
    (availableWidth + CARD_GAP) / (CARD_WIDTH + CARD_GAP)
  );
  const MAX_VISIBLE_CARDS = Math.max(2, Math.min(10, maxCardsThatFit, views.length));

  const maxIndex = Math.max(0, views.length - MAX_VISIBLE_CARDS);
  const validCarouselIndex = Math.min(carouselIndex, maxIndex);

  const scrollCarousel = useCallback(
    (direction: 'left' | 'right') => {
      setCarouselIndex((prev) => {
        const clamped = Math.min(prev, maxIndex);
        return direction === 'left'
          ? Math.max(0, clamped - 1)
          : Math.min(maxIndex, clamped + 1);
      });
    },
    [maxIndex]
  );

  const canScrollLeft = validCarouselIndex > 0;
  const canScrollRight = validCarouselIndex < maxIndex;

  const pinPositions = useMemo(() => {
    const container = {
      width: viewport.containerWidth,
      height: viewport.containerHeight,
    };
    return locations.map((location) => {
      const viewPosition = location.viewPositions.find(
        (vp) => vp.viewId === currentViewId
      );
      if (!viewPosition) return null;
      const pos = projectPin(viewPosition.x, viewPosition.y, container, imageNaturalSize);
      return pos.visible ? { location, ...pos } : null;
    });
  }, [
    locations,
    currentViewId,
    viewport.containerWidth,
    viewport.containerHeight,
    imageNaturalSize,
  ]);

  const handlePinClick = useCallback((loc: AuraLocation, left: string, top: string) => {
    setOpenPanels((prev) =>
      prev.some((p) => p.location.id === loc.id)
        ? prev.filter((p) => p.location.id !== loc.id)
        : [...prev, { location: loc, left, top }]
    );
  }, []);

  const handleCardClick = useCallback(
    (node: ViewNode) => {
      if (
        node.id === currentViewId &&
        node.alternateLayers &&
        node.alternateLayers.length > 0
      ) {
        const totalLayers = node.alternateLayers.length + 1;
        setAltLayerIndex((prev) => ({
          ...prev,
          [node.id]: ((prev[node.id] || 0) + 1) % totalLayers,
        }));
      } else {
        handleTransition(node.id);
      }
    },
    [currentViewId, handleTransition]
  );

  return (
    <div
      data-testid="aura-viewer"
      data-current-view={currentView?.name ?? ''}
      className="relative h-full w-full overflow-hidden bg-black"
    >
      {/* Layer 0: Static View Image (base) */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${currentView?.imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Layer 0a: Outgoing still, fading out when no transition video was ready */}
      {fadeOutImage && (
        <div
          className="absolute inset-0 z-[2]"
          style={{
            backgroundImage: `url(${fadeOutImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            animation: 'viewCrossfade 300ms ease-out forwards',
            pointerEvents: 'none',
          }}
          onAnimationEnd={() => setFadeOutImage(null)}
        />
      )}

      {/* Layer 0b: Alternate layer (fades in/out on top of base) */}
      {currentView?.alternateLayers &&
        currentView.alternateLayers.length > 0 &&
        currentView.alternateLayers.map((alt, i) => {
          const activeAlt = (altLayerIndex[currentViewId] || 0) - 1;
          return (
            <div
              key={`alt-${currentViewId}-${i}`}
              className="absolute inset-0 z-[1]"
              style={{
                backgroundImage: `url(${alt.imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: activeAlt === i ? 1 : 0,
                transition: 'opacity 600ms ease-in-out',
              }}
            />
          );
        })}

      {/* Layer 1: Location Pins (behind video) */}
      <div className="absolute inset-0 z-[5]">
        {pinPositions.map((entry, i) => {
          if (!entry) return null;
          return (
            <AuraPin
              key={locations[i].id}
              location={entry.location}
              left={entry.left}
              top={entry.top}
              isVisible={!isTransitioning}
              isSelected={openPanels.some((p) => p.location.id === entry.location.id)}
              onClick={handlePinClick}
            />
          );
        })}
      </div>

      {/* Panel Layer */}
      {!isTransitioning &&
        openPanels.map((panel) => (
          <div
            key={panel.location.id}
            className="absolute z-[9] overflow-hidden rounded-xl"
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
            <div className="border-b border-white/10 px-4 py-3">
              <h3 className="text-sm font-semibold tracking-wide text-white">
                {panel.location.Name}
              </h3>
              {panel.location.Description?.Type && (
                <span className="text-xs uppercase tracking-wider text-white/50">
                  {panel.location.Description.Type}
                </span>
              )}
            </div>

            <div className="space-y-3 px-4 py-3">
              {panel.location.Description?.Short && (
                <p className="text-xs leading-relaxed text-white/80">
                  {panel.location.Description.Short}
                </p>
              )}

              {panel.location.Address && (
                <div className="flex items-start gap-2">
                  <span className="w-16 flex-shrink-0 text-xs uppercase tracking-wider text-white/40">
                    Address
                  </span>
                  <span className="text-xs text-white/70">{panel.location.Address}</span>
                </div>
              )}

              {panel.location.Region && (
                <div className="flex items-start gap-2">
                  <span className="w-16 flex-shrink-0 text-xs uppercase tracking-wider text-white/40">
                    Region
                  </span>
                  <span className="text-xs text-white/70">{panel.location.Region}</span>
                </div>
              )}

              {panel.location.Attributes &&
                Object.keys(panel.location.Attributes).length > 0 && (
                  <div className="border-t border-white/10 pt-2">
                    <span className="mb-2 block text-xs uppercase tracking-wider text-white/40">
                      Details
                    </span>
                    <div className="space-y-1">
                      {Object.entries(panel.location.Attributes).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2">
                          <span className="w-24 flex-shrink-0 text-xs text-white/50">
                            {key}
                          </span>
                          <span className="text-xs font-medium text-white/80">
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

      {/* YouTube 360 embed */}
      {showEmbed && (
        <>
          {videoExpanded && (
            <div
              className="absolute inset-0"
              style={{ zIndex: 20000, background: 'rgba(0,0,0,0.6)', cursor: 'pointer' }}
              onClick={() => setVideoExpanded(false)}
            />
          )}
          <div
            className="absolute"
            style={{
              zIndex: videoExpanded ? 20001 : 9,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: videoExpanded ? '75vw' : '25vw',
              aspectRatio: '16 / 9',
              borderRadius: videoExpanded ? 8 : 12,
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              border: '1px solid rgba(255,255,255,0.3)',
              transition:
                'width 400ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 400ms ease',
            }}
          >
            <div
              ref={ytContainerRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />

            <div
              style={{
                position: 'absolute',
                inset: 0,
                bottom: videoExpanded ? 50 : 0,
                zIndex: 1,
                cursor: videoExpanded ? 'grab' : 'pointer',
              }}
              onMouseDown={(e) => {
                if (!videoExpanded) return;
                handleYtMouseDown(e);
              }}
              onClick={() => {
                if (!videoExpanded) {
                  setVideoExpanded(true);
                } else if (!ytDragRef.current.didDrag) {
                  handleYtClick();
                }
              }}
            >
              {!videoExpanded && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.15)' }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.55)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Layer 2: Review Tools canvas overlay (behind video) */}
      <ReviewTools
        expanded={toolbarExpanded}
        onToggle={() => setToolbarExpanded((prev) => !prev)}
        viewId={currentViewId}
        isTransitioning={isTransitioning}
        navExpanded={timelineExpanded}
        onNavToggle={() => setTimelineExpanded((prev) => !prev)}
        session={session}
        canEdit={canEdit}
        currentExportId={currentExportId}
      />

      {/* Layer 3: Video container (on top during transitions, pass-through when empty) */}
      <div
        ref={videoContainerRef}
        className="absolute inset-0 z-40"
        style={{
          willChange: 'transform',
          pointerEvents: isTransitioning ? 'auto' : 'none',
        }}
      />

      {/* Navigation - Centered Bottom Carousel */}
      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2"
        style={{ zIndex: 10000 }}
      >
        <div className="flex flex-col items-center gap-1.5">
          <div
            className={`flex items-center transition-all duration-300 ease-out ${timelineExpanded ? 'gap-3' : 'gap-2'} `}
          >
            {canScrollLeft && timelineExpanded && (
              <button
                onClick={() => scrollCarousel('left')}
                disabled={isTransitioning}
                className="flex items-center justify-center shadow-lg transition-all duration-300 ease-out hover:scale-105"
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
                  ? MAX_VISIBLE_CARDS * CARD_WIDTH +
                    (MAX_VISIBLE_CARDS - 1) * CARD_GAP +
                    20
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
                  transition:
                    'transform 400ms cubic-bezier(0.4, 0, 0.2, 1), gap 300ms ease-out, padding 300ms ease-out',
                }}
              >
                {(timelineExpanded
                  ? views
                  : views.slice(
                      validCarouselIndex,
                      validCarouselIndex + MAX_VISIBLE_CARDS
                    )
                ).map((node, index) => {
                  const actualIndex = timelineExpanded
                    ? index
                    : validCarouselIndex + index;
                  const isActive = node.id === currentViewId && !isTransitioning;
                  const isTarget =
                    isTransitioning &&
                    transitions.some(
                      (t) => t.key === activeTransitionKey && t.to === node.id
                    );
                  const isInView =
                    actualIndex >= validCarouselIndex &&
                    actualIndex < validCarouselIndex + MAX_VISIBLE_CARDS;

                  // Dock effect runs on the compositor: the layout box stays fixed
                  // and only `transform` animates, so navigating never triggers layout.
                  const isBig = isActive || isTarget;
                  const scale = isBig ? 1.15 : 0.9;
                  const dotSize = isActive ? 10 : 6;
                  const borderRadius = timelineExpanded ? 12 : isActive ? 5 : 3;

                  return (
                    <button
                      key={node.id}
                      onClick={() => handleCardClick(node)}
                      onPointerEnter={() => prioritize(`${currentViewId}-${node.id}`)}
                      onFocus={() => prioritize(`${currentViewId}-${node.id}`)}
                      disabled={isTransitioning}
                      className={`relative flex-shrink-0 overflow-hidden ${
                        timelineExpanded
                          ? 'shadow-lg hover:shadow-xl'
                          : `${isActive ? 'bg-white' : 'bg-white/50 hover:bg-white/80'}`
                      } ${isTransitioning ? 'cursor-wait' : 'cursor-pointer'} `}
                      style={{
                        width: timelineExpanded ? CARD_WIDTH : dotSize,
                        height: timelineExpanded ? CARD_HEIGHT : dotSize,
                        transform: timelineExpanded ? `scale(${scale})` : 'none',
                        borderRadius,
                        opacity: timelineExpanded ? (isInView ? 1 : 0) : 1,
                        border: timelineExpanded
                          ? '1px solid rgba(255,255,255,0.2)'
                          : 'none',
                        boxSizing: 'border-box',
                        willChange: 'transform',
                        transition:
                          'transform 600ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease-out, width 300ms ease-out, height 300ms ease-out, border-radius 300ms ease-out',
                      }}
                    >
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${node.thumbUrl || node.imageUrl})`,
                          opacity: timelineExpanded ? 1 : 0,
                          transition: 'opacity 300ms ease-out',
                        }}
                      />
                      <div
                        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent"
                        style={{
                          opacity: timelineExpanded ? 1 : 0,
                          transition: 'opacity 300ms ease-out',
                        }}
                      />
                      <span
                        className="absolute left-3 top-2 font-bold leading-none tracking-tight text-white"
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
                        className="absolute bottom-2 left-3 right-3 truncate text-left font-normal leading-tight text-white"
                        style={{
                          opacity: timelineExpanded ? 1 : 0,
                          transition: 'opacity 300ms ease-out',
                          fontSize: isBig ? 13 : 11,
                          textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        }}
                      >
                        {node.name}
                      </span>
                      {timelineExpanded &&
                        node.alternateLayers &&
                        node.alternateLayers.length > 0 &&
                        isActive && (
                          <div className="absolute right-2 top-2 flex gap-1">
                            {[0, ...node.alternateLayers.map((_, i) => i + 1)].map(
                              (layerIdx) => (
                                <div
                                  key={layerIdx}
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background:
                                      (altLayerIndex[node.id] || 0) === layerIdx
                                        ? 'white'
                                        : 'rgba(255,255,255,0.4)',
                                    transition: 'background 300ms ease',
                                  }}
                                />
                              )
                            )}
                          </div>
                        )}
                    </button>
                  );
                })}
              </div>
            </div>

            {canScrollRight && timelineExpanded && (
              <button
                onClick={() => scrollCarousel('right')}
                disabled={isTransitioning}
                className="flex items-center justify-center shadow-lg transition-all duration-300 ease-out hover:scale-105"
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
