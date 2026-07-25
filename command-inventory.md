# HorizonViewer Command Inventory

## Development

- Install dependencies: `npm ci`
- Run dev server: `npm run dev`
- Run dev server on a different port: `npm run dev -- --port <port>`
- Run preview server: `npm run preview`
- Build viewer: `npm run build`
- Format source: `npm run format`
- Check formatting: `npm run format:check`

## Verification

- Default local verification: `npm run build`
- Formatting check: `npm run format:check`
- Install Playwright Chromium: `npm run test:e2e:install`
- Run end-to-end tests: `npm run test:e2e`
- Run targeted end-to-end tests: `npm run test:e2e -- <spec>`
- Local GitHub Actions run: `act pull_request -W .github/workflows/ci.yml --container-architecture linux/amd64`

## Docker

- Start viewer stack: `docker compose up --build`
- Start viewer against local backend stack: `docker compose -f compose.local.yml up --build`
- Override Docker host port: `HORIZON_VIEWER_HOST_PORT=<port> docker compose up --build`

## Git Workflow

- Check branch: `git branch --show-current`
- Check status: `git status --short --branch`
- Compare against main: `git fetch origin main`
- Create branch: `git checkout -b codex/<short-slug>`
- Push branch: `git push -u origin codex/<short-slug>`
- Open PR: `gh pr create --body-file <path>`
