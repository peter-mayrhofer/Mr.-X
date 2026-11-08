import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Einstellungen, Eintrag, Modell, Modus } from '../types'

const PANE = 'co-agenten'
const TITEL = 'Co-Agenten'
const SPEICHER = 'einstellungen'

const STANDARD: Einstellungen = {
  modus: 'team',
  max: 3,
  budget: 0,
  modell: 'auto',
  hintergrund: true,
  forks: true,
}

// Jeder Modus setzt einen Vorschlag für „gleichzeitig“; danach frei einstellbar.
const MODI: { id: Modus; name: string; info: string; max: number; key: string }[] = [
  { id: 'aus', name: 'Aus', info: 'Claude arbeitet allein', max: 0, key: '1' },
  { id: 'solo', name: 'Solo', info: 'ein Helfer für Recherche', max: 1, key: '2' },
  { id: 'team', name: 'Team', info: 'ein paar parallel', max: 3, key: '3' },
  { id: 'schwarm', name: 'Schwarm', info: 'so viel parallel wie sinnvoll', max: 8, key: '4' },
]
const MODELLE: { id: Modell; name: string }[] = [
  { id: 'auto', name: 'Auto' },
  { id: 'haiku', name: 'Haiku' },
  { id: 'sonnet', name: 'Sonnet' },
  { id: 'opus', name: 'Opus' },
]
const GRENZE = 8

const einstellungen = atom({ plugin: 'co-agenten', key: 'einstellungen' } as const, STANDARD, { shape: 'einstellungen-1' })
const log = atom({ plugin: 'co-agenten', key: 'log' } as const, [] as Eintrag[], { shape: 'log-1' })
const puls = atom({ plugin: 'co-agenten', key: 'puls' } as const, 0)

const FARBE = {
  akzent: '#7c5cff',
  laeuft: '#22c55e',
  frei: '#64748b',
  gesperrt: '#ef4444',
  karte: '#7c5cff22',
}

