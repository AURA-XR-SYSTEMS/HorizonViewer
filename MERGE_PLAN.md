# HORIZON Unification Plan

## Context

Two teams built the same product in parallel, in the same GitHub repo, with **no shared git history**
(`git merge-base origin/main HEAD` returns nothing — roots are `80483081` and `e493b19`).

- **`origin/main`** — Preact viewer, consumes `GET /api/viewer/bootstrap?exportId=`, ships an
  `AdminExportPanel`, zod schemas, Playwright e2e, CI, and auto-deploys to GitHub Pages.
  Backed by **HorizonServer**, live on AWS ECS Fargate at `https://api.horizon-dev.aura-infra.com`.
- **`feat/demo-review-tools`** (local) — React 19 viewer with the video-loading optimization work,
  `ReviewTools`, faststart encode pipeline, static multi-project configs. Deployed to GCP Cloud Run.

Neither is complete: main has the plumbing, this branch has the viewer. The goal is one system, one
viewer, one deploy path, serving client links at **`horizon.auraengine.com/<exportId>`**.

Decisions taken: this branch's React viewer is the core; main's contract layer ports into it;
hosting consolidates on AWS S3 + CloudFront; the static demo projects migrate into HorizonServer
as real export jobs.

## Known constraints

- **No AWS credentials on this machine.** All AWS steps are authored here and run by Arthur.
- **`auraengine.com` DNS is at GoDaddy** (`ns33/ns34.domaincontrol.com`), not Route53. ACM
  validation records and the final CNAME/ALIAS are manual GoDaddy entries.
- `horizon.auraengine.com` currently does not resolve (NXDOMAIN).
- Nothing in this working tree is committed yet.

---

## Phase 0 — Stop the bleeding

1. Commit the optimization work currently sitting untracked (12 files incl. `.gcloudignore`).
2. Move `../Aura_HORIZON_assets_backup` somewhere durable — it is the only copy of the
   pre-optimization masters.

## Phase 1 — Extend the server contract (HorizonServer)

The viewer's `ProjectConfig` is a strict superset of the server's. Pydantic silently drops unknown
fields, so these must be added server-side or the merged viewer loses features.

`app/models.py`

- `AuraView` += `thumbUrl?`, `embed?` (`{type:'youtube360', videoId}`), `alternateLayers?`
- `ProjectConfig` += `projectId?`, `projectName?`, `metadata?`
- `AuraLocation` += `Coordinates?`, `Links?`

`app/services.py` — **both** `hydrate_config` and `hydrate_viewer_config` rebuild `AuraView`
field-by-field, so any new URL-bearing field is silently dropped unless added there. Rewrite
`thumbUrl` and `alternateLayers[].imageUrl` through `resolve_viewer_asset_url` alongside `imageUrl`.

`app/export_artifact_validator.py` — `_validate_views` must assert `thumbUrl` and alternate-layer
paths exist in the archive, same as `_validate_local_asset_path` does for `imageUrl`.

`app/export_mapping.py` — `ExportMetadataView` += `thumbPath`; carry it through
`project_config_from_metadata` and `metadata_from_project_config`.

### Fix the live mixed-content bug

`resolve_asset_url` / `resolve_viewer_asset_url` use `request.url_for(...)`, which behind the
TLS-terminating ALB emits `http://` URLs into a page served over HTTPS. Browsers block these.
Confirmed live:

```
GET https://api.horizon-dev.aura-infra.com/api/viewer/bootstrap?exportId=demo-export
  → "imageUrl":"http://api.horizon-dev.aura-infra.com/assets/view_1.png"
```

Fix: run Uvicorn with `--proxy-headers --forwarded-allow-ips=*` (ALB is the only ingress; ECS SG
allows `8080` from the ALB SG only), or normalize the scheme in `resolve_*_asset_url`. Add a
regression test asserting `https` when `X-Forwarded-Proto: https` is set.

## Phase 2 — Merge the contract layer into the viewer

Port from `origin/main`, Preact → React 19:

| From `origin/main`                                | To this repo                 | Notes                          |
| ------------------------------------------------- | ---------------------------- | ------------------------------ |
| `src/lib/apiSchemas.ts`                           | `src/lib/apiSchemas.ts`      | zod; extend for Phase 1 fields |
| `src/lib/projectConfigApi.ts`                     | `src/lib/bootstrapClient.ts` | bootstrap fetch + validation   |
| `src/lib/exportJobApi.ts` + `exportJobSchemas.ts` | same paths                   | admin API client               |
| `src/components/AdminExportPanel.tsx`             | `src/AdminExportPanel.tsx`   | `preact/hooks` → `react`       |
| `src/components/ComingSoonLanding.tsx`            | `src/ComingSoonLanding.tsx`  | root with no id                |

