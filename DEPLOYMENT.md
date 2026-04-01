# Aura HORIZON Deployment

## Current Deployment

| Property | Value |
|----------|-------|
| **Platform** | Google Cloud Run |
| **Project** | `surface-v9` |
| **Service** | `aura-embed` |
| **Region** | `us-central1` |
| **URL** | https://aura-embed-4501047095.us-central1.run.app |
| **GitHub** | `AURA-XR-SYSTEMS/HorizonViewer` (branch: `feat/demo-review-tools`) |

## Prerequisites

- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed
- Authenticated: `gcloud auth login`
- Project set: `gcloud config set project surface-v9`
- [GitHub CLI](https://cli.github.com/) for git operations

## Quick Deploy (Two Steps)

The `--source .` deploy can be flaky with large assets. Use the two-step approach:

```bash
# 1. Build the image
gcloud builds submit --tag gcr.io/surface-v9/aura-embed:latest --project surface-v9

# 2. Deploy from the built image
gcloud run deploy aura-embed \
  --image gcr.io/surface-v9/aura-embed:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --project surface-v9 \
  --memory 512Mi
```

## Updating Video Assets

When new renders come from Unreal:

```bash
# 1. Place new captures in the source folder (or update SOURCE_DIR in the script)
#    Default: C:\Perforce\AURA_DEV_WORKSPACE\AURA_MAUI\Saved\VideoCaptures

# 2. Run the asset pipeline (copies MP4s + extracts still frames)
python scripts/encode_transitions.py --use-mp4

# 3. Deploy (two-step above)
```

The encoder expects folders named `{ViewA}_to_{ViewB}/` each containing an MP4 and a `frames/` subfolder with PNGs. Still images are extracted from the last frame of incoming transitions (Cesium fully loaded).

## Local Development

```bash
npm install
npm run dev
# Opens at http://localhost:3001
```

## Docker Local Test

```bash
docker build -t aura-embed .
docker run -p 8080:8080 aura-embed
# Opens at http://localhost:8080
```

## Embedding

```html
<iframe
  src="https://aura-embed-4501047095.us-central1.run.app/embed/demo"
  width="100%"
  height="600"
  frameborder="0"
  allowfullscreen>
</iframe>
```

### URL Patterns

- `/embed/:auraKey` — Load project by key
- `/?key=:auraKey` — Load project by query param
- `/` — Demo project (loads `config.json` from `/assets/horizon/`)

## Git

```bash
# Repo: AURA-XR-SYSTEMS/HorizonViewer
# Branch: feat/demo-review-tools

git push origin feat/demo-review-tools
```

## View Logs

```bash
gcloud run services logs read aura-embed --region us-central1 --project surface-v9
```

## Rollback

```bash
# List revisions
gcloud run revisions list --service aura-embed --region us-central1 --project surface-v9

# Route traffic to a previous revision
gcloud run services update-traffic aura-embed \
  --to-revisions=REVISION_NAME=100 \
  --region us-central1 \
  --project surface-v9
```
