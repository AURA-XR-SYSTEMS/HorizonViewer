/**
 * Decides where a viewer session gets its config from.
 *
 * Two systems were built in parallel against the same repo: a server-driven
 * viewer keyed by exportId, and a static viewer keyed by a bundled project slug.
 * This resolver is the single place those meet, in priority order:
 *
 *   1. /<exportId>            path form  - the shareable client link
 *   2. ?exportId=<id>         query form - what HorizonServer used to emit, and
 *                                          what older stored viewerUrls contain
 *   3. ?key=<slug> | /embed/<slug>       - bundled project, for local dev,
 *                                          offline demos and existing iframes
 *   4. nothing                           - landing page
 *
 * Reserved paths are excluded so a stray asset or route never reads as an id.
 */

export type ProjectSource =
  | { kind: 'export'; exportId: string }
  | { kind: 'static'; auraKey: string }
  | { kind: 'none' };

/** Path segments that are never export ids. */
const RESERVED_SEGMENTS = new Set([
  'assets',
  'embed',
  'admin',
  'favicon.ico',
  'index.html',
]);

/**
 * Export ids are uuids in practice, but client-supplied ids are also accepted by
 * the server. Keep this permissive but bounded, and reject anything with a dot so
 * asset-looking paths fall through to the SPA's normal handling.
 */
const EXPORT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;

export function isPlausibleExportId(value: string): boolean {
  return EXPORT_ID_PATTERN.test(value) && !RESERVED_SEGMENTS.has(value.toLowerCase());
}

export function resolveProjectSource(location: {
  pathname: string;
  search: string;
}): ProjectSource {
  const params = new URLSearchParams(location.search);

  const embedMatch = location.pathname.match(/\/embed\/([^/]+)/);
  if (embedMatch?.[1]) {
    return { kind: 'static', auraKey: decodeURIComponent(embedMatch[1]) };
  }

  const explicitExportId = params.get('exportId')?.trim();
  const staticKey = params.get('key')?.trim();

  // Path form wins, but only when it is not shadowed by an explicit query param.
  const segments = location.pathname.split('/').filter(Boolean);
  if (segments.length === 1 && !explicitExportId && !staticKey) {
    const candidate = decodeURIComponent(segments[0]);
    if (isPlausibleExportId(candidate)) {
      return { kind: 'export', exportId: candidate };
    }
  }

  if (explicitExportId) {
    return { kind: 'export', exportId: explicitExportId };
  }

  if (staticKey) {
    return { kind: 'static', auraKey: staticKey };
  }

  return { kind: 'none' };
}
