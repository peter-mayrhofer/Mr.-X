// Zeit- und Zahlenformate (de-AT)
const MIN = 60_000;

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const uhr = (t: number) => new Date(t).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });

export const datum = (t: number) => new Date(t).toLocaleDateString("de-AT", { day: "numeric", month: "long", year: "numeric" });

export function vor(t: number, now: number) {
  const m = Math.floor((now - t) / MIN);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} Min`;
  return `vor ${Math.floor(m / 60)} h ${m % 60} Min`;
}

/** 1:23 h bzw. 45 Min */
export function dauer(ms: number) {
  const m = Math.floor(ms / MIN);
  return m < 60 ? `${m} Min` : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} h`;
}

export const km = (m: number) => `${(m / 1000).toLocaleString("de-AT", { maximumFractionDigits: 1 })} km`;

export const meter = (m: number) => (m < 1000 ? `${Math.round(m / 5) * 5} m` : km(m));
