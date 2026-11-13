// English – Chat-Meldungen und Push-Titel (Grundlage: meldungen.ts, push.ts)
import type { ServerTexte } from "../sprachen.ts";

const quelle: Record<string, string> = {
  tracker: " – location from the tracker",
  schiri: " – location from the referee",
  letzter: " – last known location",
};

export default {
  titel: {
    meldung: "Mister X reported",
    uebergabe: "Handover!",
    neuerMrx: "You are Mister X!",
    warten: "Please stay where you are",
    weiter: "You may go on!",
    durchsage: "Announcement",
    spielfeld: "Playing area gets smaller",
    regeln: "Rule change",
    nachricht: "Message from the organisers",
    start: "The game begins!",
    pause: "Pause",
    fortsetzung: "Let's go on!",
    rueckgaengig: "Handover undone",
    ende: "Game over!",
    endphase: "Final phase!",
    sammelruf: "Gathering call",
    notfall: "EMERGENCY",
    pruefen: "Check handover",
  },
  m: {
    start: (mrx, min) => `Game started! ${mrx} is Mister X and has a ${min} min head start.`,
    meldung: (mrx, src, uhr) => `Location of Mister X (${mrx}) reported${quelle[src] ?? ""}${src === "letzter" ? ` from ${uhr}` : ""}.`,
    sofort: (mrx) => `Instant report: location of Mister X (${mrx}) on instruction of the organisers.`,
    keinStandort: (mrx) => `Mister X (${mrx}) could not be reported – no location available.`,
    fang: (neu, alt, min) => `${neu} caught ${alt} and is now Mister X! ${min} min waiting time nearby.`,
    strafe: (neu, alt, min) => `Penalty handover: the flag goes from ${alt} to ${neu}. ${min} min waiting time nearby.`,
    rueckgaengig: (neu, alt) => `The handover to ${neu} was undone. ${alt} is Mister X again.`,
    gesperrt: (bereich) => `The playing area is getting smaller! Closed: ${bereich}.`,
    sperreAngekuendigt: (bereich, min) => `Attention: ${bereich} will be closed in ${min} min! Please leave the area in time.`,
    sperreAbgesagt: (bereich) => `All clear: ${bereich} will not be closed after all.`,
    freigegeben: (bereich) => `Area open again: ${bereich}.`,
    intervall: (min) => `Rule change: Mister X is now reported every ${min} min.`,
    wartezeit: (min) => `Rule change: waiting time after a handover is now ${min} min.`,
    regeltext: "The organisers have added to the rules – see “Rules”.",
    pause: "The game is paused. Please stay where you are – it will continue shortly.",
    weiter: "Let's go on! The game is running again.",
    warteEnde: "The waiting time is over – you may go on!",
    warten: (min) => `You were near the handover: stay where you are for ${min} min.`,
    gefangen: (min) => `You were caught: wait ${min} min, then the hunt goes on.`,
    vorsprung: (min) => `The flag is yours – ${min} min head start, run!`,
    wartenHand: (min) => `The organisers have given you ${min} min waiting time.`,
    endphase: (spaetestens) => `Final phase! The game can end at any moment now – at the latest at ${spaetestens}. Give it everything!`,
    sammelruf: (ort) => `Gathering call: everyone please go to the meeting point ${ort} now.`,
    sammelrufEnde: "The gathering call is over.",
    geteilt: (alt, neu) => `${alt} has split up: ${alt} and ${neu} now play separately.`,
    notfall: (team) => `${team} has reported an emergency!`,
    pruefen: (alt, neu, distM) =>
      distM === undefined
        ? `${alt} reported being caught by ${neu} – without current locations. Please check and undo if necessary.`
        : `${alt} reported being caught by ${neu}, but the phones were ${distM} m apart. Please check and undo if necessary.`,
    notfallZurueck: (team) => `All clear: ${team} has taken back the emergency (false alarm).`,
    ende: (sieger) => `Game over! ${sieger} is the last Mister X and has won!`,
    endeOhne: "Game over! There is no winner this time.",
  },
} satisfies ServerTexte;
