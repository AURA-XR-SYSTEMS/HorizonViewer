import { useEffect, useState } from 'react';

/**
 * Viewport and input-capability queries for the mobile layout.
 *
 * Breakpoints (see README "Mobile"):
 *   compact   width < 768px, or a touch device in landscape (height < 500px)
 *   short     height < 500px, a phone held sideways
 *   coarse    the primary pointer is a finger
 *
 * Everything phone-specific in the viewer keys off `useCompactLayout()`, so a
 * desktop browser at full size takes none of these branches and renders
 * exactly as before.
 */

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}

export const NARROW_QUERY = '(max-width: 767px)';
export const SHORT_QUERY = '(max-height: 500px)';
export const COARSE_QUERY = '(pointer: coarse)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function useIsShort(): boolean {
  return useMediaQuery(SHORT_QUERY);
}

export function useCoarsePointer(): boolean {
  return useMediaQuery(COARSE_QUERY);
}

export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}

/** True on phones in either orientation; false on every desktop window. */
export function useCompactLayout(): boolean {
  const narrow = useMediaQuery(NARROW_QUERY);
  const short = useIsShort();
  const coarse = useCoarsePointer();
  return narrow || (coarse && short);
}
