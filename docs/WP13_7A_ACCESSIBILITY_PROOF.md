# WP13.7A — tilgjengelighetsproof

## Automatisk Chromium-bevis

`scripts/browser-session-lifecycle-test.mjs` starter repositoryets lokale proof-server og en lokalt installert Chromium-basert nettleser. Det laster den faktiske siden `web/session-lifecycle.html`; ingen browserassertion hoppes over på Windows.

| Krav | Maskinelt bevis |
|---|---|
| Full tastaturbruk | Kritiske rolle- og lifecycle-knapper aktiveres med native Space key events gjennom CDP. |
| Logisk fokusrekkefølge | Første Tab fokuserer skip-link; kontroller er native button/select. |
| Fokus ved viewswitch | Rollebytte og målformbytte flytter fokus til sidetittel. |
| Fokus ved status/feil | Gyldig hendelse fokuserer live status; tombstone og recovery failure fokuserer alert. |
| Synlig fokus | Computed outline på skip-link er ikke `none`; alle native kontroller har `:focus-visible`. |
| Live-region | Tilstand har `role=status` og `aria-live=polite`; typed error har `role=alert`. |
| Ikke bare farge | Tilstand, feil, syntetisk klassifisering og terminalstatus uttrykkes i tekst og tilgjengelige navn. |
| 320 px reflow | `documentElement.scrollWidth <= innerWidth` ved 320 px. |
| 200 % zoom | Chromium `Emulation.setPageScaleFactor(2)` og `visualViewport.scale >= 2`, med separat 320 px overflow-bevis. |
| Reduced motion | Emulert `prefers-reduced-motion: reduce` matcher og global CSS reduserer animasjon/transition. |
| Touchmål | Alle synlige button/select måler minst 44 × 44 CSS-piksler ved 320 px. |
| Rolle- og tilstandsnavn | Accessibility tree inneholder begge rollenavn, state label og button/status-roller. |
| Uten lyd | Siden inneholder ingen audio-elementer, autoplay eller lydavhengig kontroll. |
| BM og NN | Browserproof bytter til NN, verifiserer `lang=nn` og lokaliserte tekniske etiketter. |

Proofen dekker også synlige `NOT_CREATED`, `CREATING`, `ACTIVE`, `WAITING`, `PAUSED`, `STOPPED`, `DELETED`, `STALE`, `INVALID`, `RECOVERING` og `COMPLETED` gjennom kritiske scenarioer. `READY` inngår i tastaturflyten mellom created og activate.

## Bevisartefakt

Ved bestått test opprettes `artifacts/wp13-7a-session-lifecycle.png`. Artefakten er et syntetisk teknisk skjermbilde og ikke godkjent visuelt design.

## Ikke bevist

- Manuell test med NVDA, JAWS, VoiceOver eller TalkBack.
- Co-design eller brukertest med barn/voksne.
- Kognitiv, alderstilpasset eller språklig kvalitet på copy.
- Reell touch-enhet, mobil webview eller valgt mobilrammeverk.
- Endelig høykontrast-/forced-colors-review på alle målplattformer.

Disse begrensningene gjør at GAP-008 bare er redusert på proofnivå.
