import { Timestamp } from "firebase-admin/firestore";
import { buildLeagueActivityDocument } from "../shared/leagueActivity.js";

export function activityEventId(...parts) {
  return parts.map((part) => String(part).replace(/[^A-Za-z0-9_-]/g, "_")).join("-").slice(0, 150);
}

export async function createTrustedLeagueActivity(db, leagueId, input) {
  const activityRef = db.doc(`leagues/${leagueId}/activity/${input.id}`);
  return db.runTransaction(async (transaction) => {
    const existing = await transaction.get(activityRef);
    if (existing.exists) return { created: false, id: activityRef.id || input.id };
    transaction.create(activityRef, buildLeagueActivityDocument({ ...input, createdAt: input.createdAt || Timestamp.now() }));
    return { created: true, id: activityRef.id || input.id };
  });
}
