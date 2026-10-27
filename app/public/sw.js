// Service Worker der App (Meilenstein 8): zeigt Push-Benachrichtigungen an und öffnet beim Antippen die App.
// Bewusst ohne Offline-Cache – das Spiel braucht ohnehin Verbindung, und so gibt es nie veraltete App-Versionen.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try {
    const p = e.data ? e.data.json() : {};
    d = p.data || p; // FCM legt die Daten unter „data“ ab
  } catch {
    d = { body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    (async () => {
      // App ist offen und sichtbar → sie meldet sich selbst mit Ton und Vibration, keine doppelte Benachrichtigung
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (wins.some((w) => w.visibilityState === "visible")) return;
      await self.registration.showNotification(d.title || "Mister X", {
        body: d.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: d.tag || "mrx",
        renotify: true,
        vibrate: [200, 100, 200],
        data: { link: d.link || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || "/";
  e.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus();
      return self.clients.openWindow(link);
    })(),
  );
});
