# AURA Horizon Viewer

Embeddable viewer for digital twins exported from the AURA Engine Unreal app.

Published projects are served at **`https://horizon.auraengine.com/<exportId>`**.

## How a project reaches the viewer

```
Unreal (PawnVideoRecorder)        captures view stills + transition videos
  -> export zip                   config.json at root, assets/ alongside
  -> POST /api/exports/{ws}/new   create the job
  -> POST .../{exportId}/upload   validate, then publish to S3
  -> GET  /api/viewer/bootstrap   config with asset URLs rewritten to the API
  -> horizon.auraengine.com/<id>  this viewer
```

The backend is [HorizonServer](https://github.com/AURA-XR-SYSTEMS/HorizonServer). The hosting
stack (S3 + CloudFront + ACM) lives in `aura-aws-infra/cloud/static-site/horizonviewer`.

## Where a project can come from

`src/lib/projectSource.ts` resolves this in priority order:

| URL                              | Source                                            |
| -------------------------------- | ------------------------------------------------- |
| `/<exportId>`                    | HorizonServer — the shareable client link         |
| `?exportId=<id>`                 | HorizonServer — older link format, still honoured |
| `?key=<slug>` or `/embed/<slug>` | bundled project under `public/assets/projects/`   |
| no id                            | landing page                                      |

Bundled projects exist for local development and offline demos. Anything shared with a
client should be published through the server so it has a real export id.

## Development

```bash
npm install
npm run dev            # http://localhost:3001
```

Point it at a backend with `VITE_HORIZON_API_BASE_URL`; without one, only bundled
projects load.

```bash
VITE_HORIZON_API_BASE_URL=https://api.horizon-dev.aura-infra.com npm run dev
```

Try `?key=horizon-metro` for a bundled project, or `/horizon-metro-demo` for a published one.

## Embedding

```html
<iframe
  src="https://horizon.auraengine.com/<exportId>"
  width="100%"
  height="600"
  frameborder="0"
  allow="fullscreen"
></iframe>
```

`/embed/<slug>` still resolves for existing iframes pointing at bundled projects.

## Publishing a bundled project to the server

```bash
python scripts/publish_project.py horizon-metro --dry-run
python scripts/publish_project.py horizon-metro
```

## Deploying the viewer

```bash
VITE_HORIZON_API_BASE_URL=https://api.horizon-dev.aura-infra.com npm run build
python scripts/deploy_viewer.py --bucket aura-horizon-viewer-prod \
  --profile aura-dev --distribution-id E9T1JZVXC14CW --invalidate
```

`deploy_viewer.py` sets every content type from an explicit table rather than letting the
AWS CLI guess. The CLI infers types from Python's `mimetypes`, which has no `.webp` entry
before 3.13, so a plain `aws s3 sync` uploads most of this bundle as `binary/octet-stream`
and videos silently refuse to play. The script fails on an unknown extension instead.

`.github/workflows/deploy-viewer.yml` does the same in CI, once its OIDC role exists.

## Asset encoding

`scripts/encode_transitions.py` prepares Unreal output for the web. The important part is
`-movflags +faststart`: without it the `moov` atom lands at the end of the file and a
browser must download an entire clip before showing one frame, which is what made
navigation stall. The script verifies atom order on every output.

The Unreal recorder now writes faststart directly, so fresh exports arrive correct.

## Mobile

Share links are increasingly opened on phones, so the viewer adapts to them. Branch
`j/hzn-mobile` (thread J-HZN, 2026-10-26), built on `main` @ `d0cfee8`, which is what
`horizon.auraengine.com` serves (the live `index-PYAGUJoj.js` / `index-bgKWAb1q.css` are
byte-identical to a build of that commit). The `feat/moving-pins` branch named in
`BUILD.md` §S10 exists only on the workstation that made it, not on the org remote, so it
is not included here.

### Breakpoints

Everything phone-specific keys off one hook, `useCompactLayout()` in
`src/lib/useMediaQuery.ts`. A desktop browser at full size takes none of the branches and
renders exactly as before (the pixel guard below proves it).

| Name      | Query                                          | What changes                                                                                  |
| --------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `compact` | `(max-width: 767px)`, or `coarse` **and** `short` | Phone layout: two-row header, scroll-strip nav + viewpoint sheet, bottom-sheet pin details, full-width sign-in / editor panels, 44px controls, 16px fields. |
| `short`   | `(max-height: 500px)`                          | Phone held sideways: 44px header, 96x60 nav cards.                                            |
| `coarse`  | `(pointer: coarse)`                            | The primary pointer is a finger.                                                              |
| reduced   | `(prefers-reduced-motion: reduce)`             | Transitions cut straight to the next still instead of playing the fly-through; CSS animations and transitions are collapsed. |

Safe-area insets (`env(safe-area-inset-*)`) pad the header and nav; `index.html` declares
`viewport-fit=cover` and leaves pinch zoom enabled.

### Gestures (phone layout only)

| Gesture                      | Effect                                                             |
| ---------------------------- | ------------------------------------------------------------------ |
| Swipe left / right on still  | Next / previous viewpoint in tour order (plays the transition clip) |
| Pinch                        | Zoom the still 1-4x about the pinch point; drag pans while zoomed   |
| Double-tap                   | Zoom to 2.5x at the tap; double-tap again to reset                  |
| Single tap on still          | Hide the header and nav (immersive); tap again to bring them back   |
| Tap a pin                    | Opens the location's details in a bottom sheet (44px target)        |
| Drag the sheet handle down   | Closes the sheet; the backdrop and Escape do too                    |
| Scroll the card strip        | Browses viewpoints; tap a card or the `N / total` pill for the full list |
| Arrow keys, Tab, Escape      | Step viewpoints, move focus (visible ring), close sheets. Works on desktop too. |

A new viewpoint resets zoom and closes sheets. While zoomed, swipes pan instead of
navigating and the nav gives way to the image.

### Audit and what was fixed

Phone-viewport audit on `main` with Playwright device presets iPhone 14, iPhone 15
(WebKit), Pixel 7 (Chromium), each portrait and landscape, plus a 320px-wide viewport.
Screenshots and a findings JSONL for every page a share link can reach are in
`C:\dev\aura\artifacts\2026-10-26\hzn-mobile\baseline\` (before) and `...\after\`.

| #   | Failure on `main` (phone)                                                                                            | Status                                                                                             | Test |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---- |
| 1   | Header toolbar is a fixed row: 5-9 controls off-screen at 390px, 9-14 at 320px; sign-in and edit buttons unreachable | Fixed: logo + tools / views / edit / account buttons; review tools in a scrollable second row       | `controls › every visible control…` |
| 2   | Tap targets 34-40px (toolbar, account, carousel arrows, 24x28 pins)                                                  | Fixed: 44px everywhere on the phone layout, pins get a 44px button around the 24px glyph           | `controls › every visible control…`, `location pins › …` |
| 3   | Viewpoint carousel sized from window width with fixed 144px cards; 2 of 6 views visible, arrows 40px                 | Fixed: finger-scrollable strip (112x72, 96x60 sideways), `N / total · name` pill, viewpoint sheet, 44px prev/next | `viewpoints › …` (4 tests) |
| 4   | Location pins could not be tapped at all: the review-tools overlay sat above them and swallowed pointer events (desktop too) | Fixed: overlay is `pointer-events: none` unless a review tool is active                            | `location pins › …`, desktop `pin-panel` snapshot |
| 5   | Pin detail panel floats 280-360px beside the pin at 12px text; runs off a 390px screen                               | Fixed: bottom sheet, 16px body text, 44px close                                                    | `location pins › …` |
| 6   | Pins outside the cover-cropped still are unreachable in portrait (no pan or zoom)                                    | Fixed: pinch-zoom and pan on the still (also trackpad ctrl+wheel)                                  | `still image › pinch…`, `double-tap…` |
| 7   | Hover-only affordances: card warm-up on `onPointerEnter`, review annotation delete/resize on `group-hover`           | Partly fixed: cards warm on focus/tap; annotation delete/resize handles stay hover-only (see deferred) | — |
| 8   | Review tools used mouse events only: sketch, pin, text, drag and resize did nothing with a finger                    | Fixed: pointer events with `touch-action: none` on the interaction layer                           | manual (see below) |
| 9   | No swipe between viewpoints                                                                                          | Fixed                                                                                              | `viewpoints › swiping…` |
| 10  | No way to clear the UI off the still                                                                                 | Fixed: tap toggles immersive mode                                                                  | `still image › a single tap…` |
| 11  | Sign-in / scene-editor panels fixed 280-300px wide at the button's right edge; 13px fields trigger iOS zoom; 32px rows | Fixed: full-width panels on phones, 16px fields, 44px rows                                        | `sign-in and editing › …` (2 tests) |
| 12  | Landscape phone: header and nav took 180 of 340px                                                                    | Fixed: 44px header, 60px cards, sheet capped at 70vh                                               | all tests run on the landscape projects |
| 13  | No `viewport-fit=cover` / safe-area handling                                                                         | Fixed                                                                                              | `share-link flow › the viewport meta…` |
| 14  | `prefers-reduced-motion` ignored (fly-through clips, dock animations)                                                | Fixed: crossfade instead of clip; CSS animations collapsed                                         | `motion and focus › prefers-reduced-motion…` |
| 15  | Inputs had `outline: none`, so keyboard focus on fields was invisible                                                | Fixed: global `:focus-visible` ring                                                                | `motion and focus › tabbing…`, `sign-in…` |
| 16  | Carousel arrows had no accessible name (Lighthouse `button-name`)                                                    | Fixed: `aria-label`                                                                                | Lighthouse |
| 17  | Text under 16px: card names 11-13px, pin panel 12px, panel labels 10-11px                                            | Partly fixed: body copy in sheets 16px, nav names 12px+, fields 16px. Uppercase labels stay 11-12px | `location pins › …` |
| 18  | Transition video on iOS                                                                                              | No change needed: already `playsinline` + `muted`, played from a tap; verified in WebKit            | `viewpoints › tapping a card…` |
| 19  | Pinch zoom disabled                                                                                                  | No change needed: the viewport meta never disabled it; row 6 adds zoom of the still itself         | `share-link flow › the viewport meta…` |
| 20  | Orientation change                                                                                                   | Fixed by rows 3, 12: layout re-measures on resize and the media queries flip live                   | landscape projects |
| 21  | Landing page and error / pending states                                                                              | No change needed: already fit 320px with no overflow                                               | `share-link flow › the landing page…` |

After the changes the audit records no horizontal overflow and no off-screen control on any
of the seven projects and eight states. The one entry it still lists under "small targets"
is the 24x28 pin glyph itself, which the audit's selector matches by its `cursor-pointer`
class; it sits inside the 44px button (row 2).

**Deferred, with reasons.**

- Review annotation delete / resize handles (`group-hover`) are still hover-only on phones.
  The review tools are a reviewer's desk feature, not part of the share-link tour, and the
  annotations are not persisted; making their handles touch-first is its own piece of work.
- Uppercase caption labels (Address, Region, Details, the project / view labels) stay at
  11-12px. They are labels beside 15-16px values and Lighthouse's legibility audit accepts
  12px and up.
- The admin debug panel (`VITE_HORIZON_ENABLE_ADMIN_PANEL`) is untouched: it is a build-time
  developer surface, never in a client build.
- The YouTube 360 embed's drag-to-look is mouse-only. No published export uses an embed.

### Resident comments ("share and listen")

Anyone with the link can leave a comment on the viewpoint on screen, with no account; the
project team collects them through HorizonServer's engagement feed. The header gains one
button (a speech bubble with the count) on desktop and phones. On phones the panel is a
bottom sheet with 16px fields and 44px controls; on desktop it is a popover like the
account menu. The owner, signed in, can hide a comment. Bundled projects (`?key=`) have no
server behind them, so they get no button.

Client: `src/lib/commentsApi.ts`, `src/CommentsPanel.tsx`. Server contract: HorizonServer
`app/comments.py` on branch `j/hzn-ownership` (`POST`/`GET /api/viewer/{exportId}/comments`,
`GET /api/engage/comments` with a service token, owner `POST /exports/{exportId}/comments/{id}/hide`).
A honeypot field travels with the form; the server rate-limits by connection and answers
429, which the panel shows as it is. Tests: `e2e/comments.spec.ts` (desktop, 5) and the
"resident comments" group of the phone suite.

This is the one deliberate desktop change besides the pin fix: the desktop pixel-guard
baselines were re-taken for it on 2026-10-28.

### Tests

The desktop suite (`npm run test:e2e`, Desktop Chrome) is the original 15 plus the 5 comment tests. Two more
configs run against a dev server started **without** the admin panel on port 4175:

```bash
VITE_HORIZON_API_BASE_URL=http://127.0.0.1:9999 npx vite --host 127.0.0.1 --port 4175 &
npx playwright test -c playwright.audit.config.ts          # phones: 19 tests x 7 projects = 133, + audit
npx playwright test -c playwright.desktop-visual.config.ts # desktop pixel guard: 6 snapshots
AUDIT_OUT=<dir> npx playwright test -c playwright.audit.config.ts audit   # screenshots + findings.jsonl
```

The phone projects are iPhone 14 / 15 (WebKit; `AUDIT_ENGINE=chromium` to emulate in
Chromium), Pixel 7 (Chromium), each portrait and landscape, and a 320x568 viewport. The
tour fixture in `e2e/fixtures/tour.ts` serves the bundled sample stills and clips, so
transitions really play. Pinch is synthesised with pointer events (Playwright has no
two-finger touch).

The desktop pixel guard's snapshots in `e2e/__snapshots__/desktop/` were taken on `main`
before any source change, on one Windows machine. Another machine's Chromium renders text
and blur about 1% differently, so the comparison allows `maxDiffPixelRatio: 0.02`; a 6/6
is a statement about the machine it ran on. One snapshot was re-taken on purpose:
`pin-panel.png`, because on `main` the pin was unclickable (row 4) and the baseline showed
no panel. The flake in `scene-editor.spec.ts:58` (the owner rename, about one run in five on
`main`) was the "Saved" marker showing for a single frame: the scene editor's reseed effect
reset the save state when its own save came back. Fixed in `SceneEditor.tsx` on 2026-10-28.

`npm run format:check` fails on 24 files on `main` already (docs, configs, workflows);
every file touched here passes Prettier.

### Lighthouse (mobile, production build served by `vite preview`)

Landing page `/` and the still viewer on `?key=sample-tour`. The API-backed share link
cannot be stubbed under Lighthouse, so the test tour lives in `e2e/fixtures/sample-tour/`
(not in `public/`, so it never ships) and is copied into the built output just for the
measurement:

```bash
npm run build
mkdir -p dist/assets/projects/sample-tour && cp e2e/fixtures/sample-tour/config.json dist/assets/projects/sample-tour/
npx vite preview --port 4181   # then lighthouse http://127.0.0.1:4181/?key=sample-tour
``` Lighthouse 12.8.2, Chromium 1234, default
mobile emulation and throttling, 2026-10-26. Reports: `C:\dev\aura\artifacts\2026-10-26\hzn-mobile\lighthouse\`.

| Page         | Accessibility before → after | Best practices before → after | Performance | SEO |
| ------------ | ---------------------------- | ----------------------------- | ----------- | --- |
| Landing      | 100 → 100                    | 96 → 100            | 99 → 98     | 82  |
| Still viewer | 92 → 100                     | 93 → 100              | 74 → 74     | 83  |

Before: `button-name` failed (carousel arrows), `font-size` (11px card names) and
`errors-in-console` (a 404 for `/favicon.ico`, there was no icon link). After: all three
pass. The one item Lighthouse still lists, `label-content-name-mismatch` on the nav cards,
is unweighted and reflects the "01" prefix in the accessible name. Performance is dominated
by the 1919x1079 PNG stills, which this work does not touch.

### Not tested

- Real devices. Everything above ran in Playwright's WebKit and Chromium device emulation on
  Windows. iOS Safari specifics worth a hands-on check: the home-indicator inset, `100vh`
  behind the toolbar, low-power-mode autoplay refusal (falls back to a crossfade by design).
- A signed-in session against the live server (never done with a real account, per team rules).
- The review tools' touch drawing beyond the pointer-event conversion: the sketch / pin /
  text tools were exercised by hand in device emulation, not by a test.

### Still to do before it ships

Merge `j/hzn-mobile`, `npm run build` with `VITE_HORIZON_API_BASE_URL`, and the CloudFront
deploy in "Deploying the viewer", all by the release owner. No HorizonServer change is
needed.

## Validation

```bash
npm run format:check
npm run build
npm run test:e2e        # needs `npm run test:e2e:install` once
```

## Repository history

This repo contained two unrelated codebases built in parallel against the same remote: a
Preact viewer wired to HorizonServer on `main`, and this React viewer with the video
loading work and review tools. They shared no git history — `git merge-base` returned
nothing. The merge keeps this viewer plus the server contract layer ported from the Preact
one, and drops that viewer's GitHub Pages and container delivery paths in favour of
S3 + CloudFront.
