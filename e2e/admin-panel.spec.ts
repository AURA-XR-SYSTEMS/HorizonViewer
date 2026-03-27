import { expect, test } from '@playwright/test'

const API_BASE = 'http://127.0.0.1:9999'

function createJobPayload(overrides: Record<string, unknown> = {}) {
  return {
    exportId: 'export-123',
    workspaceId: 'workspace-123',
    status: 'created',
    viewerUrl: null,
    createdAt: '2026-03-25T18:00:00Z',
    updatedAt: '2026-03-25T18:00:00Z',
    ...overrides,
  }
}

function jobPayload(overrides: Record<string, unknown> = {}) {
  return {
    ...createJobPayload(),
    errorMessage: null,
    ...overrides,
  }
}

test('renders the admin panel on page load', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('admin-panel')).toBeVisible()
  await expect(page.getByText('Export Job Workflow')).toBeVisible()
  await expect(
    page.getByText('Admin panel is enabled. No viewer export is currently configured in the URL or build env.')
  ).toBeVisible()
})

test('creates an export job, uploads a zip, and renders ready-state details', async ({ page }) => {
  await page.route(`${API_BASE}/api/exports/workspace-123/new`, async (route) => {
    expect(route.request().method()).toBe('POST')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createJobPayload()),
    })
  })

  await page.route(`${API_BASE}/api/exports/workspace-123/export-123/upload`, async (route) => {
    expect(route.request().method()).toBe('POST')
    const contentType = await route.request().headerValue('content-type')
    expect(contentType).toContain('multipart/form-data')

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        jobPayload({
          status: 'ready',
          viewerUrl: 'http://localhost:3001/?exportId=export-123',
          updatedAt: '2026-03-25T18:01:00Z',
        })
      ),
    })
  })

  await page.goto('/')

  await page.getByTestId('workspace-input').fill('workspace-123')
  await page.getByTestId('create-job-button').click()

  await expect(page.getByTestId('job-export-id')).toContainText('export-123')
  await expect(page.getByTestId('job-status')).toContainText('created')
  await expect(page.getByTestId('job-error-message')).toContainText('none')
  await expect(page.getByTestId('last-request-panel')).toContainText('/api/exports/workspace-123/new')
  await expect(page.getByTestId('last-response-payload')).toContainText('export-123')
  await expect(page.getByTestId('last-response-payload')).not.toContainText('errorMessage')

  await page.getByTestId('upload-file-input').setInputFiles({
    name: 'export.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('PK\x03\x04playwright-smoke'),
  })
  await page.getByTestId('upload-button').click()

  await expect(page.getByTestId('job-status')).toContainText('ready')
  await expect(page.getByTestId('last-request-panel')).toContainText('/api/exports/workspace-123/export-123/upload')
  await expect(page.getByTestId('last-request-panel')).toContainText('file=export.zip')
  await expect(page.getByTestId('bootstrap-status')).toContainText('Viewer bootstrap is live')
  await expect(page.getByTestId('bootstrap-status')).toContainText('http://localhost:3001/?exportId=export-123')
})

test('polls status and renders backend errors', async ({ page }) => {
  await page.route(`${API_BASE}/api/exports/workspace-123/new`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createJobPayload()),
    })
  })

  await page.route(`${API_BASE}/api/exports/workspace-123/export-123`, async (route) => {
    expect(route.request().method()).toBe('GET')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        jobPayload({
          status: 'failed',
          errorMessage: 'Upload processing failed',
          updatedAt: '2026-03-25T18:02:00Z',
        })
      ),
    })
  })

  await page.goto('/')
  await page.getByTestId('workspace-input').fill('workspace-123')
  await page.getByTestId('create-job-button').click()
  await page.getByTestId('poll-button').click()

  await expect(page.getByTestId('job-status')).toContainText('failed')
  await expect(page.getByTestId('job-error-message')).toContainText('Upload processing failed')
  await expect(page.getByTestId('last-request-panel')).toContainText('/api/exports/workspace-123/export-123')

  await page.unroute(`${API_BASE}/api/exports/workspace-123/new`)
  await page.route(`${API_BASE}/api/exports/workspace-error/new`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Export service unavailable' }),
    })
  })

  await page.getByTestId('workspace-input').fill('workspace-error')
  await page.getByTestId('create-job-button').click()

  await expect(page.getByTestId('last-error-panel')).toContainText('Export service unavailable')
})

test('loads viewer config from the bootstrap endpoint when exportId is present', async ({ page }) => {
  await page.route(`${API_BASE}/api/viewer/bootstrap?exportId=export-123`, async (route) => {
    expect(route.request().method()).toBe('GET')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        exportId: 'export-123',
        workspaceId: 'workspace-123',
        status: 'ready',
        viewerUrl: 'http://localhost:3001/?exportId=export-123',
        metadata: null,
        config: {
          views: [{ id: 1, name: 'Station Plaza', imageUrl: 'http://127.0.0.1:9999/assets/view-1.png' }],
          transitions: [{ key: '1-1', from: 1, to: 1, videoUrl: 'http://127.0.0.1:9999/assets/loop.mp4' }],
          locations: [],
        },
      }),
    })
  })

  await page.goto('/?exportId=export-123')

  await expect(page.getByText('Current view: Station Plaza')).toBeVisible()
})