Add `zod`. Keep `AuraViewer.tsx` and `ReviewTools.tsx` unchanged — the optimization work is the
asset we are protecting.

### Source resolution in `src/api/aura.ts`

Single ordered resolver replacing the current static-only path:

1. path segment `/<exportId>` → `GET {API}/api/viewer/bootstrap?exportId=<id>` ← the target shape
2. `?exportId=<id>` → same (back-compat with main and existing `viewerUrl` values)
3. `?key=<slug>` → static `/assets/projects/<slug>/config.json` (local dev / offline demo)
4. no id → `ComingSoonLanding`

`/embed/:auraKey` keeps working so live iframes do not break.

## Phase 3 — Migrate the demo projects

Script (`scripts/publish_project.py`): package `public/assets/projects/<slug>/` into an export zip
(`config.json` at root + `assets/`), `POST /api/exports/{workspaceId}/new` with a stable client
export id, then `POST .../upload`. Run for `horizon-metro` and `maui-busway`.

Depends on Phase 1 — `maui-busway` uses `embed`, `horizon-metro` uses `thumbUrl`; both are dropped
by today's server model. Verify round-trip: bootstrap output must match the local config
semantically before the static copies are demoted to dev-only fallback.

## Phase 4 — Hosting on AWS

Author here, run by Arthur:

- `infra/horizon-viewer/` Terraform: private S3 bucket + CloudFront (OAC), SPA rewrite so
  `/<exportId>` serves `index.html`, ACM cert in `us-east-1`, long cache on `/assets/*`,
  `no-cache` on `index.html`.
- `.github/workflows/deploy-viewer.yml`: build with `VITE_HORIZON_API_BASE_URL`, `aws s3 sync`,
  CloudFront invalidation, via OIDC role (mirror `github-aura-aws-infra-deploy`).
- **Manual GoDaddy steps** (documented, not automated): ACM validation CNAME, then
  `horizon.auraengine.com` → CloudFront distribution.
- Add `https://horizon.auraengine.com` to `CORS_ALLOW_ORIGINS` — already the configured value in
  `aura-aws-infra`, so no change needed there, but verify it is live on the running task.

## Phase 5 — Reconcile the repo

Branch from `origin/main`, merge this branch with `--allow-unrelated-histories`, resolving:

- **take ours**: `src/` viewer, `scripts/`, `public/assets/`
- **take theirs**: `.github/workflows/`, `AGENTS.md`, `codex-*`, `runtime-bootstrap.md`,
  Playwright config, `README.md` (then update)
- **drop**: `Dockerfile`/`nginx.conf`/`cloudbuild` GCP path, `deploy-pages.yml`, `.gcloudignore`
  — only after Phase 4 is verified live

Repo conventions in main's `AGENTS.md` (branch `codex/<slug>`, PR to `main`, `npm run format:check`

- `npm run build` before responding) become the standard going forward.

Retire the GCP Cloud Run `aura-embed` service **last**, once `horizon.auraengine.com` is verified.
Keep revision `aura-embed-00004-b6c` as the rollback anchor until then.

---

## Verification

- **Phase 1**: `nox -s all` in HorizonServer; new tests for extended fields surviving a
  config → S3 → bootstrap round-trip, and for `https` under `X-Forwarded-Proto`.
- **Phase 2**: `npm run build`; load `?key=horizon-metro` (static) and `?exportId=demo-export`
  against the live dev API; confirm ReviewTools and video prefetch still behave.
- **Phase 3**: bootstrap response for the migrated `horizon-metro` renders identically to the
  static build, including thumbnails and the maui-busway 360 embed.
- **Phase 4**: `curl -I https://horizon.auraengine.com/<exportId>` → 200 + `index.html`;
  no mixed-content or CORS errors in console; MP4s still stream with faststart.
- **End to end**: Unreal-format zip → upload → `ready` → open
  `horizon.auraengine.com/<exportId>` → viewer loads with working transitions.

## Sequencing

Phase 1 and Phase 2 are independent and can run together. Phase 3 needs Phase 1 deployed.
Phase 4 needs Phase 2 building. Phase 5 is last, and Cloud Run stays up until it is done.

## Open items

- The Unreal-side exporter that produces these zips is not in any repo I can see. The server's
  `UnrealLegacyMetadata` schema implies it exists — locate it before trusting the end-to-end path.
- Every export endpoint is unauthenticated and `workspaceId` is unvalidated, with no link to
  UserService workspaces. Fine for a closed demo, not for client-facing links. Needs a decision
  before real customer projects land.
- `ReviewTools` annotations are in-memory only — nothing persists across reloads.
