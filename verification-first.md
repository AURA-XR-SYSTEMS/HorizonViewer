# HorizonViewer Verification-First

## Environment

- Primary local validation entrypoints:
  - `npm run format:check`
  - `npm run build`
  - `npm run test:e2e`
- Default local dev port: `3101`
- Playwright test port: `4174`

## Verification Ladder

1. Inspect the changed code path and identify whether the change is formatting-only, UI behavior, build/runtime config, or end-to-end browser behavior.
2. Run `npm run format:check` first when the change touches source formatting or frontend files broadly.
3. Run `npm run build` for the default local validation path on normal frontend changes.
4. Run `npm run test:e2e -- <spec>` or `npm run test:e2e` when the change affects browser flows or backend integration visible to the viewer.
5. Use GitHub Actions as the broader CI enforcement path for format, build, and Playwright coverage.

## Notes

- Prefer the native npm scripts over ad hoc Vite or Playwright command combinations.
- Keep frontend verification narrow during iteration and widen to e2e only when browser-visible behavior changed.
- The repo is standardized, but operational promotion still requires a recorded Codex workflow smoke pass.
