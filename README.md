# AURA: Horizon Viewer

A thin, embeddable viewer for artifacts built from the AURA platform.

## Docker

Build and run just the viewer from this directory:

```powershell
docker compose up --build
```

By default it builds against `http://localhost:8000`, requests `demo-export`, and publishes the viewer on `http://localhost:3101`.

If you run the Vite dev server directly, the default local port is also `3101`:

```bash
npm run dev
```

From the repo root:

- `docker compose up --build` uses LocalStack API Gateway in front of the Lambda image
- `docker compose -f compose.local.yml up --build` points the viewer at the direct Uvicorn backend

If you need to avoid host port collisions on a shared machine, override the published port:

```bash
HORIZON_VIEWER_HOST_PORT=13101 docker compose up --build
```

The same applies to direct Vite runs:

```bash
npm run dev -- --port 13101
```

## Admin Debug Panel

Build-time admin/debug mode can be enabled with:

- `VITE_HORIZON_ENABLE_ADMIN_PANEL=true`
- optional `VITE_HORIZON_ADMIN_DEFAULT_WORKSPACE_ID=<workspaceId>`

This panel exercises the backend export-job endpoints:

- `POST /api/exports/{workspaceId}/new`
- `POST /api/exports/{workspaceId}/{exportId}/upload`
- `GET /api/exports/{workspaceId}/{exportId}`

It now consumes `GET /api/viewer/bootstrap?exportId=...` for both seeded demo exports and real ready export jobs.
When an export job becomes `ready`, the panel surfaces the returned `viewerUrl` so you can open the viewer directly against that export.

## Validation

Run the local viewer checks with:

```bash
npm run format:check
npm run build
```

For browser tests:

```bash
npm run test:e2e:install
npm run test:e2e
```

To run the GitHub Actions workflow locally with `act`:

```bash
act pull_request -W .github/workflows/ci.yml --container-architecture linux/amd64
```
