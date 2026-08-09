# Local data

This directory contains generated or downloaded development artifacts and is not deployed.

- `ratings/current/` — current multi-season input and review candidate.
- `ratings/archive/` — superseded local ratings previews retained for comparison.
- `ratings/cache/` — replaceable provider/season fetch caches.

The contents of `ratings/` are intentionally ignored by Git. Source code, checked-in provider snapshots, and immutable rating formulas belong under `functions/`, not here.
