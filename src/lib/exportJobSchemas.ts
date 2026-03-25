import { z } from 'zod'

export const ExportJobStatusSchema = z.enum(['created', 'processing', 'ready', 'failed'])

export const ExportJobResponseSchema = z.object({
  exportId: z.string(),
  workspaceId: z.string(),
  status: ExportJobStatusSchema,
  viewerUrl: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ExportJobResponse = z.infer<typeof ExportJobResponseSchema>
export type ExportJobStatus = z.infer<typeof ExportJobStatusSchema>
