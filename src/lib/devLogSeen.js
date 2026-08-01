export const seenStorageKey = "full-court:latest-update-seen";
export function readSeenVersion(storage = globalThis.localStorage) { try { return storage?.getItem(seenStorageKey) || null; } catch { return null; } }
export function markVersionSeen(version, storage = globalThis.localStorage) { try { if (version) storage?.setItem(seenStorageKey, version); } catch { /* Browser storage may be unavailable. */ } }
export function isUpdateUnseen(latestVersion, seenVersion) { return Boolean(latestVersion && latestVersion !== seenVersion); }
