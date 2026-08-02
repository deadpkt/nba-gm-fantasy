# Trusted catalog publication

`playerDataImports/{importId}` remains preview-only. The Admin callable copies an approved preview into a new immutable `playerCatalogs/{version}/players` collection, verifies the bounded write, then atomically creates the version manifest, updates `playerCatalogs/current`, appends `playerCatalogPublicationHistory`, and archives the preview.

Clients cannot write catalog, pointer, preview, or history documents. Rollback is an Admin callable that verifies an existing published version and atomically moves only the pointer plus a history event. Existing league snapshots are never visited or rewritten. New leagues pin `catalogVersion`, `ratingsVersion`, `formulaVersion`, and Simulation V1 at creation.

The pre-versioned `playerCatalogs/current/players` collection is retained as the reserved `legacy-current` compatibility version. It is never deleted, remains a valid first-publication rollback target, and the old sync workflow is frozen after versioned activation so that baseline cannot mutate.
