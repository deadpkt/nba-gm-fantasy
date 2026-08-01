import test from "node:test";
import assert from "node:assert/strict";
import { isUpdateUnseen, markVersionSeen, readSeenVersion } from "./devLogSeen.js";
test("latest update seen state stays browser local", () => { const values = new Map(); const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) }; assert.equal(isUpdateUnseen("1.2.0", readSeenVersion(storage)), true); markVersionSeen("1.2.0", storage); assert.equal(isUpdateUnseen("1.2.0", readSeenVersion(storage)), false); });
test("unavailable storage fails safely", () => { const storage = { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); } }; assert.equal(readSeenVersion(storage), null); assert.doesNotThrow(() => markVersionSeen("1.0.0", storage)); });
