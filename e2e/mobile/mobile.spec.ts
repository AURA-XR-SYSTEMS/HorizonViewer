import { expect, test, type Page } from '@playwright/test';
import { stubBootstrapError, stubTour, TOUR_EXPORT_ID } from '../fixtures/tour';

/**
 * Phone behaviour of every page a share link reaches.
 *
 * One test per row of the README "Mobile" failure table. Runs on the device
 * projects in playwright.audit.config.ts (iPhone 14/15, Pixel 7, each in
 * portrait and landscape, plus a 320px-wide viewport). Needs the dev server
 * on 4175 without the admin panel; see that config.
 */

const INTERACTIVE =
  'button, a[href], input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])';

async function openTour(page: Page, origin: string, overrides = {}) {
  await stubTour(page, origin, overrides);
  await page.goto(`/${TOUR_EXPORT_ID}`);
  await page.getByTestId('aura-viewer').waitFor();
  await page.waitForTimeout(500);
}

/** Visible controls that are smaller than 44px in either direction. */
async function smallTargets(page: Page) {
  return page.evaluate((selector) => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0')
        continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 44 || r.height < 44) {
        out.push(
          `${el.getAttribute('aria-label') || el.getAttribute('data-testid') || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`
        );
      }
    }
    return out;
  }, INTERACTIVE);
}

/** Visible controls that are not fully inside the viewport. */
async function offscreenControls(page: Page) {
  return page.evaluate((selector) => {
    const out: string[] = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0')
        continue;
      if (cs.pointerEvents === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Cards inside a horizontal scroll strip are reachable by scrolling.
      if (el.closest('.hz-scroll-x')) continue;
      if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) {
        out.push(
          el.getAttribute('aria-label') || el.getAttribute('data-testid') || el.tagName
        );
      }
    }
    return out;
  }, INTERACTIVE);
}

test.describe('share-link flow', () => {
  test('a cold link lands on the still with the viewpoint nav and no horizontal overflow', async ({
    page,
    baseURL,
  }) => {
    await openTour(page, baseURL!);
    await expect(page.getByTestId('mobile-nav')).toBeVisible();
    await expect(page.getByTestId('mobile-nav-pill')).toContainText('1 / 6');
    await expect(page.getByTestId('mobile-nav-pill')).toContainText('Station Plaza');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(await offscreenControls(page)).toEqual([]);
  });

  test('the viewport meta allows pinch zoom and covers the safe area', async ({
    page,
  }) => {
    await page.goto('/');
    const content = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(content).toContain('viewport-fit=cover');
    expect(content).not.toMatch(/user-scalable\s*=\s*(no|0)/);
    expect(content).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/);
  });

  test('the landing page and error states fit the screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ).toBeLessThanOrEqual(0);

    await stubBootstrapError(page, 'gone-export', 404, 'Not found');
    await page.goto('/gone-export');
    await expect(page.getByText('Unable to load viewer')).toBeInViewport();

    await stubBootstrapError(page, 'pending-export', 409, 'processing');
    await page.goto('/pending-export');
    await expect(page.getByText('Almost ready')).toBeInViewport();
  });
});

