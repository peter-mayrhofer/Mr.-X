// Español – Chat-Meldungen und Push-Titel (Grundlage: meldungen.ts, push.ts)
import type { ServerTexte } from "../sprachen.ts";

const quelle: Record<string, string> = {
  tracker: " – ubicación del rastreador",
  schiri: " – ubicación del árbitro",
  letzter: " – última ubicación conocida",
};

export default {
  titel: {
    meldung: "Mister X localizado",
    uebergabe: "¡Relevo!",
    neuerMrx: "¡Ustedes son Mister X!",
    warten: "Por favor, quédense quietos",
    weiter: "¡Pueden seguir!",
    durchsage: "Aviso",
    spielfeld: "El campo de juego se reduce",
    regeln: "Cambio de reglas",
    nachricht: "Mensaje de la organización",
    start: "¡Empieza el juego!",
    pause: "Pausa",
    fortsetzung: "¡Seguimos!",
    rueckgaengig: "Relevo anulado",
    ende: "¡Fin del juego!",
    endphase: "¡Fase final!",
    sammelruf: "Llamada de reunión",
    notfall: "EMERGENCIA",
    pruefen: "Revisar relevo",
  },
  m: {
    start: (mrx, min) => `¡Empieza el juego! ${mrx} es Mister X y tiene ${min} min de ventaja.`,
    meldung: (mrx, src, uhr) => `Ubicación de Mister X (${mrx}) enviada${quelle[src] ?? ""}${src === "letzter" ? ` de las ${uhr}` : ""}.`,
    sofort: (mrx) => `Aviso inmediato: ubicación de Mister X (${mrx}) por orden de la organización.`,
    keinStandort: (mrx) => `No se pudo enviar la ubicación de Mister X (${mrx}): no hay ubicación disponible.`,
    fang: (neu, alt, min) => `¡${neu} ha atrapado a ${alt} y ahora es Mister X! ${min} min de espera para los que estén cerca.`,
    strafe: (neu, alt, min) => `Relevo de penalización: la bandera pasa de ${alt} a ${neu}. ${min} min de espera para los que estén cerca.`,
    rueckgaengig: (neu, alt) => `Se ha anulado el relevo a ${neu}. ${alt} vuelve a ser Mister X.`,
    gesperrt: (bereich) => `¡El campo de juego se reduce! Cerrado: ${bereich}.`,
    sperreAngekuendigt: (bereich, min) => `¡Atención: ${bereich} se cierra en ${min} min! Salgan de la zona a tiempo.`,
    sperreAbgesagt: (bereich) => `Falsa alarma: ${bereich} no se cierra.`,
    freigegeben: (bereich) => `Zona abierta de nuevo: ${bereich}.`,
    intervall: (min) => `Cambio de reglas: ahora se envía la ubicación de Mister X cada ${min} min.`,
    wartezeit: (min) => `Cambio de reglas: la espera tras un relevo es ahora de ${min} min.`,
    regeltext: "La organización ha ampliado las reglas: miren en «Reglas».",
    pause: "El juego está en pausa. Por favor, quédense quietos: seguimos enseguida.",
    weiter: "¡Seguimos! El juego vuelve a estar en marcha.",
    warteEnde: "Se acabó la espera: ¡pueden seguir!",
    warten: (min) => `Estaban cerca del relevo: quédense quietos ${min} min.`,
    gefangen: (min) => `Los han atrapado: esperen ${min} min y luego sigue la caza.`,
    vorsprung: (min) => `La bandera es suya: ${min} min de ventaja, ¡corran!`,
    wartenHand: (min) => `La organización les ha puesto ${min} min de espera.`,
    endphase: (spaetestens) =>
      `¡Fase final! El juego puede terminar en cualquier momento, como muy tarde a las ${spaetestens}. ¡A por todas!`,
    sammelruf: (ort) => `Llamada de reunión: vengan todos ahora al punto de encuentro ${ort}.`,
    sammelrufEnde: "La llamada de reunión ha terminado.",
    geteilt: (alt, neu) => `${alt} se ha dividido: ${alt} y ${neu} juegan ahora por separado.`,
    notfall: (team) => `¡${team} ha avisado de una emergencia!`,
    pruefen: (alt, neu, distM) =>
      distM === undefined
        ? `${alt} ha indicado que lo atrapó ${neu}, sin ubicaciones actuales. Revísenlo y anúlenlo si hace falta.`
        : `${alt} ha indicado que lo atrapó ${neu}, pero los móviles estaban a ${distM} m de distancia. Revísenlo y anúlenlo si hace falta.`,
    notfallZurueck: (team) => `Falsa alarma: ${team} ha retirado la emergencia.`,
    ende: (sieger) => `¡Fin del juego! ${sieger} es el último Mister X y ha ganado.`,
    endeOhne: "¡Fin del juego! Esta vez no hay ganador.",
  },
} satisfies ServerTexte;
