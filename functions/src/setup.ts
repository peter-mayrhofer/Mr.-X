// Muss als erstes Modul laufen: ES-Module werten Importe vor dem eigenen Code aus – sonst bekämen Functions aus anderen
// Dateien (z. B. onPosition) die Standard-Region us-central1 statt europe-west1.
import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";
import { REGION } from "./env.ts";

initializeApp();
setGlobalOptions({ region: REGION, maxInstances: 10, memory: "256MiB" });
