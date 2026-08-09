# NBA catalog synchronization

The runtime source of truth is `playerCatalogs/current/players/{playerId}` in Firestore. Browser pages never call BALLDONTLIE directly.

The BALLDONTLIE Free tier does not expose `/players/active` or any player-season statistics. Its `/players` team value is historical and is never treated as active-roster evidence. The free-tier fallback intersects the provider directory with the checked-in `functions/data/currentPlayers-2025-26.json` snapshot: players with at least five official 2025-26 regular-season appearances. Regenerate that reviewed snapshot with `node scripts/data/buildCurrentPlayerSnapshot.mjs` when advancing seasons. A paid `/players/active` response automatically replaces this fallback.

Publishing is rejected unless the verified candidate set contains 350–700 players. A successful sync marks matched players `active: true` and `draftEligible: true`; every retained catalog entry outside the verified set is preserved but marked inactive and ineligible. Existing league roster snapshots and references are not rewritten.

## Provider and credentials

The trusted provider is BALLDONTLIE. Configure `BALLDONTLIE_API_KEY` as a Firebase Functions secret; never use a `VITE_` variable.

```powershell
npx firebase-tools functions:secrets:set BALLDONTLIE_API_KEY
```

The free Players endpoint supports directory sync. Active Players and game player stats require provider capabilities beyond Free; Season Averages requires GOAT. If Active Players is unavailable, sync uses a documented current-team/draft-year approximation. Missing premium statistics preserve tuned ratings for known players and apply `directory-baseline-v1` to new players without presenting fabricated NBA statistics.

## Connectivity and synchronization

Set `BALLDONTLIE_API_KEY` only in the server shell to run the non-mutating connectivity probe:

```powershell
npm run test:nba-api
```

Deploy `syncNbaPlayerCatalog`, then invoke it from an authenticated account carrying the Firebase custom claim `admin: true`. The function paginates all provider pages before upserting. It never clears the catalog. Results and capability mode are recorded in `playerCatalogs/current` and `playerCatalogs/syncStatus`.

For an explicit Admin SDK import, configure Application Default Credentials (or `FIREBASE_SERVICE_ACCOUNT_JSON`) and run:

```powershell
npm run sync:nba-catalog -- --write --confirm
```

Without both confirmation flags the command performs no provider request and no write. The completed sync response and metadata contain `playerCount` and `activePlayerCount`; counts are intentionally not hard-coded because NBA rosters change.
