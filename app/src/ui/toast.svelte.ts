// Kurze Rückmeldungen („Übergabe gespeichert“). Optional mit Aktion („Rückgängig“).
export interface Toast {
  id: number;
  text: string;
  tone: "info" | "ok" | "warn";
  action?: { label: string; run: () => void };
}

let next = 1;
class Toasts {
  list = $state<Toast[]>([]);
}
export const toasts = new Toasts();

export function toast(text: string, tone: Toast["tone"] = "info", action?: Toast["action"], ms = 4000) {
  const id = next++;
  toasts.list.push({ id, text, tone, ...(action ? { action } : {}) });
  setTimeout(() => (toasts.list = toasts.list.filter((t) => t.id !== id)), ms);
}
