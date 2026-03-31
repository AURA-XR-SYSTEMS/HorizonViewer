# AGENTS.md

Instructions in this file apply to the entire repository.

## Workflow

- Inspect the relevant code paths before editing. Prefer `rg` for search.
- Keep changes minimal and localized to the requested behavior.
- Do not revert user changes you did not make.
- Use `apply_patch` for manual file edits.

## Validation

Run checks on every implementation pass before responding.

- Formatting check: `npm run format:check`
- Preferred frontend validation: `npm run build`
- End-to-end validation: `npm run test:e2e -- <spec>`

## Notes

- The default local HorizonViewer port is `3101` for both `npm run dev` and Docker Compose.
- If you need to avoid host port collisions on a shared machine, override the Docker host port with `HORIZON_VIEWER_HOST_PORT` instead of editing `compose.yml`.
- You can override the Vite port ad hoc with `npm run dev -- --port <port>`.
- The Playwright harness intentionally uses its own isolated port (`4174`) instead of the default dev port.
- Local GitHub Actions runs use `act pull_request -W .github/workflows/ci.yml --container-architecture linux/amd64`.
