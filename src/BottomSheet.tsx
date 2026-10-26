import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * A phone bottom sheet: slides up from the bottom edge, sits above the safe
 * area, closes on the backdrop, the handle, Escape, or a downward drag.
 *
 * Only rendered on the compact layout; desktop keeps its anchored popovers.
 */

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Test id on the sheet panel. */
  testId?: string;
  /** Fraction of the viewport height the sheet may grow to. */
  maxHeight?: string;
  children: React.ReactNode;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onClose,
  title,
  testId,
  maxHeight = '70vh',
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; dy: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onHandleDown = (e: React.PointerEvent) => {
    // The close button shares this row; capturing its pointer would eat its click.
    if ((e.target as Element).closest('button')) return;
    drag.current = { startY: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!drag.current || !panelRef.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.startY);
    panelRef.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onHandleUp = () => {
    if (!drag.current || !panelRef.current) return;
    const dy = drag.current.dy;
    drag.current = null;
    panelRef.current.style.transform = '';
    if (dy > 80) onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0"
      style={{ zIndex: 20010 }}
      data-testid={testId ? `${testId}-root` : undefined}
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.35)', animation: 'fadeIn 160ms ease-out' }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl"
        style={{
          maxHeight,
          background: 'rgba(24,24,27,0.92)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderTop: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.35)',
          paddingBottom: 'var(--safe-bottom)',
          animation: 'sheetUp 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          color: 'white',
        }}
      >
        <div
          className="flex items-center justify-between px-4"
          style={{ minHeight: 52, touchAction: 'none' }}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.35)' }}
          />
          {title ? (
            <span className="pt-2 text-base font-semibold">{title}</span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid={testId ? `${testId}-close` : undefined}
            className="-mr-2 flex items-center justify-center rounded-full"
            style={{ width: 44, height: 44, color: 'rgba(255,255,255,0.8)' }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div
          className="overflow-y-auto px-4 pb-4"
          style={{ overscrollBehavior: 'contain' }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BottomSheet;
