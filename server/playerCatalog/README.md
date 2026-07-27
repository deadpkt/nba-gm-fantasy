# Player catalog sync foundation

This folder is server-side architecture only. It is not imported by the React
application and currently performs no provider calls or Firestore writes.

Future flow:

```text
provider records
  -> provider-specific toCanonicalPlayer(record)
  -> normalizeProviderPlayer()
  -> calculateOverall() from src/lib/playerRatings.js
  -> createCatalogPublication()
  -> privileged Firebase Admin publisher
  -> playerCatalogs/current
```

The adapter must provide the canonical numeric NBA person ID as `nbaPlayerId`.
That ID is used both as `player.id` and as the Firestore document ID, preserving
existing roster, lineup, and match-history compatibility. The adapter returns
only the existing UI player contract: `id`, `name`, `position`, `team`, `stats`,
`overall`, and `image`.

The eventual publisher must write only catalog documents. League team rosters
are immutable snapshots and must never be recalculated or rewritten when a new
catalog season or rating version is published.
