// Firebase im Client. Web-Konfiguration ist öffentlich (kein Geheimnis); Rechte setzen Rules + Functions durch.
// Emulator-Modus: `npm run dev:emu` (Vite-Modus „emu“) → Projekt demo-mrx, alles lokal (E-22).
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

export const EMU = import.meta.env.MODE === "emu";
const DATABASE_URL = "https://mr-x-ooe-neu.europe-west1.firebasedatabase.app";

export const app = initializeApp({
  apiKey: EMU ? "demo" : "AIzaSyDtNPyDBqWVMcCv1MQsizkUSxAPhVEcvfg",
  authDomain: "mr-x-ooe.firebaseapp.com",
  databaseURL: DATABASE_URL,
  projectId: EMU ? "demo-mrx" : "mr-x-ooe",
  storageBucket: "mr-x-ooe.firebasestorage.app",
  messagingSenderId: "221429629278",
  appId: "1:221429629278:web:1a9828455d04efd5a3cfcf",
});

export const auth = getAuth(app);
export const db = getDatabase(app, DATABASE_URL);
export const functions = getFunctions(app, "europe-west1");

if (EMU) {
  const host = location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectDatabaseEmulator(db, host, 9000);
  connectFunctionsEmulator(functions, host, 5001);
}

/**
 * Öffentlicher Web-Push-Schlüssel (Firebase-Konsole → Projekteinstellungen → Cloud Messaging → Web-Push-Zertifikate),
 * in app/.env als VITE_FCM_VAPID_KEY. Leer = Standardschlüssel von Firebase (siehe docs/FIREBASE-EINRICHTUNG.md).
 */
export const VAPID_KEY: string | undefined = import.meta.env.VITE_FCM_VAPID_KEY || undefined;
