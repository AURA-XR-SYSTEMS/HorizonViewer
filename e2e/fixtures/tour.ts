import type { Page } from '@playwright/test';

/**
 * A synthetic published tour for end-to-end tests.
 *
 * Mirrors what HorizonServer's /api/viewer/bootstrap returns for a ready export,
 * but points every asset at the viewer's own bundled sample media (served by the
 * dev server from public/assets), so stills and transition clips really load
 * and play without a server or S3.
 */

export const API_BASE = 'http://127.0.0.1:9999';
export const TOUR_EXPORT_ID = 'mobile-tour';

const asset = (origin: string, name: string) => `${origin}/assets/${name}`;

export function tourConfig(origin: string) {
  const views = [1, 2, 3, 4, 5, 6].map((id) => ({
    id,
    name:
      [
        'Station Plaza',
        'Platform Level',
        'Riverside Promenade',
        'Civic Square',
        'Market Hall',
        'Hilltop Overlook',
      ][id - 1] ?? `View ${id}`,
    imageUrl: asset(origin, id % 2 ? 'view_1.png' : 'view_2.png'),
  }));

  const transitions: { key: string; from: number; to: number; videoUrl: string }[] = [];
  for (const a of views) {
    for (const b of views) {
      if (a.id === b.id) continue;
      transitions.push({
        key: `${a.id}-${b.id}`,
        from: a.id,
        to: b.id,
        videoUrl: asset(
          origin,
          a.id < b.id ? 'transition_1_2.mp4' : 'transition_2_1.mp4'
        ),
      });
    }
  }

  const locations = [
    {
      id: 'loc-plaza-fountain',
      place_id: 'place-1',
      Name: 'Plaza Fountain',
      Address: '1 Station Plaza',
      Region: 'Downtown',
      Description: {
        Short:
          'A restored 1920s fountain that anchors the plaza and doubles as the meeting point for walking tours.',
        Type: 'Landmark',
      },
      Attributes: { Built: '1924', Restored: '2019', Material: 'Granite' },
      viewPositions: [
        { viewId: 1, x: 38, y: 62 },
        { viewId: 2, x: 70, y: 40 },
      ],
    },
    {
      id: 'loc-ticket-hall',
      place_id: 'place-2',
      Name: 'Ticket Hall',
      Address: '2 Station Plaza',
      Description: { Short: 'Main entrance to the platforms.', Type: 'Transit' },
      viewPositions: [
        { viewId: 1, x: 72, y: 48 },
        { viewId: 3, x: 20, y: 55 },
      ],
    },
    {
      id: 'loc-market',
      place_id: 'place-3',
      Name: 'Market Hall',
      Description: { Short: 'Weekend produce market.', Type: 'Retail' },
      viewPositions: [{ viewId: 5, x: 55, y: 50 }],
    },
  ];

  return {
    projectId: TOUR_EXPORT_ID,
    projectName: 'Riverside Station Tour',
    views,
    transitions,
    locations,
  };
}

export function bootstrapBody(origin: string, overrides: Record<string, unknown> = {}) {
  return {
    exportId: TOUR_EXPORT_ID,
    workspaceId: 'workspace-123',
    status: 'ready',
    viewerUrl: null,
    metadata: null,
    canEdit: false,
    config: tourConfig(origin),
    ...overrides,
  };
}

/** Serves the synthetic tour for TOUR_EXPORT_ID. */
export async function stubTour(
  page: Page,
  origin: string,
  overrides: Record<string, unknown> = {}
) {
  await page.route(
    `${API_BASE}/api/viewer/bootstrap?exportId=${TOUR_EXPORT_ID}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(bootstrapBody(origin, overrides)),
      });
    }
  );
}

/** Serves an error for an export id, the way the server would. */
export async function stubBootstrapError(
  page: Page,
  exportId: string,
  status: number,
  detail: string
) {
  await page.route(
    `${API_BASE}/api/viewer/bootstrap?exportId=${exportId}`,
    async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ detail }),
      });
    }
  );
}
