# Repository Guidelines

## Project Shape

RealmHub is a TypeScript/Express registry and marketplace server for OpenOctopus realm packages. Source and tests live in `src/`, build output lives in `dist/`, and local runtime data is ignored via `data/`.

## Commands

- `pnpm dev` watches the server build.
- `pnpm test` runs Vitest.
- `pnpm run typecheck` runs TypeScript no-emit checks.
- `pnpm run lint` runs oxlint.
- `pnpm run build` creates the package runtime in `dist/`.

## Environment

Use `.env.example` as the public template. Keep API keys, database paths, and auth secrets out of commits.

## Editing Rules

- Keep package registry API behavior covered by tests when changing server routes.
- Treat `dist/` as release output and keep it synchronized intentionally.
