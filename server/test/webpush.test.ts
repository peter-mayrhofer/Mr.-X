// Web-Push-Verschlüsselung gegen das Beispiel aus RFC 8291, Anhang A, und VAPID-Unterschrift prüfen.
import { describe, expect, it } from "vitest";
import { b64u, unb64u } from "../src/auth.ts";
import { encrypt, vapidHeader } from "../src/webpush.ts";

describe("Web Push (RFC 8291 / 8292)", () => {
  it("verschlüsselt genau wie das Beispiel im Standard", async () => {
    const body = await encrypt(
      {
        endpoint: "https://push.example.net/x",
        keys: {
          p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
          auth: "BTBZMqHH6r4Tts7J_aSIgg",
        },
      },
      "When I grow up, I want to be a watermelon",
      {
        salt: unb64u("DGv6ra1nlYgDCS1FRnbzlw"),
        local: {
          pub: unb64u("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"),
          priv: unb64u("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"),
        },
      },
    );
    expect(b64u(body)).toBe(
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
    );
  });

  it("VAPID: Unterschrift passt zum öffentlichen Schlüssel, Empfänger = Push-Dienst", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const pub = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
    const d = (await crypto.subtle.exportKey("jwk", pair.privateKey)).d!;
    const h = await vapidHeader("https://fcm.googleapis.com/fcm/send/abc", {
      publicKey: b64u(pub),
      privateKey: d,
      subject: "mailto:x@y.at",
    });
    const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(h)!;
    expect(k).toBe(b64u(pub));
    const [head, body, sig] = jwt!.split(".");
    expect(JSON.parse(new TextDecoder().decode(unb64u(body!)))).toMatchObject({ aud: "https://fcm.googleapis.com", sub: "mailto:x@y.at" });
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pair.publicKey,
      unb64u(sig!),
      new TextEncoder().encode(`${head}.${body}`),
    );
    expect(ok).toBe(true);
  });
});
