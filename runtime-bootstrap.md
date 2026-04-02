# HorizonViewer Runtime Bootstrap

## Runtime

- preferred package manager: `npm`
- local dev entrypoint: `npm run dev`
- local build entrypoint: `npm run build`
- local preview entrypoint: `npm run preview`
- default local ports:
  - Vite dev server: `3101`
  - Vite preview: `3101`
  - Playwright harness: `4174`

## GitHub Auth

- preferred auth tool: `gh`
- auth verification command: `gh auth status`
- PR workflow command: `gh pr create --body-file <path>`

## Escalation Notes

- expected git escalation points: git add/commit/push may require sandbox escalation
- expected network escalation points: pushes, fetches, installs, and auth checks may require escalation
- expected Node install points: `npm ci` and Playwright browser installs may require network access

## Runtime Contract

- this repo is a static frontend and does not publish a container image
- local Docker usage is optional and limited to viewer-oriented local orchestration
- backend API targets are configured through build-time or runtime environment variables rather than hardcoded service discovery
