import { useCallback, useEffect, useRef } from 'react';

/**
 * Touch gestures on the still image: pinch to zoom, drag to pan while zoomed,
 * swipe between viewpoints, tap to toggle the UI, double-tap to zoom.
 *
 * The transform is written straight to the element's style during a gesture
 * (no React state per pointer move); `onZoomChange` reports the settled scale
 * so the viewer can decide whether a swipe is allowed and whether pins should
 * stay interactive.
 *
 * Pointer events are used throughout so a mouse on a touch laptop behaves the
 * same way. The element needs `touch-action: none` or the browser will claim
 * the pinch for page zoom first.
 */

export interface StillGestureHandlers {
  onSwipe?: (direction: 'left' | 'right') => void;
  onTap?: () => void;
  onZoomChange?: (scale: number) => void;
}

export interface StillGestureOptions extends StillGestureHandlers {
  enabled: boolean;
  maxScale?: number;
}

const SWIPE_MIN_PX = 60;
const TAP_MAX_PX = 10;
const TAP_MAX_MS = 350;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SCALE = 2.5;

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

export function useStillGestures<T extends HTMLElement>(options: StillGestureOptions) {
  const { enabled, maxScale = 4 } = options;
  const ref = useRef<T | null>(null);
  const handlers = useRef<StillGestureHandlers>(options);
  handlers.current = options;

  const transform = useRef<Transform>({ scale: 1, tx: 0, ty: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<{
    startDist: number;
    startScale: number;
    startTx: number;
    startTy: number;
    startMidX: number;
    startMidY: number;
    panStartX: number;
    panStartY: number;
    downX: number;
    downY: number;
    downAt: number;
    moved: boolean;
    multi: boolean;
  } | null>(null);
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);

  const apply = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scale, tx, ty } = transform.current;
    el.style.transform =
      scale === 1 && tx === 0 && ty === 0
        ? ''
        : `translate(${tx}px, ${ty}px) scale(${scale})`;
  }, []);

  const clamp = useCallback(
    (next: Transform): Transform => {
      const el = ref.current;
      const scale = Math.min(maxScale, Math.max(1, next.scale));
      if (!el || scale === 1) return { scale: 1, tx: 0, ty: 0 };
      // The image is scaled about its centre, so it may slide at most half of
      // the extra size in each direction before a gap opens at the edge.
      const maxTx = ((scale - 1) * el.clientWidth) / 2;
      const maxTy = ((scale - 1) * el.clientHeight) / 2;
      return {
        scale,
        tx: Math.min(maxTx, Math.max(-maxTx, next.tx)),
        ty: Math.min(maxTy, Math.max(-maxTy, next.ty)),
      };
    },
    [maxScale]
  );

  const setTransform = useCallback(
    (next: Transform, animate = false) => {
      const el = ref.current;
      const clamped = clamp(next);
      const changed = clamped.scale !== transform.current.scale;
      transform.current = clamped;
      if (el) el.style.transition = animate ? 'transform 220ms ease-out' : '';
      apply();
      if (changed) handlers.current.onZoomChange?.(clamped.scale);
    },
    [apply, clamp]
  );

  const reset = useCallback(
    (animate = true) => setTransform({ scale: 1, tx: 0, ty: 0 }, animate),
    [setTransform]
  );

  const zoomAt = useCallback(
    (clientX: number, clientY: number, scale: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Keep the tapped point under the finger: solve for the translation
      // that maps it to itself at the new scale.
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const px = clientX - cx;
      const py = clientY - cy;
      const { scale: s0, tx: tx0, ty: ty0 } = transform.current;
      const k = scale / s0;
      setTransform({ scale, tx: px - k * (px - tx0), ty: py - k * (py - ty0) }, true);
    },
    [setTransform]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Taps on controls inside the stage (the location pins) are theirs, not
      // a gesture. React's stopPropagation cannot stop this native listener,
      // so the check lives here.
      const target = e.target as Element | null;
      if (target?.closest('button, a, input, textarea, select, [data-no-gesture]'))
        return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        // Synthetic pointer ids (tests) cannot be captured; moves still arrive.
      }
      const pts = Array.from(pointers.current.values());
      const t = transform.current;
      if (pts.length === 2) {
        const [a, b] = pts;
        gesture.current = {
          ...(gesture.current ?? {
            downX: e.clientX,
            downY: e.clientY,
            downAt: performance.now(),
            moved: false,
            multi: false,
            panStartX: 0,
            panStartY: 0,
            startDist: 0,
            startScale: 1,
            startTx: 0,
            startTy: 0,
            startMidX: 0,
            startMidY: 0,
          }),
          startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          startScale: t.scale,
          startTx: t.tx,
          startTy: t.ty,
          startMidX: (a.x + b.x) / 2,
          startMidY: (a.y + b.y) / 2,
          multi: true,
          moved: true,
        };
      } else if (pts.length === 1) {
        gesture.current = {
          startDist: 0,
          startScale: t.scale,
          startTx: t.tx,
          startTy: t.ty,
          startMidX: 0,
          startMidY: 0,
          panStartX: e.clientX,
          panStartY: e.clientY,
          downX: e.clientX,
          downY: e.clientY,
          downAt: performance.now(),
          moved: false,
          multi: false,
        };
      }
      el.style.transition = '';
    };

    const onMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesture.current;
      if (!g) return;
      const pts = Array.from(pointers.current.values());

      if (pts.length >= 2 && g.multi) {
        const [a, b] = pts;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const scale = g.startScale * (dist / g.startDist);
        const k = scale / g.startScale;
        // Zoom about the pinch midpoint, then follow it as the fingers move.
        const px = g.startMidX - cx;
        const py = g.startMidY - cy;
        setTransform({
          scale,
          tx: px - k * (px - g.startTx) + (midX - g.startMidX),
          ty: py - k * (py - g.startTy) + (midY - g.startMidY),
        });
        return;
      }

      const dx = e.clientX - g.downX;
      const dy = e.clientY - g.downY;
      if (Math.hypot(dx, dy) > TAP_MAX_PX) g.moved = true;

      if (transform.current.scale > 1 && !g.multi) {
        setTransform({
          scale: transform.current.scale,
          tx: g.startTx + (e.clientX - g.panStartX),
          ty: g.startTy + (e.clientY - g.panStartY),
        });
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.delete(e.pointerId);
      const g = gesture.current;
      if (!g) return;

      if (pointers.current.size > 0) {
        // One finger lifted after a pinch: re-base the remaining finger as a
        // pan so the image does not jump.
        const rest = Array.from(pointers.current.values())[0];
        gesture.current = {
          ...g,
          multi: false,
          panStartX: rest.x,
          panStartY: rest.y,
          startTx: transform.current.tx,
          startTy: transform.current.ty,
          moved: true,
        };
        return;
      }

      gesture.current = null;
      const elapsed = performance.now() - g.downAt;
      const dx = e.clientX - g.downX;
      const dy = e.clientY - g.downY;

      if (g.multi) {
        if (transform.current.scale < 1.05) reset(true);
        return;
      }

      if (transform.current.scale === 1 && !g.moved && elapsed < TAP_MAX_MS) {
        const prev = lastTap.current;
        const now = performance.now();
        if (
          prev &&
          now - prev.at < DOUBLE_TAP_MS &&
          Math.hypot(prev.x - e.clientX, prev.y - e.clientY) < 30
        ) {
          lastTap.current = null;
          zoomAt(e.clientX, e.clientY, DOUBLE_TAP_SCALE);
          return;
        }
        lastTap.current = { at: now, x: e.clientX, y: e.clientY };
        window.setTimeout(() => {
          if (lastTap.current && lastTap.current.at === now) {
            lastTap.current = null;
            handlers.current.onTap?.();
          }
        }, DOUBLE_TAP_MS);
        return;
      }

      if (transform.current.scale > 1) {
        if (!g.moved && elapsed < TAP_MAX_MS) {
          const prev = lastTap.current;
          const now = performance.now();
          if (prev && now - prev.at < DOUBLE_TAP_MS) {
            lastTap.current = null;
            reset(true);
            return;
          }
          lastTap.current = { at: now, x: e.clientX, y: e.clientY };
        }
        return;
      }

      if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
        handlers.current.onSwipe?.(dx < 0 ? 'left' : 'right');
      }
    };

    const onCancel = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 0) gesture.current = null;
    };

    // Trackpad pinch and ctrl+wheel arrive as wheel events with ctrlKey.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const next = transform.current.scale * (e.deltaY < 0 ? 1.1 : 0.9);
      zoomAt(e.clientX, e.clientY, next);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('wheel', onWheel);
      pointers.current.clear();
      gesture.current = null;
    };
  }, [enabled, reset, setTransform, zoomAt]);

  return { ref, reset, zoomAt, getScale: () => transform.current.scale };
}
