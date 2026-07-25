# HorizonViewer Skill Inventory

## Shared Foundation Skills

- `env-github-auth`: `CodexEnv` shared skill (`supported`, `contract+probe`) confirm `gh` auth and GitHub write readiness
- `git-branch-pr-status`: `CodexEnv` shared skill (`supported`, `contract+probe`) determine whether the current branch should be reused or refreshed
- `git-repo-publish`: `CodexEnv` shared skill (`supported`, `contract+probe`) publish validated changes with `gh --body-file`
- `verify-run-local-default`: `CodexEnv` shared skill (`supported`, `contract+probe`) select the narrowest documented local verification path

## Deferred Repo-Local Skills

- `horizonviewer-build-verify`: planned; currently represented by the documented `npm run build` entrypoint
- `horizonviewer-e2e-verify`: planned; currently represented by the documented Playwright entrypoints

## Registry Rule

- Shared skills listed here are the current first-class skill surface for `HorizonViewer`.
- Repo-local skills remain deferred until the frontend command surface needs a dedicated skill layer.
