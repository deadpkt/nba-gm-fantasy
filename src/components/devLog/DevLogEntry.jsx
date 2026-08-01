import UiIcon from "../UiIcon";
const iconNames = { added: "plus", improved: "trend", fixed: "check" };
const dateLabel = (value) => { const date = value?.toDate?.() || (value ? new Date(value) : null); return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(date) : ""; };
export default function DevLogEntry({ log, latest = false, preview = false }) {
  return <article className={`dev-log-entry ${latest ? "is-latest" : ""}`}>
    <header><div><span>VERSION {log.version}</span><h2>{log.title || "Untitled update"}</h2></div>{!preview && <time>{dateLabel(log.publishedAt)}</time>}</header>
    <p>{log.summary}</p>
    <div className="dev-log-entry__sections">{(log.sections || []).filter((section) => section.items?.length).map((section, index) => <section key={`${section.type}-${index}`}><h3><UiIcon name={iconNames[section.type] || "info"} size={15} />{section.title}</h3><ul>{section.items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}</ul></section>)}</div>
  </article>;
}
