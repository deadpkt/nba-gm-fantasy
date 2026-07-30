import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { app } from "./firebase";

export const functions = app ? getFunctions(app) : null;

if (
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" &&
  functions &&
  !globalThis.__NBA_GM_FIREBASE_FUNCTIONS_EMULATOR_CONNECTED__
) {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  globalThis.__NBA_GM_FIREBASE_FUNCTIONS_EMULATOR_CONNECTED__ = true;
}
