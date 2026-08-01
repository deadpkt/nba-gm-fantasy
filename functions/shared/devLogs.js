export const DEV_LOG_STATUSES = Object.freeze(["draft", "published"]);
export const DEV_LOG_SECTION_TYPES = Object.freeze(["added", "improved", "fixed"]);
const VERSION = /^\d+\.\d+\.\d+$/;

const fail = (message) => { throw new Error(message); };
export const devLogIdForVersion = (version) => `v${version.replaceAll(".", "_")}`;

export function normalizeDevLog(input = {}, { publishing = false } = {}) {
  const version = String(input.version || "").trim();
  const title = String(input.title || "").trim();
  const summary = String(input.summary || "").trim();
  if (!VERSION.test(version)) fail("Version must use semantic version format, such as 1.2.0.");
  if (!title || title.length > 100) fail("Title is required and must be 100 characters or fewer.");
  if (!summary || summary.length > 280) fail("Summary is required and must be 280 characters or fewer.");
  if (!Array.isArray(input.sections) || input.sections.length > 6) fail("Use no more than six update sections.");
  const sections = input.sections.map((section) => {
    const type = String(section?.type || "");
    const sectionTitle = String(section?.title || "").trim();
    if (!DEV_LOG_SECTION_TYPES.includes(type)) fail("An update section has an unsupported type.");
    if (!sectionTitle || sectionTitle.length > 50) fail("Section titles are required and must be 50 characters or fewer.");
    if (!Array.isArray(section.items) || section.items.length > 20) fail("A section may contain no more than 20 items.");
    const items = section.items.map((item) => String(item || "").trim()).filter(Boolean);
    if (items.some((item) => item.length > 240)) fail("Update items must be 240 characters or fewer.");
    return { type, title: sectionTitle, items };
  }).filter((section) => section.items.length);
  if (publishing && !sections.some((section) => section.items.length)) fail("Add at least one update item before publishing.");
  return { version, title, summary, sections };
}

export function newestPublished(logs = []) {
  return logs.filter((log) => log.status === "published" && log.publishedAt).sort((a, b) => {
    const time = (value) => value?.toMillis?.() ?? (Number(value) || 0);
    return time(b.publishedAt) - time(a.publishedAt) || b.version.localeCompare(a.version, undefined, { numeric: true });
  })[0] || null;
}
