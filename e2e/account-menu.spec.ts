import { expect, test } from '@playwright/test';

/**
 * The account control in the viewer header.
 *
 * Regression cover for a dropdown that opened into nothing. The header is a
 * fixed-height strip with overflow hidden, so a panel rendered inside it was
 * cropped away entirely — the button looked dead while the menu was in fact
 * open.
 *
 * Neither toBeVisible nor a bounding-box measurement catches that: a clipped
 * element keeps its full layout box and its own styles still read as visible.
 * These tests hit-test the panel instead, which is the only check that
 * distinguishes "drawn" from "laid out but cropped".
 */

const API_BASE = 'http://127.0.0.1:9999';

const READY_EXPORT = {
  exportId: 'menu-export',
  workspaceId: 'workspace-123',
  status: 'ready',
  viewerUrl: 'http://localhost:3101/?exportId=menu-export',
  metadata: null,
  canEdit: false,
  config: {
    views: [{ id: 1, name: 'Station Plaza', imageUrl: `${API_BASE}/assets/view-1.png` }],
    transitions: [
      { key: '1-1', from: 1, to: 1, videoUrl: `${API_BASE}/assets/loop.mp4` },
    ],
    locations: [],
  },
};

test.beforeEach(async ({ page }) => {
  await page.route(
    `${API_BASE}/api/viewer/bootstrap?exportId=menu-export`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(READY_EXPORT),
      });
    }
  );
});

test('the account button opens a panel that is actually painted on screen', async ({
  page,
}) => {
  await page.goto('/?exportId=menu-export');

  const button = page.getByTestId('account-menu-button');
  await expect(button).toBeVisible();
  await expect(page.getByTestId('account-menu-panel')).toBeHidden();

  await button.click();

  const panel = page.getByTestId('account-menu-panel');
  await expect(panel).toBeVisible();

  // Hit-test the middle of the panel rather than measuring it.
  //
  // This is the assertion that catches the original bug, and the reason the
  // obvious checks do not: an element cropped by an ancestor's overflow keeps
  // its full layout box, so getBoundingClientRect still reports 280x200 and
  // toBeVisible still passes. Only hit-testing reveals that nothing is drawn
  // there. Against the pre-fix component this lands on a control behind the
  // panel; the panel was open the whole time and simply invisible.
  const hit = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2
    );
    return {
      insidePanel: target ? element.contains(target) : false,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      right: Math.round(rect.x + rect.width),
    };
  });

  expect(hit.insidePanel).toBe(true);
  expect(hit.height).toBeGreaterThan(100);
  expect(hit.width).toBeGreaterThan(200);
  expect(hit.right).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
});

test('signed out, the panel offers sign-in', async ({ page }) => {
  await page.goto('/?exportId=menu-export');
  await page.getByTestId('account-menu-button').click();

  const panel = page.getByTestId('account-menu-panel');
  await expect(panel.getByText('Sign in to AURA')).toBeVisible();
  await expect(panel.getByPlaceholder('Email')).toBeVisible();
  await expect(panel.getByPlaceholder('Password')).toBeVisible();
});

test('clicking inside the panel does not dismiss it', async ({ page }) => {
  await page.goto('/?exportId=menu-export');
  await page.getByTestId('account-menu-button').click();

  const panel = page.getByTestId('account-menu-panel');
  await panel.getByPlaceholder('Email').click();
  await panel.getByPlaceholder('Email').fill('someone@example.com');

  // The panel is portalled out of the button's subtree, so a naive
  // "click outside the container closes it" check would treat this as outside.
  await expect(panel).toBeVisible();
});

test('clicking the page dismisses the panel', async ({ page }) => {
  await page.goto('/?exportId=menu-export');
  await page.getByTestId('account-menu-button').click();
  await expect(page.getByTestId('account-menu-panel')).toBeVisible();

  await page.mouse.click(400, 500);

  await expect(page.getByTestId('account-menu-panel')).toBeHidden();
});
