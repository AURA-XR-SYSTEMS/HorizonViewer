import type { ApiProjectConfig } from './apiSchemas'
import { ViewerBootstrapResponseSchema } from './apiSchemas'

function getRequiredExportId(): string {
  const params = new URLSearchParams(window.location.search)
  const exportId = params.get('exportId') ?? import.meta.env.VITE_HORIZON_EXPORT_ID

  if (!exportId) {
    throw new Error(
      'Missing exportId. Provide ?exportId=... in the URL or set VITE_HORIZON_EXPORT_ID.'
    )
  }

  return exportId
}

function getRequiredApiBaseUrl(): string {
  const apiBaseUrl = import.meta.env.VITE_HORIZON_API_BASE_URL

  if (!apiBaseUrl) {
    throw new Error('Missing VITE_HORIZON_API_BASE_URL.')
  }

  return apiBaseUrl.replace(/\/$/, '')
}

function buildProjectConfigUrl(): string {
  const apiBaseUrl = getRequiredApiBaseUrl()
  const exportId = encodeURIComponent(getRequiredExportId())
  return `${apiBaseUrl}/api/viewer/bootstrap?exportId=${exportId}`
}

export async function fetchApiProjectConfig(): Promise<ApiProjectConfig> {
  const response = await fetch(buildProjectConfigUrl())

  if (!response.ok) {
    let detail = `Request failed: ${response.status}`
    try {
      const payload = await response.json()
      if (payload && typeof payload === 'object' && 'detail' in payload) {
        detail = String((payload as { detail: unknown }).detail)
      }
    } catch {
      // Ignore invalid error payloads and fall back to the HTTP status message.
    }

    throw new Error(detail)
  }

  const raw = await response.json()
  const result = ViewerBootstrapResponseSchema.safeParse(raw)

  if (!result.success) {
    console.error('ViewerBootstrapResponseSchema validation failed', result.error)
    throw new Error('Invalid viewer bootstrap response')
  }

  return result.data.config
}
