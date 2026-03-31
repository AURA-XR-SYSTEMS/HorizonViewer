import {
  CreateExportJobResponseSchema,
  ExportJobResponseSchema,
  type CreateExportJobResponse,
  type ExportJobResponse,
} from './exportJobSchemas'

export interface DebugRequest {
  method: 'POST' | 'GET'
  url: string
  summary: string
}

export interface DebugResponse {
  status: number
  payload: unknown
}

export interface ExportJobApiResult {
  job: ExportJobResponse
  debugRequest: DebugRequest
  debugResponse: DebugResponse
}

export interface UploadMetadataLocation {
  id: string
  name: string
  viewPositions: Array<{
    viewId: number
    x: number
    y: number
  }>
}

export interface UploadMetadataPayload {
  projectName?: string
  sourceApplication?: string
  sourceVersion?: string
  views: Array<{
    id: number
    name: string
    imagePath: string
  }>
  transitions: Array<{
    key: string
    fromViewId: number
    toViewId: number
    videoPath: string
  }>
  locations: UploadMetadataLocation[]
}

function getApiBaseUrl(): string {
  const apiBaseUrl = import.meta.env.VITE_HORIZON_API_BASE_URL
  if (!apiBaseUrl) {
    throw new Error('Missing VITE_HORIZON_API_BASE_URL.')
  }
  return apiBaseUrl.replace(/\/$/, '')
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  const text = await response.text()
  return text ? { detail: text } : null
}

function jobResponseFromCreateResponse(job: CreateExportJobResponse): ExportJobResponse {
  return {
    ...job,
    errorMessage: null,
  }
}

async function expectCreateJobResponse(
  response: Response
): Promise<DebugResponse & { job: ExportJobResponse }> {
  const payload = await parseResponse(response)

  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : `Request failed: ${response.status}`
    throw new Error(detail)
  }

  const result = CreateExportJobResponseSchema.safeParse(payload)
  if (!result.success) {
    console.error('CreateExportJobResponseSchema validation failed', result.error)
    throw new Error('Invalid export job response')
  }

  return {
    status: response.status,
    payload,
    job: jobResponseFromCreateResponse(result.data),
  }
}

async function expectJobResponse(
  response: Response
): Promise<DebugResponse & { job: ExportJobResponse }> {
  const payload = await parseResponse(response)

  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : `Request failed: ${response.status}`
    throw new Error(detail)
  }

  const result = ExportJobResponseSchema.safeParse(payload)
  if (!result.success) {
    console.error('ExportJobResponseSchema validation failed', result.error)
    throw new Error('Invalid export job response')
  }

  return {
    status: response.status,
    payload,
    job: result.data,
  }
}

export async function createExportJob(workspaceId: string): Promise<ExportJobApiResult> {
  const url = `${getApiBaseUrl()}/api/exports/${encodeURIComponent(workspaceId)}/new`
  const debugRequest: DebugRequest = {
    method: 'POST',
    url,
    summary: 'No request body',
  }

  const response = await fetch(url, { method: 'POST' })
  const { job, status, payload } = await expectCreateJobResponse(response)

  return {
    job,
    debugRequest,
    debugResponse: { status, payload },
  }
}

export async function uploadExportZip(
  workspaceId: string,
  exportId: string,
  file: File,
  metadata?: UploadMetadataPayload
): Promise<ExportJobApiResult> {
  const url = `${getApiBaseUrl()}/api/exports/${encodeURIComponent(workspaceId)}/${encodeURIComponent(
    exportId
  )}/upload`
  const formData = new FormData()
  formData.append('file', file)
  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata))
  }

  const debugRequest: DebugRequest = {
    method: 'POST',
    url,
    summary: metadata
      ? `multipart/form-data with file=${file.name} (${file.type || 'unknown type'}, ${file.size} bytes) and metadata JSON`
      : `multipart/form-data with file=${file.name} (${file.type || 'unknown type'}, ${file.size} bytes)`,
  }

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  })
  const { job, status, payload } = await expectJobResponse(response)

  return {
    job,
    debugRequest,
    debugResponse: { status, payload },
  }
}

export async function fetchExportJob(
  workspaceId: string,
  exportId: string
): Promise<ExportJobApiResult> {
  const url = `${getApiBaseUrl()}/api/exports/${encodeURIComponent(workspaceId)}/${encodeURIComponent(
    exportId
  )}`
  const debugRequest: DebugRequest = {
    method: 'GET',
    url,
    summary: 'No request body',
  }

  const response = await fetch(url)
  const { job, status, payload } = await expectJobResponse(response)

  return {
    job,
    debugRequest,
    debugResponse: { status, payload },
  }
}
