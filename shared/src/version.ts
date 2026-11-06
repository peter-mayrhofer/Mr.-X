// Update-Hinweis der Android-App: die APK bringt ihre Web-App mit; ist auf dem Server ein anderer Stand, ist sie veraltet.

/** true, wenn die eingebaute Web-App (lokal) nicht dem Stand auf dem Server entspricht */
export function appVeraltet(lokal: string, server: string | null): boolean {
  return !!server && lokal !== "dev" && server !== "dev" && server !== lokal;
}
