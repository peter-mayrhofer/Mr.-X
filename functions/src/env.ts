import { defineString } from "firebase-functions/params";

/** E-Mail-Adressen der Super-Admins (Organisator). Beim Deploy abgefragt bzw. aus functions/.env */
export const SUPER_ADMINS = defineString("SUPER_ADMINS", { description: "E-Mail-Adressen der Super-Admins, mit Komma getrennt" });

/** Datenbank-Instanz des Neubaus (E-21) */
export const DATABASE_URL = defineString("DATABASE_URL", { default: "https://mr-x-ooe-neu.europe-west1.firebasedatabase.app" });

export const REGION = "europe-west1";
