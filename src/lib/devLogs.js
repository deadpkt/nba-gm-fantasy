import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "./firebase";
import { functions } from "./firebaseFunctions";

export const DEV_LOG_SECTION_TYPES = ["added", "improved", "fixed"];
export { isUpdateUnseen, markVersionSeen, readSeenVersion, seenStorageKey } from "./devLogSeen";

export async function loadPublishedDevLogs(pageSize = 20) {
  const snapshot = await getDocs(query(collection(db, "devLogs"), where("status", "==", "published"), orderBy("publishedAt", "desc"), limit(pageSize)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}
export async function loadAllDevLogs() { const snapshot = await getDocs(collection(db, "devLogs")); return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0)); }
export async function loadLatestUpdateMeta() { const snapshot = await getDoc(doc(db, "appMeta", "current")); return snapshot.exists() ? snapshot.data() : null; }
const call = async (name, data) => { if (!functions) throw new Error("Dev Log services are unavailable."); return (await httpsCallable(functions, name)(data)).data; };
export const saveDevLogDraft = (value) => call("saveDevLogDraft", value);
export const setDevLogPublication = (id, published) => call("setDevLogPublication", { id, published });
export const deleteDevLog = (id) => call("deleteDevLog", { id });
