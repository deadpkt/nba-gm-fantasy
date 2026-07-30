import { connectStorageEmulator, getStorage } from "firebase/storage";
import { app } from "./firebase";

export const storage = app ? getStorage(app) : null;

if (
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" &&
  storage &&
  !globalThis.__NBA_GM_FIREBASE_STORAGE_EMULATOR_CONNECTED__
) {
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  globalThis.__NBA_GM_FIREBASE_STORAGE_EMULATOR_CONNECTED__ = true;
}
