// Tracker verwalten (Meilenstein 11, Abschnitt 4.3): Gerät anlegen, „Gerät → Team / Fahne“ zuordnen, entfernen.
// Jedes Gerät hat einen Schlüssel; zusammen mit dem Spiel-Code ergibt er die Geräte-Kennung („linz-2027.Ab3…“),
// die im Traccar Client eingetragen wird. Der Schlüssel steht nur in den Geheimnissen des Spielraums.
import type { ApiResults, Device } from "@mrx/shared";
import { randomId } from "../auth.ts";
import { fail, str } from "../util.ts";
import type { Auth, GameRoom } from "../room.ts";

type D = Record<string, unknown>;
const MAX_DEVICES = 20;

export function addDevice(room: GameRoom, d: D, a: Auth): ApiResults["addDevice"] {
  const who = room.who(a, ["admin"]);
  const name = str(d.name, [1, 40], "Name des Geräts");
  if (Object.keys(room.d.devices).length >= MAX_DEVICES) fail("invalid", `Höchstens ${MAX_DEVICES} Geräte`);
  const id = randomId(6);
  const key = randomId(12);
  room.put("devices", id, { name, assign: null, createdAt: Date.now() } satisfies Device);
  room.set("secrets", { ...room.d.secrets, deviceKeys: { ...room.d.secrets.deviceKeys, [id]: key } });
  room.audit(who, "Tracker angelegt", name);
  return { device: id, key };
}

export function setDevice(room: GameRoom, d: D, a: Auth): ApiResults["setDevice"] {
  const who = room.who(a, ["admin"]);
  const id = String(d.device ?? "");
  const dev = room.d.devices[id];
  if (!dev) fail("invalid", "Gerät unbekannt");
  const assign = d.assign === null ? null : String(d.assign ?? "");
  if (assign !== null && assign !== "fahne" && !room.d.teams[assign]) fail("invalid", "Team unbekannt");
  room.put("devices", id, { ...dev, assign });
  room.audit(who, "Tracker zugeordnet", `${dev.name} → ${assign === "fahne" ? "Fahne" : assign ? room.d.teams[assign]!.name : "niemand"}`);
  return {};
}

export function removeDevice(room: GameRoom, d: D, a: Auth): ApiResults["removeDevice"] {
  const who = room.who(a, ["admin"]);
  const id = String(d.device ?? "");
  const dev = room.d.devices[id];
  if (!dev) return {};
  room.put("devices", id, null);
  const { [id]: _, ...keys } = room.d.secrets.deviceKeys ?? {};
  room.set("secrets", { ...room.d.secrets, deviceKeys: keys });
  room.audit(who, "Tracker entfernt", dev.name);
  return {};
}

/** Geräte-Kennung nochmal anzeigen (z. B. für ein Ersatz-Handy) */
export function deviceKey(room: GameRoom, d: D, a: Auth): ApiResults["deviceKey"] {
  room.who(a, ["admin"]);
  const key = room.d.secrets.deviceKeys?.[String(d.device ?? "")];
  if (!key) fail("invalid", "Gerät unbekannt");
  return { key };
}