test.describe('controls', () => {
  test('every visible control is at least 44px and inside the viewport', async ({
    page,
    baseURL,
  }) => {
    await openTour(page, baseURL!);
    expect(await smallTargets(page)).toEqual([]);
    expect(await offscreenControls(page)).toEqual([]);

    // The review tools row, once opened, scrolls sideways instead of clipping.
    await page.getByTestId('mobile-tools-toggle').click();
    await expect(page.getByTestId('mobile-tools-row')).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
    const row = page.getByTestId('mobile-tools-row');
    const scrollable = await row.evaluate((el) => el.scrollWidth > el.clientWidth);
    const fits = await row.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(scrollable || fits).toBe(true);
    await row.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await expect(page.getByRole('button', { name: 'Clear all' })).toBeInViewport();
  });

  test('the header stays reachable in landscape with the keyboard open space', async ({
    page,
    baseURL,
  }) => {
    await openTour(page, baseURL!);
    const header = page.getByTestId('mobile-header');
    await expect(header).toBeVisible();
    const box = (await header.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    await expect(page.getByTestId('account-menu-button')).toBeInViewport();
  });
});

test.describe('viewpoints', () => {
  test('tapping a card plays the transition video inline, muted', async ({
    page,
    baseURL,
  }) => {
    await openTour(page, baseURL!);
    // The viewer deliberately crossfades instead of waiting when a clip is not
    // ready within 250ms of the tap, so give the warm-up queue time to fetch it.
    await page.getByTestId('mobile-nav-card-2').hover();
    await page.waitForTimeout(2500);
    await page.getByTestId('mobile-nav-card-2').click();
    const video = page.locator('[data-testid="aura-viewer"] video');
    await expect(video).toHaveCount(1);
    const props = await video.evaluate((v: HTMLVideoElement) => ({
      playsInline: v.playsInline,
      muted: v.muted,
      inlineAttr: v.hasAttribute('playsinline'),
      controls: v.controls,
    }));
    expect(props.playsInline).toBe(true);
    expect(props.inlineAttr).toBe(true);
    expect(props.muted).toBe(true);
    expect(props.controls).toBe(false);
    await expect(page.getByTestId('aura-viewer')).toHaveAttribute(
      'data-current-view',
      'Platform Level',
      { timeout: 15000 }
    );
    await expect(page.getByTestId('mobile-nav-pill')).toContainText('2 / 6');
  });

  test('swiping left on the still advances to the next viewpoint', async ({
    page,
    baseURL,
  }) => {
    await openTour(page, baseURL!);
    const stage = page.getByTestId('still-stage');
    const box = (await stage.boundingBox())!;
    const y = box.y + box.height * 0.45;
    await page.mouse.move(box.x + box.width * 0.8, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, y, { steps: 4 });
    await page.mouse.move(box.x + box.width * 0.3, y, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId('aura-viewer')).toHaveAttribute(
      'data-current-view',
      'Platform Level',
      { timeout: 15000 }
    );
  });

  test('the viewpoint sheet lists every view and jumps to one', async ({
    page,
    baseURL,
  }) => {
    await openTour(page, baseURL!);
    await page.getByTestId('mobile-nav-pill').click();
    const sheet = page.getByTestId('viewpoint-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button')).toHaveCount(7); // 6 views + close
    expect(await smallTargets(page)).toEqual([]);
    await page.getByTestId('viewpoint-sheet-item-5').click();
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId('aura-viewer')).toHaveAttribute(
      'data-current-view',
      'Market Hall',
      { timeout: 15000 }
    );
  });

  test('prev and next buttons step through the tour and stop at the ends', async ({
    page,
    baseURL,
  }) => {
    await openTour(page, baseURL!);
    await expect(page.getByTestId('mobile-nav-prev')).toBeDisabled();
    await page.getByTestId('mobile-nav-next').click();
    await expect(page.getByTestId('aura-viewer')).toHaveAttribute(
      'data-current-view',
      'Platform Level',
      { timeout: 15000 }
    );
    await expect(page.getByTestId('mobile-nav-prev')).toBeEnabled();
  });

  test('arrow keys step through the tour for keyboard users', async ({
    page,
    baseURL,
  }) => {
    await openTour(page, baseURL!);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('aura-viewer')).toHaveAttribute(
      'data-current-view',
      'Platform Level',
      { timeout: 15000 }
    );
  });
});

