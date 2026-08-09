import { Timestamp } from "firebase-admin/firestore";
import { normalizeRatingsReviews, ratingsReviewContext, validateCalibrationApproval, validateLicensingReview, validateReviewRevocation } from "../shared/ratingsReview.js";

const assertAdmin = (auth) => {
  if (!auth?.uid || auth.token?.admin !== true) throw Object.assign(new Error("Only admins may update ratings reviews."), { code: "permission-denied" });
};
const cleanId = (value) => String(value || "").trim();

async function updateReview({ db, auth, importId: rawImportId, reviewType, action, input = {} }) {
  assertAdmin(auth);
  const importId = cleanId(rawImportId);
  if (!/^ratings_[A-Za-z0-9_.-]+$/.test(importId)) throw new Error("A valid ratings import ID is required.");
  const importRef = db.doc(`playerDataImports/${importId}`);
  const historyRef = db.collection("playerDataImportReviewHistory").doc();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(importRef);
    if (!snapshot.exists) throw Object.assign(new Error("Ratings import was not found."), { code: "not-found" });
    const item = snapshot.data();
    const previous = normalizeRatingsReviews(item.reviews)[reviewType];
    if (reviewType === "calibration" && action === "approve" && previous.status === "approved") throw new Error("Calibration review is already approved.");
    const review = action === "revoke"
      ? validateReviewRevocation({ importId, item, reviewType, input })
      : reviewType === "calibration"
        ? validateCalibrationApproval({ importId, item, input })
        : validateLicensingReview({ importId, item, input: { ...input, action } });
    const now = Timestamp.now();
    const completed = { ...review, reviewedAt: now, reviewedBy: auth.uid };
    transaction.update(importRef, { [`reviews.${reviewType}`]: completed, updatedAt: now });
    const context = ratingsReviewContext(importId, item);
    transaction.create(historyRef, {
      importId, reviewType, action, previousStatus: previous.status, newStatus: completed.status,
      actorUid: auth.uid, timestamp: now, formulaVersion: context.formulaVersion,
      provider: context.provider, season: context.season,
      summary: reviewType === "licensing" ? String(completed.basis || "").slice(0, 280) : String(completed.notes || "").slice(0, 280),
    });
    return { importId, reviewType, status: completed.status, review: completed, historyEventId: historyRef.id };
  });
}

export const approveCalibrationReview = (options) => updateReview({ ...options, reviewType: "calibration", action: "approve" });
export const revokeCalibrationReview = (options) => updateReview({ ...options, reviewType: "calibration", action: "revoke" });
export const setLicensingReview = (options) => updateReview({ ...options, reviewType: "licensing", action: options.input?.action });

export { updateReview };
