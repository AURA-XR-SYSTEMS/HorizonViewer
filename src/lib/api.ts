import type { ProjectConfig } from '@/types'
import { mapApiConfig } from '@lib/configMapper'
import { z } from 'zod'

const ViewSchema = z.object({
  id: z.number(),
  name: z.string(),
  imageUrl: z.string(),
})

const ViewPositionSchema = z.object({
  viewId: z.number(),
  x: z.number(),
  y: z.number(),
})

const LocationDescriptionSchema = z.object({
  Short: z.string().optional(),
  Detailed: z.string().optional(),
  Type: z.string().optional(),
})

const LocationSchema = z.object({
  id: z.string(),
  place_id: z.string().optional(),
  Name: z.string(),
  Address: z.string().optional(),
  Region: z.string().optional(),
  Description: LocationDescriptionSchema.optional(),
  Attributes: z.record(z.string(), z.string()).optional(),
  viewPositions: z.array(ViewPositionSchema),
})

const TransitionSchema = z.object({
  key: z.string(),
  from: z.number(),
  to: z.number(),
  videoUrl: z.string(),
})

export const ProjectConfigSchema = z.object({
  views: z.array(ViewSchema),
  locations: z.array(LocationSchema),
  transitions: z.array(TransitionSchema),
})

const ExportConfigEnvelopeSchema = z.object({
  exportId: z.string(),
  config: ProjectConfigSchema,
})

function getExportId(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('exportId') ?? import.meta.env.VITE_HORIZON_EXPORT_ID ?? 'demo-export'
}

function getConfigUrl(): string {
  const directConfigUrl = import.meta.env.VITE_HORIZON_CONFIG_URL
  if (directConfigUrl) {
    return directConfigUrl
  }

  const apiBaseUrl = import.meta.env.VITE_HORIZON_API_BASE_URL
  if (!apiBaseUrl) {
    throw new Error(
      'Missing Horizon config settings. Set VITE_HORIZON_CONFIG_URL or VITE_HORIZON_API_BASE_URL.'
    )
  }

  const exportId = encodeURIComponent(getExportId())
  return `${apiBaseUrl.replace(/\/$/, '')}/exports/${exportId}/config`
}

export async function fetchProjectConfig(): Promise<ProjectConfig> {
  const response = await fetch(getConfigUrl())

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  const raw = await response.json()
  const directConfigResult = ProjectConfigSchema.safeParse(raw)
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
