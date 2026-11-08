# Co-Agenten

Eine Mod für Claude Code, mit der du selbst bestimmst, ob und wie viele Co-Agenten (Subagents) Claude benutzt.
Das Panel „Co-Agenten“ rechts neben dem Chat zeigt die Crew live und hat alle Einstellungen:

- **Modus:** Aus, Solo, Team oder Schwarm (Tasten 1–4)
- **Gleichzeitig:** 0 bis 8 Co-Agenten (Tasten w/m)
- **Pro Sitzung:** Budget, wie viele Co-Agenten Claude insgesamt starten darf (∞ = unbegrenzt)
- **Modell** der Co-Agenten: Auto, Haiku, Sonnet oder Opus
- **Hintergrund** und **Forks** an oder aus
- **Einsätze:** welche Co-Agenten laufen, fertig sind oder vom Panel abgelehnt wurden

Claude bekommt die Einstellung in seinen Anweisungen und plant gleich passend. Was darüber hinausgeht, lehnt die Mod
beim Start ab. Die Einstellungen bleiben über Sitzungen erhalten. Schnell per Befehl: `/coagenten 3`, `/coagenten aus`,
`/coagenten schwarm`.

## Installieren

Im Terminal in einer Claude-Code-Sitzung:

```
/plugin install co-agenten --marketplace peter-mayrhofer/Mr.-X
```

Aus der Eingabeaufforderung bzw. Shell:

```
claude plugin install co-agenten --marketplace peter-mayrhofer/Mr.-X
```

In der Desktop-App (wo `/plugin` nicht läuft): neben dem Eingabefeld auf **+** → **Plugins** → **Add marketplace**
mit `peter-mayrhofer/Mr.-X` → **Add plugin**.

Das Repository ist privat: Installieren klappt nur auf einem Computer, der bei GitHub angemeldet ist (z. B. mit
`gh auth login` und `gh auth setup-git`, oder einem SSH-Schlüssel).

Das Panel „Co-Agenten“ erscheint in Claude Code am Computer (Terminal oder Desktop-App) rechts neben dem Chat. In der
Web- oder Handy-App gibt es kein Panel; dort zeigt `/coagenten` dieselbe Übersicht als Text.
