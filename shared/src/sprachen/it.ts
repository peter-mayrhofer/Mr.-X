// Italiano – Chat-Meldungen und Push-Titel (Grundlage: meldungen.ts, push.ts)
import type { ServerTexte } from "../sprachen.ts";

const quelle: Record<string, string> = {
  tracker: " – posizione dal tracker",
  schiri: " – posizione dall'arbitro",
  letzter: " – ultima posizione nota",
};

export default {
  titel: {
    meldung: "Mister X segnalato",
    uebergabe: "Passaggio!",
    neuerMrx: "Siete Mister X!",
    warten: "Fermatevi, per favore",
    weiter: "Potete ripartire!",
    durchsage: "Annuncio",
    spielfeld: "Il campo di gioco si riduce",
    regeln: "Cambio di regole",
    nachricht: "Messaggio dall'organizzazione",
    start: "Il gioco comincia!",
    pause: "Pausa",
    fortsetzung: "Si riparte!",
    rueckgaengig: "Passaggio annullato",
    ende: "Fine del gioco!",
    endphase: "Fase finale!",
    sammelruf: "Chiamata di raduno",
    notfall: "EMERGENZA",
    pruefen: "Controllare il passaggio",
  },
  m: {
    start: (mrx, min) => `Il gioco è iniziato! ${mrx} è Mister X e ha ${min} min di vantaggio.`,
    meldung: (mrx, src, uhr) => `Posizione di Mister X (${mrx}) segnalata${quelle[src] ?? ""}${src === "letzter" ? ` delle ${uhr}` : ""}.`,
    sofort: (mrx) => `Segnalazione immediata: posizione di Mister X (${mrx}) su indicazione dell'organizzazione.`,
    keinStandort: (mrx) => `Non è stato possibile segnalare Mister X (${mrx}): nessuna posizione disponibile.`,
    fang: (neu, alt, min) => `${neu} ha preso ${alt} ed è ora Mister X! ${min} min di attesa per chi è vicino.`,
    strafe: (neu, alt, min) => `Passaggio di penalità: la bandiera passa da ${alt} a ${neu}. ${min} min di attesa per chi è vicino.`,
    rueckgaengig: (neu, alt) => `Il passaggio a ${neu} è stato annullato. ${alt} è di nuovo Mister X.`,
    gesperrt: (bereich) => `Il campo di gioco si riduce! Chiuso: ${bereich}.`,
    sperreAngekuendigt: (bereich, min) => `Attenzione: ${bereich} chiude tra ${min} min! Uscite dalla zona in tempo.`,
    sperreAbgesagt: (bereich) => `Cessato allarme: ${bereich} non viene chiuso.`,
    freigegeben: (bereich) => `Zona di nuovo aperta: ${bereich}.`,
    intervall: (min) => `Cambio di regole: ora Mister X viene segnalato ogni ${min} min.`,
    wartezeit: (min) => `Cambio di regole: l'attesa dopo un passaggio ora è di ${min} min.`,
    regeltext: "L'organizzazione ha integrato le regole – vedi «Regole».",
    pause: "Il gioco è in pausa. Fermatevi, per favore – si riparte tra poco.",
    weiter: "Si riparte! Il gioco è di nuovo in corso.",
    warteEnde: "L'attesa è finita – potete ripartire!",
    warten: (min) => `Eravate vicini al passaggio: restate fermi ${min} min.`,
    gefangen: (min) => `Siete stati presi: aspettate ${min} min, poi la caccia continua.`,
    vorsprung: (min) => `La bandiera è vostra – ${min} min di vantaggio, correte!`,
    wartenHand: (min) => `L'organizzazione vi ha dato ${min} min di attesa.`,
    endphase: (spaetestens) => `Fase finale! Il gioco può finire in qualsiasi momento, al più tardi alle ${spaetestens}. Date il massimo!`,
    sammelruf: (ort) => `Chiamata di raduno: tutti ora al punto d'incontro ${ort}.`,
    sammelrufEnde: "La chiamata di raduno è terminata.",
    geteilt: (alt, neu) => `${alt} si è diviso: ${alt} e ${neu} ora giocano separati.`,
    notfall: (team) => `${team} ha segnalato un'emergenza!`,
    pruefen: (alt, neu, distM) =>
      distM === undefined
        ? `${alt} ha segnalato di essere stato preso da ${neu}, senza posizioni attuali. Controllate e annullate se serve.`
        : `${alt} ha segnalato di essere stato preso da ${neu}, ma i telefoni erano a ${distM} m di distanza. Controllate e annullate se serve.`,
    notfallZurueck: (team) => `Cessato allarme: ${team} ha ritirato l'emergenza (falso allarme).`,
    ende: (sieger) => `Fine del gioco! ${sieger} è l'ultimo Mister X e ha vinto!`,
    endeOhne: "Fine del gioco! Questa volta non c'è un vincitore.",
  },
} satisfies ServerTexte;
