# NBA player-data platform

## Current provider audit

| Concern | Current behavior |
| --- | --- |
| Endpoints | `/v1/players`; capability checks for `/v1/players/active` and `/v1/stats`. The new adapter also defines `/v1/teams` and season-stat fetching, but is not connected to production. |
| Authentication | Server-side `BALLDONTLIE_API_KEY` in the `Authorization` header. The key is a Functions secret or local admin environment variable and is never sent to the browser. |
| Pagination | Cursor-based, 100 records/page, deduplicated by provider ID, with repeated-cursor detection, empty-page termination, and a 1,000-page ceiling. |
| Transport safety | 20-second request timeout; up to five retries for 429/5xx; `Retry-After`/exponential backoff; approximately one request per second. The provider's contractual quota is tier-dependent and is not inferred by the application. |
| Coverage | The maintained snapshot has 540 current-season names. The latest catalog audit contains 522 active/draft-eligible identities; unmatched snapshot names and provider identity discrepancies account for gaps. Historical provider rows remain retained but inactive. |
| Imported data | Stable provider identity, name, position eligibility, current directory team, height/weight, jersey/college/country/draft metadata, headshot identity, activity flags, and V1 directory-baseline ratings. |
| Missing data | Free-tier active-player authority and verified enriched season statistics are unavailable in the current integration. Some current-season identities and headshots can be unmatched. |
| Execution | Firebase Admin callable and local Admin SDK script only. Simulation, Draft, Free Agency, and browser code read Firestore and never call the provider. |
| Refresh | Admin callable `syncNbaPlayerCatalog` or explicitly confirmed `npm run sync:nba-catalog -- --write --confirm`. Fetch finishes before catalog batches are prepared; failures are recorded in `playerCatalogs/syncStatus`. |
| Failure handling | Timeout, cursor-loop, page-count, response-shape, plausible-player-count, authorization, retry, and Firestore sync-status guards. Existing catalog documents are not cleared before fetch. |

The current production catalog sync remains the Phase 16 BALLDONTLIE sync. It is server-only, cursor-paginated, rate-limited, retried, timeout-protected, and filtered through the maintained current-season appearance snapshot when the paid active-player endpoint is unavailable.

Phase 21.5A adds a provider-neutral boundary without switching production. Providers implement `fetchPlayers`, `fetchSeasonStats`, `fetchTeams`, `normalizePlayer`, and `normalizeSeasonStats`. Only adapters may read provider response shapes. Everything downstream consumes the canonical model.

The canonical model contains a stable identity and neutral external-identity list, structured name, primary/eligible positions, team, physical profile, experience, headshot, active/draft status, ratings, and source metadata. Raw fields such as `first_name`, `team.full_name`, `fg3_pct`, and cursor metadata stop at the adapter.

The import lifecycle is fetch, normalize, validate, generate ratings, build coverage, and optionally publish. Preview and publish both require an authenticated admin claim. Publishing additionally requires explicit confirmation, a clean validation report, and an injected trusted publisher. No Firestore publisher or callable is connected in Phase 21.5A, so this architecture cannot overwrite the live catalog.

Validation reports duplicate canonical IDs, duplicate normalized names, invalid positions, missing teams/headshots/stats, inactive or retired players, and rating-bound failures. Coverage summarizes total/active/inactive players, verified and missing ratings, missing images, duplicates, position distribution, and five-point rating bands.

To replace BALLDONTLIE later, implement the provider contract, map its payloads to the canonical player and normalized season-stat contracts, run the same test suite and coverage preview, then explicitly connect the trusted publisher in a separately reviewed release. Simulation, Draft, Free Agency, and other clients continue to read Firestore only.
