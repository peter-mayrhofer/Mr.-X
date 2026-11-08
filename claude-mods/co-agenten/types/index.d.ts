export type Modus = 'aus' | 'solo' | 'team' | 'schwarm'
export type Modell = 'auto' | 'haiku' | 'sonnet' | 'opus'

export type Einstellungen = {
  modus: Modus
  /** höchstens so viele Co-Agenten gleichzeitig */
  max: number
  /** höchstens so viele Co-Agenten pro Sitzung (0 = unbegrenzt) */
  budget: number
  modell: Modell
  hintergrund: boolean
  forks: boolean
}

export type Eintrag = {
  id: string
  beschreibung: string
  typ: string
  modell: string
  start: number
  /** 'blockiert' = vom Panel abgelehnt */
  zustand: 'laeuft' | 'fertig' | 'fehler' | 'blockiert'
  grund?: string
}

declare module 'claude-code' {
  interface PluginState {
    'co-agenten': {
      einstellungen: Shaped<Einstellungen>
      log: Shaped<Eintrag[]>
      puls: number
    }
  }
}
