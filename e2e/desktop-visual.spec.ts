import { expect, test } from '@playwright/test';
import { stubBootstrapError, stubTour, TOUR_EXPORT_ID } from './fixtures/tour';

/**
 * Desktop pixel guard.
 *
 * The mobile work must leave desktop untouched. These snapshots were taken on
 * main (d0cfee8) before any source change; every page a share link reaches is
 * compared at 1280x720 Desktop Chrome. Update them only for a deliberate
 * desktop change, with `--update-snapshots`. They are machine-specific at the
 * 1% level (see SNAP); a clean 6/6 is a statement about one machine.
 *
 * The pin click is forced because on main the annotation overlay sits above the
 * pins and swallows pointer events (fixed on this branch); forcing keeps the
 * snapshot comparable across both.
 */

test.use({ viewport: { width: 1280, height: 720 } });

// Baselines were taken on one Windows machine; another machine's Chromium renders
// text and blur about 1% differently, so the tolerance is wide enough for that
// and narrow enough to catch a moved or missing control.
const SNAP = { maxDiffPixelRatio: 0.02 };

test('landing page', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('landing-page').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('landing.png', SNAP);
});

test('still viewer with carousel', async ({ page, baseURL }) => {
  await stubTour(page, baseURL!);
  await page.goto(`/${TOUR_EXPORT_ID}`);
  await page.getByTestId('aura-viewer').waitFor();
  await page.waitForTimeout(1200);
  await expect(page).toHaveScreenshot('still.png', SNAP);
});

test('location pin panel', async ({ page, baseURL }) => {
  await stubTour(page, baseURL!);
  await page.goto(`/${TOUR_EXPORT_ID}`);
  await page.getByTestId('aura-viewer').waitFor();
  await page.waitForTimeout(1200);
  await page.locator('[data-testid="aura-viewer"] svg.cursor-pointer').first().click({
    force: true,
  });
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot('pin-panel.png', SNAP);
});

test('sign-in menu', async ({ page, baseURL }) => {
  await stubTour(page, baseURL!);
  await page.goto(`/${TOUR_EXPORT_ID}`);
  await page.getByTestId('aura-viewer').waitFor();
  await page.waitForTimeout(1200);
  await page.getByTestId('account-menu-button').click();
  await page.getByTestId('account-menu-panel').waitFor();
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot('sign-in.png', SNAP);
});

test('scene editor', async ({ page, baseURL }) => {
  await stubTour(page, baseURL!, { canEdit: true });
  await page.goto(`/${TOUR_EXPORT_ID}`);
  await page.getByTestId('scene-editor-button').click();
  await page.getByTestId('scene-editor-panel').waitFor();
  await page.waitForTimeout(1200);
  await expect(page).toHaveScreenshot('scene-editor.png', SNAP);
});

test('error and pending states', async ({ page }) => {
  await stubBootstrapError(page, 'gone-export', 404, 'Not found');
  await page.goto('/gone-export');
  await page.getByText('Unable to load viewer').waitFor();
  await expect(page).toHaveScreenshot('error-404.png', SNAP);

  await stubBootstrapError(page, 'pending-export', 409, 'Export is still processing');
  await page.goto('/pending-export');
  await page.getByText('Almost ready').waitFor();
  await expect(page).toHaveScreenshot('pending.png', SNAP);
});