const laufend = (l: Eintrag[]) => l.filter(x => x.zustand === 'laeuft').length
const gestartet = (l: Eintrag[]) => l.filter(x => x.zustand !== 'blockiert').length
const dauer = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.round(ms / 60_000)} min`)

/** Hinweis an Claude: so plant es seine Arbeit gleich passend, statt erst am Limit zu scheitern */
function anweisung(s: Einstellungen): string {
  if (s.modus === 'aus' || s.max === 0)
    return 'Co-Agenten-Einstellung des Nutzers (Panel „Co-Agenten“): AUS. Starte keine Subagents (Agent-Tool), erledige alles selbst.'
  const teile = [
    `Co-Agenten-Einstellung des Nutzers (Panel „Co-Agenten“): Modus ${s.modus}, höchstens ${s.max} Subagents gleichzeitig`,
    s.budget > 0 ? `höchstens ${s.budget} pro Sitzung` : 'kein Sitzungs-Limit',
    s.modell === 'auto' ? 'Modell nach Bedarf' : `Modell ${s.modell}`,
    s.hintergrund ? 'Hintergrund erlaubt' : 'nur im Vordergrund',
    s.forks ? 'Forks erlaubt' : 'keine Forks',
  ]
  const lust =
    s.modus === 'schwarm'
      ? 'Der Nutzer wünscht ausdrücklich, dass du unabhängige Teilaufgaben (Recherche, Prüfen, parallele Änderungen) auf Subagents verteilst, wo das Zeit spart.'
      : s.modus === 'team'
        ? 'Der Nutzer erlaubt ausdrücklich, Subagents für gut abgrenzbare, parallele Teilaufgaben zu nutzen.'
        : 'Der Nutzer erlaubt ausdrücklich einen einzelnen Subagent für eine Recherche oder Prüfung, wenn er Kontext spart.'
  return `${teile.join(', ')}. ${lust} Mehr lehnt das Panel ab.`
}

async function setze($: EngineInterface, fn: (s: Einstellungen) => Einstellungen) {
  await update($, einstellungen, s => fn(s))
  const s = await read($, einstellungen)
  await $.store.set(SPEICHER, s)
  $.ui.status(s.modus === 'aus' ? 'Co-Agenten: aus' : `Co-Agenten: max ${s.max}`)
}

/** Status der Agenten nachziehen, wann immer sich etwas tut */
async function abgleichen($: EngineInterface) {
  const l = await read($, log)
  if (!l.some(x => x.zustand === 'laeuft')) return
  const liste = await $.agent.list()
  const stand = new Map(liste.map(a => [a.id, a.status]))
  let geaendert = false
  const neu = l.map(x => {
    if (x.zustand !== 'laeuft') return x
    const st = stand.get(x.id)
    const z = st === 'completed' || st === undefined ? 'fertig' : st === 'failed' || st === 'killed' ? 'fehler' : 'laeuft'
    if (z !== x.zustand) geaendert = true
    return z === x.zustand ? x : { ...x, zustand: z as Eintrag['zustand'] }
  })
  if (geaendert) await update($, log, () => neu)
  await update($, puls, n => (n ?? 0) + 1)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Einstellungen überleben die Sitzung
    const gespeichert = (await $.store.get(SPEICHER)) as Partial<Einstellungen> | undefined
    if (gespeichert) await update($, einstellungen, () => ({ ...STANDARD, ...gespeichert }))
    await $.command.register({
      name: 'coagenten',
      description: 'Co-Agenten steuern: Übersicht, Modus, Anzahl, Budget, Modell',
      argumentHint: '[aus|solo|team|schwarm | 0-8 | budget N | modell X | hintergrund an|aus | forks an|aus]',
    })
    void $.ui.open({ id: PANE, title: TITEL })
    const s = await read($, einstellungen)
    $.ui.status(s.modus === 'aus' ? 'Co-Agenten: aus' : `Co-Agenten: max ${s.max}`)
    return next(e)
  })

  on('command.run', { command: 'coagenten' }, async ($, e) => {
    // Befehle: aus|solo|team|schwarm, 0-8, budget N|∞, modell auto|haiku|sonnet|opus,
    // hintergrund an|aus, forks an|aus, leeren – mehrere hintereinander erlaubt
    const w = String(e.args ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
    const fehler: string[] = []
    for (let i = 0; i < w.length; i++) {
      const t = w[i]!
      const n = w[i + 1]
      const modus = MODI.find(m => m.id === t)
      const zahl = Number(t)
      if (modus) await setze($, s => ({ ...s, modus: modus.id, max: modus.max }))
      else if (Number.isInteger(zahl) && zahl >= 0 && zahl <= GRENZE)
        await setze($, s => ({ ...s, max: zahl, modus: zahl === 0 ? 'aus' : s.modus === 'aus' ? 'team' : s.modus }))
      else if (t === 'budget' && n !== undefined) {
        const b = n === '∞' || n === 'aus' || n === '0' ? 0 : Number(n)
        if (Number.isInteger(b) && b >= 0) await setze($, s => ({ ...s, budget: b }))
        else fehler.push(`budget ${n}`)
        i++
      } else if (t === 'modell' && n !== undefined) {
        const m = MODELLE.find(x => x.id === n)
        if (m) await setze($, s => ({ ...s, modell: m.id }))
        else fehler.push(`modell ${n}`)
        i++
      } else if ((t === 'hintergrund' || t === 'forks') && (n === 'an' || n === 'aus')) {
        await setze($, s => ({ ...s, [t]: n === 'an' }))
        i++
      } else if (t === 'leeren') await update($, log, x => x.filter(y => y.zustand === 'laeuft'))
      else fehler.push(t)
    }
    await abgleichen($)
    const offen = await $.ui.open({ id: PANE, title: TITEL })
    const s = await read($, einstellungen)
    const l = await read($, log)
    const jetzt = await $.clock.now()
    const aktiv = laufend(l)
    const plaetze = Array.from({ length: GRENZE }, (_, i) => (i < aktiv ? '●' : i < s.max ? '○' : '·')).join(' ')
    const ja = (b: boolean) => (b ? 'an' : 'aus')
    const zeilen = [
      s.modus === 'aus' || s.max === 0 ? '**Crew schläft** – Co-Agenten sind aus' : `**Crew** ${plaetze}   ${aktiv} von ${s.max} aktiv`,
      '',
      `| | |`,
      `|---|---|`,
      `| Modus | **${MODI.find(m => m.id === s.modus)?.name}** – ${MODI.find(m => m.id === s.modus)?.info} |`,
      `| Gleichzeitig | **${s.max}** |`,
      `| Pro Sitzung | **${s.budget === 0 ? '∞' : s.budget}** (${gestartet(l)} gestartet, ${l.filter(x => x.zustand === 'blockiert').length} abgelehnt) |`,
      `| Modell | **${MODELLE.find(m => m.id === s.modell)?.name}** |`,
      `| Hintergrund / Forks | ${ja(s.hintergrund)} / ${ja(s.forks)} |`,
    ]
    if (l.length) {
      zeilen.push('', '**Einsätze**')
      for (const x of [...l].reverse().slice(0, 8))
        zeilen.push(
          `- ${x.zustand === 'laeuft' ? '● läuft' : x.zustand === 'fertig' ? '✓ fertig' : '✗ ' + (x.zustand === 'blockiert' ? 'abgelehnt' : 'Fehler')} · ${x.beschreibung} · ` +
            (x.zustand === 'blockiert' ? (x.grund ?? '') : `${x.typ} · ${dauer(jetzt - x.start)}`),
        )
    }
    if (fehler.length) zeilen.push('', `Nicht verstanden: ${fehler.join(', ')}`)
    zeilen.push(
      '',
      '`/coagenten aus|solo|team|schwarm` · `/coagenten 0–8` · `budget 10|∞` · `modell auto|haiku|sonnet|opus` · `hintergrund an|aus` · `forks an|aus` · `leeren`',
    )
    if (offen.isPlaced) zeilen.push('', `Panel „${TITEL}“ ist offen.`)
    return { text: zeilen.join('\n') }
  })

  // Claude erfährt die Einstellung im System-Prompt
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    const s = await read($, einstellungen)
    return { sections: [...r.sections, { id: 'co-agenten:einstellung', text: anweisung(s), scope: 'session' as const }] }
  })

  // Türsteher: jeder Start eines Co-Agenten geht hier durch
  on('agent.spawn', async ($, e, next) => {
    if (e.workflow || e.isTeammate) return next(e)
    const s = await read($, einstellungen)
    const l = await read($, log)
    const jetzt = await $.clock.now()
    const sperre = (grund: string) =>
      update($, log, x => [
        ...x,
        { id: `${e.tool_use_id}-b`, beschreibung: e.description, typ: e.subagentType, modell: '–', start: jetzt, zustand: 'blockiert' as const, grund },
      ].slice(-60)).then(() => ({ deny: `Co-Agenten-Panel: ${grund}. Mach die Aufgabe selbst oder bitte den Nutzer, das Limit im Panel zu erhöhen.` }))

    if (s.modus === 'aus' || s.max === 0) return sperre('Co-Agenten sind ausgeschaltet')
    if (laufend(l) >= s.max) return sperre(`Limit erreicht (${laufend(l)} von ${s.max} laufen)`)
    if (s.budget > 0 && gestartet(l) >= s.budget) return sperre(`Sitzungs-Budget aufgebraucht (${s.budget})`)
    if (e.fork && !s.forks) return sperre('Forks sind ausgeschaltet')

    const r = await next({
      ...e,
      ...(s.modell !== 'auto' && !e.fork ? { model: s.modell } : {}),
      ...(!s.hintergrund ? { background: false } : {}),
    })
    if (r.deny === undefined)
      await update($, log, x => [
        ...x,
        { id: r.agentId ?? e.tool_use_id, beschreibung: e.description, typ: e.subagentType, modell: r.model, start: jetzt, zustand: 'laeuft' as const },
      ].slice(-60))
    return r
  }).catch(($, e, next) => next(e)) // die Mod darf Claude nie blockieren, wenn sie selbst stolpert

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    await abgleichen($)
    return r
  })
  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    await abgleichen($)
    return r
  }).catch(($, e, next) => next(e))

  // ---------- Das Panel ----------
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = await read($, einstellungen)
    const l = await read($, log)
    await read($, puls)
    const jetzt = await $.clock.now()
    const breit = Math.max(24, (e.props as { bodyColumns?: number }).bodyColumns ?? 40)
    const aktiv = laufend(l)
    const aus = s.modus === 'aus' || s.max === 0

    // Crew-Leiste: ein Platz pro erlaubtem Co-Agenten
    const plaetze = Array.from({ length: GRENZE }, (_, i) => (i < aktiv ? '●' : i < s.max ? '○' : '·'))

    const ändere = (fn: (x: Einstellungen) => Einstellungen) => () => void setze($, fn)

    return (
      <Box flexDirection="column" gap={1} width={breit}>
        {/* Kopf: Crew auf einen Blick */}
        <Box flexDirection="column" borderStyle="round" borderColor={aus ? FARBE.gesperrt : FARBE.akzent} paddingX={1} backgroundColor={FARBE.karte}>
          <Text bold color={aus ? FARBE.gesperrt : FARBE.akzent}>
            {aus ? 'CREW SCHLÄFT' : `CREW · ${aktiv} von ${s.max} aktiv`}
          </Text>
          <Text>
            {plaetze.map((p, i) => (
              <Text color={p === '●' ? FARBE.laeuft : p === '○' ? FARBE.akzent : FARBE.frei}>{p}{i < GRENZE - 1 ? ' ' : ''}</Text>
            ))}
          </Text>
          <Text dimColor>
            {gestartet(l)} gestartet{s.budget > 0 ? ` von ${s.budget}` : ''} · {l.filter(x => x.zustand === 'blockiert').length} abgelehnt
          </Text>
        </Box>

        {/* Modus */}
        <Box flexDirection="column">
          <Text bold>Modus</Text>
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            {MODI.map(m => (
              <Button
                key={`modus-${m.id}`}
                hotkey={m.key}
                variant={s.modus === m.id ? 'primary' : 'secondary'}
                onPress={ändere(x => ({ ...x, modus: m.id, max: m.max }))}
              >
                {m.name}
              </Button>
            ))}
          </Box>
          <Text dimColor>{MODI.find(m => m.id === s.modus)?.info}</Text>
        </Box>

        {/* Anzahl */}
        <Box flexDirection="column">
          <Text bold>Gleichzeitig</Text>
          <Box flexDirection="row" gap={1} alignItems="center">
            <Button key="weniger" hotkey="w" onPress={ändere(x => ({ ...x, max: Math.max(0, x.max - 1), modus: x.max - 1 <= 0 ? 'aus' : x.modus }))}>
              −
            </Button>
            <Text bold color={FARBE.akzent}>{` ${s.max} `}</Text>
            <Button key="mehr" hotkey="m" onPress={ändere(x => ({ ...x, max: Math.min(GRENZE, x.max + 1), modus: x.modus === 'aus' ? 'solo' : x.modus }))}>
              +
            </Button>
          </Box>
          <Text bold>Pro Sitzung</Text>
          <Box flexDirection="row" gap={1} alignItems="center">
            <Button key="budget-weniger" onPress={ändere(x => ({ ...x, budget: Math.max(0, x.budget - 5) }))}>
              −5
            </Button>
            <Text bold color={FARBE.akzent}>{s.budget === 0 ? ' ∞ ' : ` ${s.budget} `}</Text>
            <Button key="budget-mehr" onPress={ändere(x => ({ ...x, budget: x.budget + 5 }))}>
              +5
            </Button>
          </Box>
        </Box>

        {/* Modell */}
        <Box flexDirection="column">
          <Text bold>Modell der Co-Agenten</Text>
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            {MODELLE.map(m => (
              <Button key={`modell-${m.id}`} variant={s.modell === m.id ? 'primary' : 'secondary'} onPress={ändere(x => ({ ...x, modell: m.id }))}>
                {m.name}
              </Button>
            ))}
          </Box>
        </Box>

        {/* Schalter */}
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          <Button key="hintergrund" variant={s.hintergrund ? 'primary' : 'secondary'} onPress={ändere(x => ({ ...x, hintergrund: !x.hintergrund }))}>
            {s.hintergrund ? '✓ Hintergrund' : '✗ Hintergrund'}
          </Button>
          <Button key="forks" variant={s.forks ? 'primary' : 'secondary'} onPress={ändere(x => ({ ...x, forks: !x.forks }))}>
            {s.forks ? '✓ Forks' : '✗ Forks'}
          </Button>
        </Box>

        {/* Live-Liste */}
        <Box flexDirection="column">
          <Text bold>Einsätze</Text>
          {l.length === 0 && <Text dimColor>Noch kein Co-Agent unterwegs.</Text>}
          {[...l].reverse().slice(0, 12).map(x => (
            <Text>
              <Text color={x.zustand === 'laeuft' ? FARBE.laeuft : x.zustand === 'blockiert' || x.zustand === 'fehler' ? FARBE.gesperrt : FARBE.frei}>
                {x.zustand === 'laeuft' ? '● ' : x.zustand === 'fertig' ? '✓ ' : '✗ '}
              </Text>
              <Text>{x.beschreibung}</Text>
              <Text dimColor>
                {' · '}
                {x.zustand === 'blockiert' ? x.grund : `${x.typ}${x.modell && x.modell !== '–' ? ` · ${x.modell}` : ''} · ${dauer(jetzt - x.start)}`}
              </Text>
            </Text>
          ))}
          {l.length > 0 && (
            <Button key="leeren" dimColor onPress={() => void update($, log, x => x.filter(y => y.zustand === 'laeuft'))}>
              Liste leeren
            </Button>
          )}
        </Box>
      </Box>
    )
  })
}
