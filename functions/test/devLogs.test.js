import test from "node:test";
import assert from "node:assert/strict";
import { devLogIdForVersion, newestPublished, normalizeDevLog } from "../shared/devLogs.js";
const valid = { version: "1.2.0", title: "Dynasty Update", summary: "A concise release.", sections: [{ type: "added", title: "Added", items: ["A secure Dev Log."] }] };
test("structured Dev Logs normalize without HTML interpretation", () => { assert.equal(devLogIdForVersion(valid.version), "v1_2_0"); assert.deepEqual(normalizeDevLog(valid, { publishing: true }), valid); });
test("malformed and empty published content is rejected", () => { assert.throws(() => normalizeDevLog({ ...valid, version: "v1" }), /semantic/); assert.throws(() => normalizeDevLog({ ...valid, sections: [] }, { publishing: true }), /at least one/); assert.throws(() => normalizeDevLog({ ...valid, sections: [{ type: "html", title: "X", items: ["x"] }] }), /unsupported/); });
test("newest metadata selection is deterministic", () => { assert.equal(newestPublished([{ id: "a", version: "1.0.0", status: "published", publishedAt: 1 }, { id: "b", version: "1.1.0", status: "published", publishedAt: 2 }]).id, "b"); });
