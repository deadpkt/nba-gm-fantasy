import { RATING_FORMULA_VERSION } from "./playerRatingsV2.js";

export const REVIEW_STATUS = Object.freeze({
  PENDING: "pending", APPROVED: "approved", REJECTED: "rejected", REVOKED: "revoked",
});

const text = (value, max = 2000) => String(value || "").trim().slice(0, max);
const count = (value) => Number.isInteger(value) ? value : 0;
const expectedPlayers = (item = {}) => item.expectedPlayerCount ?? item.playerCount ?? 0;
const stagedPlayers = (item = {}) => item.stagedPlayerCount ?? item.writtenPlayerCount ?? item.playerCount ?? 0;
const criticalIssues = (item = {}) => count(item.calibrationRealism?.criticalIssues?.length ?? item.calibrationRealism?.criticalCount ?? item.coverage?.criticalIssueCount);
const criticalAnomalies = (item = {}) => count(item.anomalySummary?.criticalCount ?? item.coverage?.criticalAnomalyCount);
const unresolvedWarnings = (item = {}) => count(item.warningResolution?.unresolvedCount ?? item.calibrationRealism?.warnings?.length);

export function normalizeRatingsReviews(reviews = {}) {
  return {
    calibration: { status: REVIEW_STATUS.PENDING, ...(reviews.calibration || {}) },
    licensing: { status: REVIEW_STATUS.PENDING, ...(reviews.licensing || {}) },
  };
}

export function ratingsReviewContext(importId, item = {}) {
  return {
    importId,
    formulaVersion: item.formulaVersion || null,
    provider: item.provider || item.fetchManifest?.provider || null,
    season: item.season ?? item.fetchManifest?.season ?? null,
  };
}

export function validateCalibrationApproval({ importId, item, input = {} } = {}) {
  if (!item) throw new Error("Ratings import was not found.");
  if (item.status !== "ready") throw new Error("Ratings import is not ready.");
  if (item.formulaVersion !== RATING_FORMULA_VERSION) throw new Error("This ratings formula version is not currently supported.");
  if (expectedPlayers(item) <= 0 || stagedPlayers(item) !== expectedPlayers(item)) throw new Error("Staged player count does not match the expected player count.");
  if (criticalIssues(item) > 0) throw new Error("Calibration review cannot be approved while critical issues exist.");
  if (criticalAnomalies(item) > 0) throw new Error("Calibration review cannot be approved while critical anomalies exist.");
  if (item.validationStatus !== "eligible-after-licensing-review" || item.coverage?.publicationEligible !== true) throw new Error("Ratings validation has not passed.");
  if (input.topHierarchyReviewed !== true || input.coverageAndAnomalyReviewed !== true || input.importScopeConfirmed !== true) throw new Error("Complete every calibration review confirmation.");
  return {
    status: REVIEW_STATUS.APPROVED,
    notes: text(input.notes),
    formulaVersion: item.formulaVersion,
    reviewedPlayerCount: expectedPlayers(item),
    criticalIssueCount: criticalIssues(item),
    criticalAnomalyCount: criticalAnomalies(item),
    unresolvedWarningCount: unresolvedWarnings(item),
    topHierarchyReviewed: true,
    coverageReviewed: true, anomalyReviewed: true, importScopeConfirmed: true,
    importId,
  };
}

export function validateLicensingReview({ importId, item, input = {} } = {}) {
  if (!item) throw new Error("Ratings import was not found.");
  if (item.status !== "ready") throw new Error("Ratings import is not ready.");
  if (item.formulaVersion !== RATING_FORMULA_VERSION) throw new Error("This ratings formula version is not currently supported.");
  if (!["approve", "reject"].includes(input.action)) throw new Error("Licensing review action is invalid.");
  const previousStatus = normalizeRatingsReviews(item.reviews).licensing.status;
  if (previousStatus === (input.action === "approve" ? REVIEW_STATUS.APPROVED : REVIEW_STATUS.REJECTED)) throw new Error(`Licensing review is already ${previousStatus}.`);
  const basis = text(input.basis);
  if (!basis) throw new Error("Licensing review basis is required.");
  const scope = text(input.scope, 1000);
  if (!scope) throw new Error("Licensing review scope is required.");
  if (typeof input.attributionRequired !== "boolean") throw new Error("Select an attribution requirement.");
  if (input.reviewConfirmed !== true) throw new Error("Confirm the completed organizational licensing review.");
  const context = ratingsReviewContext(importId, item);
  return {
    status: input.action === "approve" ? REVIEW_STATUS.APPROVED : REVIEW_STATUS.REJECTED,
    basis,
    scope,
    attributionRequired: input.attributionRequired === true,
    notes: text(input.notes),
    provider: context.provider,
    season: context.season,
    formulaVersion: context.formulaVersion,
    importId,
  };
}

export function validateReviewRevocation({ importId, item, reviewType, input = {} } = {}) {
  if (!item) throw new Error("Ratings import was not found.");
  if (!['calibration', 'licensing'].includes(reviewType)) throw new Error("Ratings review type is invalid.");
  const previous = normalizeRatingsReviews(item.reviews)[reviewType];
  if (![REVIEW_STATUS.APPROVED, REVIEW_STATUS.REJECTED].includes(previous.status)) throw new Error("Only a completed ratings review can be revoked.");
  return { ...previous, status: REVIEW_STATUS.REVOKED, notes: text(input.notes || previous.notes), importId };
}

export function trustedReviewBlockers(importId, item = {}) {
  const reviews = normalizeRatingsReviews(item.reviews);
  const context = ratingsReviewContext(importId, item);
  const blockers = [];
  const calibration = reviews.calibration;
  const licensing = reviews.licensing;
  if (calibration.status !== REVIEW_STATUS.APPROVED) blockers.push({ code: "calibration-review-required", message: "Calibration & Coverage Review is pending." });
  else if (calibration.importId !== importId || calibration.formulaVersion !== context.formulaVersion || calibration.reviewedPlayerCount !== expectedPlayers(item)) blockers.push({ code: "stale-calibration-review", message: "This approval belongs to a stale formula version or import snapshot." });
  if (licensing.status !== REVIEW_STATUS.APPROVED) blockers.push({ code: licensing.status === REVIEW_STATUS.REVOKED ? "licensing-review-revoked" : "licensing-checkpoint-required", message: licensing.status === REVIEW_STATUS.REVOKED ? "Licensing Review has been revoked." : `Licensing Review is ${licensing.status}.` });
  else if (licensing.importId !== importId || licensing.formulaVersion !== context.formulaVersion || licensing.provider !== context.provider || String(licensing.season) !== String(context.season) || !text(licensing.basis)) blockers.push({ code: "stale-licensing-review", message: "Licensing Review does not match this import's source context." });
  return blockers;
}

export function readablePublicationBlockers(importId, item = {}) {
  return trustedReviewBlockers(importId, item);
}
