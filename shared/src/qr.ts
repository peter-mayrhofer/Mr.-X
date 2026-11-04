// Was ein gescannter QR-Code bedeutet: Mister-X-Links (Beitritt, Schiri/Spielleitung, Großbild, Zuschauer) oder ein
// reiner Spiel-Code → Seite in der App. Fremde Codes → null. Egal von welcher Adresse der Link kommt (Web, App, eigene
// Domain): zählt nur der Teil nach „#“.
const ROUTE =
  /^\/(beitreten\/[a-z0-9-]{3,30}|staff\/(schiri|admin)|s\/[a-z0-9-]{3,30}|g\/[a-z0-9-]{3,30}|z\/[a-z0-9-]{3,30})(\?[\w=&%.-]*)?$/;
const CODE = /^[a-z0-9-]{3,30}$/;

export function routeFromQr(text: string): string | null {
  const t = text.trim();
  const i = t.indexOf("#/");
  if (i >= 0) {
    const r = t.slice(i + 1);
    return ROUTE.test(r) ? r : null;
  }
  return CODE.test(t.toLowerCase()) ? `/s/${t.toLowerCase()}` : null;
}
