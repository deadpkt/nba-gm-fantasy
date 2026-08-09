import { useMemo, useState } from "react";
import { approveCalibration, revokeCalibration, setLicensing } from "../../../lib/adminRatings";

const when = (value) => value?.toDate?.().toLocaleString?.() || (value ? new Date(value).toLocaleString() : "—");
const review = (manifest, type) => ({ status: "pending", ...(manifest?.reviews?.[type] || {}) });

export default function RatingsReviewPanel({ importId, manifest, history = [], onChanged, onError }) {
  const [dialog, setDialog] = useState(null), [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(""), [basis, setBasis] = useState(""), [scope, setScope] = useState(""), [attributionRequired, setAttributionRequired] = useState(null);
  const [checks, setChecks] = useState({ hierarchy: false, coverage: false, scope: false });
  const calibration = review(manifest, "calibration"), licensing = review(manifest, "licensing");
  const readiness = useMemo(() => {
    const blockers = [];
    if (manifest.status !== "ready") blockers.push("Import is not ready.");
    if ((manifest.anomalySummary?.criticalCount || 0) > 0) blockers.push("A critical validation issue exists.");
    if (calibration.status !== "approved") blockers.push("Calibration review pending.");
    if (licensing.status !== "approved") blockers.push(licensing.status === "revoked" ? "Licensing review revoked." : `Licensing review ${licensing.status}.`);
    return blockers;
  }, [calibration.status, licensing.status, manifest]);
  const open = (type) => { setDialog(type); setNotes(""); setBasis(licensing.basis || ""); setScope(licensing.scope || ""); setAttributionRequired(typeof licensing.attributionRequired === "boolean" ? licensing.attributionRequired : null); setChecks({ hierarchy: false, coverage: false, scope: false }); };
  const canSubmit = dialog === "calibration" ? Object.values(checks).every(Boolean) : dialog?.startsWith("license-") && dialog !== "license-revoke" ? Boolean(basis.trim() && scope.trim()) && typeof attributionRequired === "boolean" && checks.scope : true;
  const submit = async () => {
    setBusy(true); onError("");
    try {
      if (dialog === "calibration") await approveCalibration({ importId, notes, topHierarchyReviewed: checks.hierarchy, coverageAndAnomalyReviewed: checks.coverage, importScopeConfirmed: checks.scope });
      else if (dialog === "calibration-revoke") await revokeCalibration({ importId, notes });
      else await setLicensing({ importId, action: dialog === "license-revoke" ? "revoke" : dialog === "license-reject" ? "reject" : "approve", basis, scope, attributionRequired, notes, reviewConfirmed: checks.scope });
      setDialog(null); await onChanged();
    } catch (error) { onError(error.message || "Ratings review action failed."); }
    finally { setBusy(false); }
  };
  const title = dialog === "calibration" ? "Approve Calibration & Coverage Review?" : dialog === "calibration-revoke" ? "Revoke calibration approval" : dialog === "license-approve" ? "Approve Licensing Review" : dialog === "license-reject" ? "Reject Licensing Review" : "Revoke Licensing Review";
  return <section className="ratings-review">
    <header><div><small>TRUSTED WORKFLOW</small><h2>Review & Approval</h2></div><span>{importId}</span></header>
    <div className="ratings-review__grid">
      <article><div className="ratings-review__title"><h3>Calibration & Coverage</h3><b data-status={calibration.status}>{calibration.status}</b></div><dl><div><dt>Formula</dt><dd>{manifest.formulaVersion}</dd></div><div><dt>Players</dt><dd>{manifest.stagedPlayerCount ?? manifest.playerCount}/{manifest.expectedPlayerCount ?? manifest.playerCount}</dd></div><div><dt>Critical</dt><dd>{manifest.anomalySummary?.criticalCount || 0}</dd></div><div><dt>Unresolved</dt><dd>{manifest.warningResolution?.unresolvedCount || 0}</dd></div></dl>{calibration.reviewedBy && <p>Reviewed by {calibration.reviewedBy}<br/>{when(calibration.reviewedAt)}{calibration.notes && <><br/>{calibration.notes}</>}</p>}<footer>{calibration.status === "approved" ? <button type="button" onClick={() => open("calibration-revoke")}>Revoke</button> : <button type="button" onClick={() => open("calibration")}>Review calibration</button>}</footer></article>
      <article><div className="ratings-review__title"><h3>Licensing Review</h3><b data-status={licensing.status}>{licensing.status}</b></div><p>Record your organization&apos;s completed licensing review. This is not legal advice or automatic authorization.</p><dl><div><dt>Provider</dt><dd>{manifest.provider || "—"}</dd></div><div><dt>Season</dt><dd>{manifest.season || "—"}</dd></div>{licensing.basis && <div><dt>Basis</dt><dd>{licensing.basis}</dd></div>}</dl>{licensing.reviewedBy && <p>Reviewed by {licensing.reviewedBy}<br/>{when(licensing.reviewedAt)}</p>}<footer>{["approved", "rejected"].includes(licensing.status) ? <button type="button" onClick={() => open("license-revoke")}>Revoke</button> : <><button type="button" onClick={() => open("license-reject")}>Reject</button><button type="button" onClick={() => open("license-approve")}>Approve</button></>}</footer></article>
      <article className="ratings-review__readiness"><div className="ratings-review__title"><h3>Publication Readiness</h3><b data-status={readiness.length ? "pending" : "approved"}>{readiness.length ? "blocked" : "ready"}</b></div>{readiness.length ? <ul>{readiness.map((item) => <li key={item}>{item}</li>)}</ul> : <p>READY FOR PUBLICATION</p>}<details><summary>Developer blocker details</summary><code>{readiness.length ? manifest.publication?.blockers?.join(" · ") || "review-required" : "none"}</code></details></article>
    </div>
    {history.length > 0 && <details className="ratings-review__history"><summary>Review history ({history.length})</summary>{history.map((item) => <div key={item.id}><b>{item.reviewType} · {item.action}</b><span>{item.previousStatus} → {item.newStatus}</span><time>{when(item.timestamp)}</time></div>)}</details>}
    {dialog && <div className="ratings-admin__dialog-backdrop"><section className="ratings-admin__dialog ratings-review__dialog" role="dialog" aria-modal="true" aria-labelledby="ratings-review-title"><h2 id="ratings-review-title">{title}</h2>{dialog === "calibration" && <><p>{manifest.formulaVersion} · {manifest.playerCount} players · {manifest.anomalySummary?.criticalCount || 0} critical · {manifest.warningResolution?.unresolvedCount || 0} unresolved</p><fieldset><label><input type="checkbox" checked={checks.hierarchy} onChange={(event) => setChecks({ ...checks, hierarchy: event.target.checked })}/> I reviewed the player hierarchy.</label><label><input type="checkbox" checked={checks.coverage} onChange={(event) => setChecks({ ...checks, coverage: event.target.checked })}/> I reviewed coverage and anomaly results.</label><label><input type="checkbox" checked={checks.scope} onChange={(event) => setChecks({ ...checks, scope: event.target.checked })}/> I understand this approval applies only to this staged import.</label></fieldset></>}{dialog?.startsWith("license-") && dialog !== "license-revoke" && <><label>Review basis<textarea value={basis} onChange={(event) => setBasis(event.target.value)}/></label><label>Scope<textarea value={scope} onChange={(event) => setScope(event.target.value)}/></label><label>Attribution requirement<select value={attributionRequired === null ? "" : String(attributionRequired)} onChange={(event) => setAttributionRequired(event.target.value === "" ? null : event.target.value === "true")}><option value="">Select</option><option value="true">Attribution required</option><option value="false">Attribution not required</option></select></label><label className="ratings-review__check"><input type="checkbox" checked={checks.scope} onChange={(event) => setChecks({ ...checks, scope: event.target.checked })}/> I confirm that I am recording my organization&apos;s completed licensing review for this import.</label></>}<label>Review notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)}/></label><footer><button type="button" onClick={() => !busy && setDialog(null)}>Cancel</button><button type="button" disabled={busy || !canSubmit} onClick={submit}>{busy ? "Saving…" : dialog === "calibration" ? "Approve Review" : dialog === "license-approve" ? "Approve Licensing Review" : dialog === "license-reject" ? "Reject Licensing Review" : "Confirm"}</button></footer></section></div>}
  </section>;
}
