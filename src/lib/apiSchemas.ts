import { z } from 'zod'

export const ViewSchema = z.object({
  id: z.number(),
  name: z.string(),
  imageUrl: z.string(),
})

export const ViewPositionSchema = z.object({
  viewId: z.number(),
  x: z.number(),
  y: z.number(),
})

export const LocationDescriptionSchema = z.object({
  Short: z.string().optional(),
  Detailed: z.string().optional(),
  Type: z.string().optional(),
})

export const LocationSchema = z.object({
  id: z.string(),
  place_id: z.string().optional(),
  Name: z.string(),
  Address: z.string().optional(),
  Region: z.string().optional(),
  Description: LocationDescriptionSchema.optional(),
  Attributes: z.record(z.string(), z.string()).optional(),
  viewPositions: z.array(ViewPositionSchema),
})

export const TransitionSchema = z.object({
  key: z.string(),
  from: z.number(),
  to: z.number(),
  videoUrl: z.string(),
})

export const ApiProjectConfigSchema = z.object({
  views: z.array(ViewSchema),
  locations: z.array(LocationSchema),
  transitions: z.array(TransitionSchema),
})

export const ExportConfigEnvelopeSchema = z.object({
  exportId: z.string(),
  config: ApiProjectConfigSchema,
})

export const ViewerBootstrapResponseSchema = z.object({
  exportId: z.string(),
  workspaceId: z.string(),
  status: z.enum(['created', 'processing', 'ready', 'failed']),
  viewerUrl: z.string().nullable(),
  metadata: z.unknown().nullable(),
  config: ApiProjectConfigSchema,
})

export type ApiProjectConfig = z.infer<typeof ApiProjectConfigSchema>
export type ExportConfigEnvelope = z.infer<typeof ExportConfigEnvelopeSchema>
export type ViewerBootstrapResponse = z.infer<typeof ViewerBootstrapResponseSchema>
