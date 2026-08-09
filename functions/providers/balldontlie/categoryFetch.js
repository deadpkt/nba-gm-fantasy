export async function fetchProviderCategories(categories, { required = [], logger = () => {} } = {}) {
  const entries = await Promise.all(Object.entries(categories).map(async ([name, loader]) => {
    try { return [name, { status: "complete", data: await loader() }]; }
    catch (error) { logger(`Provider category ${name} failed: ${error.message}`); return [name, { status: "failed", data: null, error: error.message }]; }
  }));
  const results = Object.fromEntries(entries);
  const failed = entries.filter(([, result]) => result.status === "failed").map(([name]) => name);
  const requiredFailed = failed.filter((name) => required.includes(name));
  return {
    status: requiredFailed.length ? "failed" : failed.length ? "partial" : "complete",
    publishable: failed.length === 0,
    results,
    coverage: Object.fromEntries(entries.map(([name, result]) => [name, result.status === "complete"])),
    errors: entries.filter(([, result]) => result.error).map(([category, result]) => ({ category, message: result.error })),
    requiredFailed,
  };
}

