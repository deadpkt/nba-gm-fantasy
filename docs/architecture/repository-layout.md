# Repository layout

FULL COURT uses domain-oriented folders while keeping runtime boundaries explicit.

## Frontend

- `src/App.jsx` owns route composition. Public URLs remain stable when page files move.
- `src/pages/` contains route-level screens; owner-only screens live in `src/pages/admin/`.
- `src/features/notifications/` owns notification presentation, subscription, and callable access.
- `src/components/` contains shared and domain UI reused across routes.
- `src/context/` and `src/hooks/` contain cross-feature application state.
- `src/lib/` contains client repositories and pure domain helpers that are not feature-local.

## Trusted backend

- `functions/index.js` is the stable Firebase export surface. Export names and trigger paths are public deployment contracts.
- `functions/lib/` contains trusted services used by callable and trigger handlers.
- `functions/providers/` contains external-provider adapters. BALLDONTLIE payloads stay under `functions/providers/balldontlie/`.
- `functions/shared/` contains provider-neutral deterministic domain logic shared by handlers and tests.
- `functions/data/` contains reviewed, deployed source snapshots—not local provider caches.
- `functions/test/` contains backend tests.

Ratings formula versions and simulation engines intentionally retain separate source files. Historical determinism takes priority over reducing file count.

## Tooling and data

- `scripts/admin/` manages trusted administrator configuration.
- `scripts/data/` manages provider and catalog maintenance.
- `scripts/ratings/` builds, recalibrates, audits, and stages ratings previews.
- `scripts/simulation/` runs local simulation calibration.
- `scripts/maintenance/` contains explicit one-time migrations and audits.
- `scripts/lib/` contains reusable CLI-only helpers and their tests.
- `local-data/ratings/current/` is the working input and candidate area.
- `local-data/ratings/archive/` retains superseded local previews.
- `local-data/ratings/cache/` contains replaceable provider caches.

Local data is ignored, never deployed, and must never be imported by application or Functions modules. Trusted publication reads staged Firestore imports, not files from `local-data/`.

## Documentation and tests

- `docs/architecture/` documents system and repository boundaries.
- `docs/data/` documents provider and catalog operations.
- `docs/ratings/` documents ratings workflows.
- `test/firestore/` contains emulator-backed security tests.
- Route and pure frontend tests remain beside the client helpers they exercise.

## Artifact policy

- **SOURCE:** application code, immutable formulas, reviewed provider snapshots, rules, tests, and documentation. Tracked by Git.
- **GENERATED:** ratings previews and reports under `local-data/`.
- **LOCAL-ONLY:** credentials, `.env`, and admin working inputs. Never committed.
- **CACHE:** replaceable provider responses under `local-data/ratings/cache/`.
- **DEPLOYED:** frontend output, Firebase Functions, rules, and checked-in Functions data snapshots.

Do not add provider calls, Firestore reads, or local file reads at module import time. This keeps Firebase Function discovery fast and keeps simulation, Draft, and Free Agency independent of external APIs.
