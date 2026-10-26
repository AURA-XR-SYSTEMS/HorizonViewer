import React, { useEffect, useRef, useState } from 'react';
import BottomSheet from './BottomSheet';
import type { ViewNode } from './types';

/**
 * Viewpoint navigation for phones.
 *
 * Replaces the desktop carousel (fixed 144px cards sized from window width)
 * with a finger-scrollable strip of smaller cards plus a "N / total · name"
 * pill that opens a bottom sheet listing every viewpoint. Both sit above the
 * home-indicator safe area. Prev / next buttons are 44px for thumbs and also
 * serve keyboard users.
 */

interface MobileNavProps {
  views: ViewNode[];
  currentViewId: number;
  targetViewId: number | null;
  isTransitioning: boolean;
  /** Phone held sideways: shorter cards so the still keeps most of the height. */
  short: boolean;
  onSelect: (view: ViewNode) => void;
  onPrioritize: (viewId: number) => void;
}

const MobileNav: React.FC<MobileNavProps> = ({
  views,
  currentViewId,
  targetViewId,
  isTransitioning,
  short,
  onSelect,
  onPrioritize,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const index = Math.max(
    0,
    views.findIndex((v) => v.id === currentViewId)
  );
  const current = views[index];
  const cardW = short ? 96 : 112;
  const cardH = short ? 60 : 72;

  // Keep the active card in view as the tour advances.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const card = strip.querySelector<HTMLElement>(`[data-view-id="${currentViewId}"]`);
    if (!card) return;
    const left = card.offsetLeft - (strip.clientWidth - card.offsetWidth) / 2;
    strip.scrollTo({ left, behavior: 'smooth' });
  }, [currentViewId, views.length]);

  const go = (delta: number) => {
    const next = views[index + delta];
    if (next) onSelect(next);
  };

  const navButton = (
    label: string,
    disabled: boolean,
    onClick: () => void,
    path: string,
    testId: string
  ) => (
    <button
      type="button"
      aria-label={label}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="flex flex-shrink-0 items-center justify-center rounded-full"
      style={{
        width: 44,
        height: 44,
        background: 'rgba(255,255,255,0.18)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.3)',
        color: 'white',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={path} />
      </svg>
    </button>
  );

  return (
    <>
      <nav
        aria-label="Viewpoints"
        data-testid="mobile-nav"
        className="absolute inset-x-0 bottom-0 flex flex-col"
        style={{
          zIndex: 10000,
          paddingBottom: 'calc(var(--safe-bottom) + 8px)',
          paddingLeft: 'var(--safe-left)',
          paddingRight: 'var(--safe-right)',
          gap: short ? 6 : 8,
          background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))',
          pointerEvents: 'none',
        }}
      >
        <div
          ref={stripRef}
          className="hz-scroll-x flex items-end"
          data-testid="mobile-nav-strip"
          style={{
            gap: 8,
            padding: `8px max(12px, calc(50% - ${cardW / 2}px)) 2px`,
            pointerEvents: 'auto',
          }}
        >
          {views.map((node, i) => {
            const isActive = node.id === currentViewId && !isTransitioning;
            const isTarget = isTransitioning && node.id === targetViewId;
            return (
              <button
                key={node.id}
                type="button"
                data-view-id={node.id}
                data-testid={`mobile-nav-card-${node.id}`}
                aria-label={`${String(i + 1).padStart(2, '0')} ${node.name}`}
                aria-current={isActive ? 'true' : undefined}
                disabled={isTransitioning}
                onClick={() => onSelect(node)}
                onPointerEnter={() => onPrioritize(node.id)}
                onFocus={() => onPrioritize(node.id)}
                className="relative flex-shrink-0 overflow-hidden rounded-xl"
                style={{
                  width: cardW,
                  height: cardH,
                  scrollSnapAlign: 'center',
                  border:
                    isActive || isTarget
                      ? '2px solid white'
                      : '1px solid rgba(255,255,255,0.25)',
                  boxShadow: isActive ? '0 4px 16px rgba(0,0,0,0.4)' : 'none',
                  opacity: isActive || isTarget ? 1 : 0.75,
                  transition: 'opacity 200ms ease-out, border-color 200ms ease-out',
                }}
              >
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${node.thumbUrl || node.imageUrl})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <span
                  className="absolute left-2 top-1 font-bold leading-none text-white"
                  style={{ fontSize: 14, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className="absolute bottom-1 left-2 right-2 truncate text-left leading-tight text-white"
                  style={{ fontSize: 12, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                >
                  {node.name}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="flex items-center justify-center"
          style={{ gap: 10, padding: '0 12px', pointerEvents: 'auto' }}
        >
          {navButton(
            'Previous viewpoint',
            index === 0 || isTransitioning,
            () => go(-1),
            'm15 18-6-6 6-6',
            'mobile-nav-prev'
          )}
          <button
            type="button"
            data-testid="mobile-nav-pill"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen(true)}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4"
            style={{
              height: 44,
              maxWidth: 320,
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              fontSize: 15,
            }}
          >
            <span className="flex-shrink-0 font-semibold tabular-nums">
              {index + 1} / {views.length}
            </span>
            <span className="truncate" style={{ opacity: 0.85 }}>
              {current?.name}
            </span>
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
          </button>
          {navButton(
            'Next viewpoint',
            index >= views.length - 1 || isTransitioning,
            () => go(1),
            'm9 18 6-6-6-6',
            'mobile-nav-next'
          )}
        </div>
      </nav>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Viewpoints"
        testId="viewpoint-sheet"
      >
        <ol className="flex flex-col" style={{ gap: 4 }}>
          {views.map((node, i) => {
            const isActive = node.id === currentViewId;
            return (
              <li key={node.id}>
                <button
                  type="button"
                  data-testid={`viewpoint-sheet-item-${node.id}`}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => {
                    setSheetOpen(false);
                    onSelect(node);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 text-left"
                  style={{
                    minHeight: 56,
                    background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                  }}
                >
                  <span
                    className="flex-shrink-0 rounded-lg bg-cover bg-center"
                    style={{
                      width: 64,
                      height: 44,
                      backgroundImage: `url(${node.thumbUrl || node.imageUrl})`,
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                  />
                  <span
                    className="flex-shrink-0 tabular-nums"
                    style={{ fontSize: 14, opacity: 0.6, width: 24 }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1 truncate" style={{ fontSize: 16 }}>
                    {node.name}
                  </span>
                  {isActive && (
                    <span
                      className="flex-shrink-0"
                      style={{ fontSize: 12, opacity: 0.7 }}
                    >
                      Current
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </BottomSheet>
    </>
  );
};

export default MobileNav;
