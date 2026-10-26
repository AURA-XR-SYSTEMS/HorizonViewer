import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { API_BASE, TOUR_EXPORT_ID, stubBootstrapError, stubTour } from '../fixtures/tour';

/**
 * Phone-viewport audit. Not a pass/fail suite: it records, per device and page
 * state, what a person on a phone would run into, and writes screenshots plus a
 * findings JSON for the README's failure table. Run with:
 *
 *   AUDIT_OUT=<dir> npx playwright test -c playwright.audit.config.ts audit
 *
 * Skipped unless AUDIT_OUT is set, so the regular mobile run never writes it.
 */

const OUT = process.env.AUDIT_OUT;
test.skip(!OUT, 'AUDIT_OUT not set');

const INTERACTIVE =
  'button, a[href], input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"]), svg[class*="cursor-pointer"]';

type Finding = {
  device: string;
  state: string;
  viewport: { width: number; height: number };
  overflowX: boolean;
  scrollWidth: number;
  smallTapTargets: { label: string; w: number; h: number }[];
  offscreenControls: { label: string; rect: number[] }[];
  textUnder16: { count: number; sizes: number[]; samples: string[] };
  viewportMeta: string | null;
  video?: { present: boolean; playsInline?: boolean; muted?: boolean; paused?: boolean };
  focusVisibleAfterTabs?: { label: string; outline: string; boxShadow: string }[];
};

async function measure(page: Page, device: string, state: string): Promise<Finding> {
  return page.evaluate(
    ({ device, state, INTERACTIVE }) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const label = (el: Element) =>
        (
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          el.getAttribute('data-testid') ||
          (el as HTMLElement).innerText?.trim().slice(0, 30) ||
          el.tagName.toLowerCase()
        ).replace(/\s+/g, ' ');
      const visible = (el: Element) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        if (parseFloat(cs.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };

      const smallTapTargets: Finding['smallTapTargets'] = [];
      const offscreenControls: Finding['offscreenControls'] = [];
      for (const el of Array.from(document.querySelectorAll(INTERACTIVE))) {
        if (!visible(el)) continue;
        if ((el as HTMLElement).className?.toString().includes('hidden')) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 44 || r.height < 44) {
          smallTapTargets.push({
            label: label(el),
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        }
        if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) {
          offscreenControls.push({
            label: label(el),
            rect: [r.left, r.top, r.right, r.bottom].map((n) => Math.round(n)),
          });
        }
      }

      const sizes = new Set<number>();
      const samples: string[] = [];
      let count = 0;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim();
        if (!text) continue;
        const el = node.parentElement;
        if (!el || !visible(el)) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 16) {
          count++;
          sizes.add(Math.round(size * 10) / 10);
          if (samples.length < 12) samples.push(`${size}px: ${text.slice(0, 40)}`);
        }
      }

      return {
        device,
        state,
        viewport: { width: vw, height: vh },
        overflowX: document.documentElement.scrollWidth > vw + 1,
        scrollWidth: document.documentElement.scrollWidth,
        smallTapTargets,
        offscreenControls,
        textUnder16: { count, sizes: Array.from(sizes).sort((a, b) => a - b), samples },
        viewportMeta:
          document.querySelector('meta[name="viewport"]')?.getAttribute('content') ??
          null,
      } as Finding;
    },
    { device, state, INTERACTIVE }
  );
}

async function shot(page: Page, device: string, state: string) {
  const dir = path.join(OUT!, device);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${state}.png`), fullPage: false });
}

function record(f: Finding) {
  const file = path.join(OUT!, 'findings.jsonl');
  fs.mkdirSync(OUT!, { recursive: true });
  fs.appendFileSync(file, JSON.stringify(f) + '\n');
}

test('audit every page a share link can reach', async ({ page, baseURL }, info) => {
  const device = info.project.name;
  const origin = baseURL!;

  // Landing page (a link with no id, or a bare domain).
  await page.goto('/');
  await page.getByTestId('landing-page').waitFor();
  await shot(page, device, '01-landing');
  record(await measure(page, device, 'landing'));

  // Still viewer, as a cold share link.
  await stubTour(page, origin);
  await page.goto(`/${TOUR_EXPORT_ID}`);
  await page.getByTestId('aura-viewer').waitFor();
  await page.waitForTimeout(800);
  await shot(page, device, '02-still');
  const still = await measure(page, device, 'still');
  // Keyboard-only: tab into the page and see whether focus is drawn anywhere.
  const focusTrail: NonNullable<Finding['focusVisibleAfterTabs']> = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    focusTrail.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body)
          return { label: 'body', outline: '', boxShadow: '' };
        const cs = getComputedStyle(el);
        return {
          label: el.getAttribute('aria-label') || el.getAttribute('title') || el.tagName,
          outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
          boxShadow: cs.boxShadow,
        };
      })
    );
  }
  still.focusVisibleAfterTabs = focusTrail;
  record(still);

  // Location pin and its tooltip panel.
  const pin = page.locator('[data-testid="aura-viewer"] svg.cursor-pointer').first();
  if (await pin.count()) {
    await pin.click({ force: true });
    await page.waitForTimeout(400);
    await shot(page, device, '03-pin-panel');
    record(await measure(page, device, 'pin-panel'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // Transition video player: click the second card and capture mid-clip.
  // Desktop carousel cards on main; the phone nav's cards once it exists.
  const cards = page.locator(
    '[data-testid="aura-viewer"] button[style*="width: 144px"], [data-testid="mobile-nav-card-2"]'
  );
  if ((await cards.count()) > 0) {
    await cards.last().click({ force: true });
    await page.waitForTimeout(600);
    const video = await page.evaluate(() => {
      const v = document.querySelector('video');
      return v
        ? { present: true, playsInline: v.playsInline, muted: v.muted, paused: v.paused }
        : { present: false };
    });
    await shot(page, device, '04-transition');
    const t = await measure(page, device, 'transition');
    t.video = video;
    record(t);
    await page.waitForTimeout(4000);
  }

  // Sign-in (account menu).
  await page.getByTestId('account-menu-button').click({ force: true });
  await page.getByTestId('account-menu-panel').waitFor();
  await shot(page, device, '05-sign-in');
  record(await measure(page, device, 'sign-in'));
  await page.keyboard.press('Escape');

  // Scene editor, reachable when the link's owner is signed in.
  await stubTour(page, origin, { canEdit: true });
  await page.goto(`/${TOUR_EXPORT_ID}`);
  await page.getByTestId('scene-editor-button').waitFor();
  await page.getByTestId('scene-editor-button').click({ force: true });
  await page.getByTestId('scene-editor-panel').waitFor();
  await shot(page, device, '06-scene-editor');
  record(await measure(page, device, 'scene-editor'));

  // Error states.
  await stubBootstrapError(page, 'gone-export', 404, 'Not found');
  await page.goto('/gone-export');
  await page.getByText('Unable to load viewer').waitFor();
  await shot(page, device, '07-error-404');
  record(await measure(page, device, 'error-404'));

  await stubBootstrapError(page, 'pending-export', 409, 'Export is still processing');
  await page.goto('/pending-export');
  await page.getByText('Almost ready').waitFor();
  await shot(page, device, '08-pending');
  record(await measure(page, device, 'pending'));

  void API_BASE;
});
