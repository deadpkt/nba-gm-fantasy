import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "./firebase";

export async function loadRatingsPreviewManifests(pageSize = 20) {
  const snapshot = await getDocs(query(collection(db, "playerDataImports"), orderBy("createdAt", "desc"), limit(pageSize)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function loadRatingsPreviewPlayers(importId, pageSize = 600) {
  const snapshot = await getDocs(query(collection(db, "playerDataImports", importId, "players"), orderBy("overall", "desc"), limit(pageSize)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function loadCatalogPublicationState(pageSize = 20) {
  const [pointer, versions, history] = await Promise.all([
    getDoc(doc(db, "playerCatalogs", "current")),
    getDocs(query(collection(db, "playerCatalogs"), orderBy("publishedAt", "desc"), limit(pageSize))),
    getDocs(query(collection(db, "playerCatalogPublicationHistory"), orderBy("createdAt", "desc"), limit(pageSize))),
  ]);
  return { current: pointer.exists() ? pointer.data() : null, versions: versions.docs.filter((item) => !["current", "syncStatus"].includes(item.id)).map((item) => ({ id: item.id, ...item.data() })), history: history.docs.map((item) => ({ id: item.id, ...item.data() })) };
}

export async function publishCatalog(input) { return (await httpsCallable(getFunctions(app), "publishPlayerCatalog")(input)).data; }
export async function rollbackCatalog(input) { return (await httpsCallable(getFunctions(app), "rollbackPlayerCatalogVersion")(input)).data; }
