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
