import { OwnedExportSummarySchema, type OwnedExportSummary } from './apiSchemas';
import { authHeaders } from './auth';
import { getApiBaseUrl } from './bootstrapClient';
import type { ProjectConfig, ViewNode } from '../types';

/**
 * Owner-only operations on a published export.
 *
 * Every call here requires a session and is refused with 403 by the server if
 * the account does not own the export. The UI hides these behind canEdit, but
 * that is a courtesy: the server is the authority and re-checks each time.
 */

export class NotAuthorizedError extends Error {
  constructor(message = 'This scene belongs to another account.') {
    super(message);
    this.name = 'NotAuthorizedError';
  }
}

export class NotSignedInError extends Error {
  constructor(message = 'Sign in to make changes.') {
    super(message);
    this.name = 'NotSignedInError';
  }
}

function requireApiBaseUrl(): string {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error('This viewer is not configured to reach HorizonServer.');
  }
  return apiBaseUrl;
}

async function readDetail(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object' && 'detail' in payload) {
      return String((payload as { detail: unknown }).detail);
    }
  } catch {
    // Non-JSON body; fall through.
  }
  return fallback;
}

async function throwForStatus(response: Response): Promise<never> {
  if (response.status === 401) {
    throw new NotSignedInError(await readDetail(response, 'Sign in to make changes.'));
  }
  if (response.status === 403) {
    throw new NotAuthorizedError(
      await readDetail(response, 'This scene belongs to another account.')
    );
  }
  throw new Error(await readDetail(response, `Request failed: ${response.status}`));
}

async function putSlice(
  exportId: string,
  slice: string,
  payload: unknown
): Promise<void> {
  const response = await fetch(
    `${requireApiBaseUrl()}/exports/${encodeURIComponent(exportId)}/${slice}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) await throwForStatus(response);
}

export function saveViews(exportId: string, views: ViewNode[]): Promise<void> {
  return putSlice(exportId, 'views', views);
}

/**
 * Replace the whole published config.
 *
 * Used for edits that span slices — renaming the project and a view in one go —
 * because there is no endpoint for the project name alone, and a single PUT
 * keeps the two from landing separately.
 *
 * Send a config derived from what the server last returned. This replaces
 * rather than merges, so a partial object silently drops the rest of the scene.
 * Asset URLs may be sent back exactly as received: the server stores them
 * relative again, so the current hostname is not baked in.
 */
export function saveConfig(exportId: string, config: ProjectConfig): Promise<void> {
  return putSlice(exportId, 'config', config);
}

/**
 * Permanently delete an export and its published assets.
 *
 * Irreversible, and it breaks any link already shared for the scene — which is
 * the point, since it is the only way to unpublish. Callers must confirm first.
 */
export async function deleteExport(exportId: string): Promise<void> {
  const response = await fetch(
    `${requireApiBaseUrl()}/api/exports/${encodeURIComponent(exportId)}`,
    { method: 'DELETE', headers: authHeaders() }
  );
  if (!response.ok) await throwForStatus(response);
}

/** The signed-in account's exports, newest first. Empty when signed out. */
export async function listMyExports(): Promise<OwnedExportSummary[]> {
  const response = await fetch(`${requireApiBaseUrl()}/api/exports/mine`, {
    headers: authHeaders(),
  });
  if (response.status === 401) return [];
  if (!response.ok) await throwForStatus(response);

  const payload = await response.json();
  if (!Array.isArray(payload)) return [];

  // One malformed row should not blank the whole list.
  return payload.flatMap((row) => {
    const parsed = OwnedExportSummarySchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}
