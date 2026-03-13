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

export async function fetchProjectConfig(): Promise<ProjectConfig> {
  const response = await fetch(import.meta.env.VITE_HORIZON_CONFIG_URL)

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  const raw = await response.json()
  console.log(raw)
  const result = ProjectConfigSchema.safeParse(raw)
  if (!result.success) {
    console.error('ProjectConfigSchema validation failed', result.error)
    throw new Error('Invalid project config response')
  }
  const config = result.data
  return mapApiConfig(config)
}
