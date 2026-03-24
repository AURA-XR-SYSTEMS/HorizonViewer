# Aura Horizon Deployment

## Current Deployment

| Property | Value |
|----------|-------|
| **Platform** | Google Cloud Run |
| **Project** | `surface-v9` |
| **Service** | `aura-embed` |
| **Region** | `us-central1` |
| **URL** | https://aura-embed-4501047095.us-central1.run.app |

## Prerequisites

- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed
- Authenticated: `gcloud auth login`
- Project set: `gcloud config set project surface-v9`

## Deploy

From the `Aura_HORIZON` directory:

```bash
gcloud run deploy aura-embed --source . --region us-central1 --allow-unauthenticated --port 8080
```

This command:
1. Builds the Docker image using the `Dockerfile`
2. Pushes to Google Container Registry
3. Deploys to Cloud Run
4. Routes 100% traffic to the new revision

## Manual Docker Build (Optional)

If you need to build locally first:

```bash
# Build
docker build -t aura-embed .

# Test locally
docker run -p 8080:8080 aura-embed

# Tag for GCR
docker tag aura-embed gcr.io/surface-v9/aura-embed

# Push
docker push gcr.io/surface-v9/aura-embed

# Deploy from image
gcloud run deploy aura-embed --image gcr.io/surface-v9/aura-embed --region us-central1 --allow-unauthenticated --port 8080
```

## Embedding

Use in an iframe:

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
- `/` — Demo project

## View Logs

```bash
gcloud run services logs read aura-embed --region us-central1
```

## Rollback

List revisions:
```bash
gcloud run revisions list --service aura-embed --region us-central1
```

Route traffic to previous revision:
```bash
gcloud run services update-traffic aura-embed --to-revisions=REVISION_NAME=100 --region us-central1
```