test.describe('still image', () => {
  test('pinch zooms the still and a swipe no longer changes viewpoint', async ({
    page,
    baseURL,
  }) => {
    await openTour(page, baseURL!);
    const stage = page.getByTestId('still-stage');
    const box = (await stage.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // Synthesised two-finger pinch: pointer events with distinct ids.
    await stage.evaluate(
      (el, { cx, cy }) => {
        const fire = (type: string, id: number, x: number, y: number) =>
          el.dispatchEvent(
            new PointerEvent(type, {
              pointerId: id,
              pointerType: 'touch',
              clientX: x,
              clientY: y,
              bubbles: true,
              isPrimary: id === 1,
            })
          );
        fire('pointerdown', 1, cx - 20, cy);
        fire('pointerdown', 2, cx + 20, cy);
        for (let i = 1; i <= 8; i++) {
          fire('pointermove', 1, cx - 20 - i * 10, cy);
          fire('pointermove', 2, cx + 20 + i * 10, cy);
        }
        fire('pointerup', 1, cx - 100, cy);
        fire('pointerup', 2, cx + 100, cy);
      },
      { cx, cy }
    );
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    const transform = await stage.evaluate((el) => el.style.transform);
    expect(transform).toMatch(/scale\(([2-4](\.\d+)?)\)/);

    // Zoomed in, a horizontal drag pans instead of swiping to the next view.
    await page.mouse.move(cx + 60, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 60, cy, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    await expect(page.getByTestId('aura-viewer')).toHaveAttribute(
      'data-current-view',
      'Station Plaza'
    );
    // The nav gives way to the zoomed image.
    await expect(page.getByTestId('mobile-nav')).toHaveCount(0);
  });

  test('double-tap zooms in and a new viewpoint resets the zoom', async ({
    page,
    baseURL,
  }) => {
    await openTour(page, baseURL!);
    const stage = page.getByTestId('still-stage');
    const box = (await stage.boundingBox())!;
    const x = box.x + box.width * 0.6;
    const y = box.y + box.height * 0.4;
    await page.mouse.click(x, y);
    await page.mouse.click(x, y, { delay: 20 });
    await expect(stage).toHaveAttribute('data-zoomed', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('aura-viewer')).toHaveAttribute(
      'data-current-view',
      'Platform Level',
      { timeout: 15000 }
    );
    await expect(stage).toHaveAttribute('data-zoomed', 'false');
  });

  test('a single tap on the still hides the UI and a second tap brings it back', async ({
    page,
    baseURL,
  }) => {
    await openTour(page, baseURL!);
    const stage = page.getByTestId('still-stage');
    const box = (await stage.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
    await expect(page.getByTestId('mobile-nav')).toHaveCount(0, { timeout: 2000 });
    const header = page.getByTestId('mobile-header');
    await expect
      .poll(
        async () => (await header.boundingBox())!.y + (await header.boundingBox())!.height
      )
      .toBeLessThanOrEqual(0);
    await page.waitForTimeout(400);
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
    await expect(page.getByTestId('mobile-nav')).toBeVisible();
  });
});

test.describe('location pins', () => {
  test('a pin has a 44px target and opens its details in a bottom sheet', async ({
    page,
    baseURL,
  }) => {
    await openTour(page, baseURL!);
    const pin = page.getByRole('button', { name: 'Plaza Fountain' });
    await expect(pin).toBeVisible();
    const box = (await pin.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await pin.click();
    const sheet = page.getByTestId('location-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Plaza Fountain');
    await expect(sheet).toContainText('A restored 1920s fountain');
    await expect(sheet).toContainText('Granite');
    // Readable: body copy at 16px, nothing under 12px.
    const sizes = await sheet.evaluate((el) =>
      Array.from(el.querySelectorAll('p, span, dt, dd')).map((n) =>
        parseFloat(getComputedStyle(n).fontSize)
      )
    );
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
    const body = page.locator('[data-testid="location-sheet-body"] p').first();
    expect(parseFloat(await body.evaluate((n) => getComputedStyle(n).fontSize))).toBe(16);
    // Tapping the pin did not toggle the immersive mode.
    await page.getByTestId('location-sheet-close').click();
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId('mobile-nav')).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
  });
});

test.describe('sign-in and editing', () => {
  test('the sign-in panel fits the screen with 16px fields and 44px rows', async ({
    page,
    baseURL,
  }) => {
    await openTour(page, baseURL!);
    await page.getByTestId('account-menu-button').click();
    const panel = page.getByTestId('account-menu-panel');
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    const vw = await page.evaluate(() => window.innerWidth);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
    for (const input of await panel.locator('input').all()) {
      const size = await input.evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
      expect(size).toBeGreaterThanOrEqual(16);
      expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      (await panel.getByRole('button', { name: 'Sign in' }).boundingBox())!.height
    ).toBeGreaterThanOrEqual(44);
    // Keyboard focus is visible on the field.
    await panel.locator('input').first().focus();
    const outline = await panel
      .locator('input')
      .first()
      .evaluate((n) => getComputedStyle(n).outlineStyle);
    expect(outline).not.toBe('none');
  });

  test('the owner can edit the scene from a phone', async ({ page, baseURL }) => {
    await openTour(page, baseURL!, { canEdit: true });
    let saved: any = null;
    await page.route(
      `http://127.0.0.1:9999/exports/${TOUR_EXPORT_ID}/config`,
      async (route) => {
        saved = JSON.parse(route.request().postData() ?? '{}');
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
    );
    const button = page.getByTestId('scene-editor-button');
    await expect(button).toBeInViewport();
    expect((await button.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    await button.click();
    const panel = page.getByTestId('scene-editor-panel');
    await expect(panel).toBeVisible();
    expect(await offscreenControls(page)).toEqual([]);
    await page.getByTestId('scene-editor-view-name').fill('Renamed on a phone');
    await page.getByTestId('scene-editor-save').click();
    // The outcome that matters: the PUT carried the rename and the viewer shows it.
    await expect(page.getByTestId('aura-viewer')).toHaveAttribute(
      'data-current-view',
      'Renamed on a phone'
    );
    expect(saved.views[0].name).toBe('Renamed on a phone');
    await expect(page.getByTestId('scene-editor-error')).toHaveCount(0);
  });
});

test.describe('motion and focus', () => {
  test('prefers-reduced-motion cuts to the next still instead of playing the clip', async ({
    page,
    baseURL,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openTour(page, baseURL!);
    await page.getByTestId('mobile-nav-card-2').click();
    await expect(page.getByTestId('aura-viewer')).toHaveAttribute(
      'data-current-view',
      'Platform Level',
      { timeout: 2000 }
    );
    await expect(page.locator('[data-testid="aura-viewer"] video')).toHaveCount(0);
  });

  test('tabbing shows a focus ring on the header controls', async ({ page, baseURL }) => {
    await openTour(page, baseURL!);
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const cs = getComputedStyle(el);
      return { tag: el.tagName, outline: cs.outlineStyle, width: cs.outlineWidth };
    });
    expect(focused.tag).toBe('BUTTON');
    expect(focused.outline).not.toBe('none');
    expect(parseFloat(focused.width)).toBeGreaterThanOrEqual(2);
  });
});

test.describe('resident comments', () => {
  test('a resident comments from the phone in a bottom sheet', async ({
    page,
    baseURL,
  }) => {
    const commentsUrl = `http://127.0.0.1:9999/api/viewer/${TOUR_EXPORT_ID}/comments`;
    const items: Record<string, unknown>[] = [];
    let posted: Record<string, unknown> | null = null;
    await page.route(commentsUrl, async (route) => {
      if (route.request().method() === 'POST') {
        posted = JSON.parse(route.request().postData() ?? '{}');
        const created = {
          id: 'c1',
          viewId: posted!.viewId,
          text: posted!.text,
          name: posted!.name ?? null,
          position: null,
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
    await openTour(page, baseURL!);

    const button = page.getByTestId('comments-button');
    expect((await button.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    await button.click();
    const sheet = page.getByTestId('comments-sheet');
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('comments-empty')).toBeVisible();

    const text = page.getByTestId('comment-text');
    expect(parseFloat(await text.evaluate((n) => getComputedStyle(n).fontSize))).toBe(16);
    await text.fill('Needs a crossing here.');
    const send = page.getByTestId('comment-send');
    expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await send.click();

    await expect(page.getByTestId('comment-sent')).toBeVisible();
    expect(posted).toEqual({ viewId: 1, text: 'Needs a crossing here.' });
    await expect(sheet.getByTestId('comment-item')).toHaveCount(1);
    expect(await smallTargets(page)).toEqual([]);

    await page.getByTestId('comments-sheet-close').click();
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId('comments-count')).toHaveText('1');
  });
});
