# BALLDONTLIE GOAT Ratings preview

The GOAT import is a trusted local Admin SDK workflow. Provider calls never run in React, and the API key is never written to output or Firestore.

```powershell
$env:BALLDONTLIE_API_KEY="YOUR_SECRET_KEY"
npm run fetch:goat-ratings-preview -- --season 2025 --output goat-ratings-preview-2025.json
```

To stage the generated preview for read-only admin inspection without fetching the provider again:

```powershell
npm run stage:goat-ratings-preview -- --input goat-ratings-preview-2025.json --confirm --admin-uid FIREBASE_UID
```

The local JSON contains only the fetch manifest, normalized player/stat inputs, validation findings, and Ratings V2 preview. Generated files are ignored by Git and can be deleted after review. Staging writes only to `playerDataImports`; it does not publish, change `playerCatalogs/current`, activate Simulation V2, or modify leagues.

Large previews are staged through resumable sequential batches of at most 100 players. Each WriteBatch commit has a 90-second deadline, and the manifest becomes `ready` only after every deterministic batch ledger entry is verified. A failed retry reuses the same import ID and source hash; completed batches are skipped, incomplete batches are safely overwritten. A different file cannot reuse an existing import ID. Failed/staging imports remain non-publishable and can be inspected in the Admin Ratings Preview page. No client-side cleanup permission is provided; if an abandoned import must be removed, use a separately reviewed Admin SDK operation against that exact `playerDataImports/{importId}` path.

`--category general_advanced,shooting_5ft` keeps the required `general_base` category and limits optional diagnostics. `--max-players N` is intended only for bounded provider testing. `--dry-run` explicitly prevents staging. Resume/caching is intentionally deferred.
