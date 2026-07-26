import type { ProjectConfig } from '../types';
import { ViewerBootstrapResponseSchema } from './apiSchemas';
import { authHeaders } from './auth';
import { mapApiConfig } from './configMapper';

export interface LoadedProject {
  config: ProjectConfig;
  /** True only when the signed-in account owns this export. */
  canEdit: boolean;
}

/**
 * Loads a published export from HorizonServer.
 *
 * Ported from origin/main's projectConfigApi. The server rewrites relative asset
 * paths to proxy URLs before responding, so nothing here needs to know about S3.
 */

export function getApiBaseUrl(): string {
  const apiBaseUrl =
    import.meta.env.VITE_HORIZON_API_BASE_URL || import.meta.env.VITE_API_URL || '';
  return apiBaseUrl.replace(/\/$/, '');
}

export class ExportNotReadyError extends Error {
  constructor(
    message: string,
    readonly status: string
  ) {
    super(message);
    this.name = 'ExportNotReadyError';
  }
}

export async function fetchExportConfig(exportId: string): Promise<LoadedProject> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error(
      'This viewer is not configured to load shared links. Set VITE_HORIZON_API_BASE_URL.'
    );
  }

  const url = `${apiBaseUrl}/api/viewer/bootstrap?exportId=${encodeURIComponent(exportId)}`;
  // Sent when signed in so the server can answer canEdit. The endpoint is
  // public, so an absent or stale token still loads the scene read-only.
  const response = await fetch(url, { headers: authHeaders() });

  if (!response.ok) {
    // The server explains itself in `detail`; surface that rather than a bare status.
    let detail = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload && typeof payload === 'object' && 'detail' in payload) {
        detail = String((payload as { detail: unknown }).detail);
      }
    } catch {
      // Non-JSON error body; keep the status message.
    }

    if (response.status === 409) {
      throw new ExportNotReadyError(detail, 'processing');
    }
    if (response.status === 404) {
      throw new Error('That link does not exist, or has been removed.');
    }
    throw new Error(detail);
  }

  const parsed = ViewerBootstrapResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    console.error('Viewer bootstrap validation failed', parsed.error);
    throw new Error('The server returned a project in an unexpected format.');
  }

  return {
    config: mapApiConfig(parsed.data.config, parsed.data.exportId),
    canEdit: parsed.data.canEdit,
  };
}
