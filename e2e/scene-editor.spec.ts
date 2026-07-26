import { expect, test } from '@playwright/test';

/**
 * Owner-only scene editing.
 *
 * The edit surface only appears when the server said canEdit, and a save is a
 * single PUT of the whole config. These check both the happy path and the two
 * refusals that matter, because a save that silently fails looks identical to
 * one that worked until the page is reloaded.
 */

const API_BASE = 'http://127.0.0.1:9999';
const EXPORT_ID = 'editable-export';

function bootstrapBody(overrides: Record<string, unknown> = {}) {
  return {
    exportId: EXPORT_ID,
    workspaceId: 'workspace-123',
    status: 'ready',
    viewerUrl: null,
    metadata: null,
    canEdit: true,
    config: {
      projectId: EXPORT_ID,
      projectName: 'Original Project',
      views: [
        { id: 1, name: 'Station Plaza', imageUrl: `${API_BASE}/assets/view-1.png` },
        { id: 2, name: 'Platform Level', imageUrl: `${API_BASE}/assets/view-2.png` },
      ],
      transitions: [{ key: '1-2', from: 1, to: 2, videoUrl: `${API_BASE}/assets/t.mp4` }],
      locations: [],
    },
    ...overrides,
  };
}

async function stubBootstrap(page: any, overrides: Record<string, unknown> = {}) {
  await page.route(
    `${API_BASE}/api/viewer/bootstrap?exportId=${EXPORT_ID}`,
    async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(bootstrapBody(overrides)),
      });
    }
  );
}

test('a visitor who does not own the scene gets no edit surface', async ({ page }) => {
  await stubBootstrap(page, { canEdit: false });
  await page.goto(`/?exportId=${EXPORT_ID}`);

  await expect(page.getByTestId('aura-viewer')).toBeVisible();
  await expect(page.getByTestId('scene-editor-button')).toHaveCount(0);
});

test('the owner can rename the project and the current view', async ({ page }) => {
  await stubBootstrap(page);

  let savedBody: any = null;
  await page.route(`${API_BASE}/exports/${EXPORT_ID}/config`, async (route) => {
    expect(route.request().method()).toBe('PUT');
    savedBody = JSON.parse(route.request().postData() ?? '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exportId: EXPORT_ID, config: savedBody }),
    });
  });

  await page.goto(`/?exportId=${EXPORT_ID}`);
  await page.getByTestId('scene-editor-button').click();

  const panel = page.getByTestId('scene-editor-panel');
  await expect(panel).toBeVisible();

  // Save is inert until something actually changes.
  await expect(page.getByTestId('scene-editor-save')).toBeDisabled();

  await page.getByTestId('scene-editor-project-name').fill('Renamed Project');
  await page.getByTestId('scene-editor-view-name').fill('Renamed View');
  await page.getByTestId('scene-editor-save').click();

  await expect(page.getByTestId('scene-editor-saved')).toBeVisible();

  // The whole config is replaced, so the untouched parts have to survive.
  expect(savedBody.projectName).toBe('Renamed Project');
  expect(savedBody.views.find((v: any) => v.id === 1).name).toBe('Renamed View');
  expect(savedBody.views.find((v: any) => v.id === 2).name).toBe('Platform Level');
  expect(savedBody.transitions).toHaveLength(1);
  expect(savedBody.views[0].imageUrl).toContain('view-1.png');
});

test('a saved rename shows in the viewer without a reload', async ({ page }) => {
  await stubBootstrap(page);
  await page.route(`${API_BASE}/exports/${EXPORT_ID}/config`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto(`/?exportId=${EXPORT_ID}`);
  await expect(page.getByTestId('aura-viewer')).toHaveAttribute(
    'data-current-view',
    'Station Plaza'
  );

  await page.getByTestId('scene-editor-button').click();
  await page.getByTestId('scene-editor-view-name').fill('Renamed View');
  await page.getByTestId('scene-editor-save').click();

  await expect(page.getByTestId('aura-viewer')).toHaveAttribute(
    'data-current-view',
    'Renamed View'
  );
});

test('a rejected save reports the refusal instead of looking successful', async ({
  page,
}) => {
  await stubBootstrap(page);
  await page.route(`${API_BASE}/exports/${EXPORT_ID}/config`, async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'This export belongs to another account.' }),
    });
  });

  await page.goto(`/?exportId=${EXPORT_ID}`);
  await page.getByTestId('scene-editor-button').click();
  await page.getByTestId('scene-editor-project-name').fill('Nope');
  await page.getByTestId('scene-editor-save').click();

  await expect(page.getByTestId('scene-editor-error')).toContainText(
    'belongs to another account'
  );
  await expect(page.getByTestId('scene-editor-saved')).toHaveCount(0);
});

test('an expired session reports that rather than saving silently', async ({ page }) => {
  await stubBootstrap(page);
  await page.route(`${API_BASE}/exports/${EXPORT_ID}/config`, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Invalid or expired token' }),
    });
  });

  await page.goto(`/?exportId=${EXPORT_ID}`);
  await page.getByTestId('scene-editor-button').click();
  await page.getByTestId('scene-editor-project-name').fill('Nope');
  await page.getByTestId('scene-editor-save').click();

  await expect(page.getByTestId('scene-editor-error')).toBeVisible();
});

test('a view cannot be renamed to nothing', async ({ page }) => {
  await stubBootstrap(page);
  await page.goto(`/?exportId=${EXPORT_ID}`);

  await page.getByTestId('scene-editor-button').click();
  await page.getByTestId('scene-editor-view-name').fill('   ');

  await expect(page.getByTestId('scene-editor-save')).toBeDisabled();
});
