import { expect, test, type Page } from '@playwright/test';
import { API_BASE, stubTour, TOUR_EXPORT_ID } from './fixtures/tour';

/**
 * Resident comments on a shared tour (desktop).
 *
 * The link holder needs no account to post; the server is stubbed, so these
 * check the viewer's half: the count on the button, the list, the composer
 * attaching to the viewpoint on screen, refusals surfacing, and the owner's
 * hide. The phone layout of the same panel is in e2e/mobile/mobile.spec.ts.
 */

const COMMENTS_URL = `${API_BASE}/api/viewer/${TOUR_EXPORT_ID}/comments`;

function comment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    viewId: 1,
    text: 'Keep the benches by the fountain.',
    name: 'Ada',
    position: null,
    status: 'new',
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    ...overrides,
  };
}

/** A stubbed comments store: GET lists, POST appends and echoes. */
async function stubComments(page: Page, initial: Record<string, unknown>[] = []) {
  const items = [...initial];
  const posted: Record<string, unknown>[] = [];
  await page.route(COMMENTS_URL, async (route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}');
      posted.push(body);
      const created = {
        id: `c${items.length + 1}`,
        viewId: body.viewId,
        text: body.text,
        name: body.name ?? null,
        position: body.position ?? null,
        status: 'new',
        createdAt: new Date().toISOString(),
      };
      items.push(created);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exportId: TOUR_EXPORT_ID, count: items.length, items }),
    });
  });
  return { items, posted };
}

test('the button shows the count and the panel lists the comments', async ({
  page,
  baseURL,
}) => {
  await stubTour(page, baseURL!);
  await stubComments(page, [
    comment(),
    comment({ id: 'c2', viewId: 2, name: null, text: 'Too much glass.' }),
  ]);
  await page.goto(`/${TOUR_EXPORT_ID}`);

  const button = page.getByTestId('comments-button');
  await expect(button).toHaveAttribute('aria-label', 'Comments, 2');
  await expect(page.getByTestId('comments-count')).toHaveText('2');

  await button.click();
  const panel = page.getByTestId('comments-panel');
  await expect(panel).toBeVisible();
  const items = panel.getByTestId('comment-item');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Ada');
  await expect(items.nth(0)).toContainText('on 01 Station Plaza');
  await expect(items.nth(1)).toContainText('A resident');
  await expect(items.nth(1)).toContainText('on 02 Platform Level');
  // Not an owner: no hide control.
  await expect(panel.getByTestId('comment-hide')).toHaveCount(0);
});

test('a resident posts on the viewpoint on screen without signing in', async ({
  page,
  baseURL,
}) => {
  await stubTour(page, baseURL!);
  const store = await stubComments(page);
  await page.goto(`/${TOUR_EXPORT_ID}`);
  await page.getByTestId('comments-button').click();
  await expect(page.getByTestId('comments-empty')).toBeVisible();

  // Move to view 2 first so the comment attaches to it.
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('aura-viewer')).toHaveAttribute(
    'data-current-view',
    'Platform Level',
    {
      timeout: 15000,
    }
  );

  await page.getByTestId('comments-button').click();
  await expect(page.getByTestId('comment-form')).toContainText(
    'Commenting on 02 Platform Level'
  );
  await page.getByTestId('comment-name').fill('Bea');
  await page.getByTestId('comment-text').fill('The platform needs shade.');
  await page.getByTestId('comment-send').click();

  await expect(page.getByTestId('comment-sent')).toBeVisible();
  expect(store.posted).toEqual([
    { viewId: 2, text: 'The platform needs shade.', name: 'Bea' },
  ]);
  await expect(page.getByTestId('comment-item')).toHaveCount(1);
  await expect(page.getByTestId('comments-count')).toHaveText('1');
  // The honeypot was left empty and not sent.
  expect('website' in store.posted[0]).toBe(false);
});

test('a refusal from the server is shown, not swallowed', async ({ page, baseURL }) => {
  await stubTour(page, baseURL!);
  await page.route(COMMENTS_URL, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          detail: 'Too many comments from this connection. Try again later.',
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exportId: TOUR_EXPORT_ID, count: 0, items: [] }),
    });
  });
  await page.goto(`/${TOUR_EXPORT_ID}`);
  await page.getByTestId('comments-button').click();
  await page.getByTestId('comment-text').fill('spam spam spam');
  await page.getByTestId('comment-send').click();

  await expect(page.getByTestId('comment-error')).toContainText('Too many comments');
  await expect(page.getByTestId('comment-sent')).toHaveCount(0);
});

test('the owner can hide a comment', async ({ page, baseURL }) => {
  await stubTour(page, baseURL!, { canEdit: true });
  await stubComments(page, [comment()]);
  let hidden: string | null = null;
  await page.route(
    `${API_BASE}/exports/${TOUR_EXPORT_ID}/comments/c1/hide`,
    async (route) => {
      hidden = route.request().method();
      await route.fulfill({ status: 204 });
    }
  );
  await page.goto(`/${TOUR_EXPORT_ID}`);
  await page.getByTestId('comments-button').click();
  await page.getByTestId('comment-hide').click();

  await expect(page.getByTestId('comment-item')).toHaveCount(0);
  expect(hidden).toBe('POST');
});

test('a bundled project has no comments button (no server behind it)', async ({
  page,
}) => {
  await page.route('**/assets/projects/local-demo/config.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projectId: 'local-demo',
        projectName: 'Local',
        views: [{ id: 1, name: 'Only', imageUrl: '/assets/view_1.png' }],
        transitions: [],
        locations: [],
      }),
    });
  });
  await page.goto('/?key=local-demo');
  await expect(page.getByTestId('aura-viewer')).toBeVisible();
  await expect(page.getByTestId('comments-button')).toHaveCount(0);
});
