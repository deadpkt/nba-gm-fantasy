# Verified Ratings V2 preview

Ratings V2 formula `ratings-v2.0.0` consumes only `normalizeSeasonStatRecord` output. BALLDONTLIE field names are confined to its provider adapter. Population percentiles are winsorized at the 2nd and 98th percentiles and blend 70% league context with 30% valid-position context. Ratings use integers from 25–99.

Attributes combine efficiency, volume, role, and available advanced context. Missing advanced categories remain null, lower coverage/confidence, and trigger conservative positional-population regression. They are never silently replaced with league-average provider data. Athleticism is only an activity proxy; consistency uses game-log variance when available and otherwise remains a conservative workload proxy.

Confidence uses games, estimated or supplied total minutes, minutes per game, starts, core-stat completeness, and eight advanced-category groups. Verified status requires at least 20 games, 500 minutes, 90% core coverage, and three advanced groups. Smaller usable samples are provisional; fewer than three games, 40 minutes, or 55% core coverage are insufficient data.

Preview manifests explicitly disable publication and require a licensing checkpoint covering fantasy use, normalized-stat retention, derived ratings, historical retention, identity display, and attribution. Current thresholds are 98% active identity coverage, 95% average core-stat coverage, zero duplicate identities, zero malformed ratings, zero critical anomalies, and zero missing canonical positions. These thresholds are publication prerequisites, not guarantees of approval.

Only normalized inputs, compact explanations, anomalies, comparison data, and coverage metadata are staged. Raw provider responses are not retained. `playerDataImports` is readable only by an explicit Firebase admin custom claim; every client write is denied. Trusted Admin SDK staging is bounded to 700 players. Draft, Free Agency, player snapshots, contracts, and both simulation versions do not query this collection.

The offline workflow accepts a JSON object containing `season`, canonical `players`, normalized `seasonStats`, and optionally `currentPlayers` and `sourceCategoryCoverage`:

`npm run preview:ratings-v2 -- --input normalized-input.json --output ratings-v2-preview.json`

This writes locally only. Optional staging requires Application Default Credentials, explicit confirmation, and a real Firebase user whose custom claims include `admin: true`:

`npm run preview:ratings-v2 -- --input normalized-input.json --stage --confirm --admin-uid <uid>`

Staging writes only `playerDataImports`; it never changes the current catalog pointer. Production activation remains a separate trusted, admin-only publication operation with validation, licensing approval, immutable versioning, and rollback safeguards.

## Ratings ownership

FULL COURT derives overall ratings internally through its versioned Ratings V2 pipeline. The abandoned External OVR CSV workflow was intentionally removed: NBA 2K and other third-party game ratings are not copied into the catalog. Future calibration should improve the internal formula, validation, and review tooling. Detailed attributes continue to come from normalized GOAT data, while trusted catalog publication and rollback remain the only production activation path.

## Ratings V2.3 realism calibration

`ratings-v2.3.0` keeps every V2.2 detailed attribute intact and replaces only the Overall hierarchy model. The model groups correlated attributes into scoring, creation, perimeter defense, interior defense, rebounding, and physical/reliability domains. Overall then combines domain skill value with role responsibility, role-adjusted efficiency and impact, and reliability/evidence. Its upper-tail curve is earned through verified workload, independent breadth, efficiency, and creation or two-way impact; specialist attributes remain elite without being counted as multiple independent star skills.

Role classification is calculated before Overall and never consumes Overall. Role ranges and expected rank bands are review guardrails rather than fixed quotas. Missing advanced categories lower evidence and elite certainty instead of being treated as zero or elite. Team wins, reputation, popularity, external game ratings, and player-name overrides are not inputs.

Recalibration is deterministic and offline:

`node scripts/recalibrateRatingsPreview.mjs --input goat-ratings-preview-2025-v2.2.json --output goat-ratings-preview-2025-v2.3.json --formula ratings-v2.3.0`

The output contains the full ranked population audit, top 100, top 20 per position, role leaders, five-point distribution, V2.2 deltas, warning queue, and realism score. It performs no provider request, Firestore write, staging, or publication. V2.3 remains blocked until critical realism issues are zero, calibration is manually approved, licensing is truthfully approved, staging is ready, and exact publication confirmation is provided.
