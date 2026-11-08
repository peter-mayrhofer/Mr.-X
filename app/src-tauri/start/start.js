// Prüft, ob der Server erreichbar ist, und lädt dann die Web-App. Adresse kommt aus der Hülle (window.__MRX_SERVER__).
const SERVER = window.__MRX_SERVER__;
const suche = document.getElementById("suche");
const fehler = document.getElementById("fehler");
let wartet = null;

async function versuchen() {
  clearTimeout(wartet);
  fehler.hidden = true;
  suche.hidden = false;
  try {
    // no-cors: Antwort ist opak, zeigt aber, dass das Netz und der Server da sind
    await fetch(SERVER + "/health", { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(8000) });
    location.replace(SERVER + "/");
  } catch {
    suche.hidden = true;
    fehler.hidden = false;
    wartet = setTimeout(versuchen, 10000);
  }
}

document.getElementById("neu").addEventListener("click", versuchen);
if (SERVER) versuchen();
else document.querySelector("#suche p").textContent = "Server-Adresse fehlt – bitte die App neu installieren.";
