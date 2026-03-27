# AURA: Horizon Viewer

A thin, embeddable viewer for artifacts built from the AURA platform.

## Docker

Build and run just the viewer from this directory:

```powershell
docker compose up --build
```

By default it builds against `http://localhost:8000` and requests `demo-export`.

From the repo root:

- `docker compose up --build` uses LocalStack API Gateway in front of the Lambda image
- `docker compose -f compose.local.yml up --build` points the viewer at the direct Uvicorn backend

## Admin Debug Panel

Build-time admin/debug mode can be enabled with:

- `VITE_HORIZON_ENABLE_ADMIN_PANEL=true`
- optional `VITE_HORIZON_ADMIN_DEFAULT_WORKSPACE_ID=<workspaceId>`

This panel exercises the backend export-job endpoints:

- `POST /api/exports/{workspaceId}/new`
- `POST /api/exports/{workspaceId}/{exportId}/upload`
- `GET /api/exports/{workspaceId}/{exportId}`

It does not yet consume `GET /api/viewer/bootstrap?exportId=...`.
When a job becomes `ready`, the panel stays honest about that limitation instead of inventing viewer bootstrap behavior.

