import type { ApiProjectConfig } from './apiSchemas'
import { ExportConfigEnvelopeSchema } from './apiSchemas'

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
  return `${apiBaseUrl}/exports/${exportId}/config`
}

export async function fetchApiProjectConfig(): Promise<ApiProjectConfig> {
  const response = await fetch(buildProjectConfigUrl())

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  const raw = await response.json()
  const result = ExportConfigEnvelopeSchema.safeParse(raw)

  if (!result.success) {
    console.error('ExportConfigEnvelopeSchema validation failed', result.error)
    throw new Error('Invalid project config response')
  }

  return result.data.config
}
