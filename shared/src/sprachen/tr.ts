// Türkçe – Chat-Meldungen und Push-Titel (Grundlage: meldungen.ts, push.ts). Teamnamen ohne Endungen („… takımı“).
import type { ServerTexte } from "../sprachen.ts";

const quelle: Record<string, string> = {
  tracker: " – takip cihazının konumu",
  schiri: " – hakemin konumu",
  letzter: " – bilinen son konum",
};

export default {
  titel: {
    meldung: "Mister X bildirildi",
    uebergabe: "Devir teslim!",
    neuerMrx: "Mister X sizsiniz!",
    warten: "Lütfen olduğunuz yerde durun",
    weiter: "Devam edebilirsiniz!",
    durchsage: "Duyuru",
    spielfeld: "Oyun alanı küçülüyor",
    regeln: "Kural değişikliği",
    nachricht: "Oyun yönetiminden mesaj",
    start: "Oyun başlıyor!",
    pause: "Mola",
    fortsetzung: "Devam ediyoruz!",
    rueckgaengig: "Devir teslim geri alındı",
    ende: "Oyun bitti!",
    endphase: "Son aşama!",
    sammelruf: "Toplanma çağrısı",
    notfall: "ACİL DURUM",
    pruefen: "Devir teslimi kontrol et",
  },
  m: {
    start: (mrx, min) => `Oyun başladı! Mister X: ${mrx} takımı – ${min} dk kaçış süresi var.`,
    meldung: (mrx, src, uhr) => `Mister X'in (${mrx}) konumu bildirildi${quelle[src] ?? ""}${src === "letzter" ? `, saat ${uhr}` : ""}.`,
    sofort: (mrx) => `Anında bildirim: Mister X'in (${mrx}) konumu oyun yönetiminin talimatıyla bildirildi.`,
    keinStandort: (mrx) => `Mister X (${mrx}) bildirilemedi – konum yok.`,
    fang: (neu, alt, min) => `${neu} takımı ${alt} takımını yakaladı ve artık Mister X! Yakındakiler için ${min} dk bekleme süresi.`,
    strafe: (neu, alt, min) => `Ceza devri: bayrak ${alt} takımından ${neu} takımına geçiyor. Yakındakiler için ${min} dk bekleme süresi.`,
    rueckgaengig: (neu, alt) => `${neu} takımına devir teslim geri alındı. Mister X yeniden ${alt} takımı.`,
    gesperrt: (bereich) => `Oyun alanı küçülüyor! Kapalı: ${bereich}.`,
    sperreAngekuendigt: (bereich, min) => `Dikkat: ${bereich} ${min} dk sonra kapanıyor! Lütfen alandan zamanında çıkın.`,
    sperreAbgesagt: (bereich) => `Tehlike geçti: ${bereich} kapatılmayacak.`,
    freigegeben: (bereich) => `Alan yeniden açık: ${bereich}.`,
    intervall: (min) => `Kural değişikliği: Mister X artık her ${min} dk'da bir bildiriliyor.`,
    wartezeit: (min) => `Kural değişikliği: devir teslimden sonraki bekleme süresi artık ${min} dk.`,
    regeltext: "Oyun yönetimi kurallara ekleme yaptı – bkz. „Kurallar“.",
    pause: "Oyun durduruldu. Lütfen olduğunuz yerde durun – birazdan devam ediyor.",
    weiter: "Devam ediyoruz! Oyun yeniden başladı.",
    warteEnde: "Bekleme süresi bitti – devam edebilirsiniz!",
    warten: (min) => `Devir teslimin yakınındaydınız: ${min} dk olduğunuz yerde durun.`,
    gefangen: (min) => `Yakalandınız: ${min} dk bekleyin, sonra av devam ediyor.`,
    vorsprung: (min) => `Bayrak sizde – ${min} dk kaçış süresi, koşun!`,
    wartenHand: (min) => `Oyun yönetimi size ${min} dk bekleme süresi verdi.`,
    endphase: (spaetestens) => `Son aşama! Oyun artık her an bitebilir – en geç saat ${spaetestens}. Elinizden geleni yapın!`,
    sammelruf: (ort) => `Toplanma çağrısı: herkes şimdi buluşma noktasına: ${ort}.`,
    sammelrufEnde: "Toplanma çağrısı sona erdi.",
    geteilt: (alt, neu) => `${alt} takımı ikiye ayrıldı: ${alt} ve ${neu} artık ayrı oynuyor.`,
    notfall: (team) => `${team} takımı acil durum bildirdi!`,
    pruefen: (alt, neu, distM) =>
      distM === undefined
        ? `${alt} takımı ${neu} takımı tarafından yakalandığını bildirdi – güncel konum yok. Lütfen kontrol edin, gerekirse geri alın.`
        : `${alt} takımı ${neu} takımı tarafından yakalandığını bildirdi, ama telefonlar ${distM} m uzaktaydı. Lütfen kontrol edin, gerekirse geri alın.`,
    notfallZurueck: (team) => `Tehlike geçti: ${team} takımı acil durumu geri aldı (yanlış alarm).`,
    ende: (sieger) => `Oyun bitti! Son Mister X ${sieger} takımı – kazanan onlar!`,
    endeOhne: "Oyun bitti! Bu sefer kazanan yok.",
  },
} satisfies ServerTexte;
