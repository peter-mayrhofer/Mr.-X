// Erzeugt die Geheimnisse für den Server (docs/BETRIEB.md, Schritt „Schlüssel“): Token-Schlüssel, Setup-Geheimnis und
// das VAPID-Schlüsselpaar für Web Push. Schreibt sie in server/geheimnisse.json (wird nie ins Repository übernommen)
// und zeigt, wie sie zu Cloudflare kommen. Aufruf: npm run schluessel
import { writeFileSync } from "node:fs";

const b64u = (b) => Buffer.from(b).toString("base64url");
const random = (n) => b64u(crypto.getRandomValues(new Uint8Array(n)));

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
const secrets = {
  TOKEN_SECRET: random(32),
  // gut abzuschreiben: Gruppen aus Buchstaben und Ziffern
  SETUP_SECRET: random(15).replace(/[-_]/g, "x").match(/.{5}/g).join("-"),
  VAPID_PUBLIC: b64u(await crypto.subtle.exportKey("raw", pair.publicKey)),
  VAPID_PRIVATE: (await crypto.subtle.exportKey("jwk", pair.privateKey)).d,
};
const file = new URL("geheimnisse.json", import.meta.url);
writeFileSync(file, JSON.stringify(secrets, null, 2));

console.log(`
Geheimnisse erzeugt und gespeichert in: server/geheimnisse.json

1. Zu Cloudflare hochladen:
     npx wrangler secret bulk server/geheimnisse.json -c server/wrangler.jsonc

2. Setup-Geheimnis aufschreiben und sicher aufbewahren (damit legst du das Organisator-Passwort fest):
     ${secrets.SETUP_SECRET}

3. Danach die Datei server/geheimnisse.json löschen.
`);
