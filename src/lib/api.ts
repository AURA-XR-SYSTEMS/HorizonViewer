import type { ProjectConfig } from '@/types'
import { mapApiConfig } from '@lib/configMapper'
import { ApiProjectConfigSchema, ExportConfigEnvelopeSchema } from './apiSchemas'

function getExportId(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('exportId') ?? import.meta.env.VITE_HORIZON_EXPORT_ID ?? ''
}

function getConfigUrl(): string {
  const apiBaseUrl = import.meta.env.VITE_HORIZON_API_BASE_URL
  if (!apiBaseUrl) {
    throw new Error(
      'Missing Horizon config settings. Set VITE_HORIZON_CONFIG_URL or VITE_HORIZON_API_BASE_URL.'
    )
  }

  const exportId = encodeURIComponent(getExportId())
  return `${apiBaseUrl.replace(/\/$/, '')}/exports/${exportId}/config`
}

export async function fetchApiProjectConfig(): Promise<ProjectConfig> {
  const response = await fetch(getConfigUrl())

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  const raw = await response.json()
  const directConfigResult = ApiProjectConfigSchema.safeParse(raw)
  if (directConfigResult.success) {
    return mapApiConfig(directConfigResult.data)
  }

  const exportConfigResult = ExportConfigEnvelopeSchema.safeParse(raw)
  if (!exportConfigResult.success) {
    console.error('ProjectConfigSchema validation failed', exportConfigResult.error)
    throw new Error('Invalid project config response')
  }

  return mapApiConfig(exportConfigResult.data.config)
}
