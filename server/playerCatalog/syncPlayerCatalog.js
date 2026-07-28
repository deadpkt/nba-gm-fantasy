import {
  createCatalogPublication,
  publishCatalog,
} from "./catalogPublisher.js";

// This is the server-side orchestration seam. A future scheduled function
// supplies a provider adapter and a provider fetch function; neither is added
// here, so this module makes no network calls and has no credentials.
export async function preparePlayerCatalogSync({
  adapter,
  loadProviderRecords,
  source,
  season,
  ratingVersion,
}) {
  if (!adapter?.normalize || typeof loadProviderRecords !== "function") {
    throw new Error("A provider adapter and record loader are required.");
  }

  const providerRecords = await loadProviderRecords();
  if (!Array.isArray(providerRecords)) {
    throw new Error("The provider record loader must return an array.");
  }

  return createCatalogPublication({
    players: providerRecords.map((record) =>
      adapter.normalize(record, { ratingVersion }),
    ),
    source: source || adapter.providerName,
    season,
    ratingVersion,
  });
}

export async function syncPlayerCatalog(options) {
  const publication = await preparePlayerCatalogSync(options);
  return publishCatalog(publication);
}
