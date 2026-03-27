import { z } from 'zod'

export const ExportJobStatusSchema = z.enum(['created', 'processing', 'ready', 'failed'])

const ExportJobBaseSchema = z.object({
  exportId: z.string(),
  workspaceId: z.string(),
  status: ExportJobStatusSchema,
  viewerUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const CreateExportJobResponseSchema = ExportJobBaseSchema

export const ExportJobResponseSchema = ExportJobBaseSchema.extend({
  errorMessage: z.string().nullable(),
})

export type CreateExportJobResponse = z.infer<typeof CreateExportJobResponseSchema>
export type ExportJobResponse = z.infer<typeof ExportJobResponseSchema>
export type ExportJobStatus = z.infer<typeof ExportJobStatusSchema>
