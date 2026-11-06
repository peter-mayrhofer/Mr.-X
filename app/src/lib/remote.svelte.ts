// Wert einmal vom Server holen, sobald (und solange) der Schlüssel feststeht – z. B. Spielname für den QR-Link oder das
// Archiv nach Spielende. `key()` = null → nichts holen.
export function remote<T>(
  key: () => string | null,
  load: (key: string) => Promise<T>,
): { readonly value: T | null; readonly loaded: boolean } {
  const s = $state({ value: null as T | null, loaded: false });
  $effect(() => {
    const k = key();
    s.value = null;
    s.loaded = false;
    if (!k) return;
    let stale = false;
    load(k).then(
      (v) => {
        if (stale) return;
        s.value = v;
        s.loaded = true;
      },
      () => {
        if (!stale) s.loaded = true;
      },
    );
    return () => (stale = true);
  });
  return s;
}
