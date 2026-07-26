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
