import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, startAfter } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "./firebase";
import { functions } from "./firebaseFunctions";

export const publicProfileRef = (uid) => doc(db, "publicProfiles", uid);
export const socialEdgeRef = (uid, type, relatedUid) => doc(db, "publicProfiles", uid, type, relatedUid);

export function subscribePublicProfile(uid, onValue, onError) {
  return onSnapshot(publicProfileRef(uid), (snapshot) => onValue(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null), onError);
}

export function subscribeFollowState(viewerUid, targetUid, onValue, onError) {
  return onSnapshot(socialEdgeRef(viewerUid, "following", targetUid), (snapshot) => onValue(snapshot.exists()), onError);
}

export async function getFollowState(viewerUid, targetUid) {
  if (!viewerUid || !targetUid || viewerUid === targetUid) return false;
  return (await getDoc(socialEdgeRef(viewerUid, "following", targetUid))).exists();
}

export async function ensurePublicProfile(uid) {
  if (!functions) throw new Error("Public profile services are unavailable.");
  return (await httpsCallable(functions, "ensurePublicProfile")({ targetUid: uid })).data;
}

export async function setFollowState(targetUid, following) {
  if (!functions) throw new Error("Social services are unavailable.");
  return (await httpsCallable(functions, following ? "followUser" : "unfollowUser")({ targetUid })).data;
}

export async function loadSocialPage({ uid, type, pageSize = 25, cursor = null }) {
  if (!["followers", "following"].includes(type)) throw new Error("Unknown social list.");
  const constraints = [orderBy("createdAt", "desc"), limit(pageSize)];
  if (cursor) constraints.splice(1, 0, startAfter(cursor));
  const snapshot = await getDocs(query(collection(db, "publicProfiles", uid, type), ...constraints));
  const profiles = await Promise.all(snapshot.docs.map(async (edge) => {
    const profileSnapshot = await getDoc(publicProfileRef(edge.id));
    return profileSnapshot.exists() ? { id: profileSnapshot.id, ...profileSnapshot.data() } : null;
  }));
  return {
    profiles: profiles.filter(Boolean),
    cursor: snapshot.docs.at(-1) || null,
    hasMore: snapshot.size === pageSize,
  };
}

export function normalizePublicProfile(profile) {
  if (!profile) return null;
  return {
    uid: String(profile.uid || profile.id),
    displayName: String(profile.displayName || "Full Court Player"),
    photoURL: String(profile.photoURL || ""),
    bannerURL: String(profile.bannerURL || ""),
    joinedAt: profile.joinedAt || null,
    followersCount: Number.isInteger(profile.followersCount) && profile.followersCount >= 0 ? profile.followersCount : 0,
    followingCount: Number.isInteger(profile.followingCount) && profile.followingCount >= 0 ? profile.followingCount : 0,
  };
}
