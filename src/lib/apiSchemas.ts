import { z } from 'zod';

/**
 * Runtime shape of the HorizonServer viewer contract.
 *
 * Ported from the Preact viewer on origin/main and extended with the fields this
 * viewer relies on (thumbUrl, embed, alternateLayers, project identity). Those
 * fields are optional on the wire: older exports predate them, and the server
 * only started preserving them once ProjectConfig was widened to match.
 */

export const ViewEmbedSchema = z.object({
  type: z.literal('youtube360'),
  videoId: z.string(),
});

export const AlternateLayerSchema = z.object({
  name: z.string(),
  imageUrl: z.string(),
});

export const ViewSchema = z.object({
  id: z.number(),
  name: z.string(),
  imageUrl: z.string(),
  thumbUrl: z.string().nullish(),
  embed: ViewEmbedSchema.nullish(),
  alternateLayers: z.array(AlternateLayerSchema).nullish(),
});

export const ViewPositionSchema = z.object({
  viewId: z.number(),
  x: z.number(),
  y: z.number(),
});

export const LocationDescriptionSchema = z.object({
  Short: z.string().nullish(),
  Detailed: z.string().nullish(),
  Type: z.string().nullish(),
});

export const CoordinatesSchema = z.object({
  Lat: z.number(),
  Lng: z.number(),
  Alt: z.number().nullish(),
});

export const LinksSchema = z.object({
  SourceLinks: z.array(z.string()).nullish(),
  Citations: z.array(z.string()).nullish(),
});

export const LocationSchema = z.object({
  id: z.string(),
  place_id: z.string().nullish(),
  Name: z.string(),
  Address: z.string().nullish(),
  Region: z.string().nullish(),
  Coordinates: CoordinatesSchema.nullish(),
  Description: LocationDescriptionSchema.nullish(),
  Attributes: z.record(z.string(), z.string()).nullish(),
  Links: LinksSchema.nullish(),
  viewPositions: z.array(ViewPositionSchema),
});

export const TransitionSchema = z.object({
  key: z.string(),
  from: z.number(),
  to: z.number(),
  videoUrl: z.string(),
});

export const ApiProjectConfigSchema = z.object({
  projectId: z.string().nullish(),
  projectName: z.string().nullish(),
  views: z.array(ViewSchema),
  locations: z.array(LocationSchema),
  transitions: z.array(TransitionSchema),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export const ExportConfigEnvelopeSchema = z.object({
  exportId: z.string(),
  config: ApiProjectConfigSchema,
});

export const ViewerBootstrapResponseSchema = z.object({
  exportId: z.string(),
  workspaceId: z.string(),
  status: z.enum(['created', 'processing', 'ready', 'failed']),
  viewerUrl: z.string().nullable(),
  metadata: z.unknown().nullable(),
  config: ApiProjectConfigSchema,
});

export type ApiProjectConfig = z.infer<typeof ApiProjectConfigSchema>;
export type ExportConfigEnvelope = z.infer<typeof ExportConfigEnvelopeSchema>;
export type ViewerBootstrapResponse = z.infer<typeof ViewerBootstrapResponseSchema>;
