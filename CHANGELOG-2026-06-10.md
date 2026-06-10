# VM FEBER - endringer 10. juni 2026

## Bonussporsmal

- Erstattet det gamle fritekstfeltet for toppscorer med en generisk
  bonusseksjon for Full VM.
- Lagt inn lagvalg, spillersok, tallfelt og ja/nei-felt.
- Lagt inn de ti vanlige bonussporsmalene fra `bonus-questions-2026.xlsx`.
- Gruppeplasseringer avledes fortsatt fra kamptips og vises ikke som egne
  bonusfelt.

## Spillerregister

- Lagt til Supabase-oppsett for `teams` og `players`.
- Generert idempotent seed fra FIFAs troppsliste, versjon 1 datert
  10. juni 2026.
- Verifisert 48 lag og 1 248 spillere.
- Normalisert PDF-artefakter og navn til sokbar ASCII i seed-filen.
- Lagt ved parser og seed-generator under `tools/`.

## Nye utrullingsfiler

Kjor disse i Supabase SQL Editor i denne rekkefolgen:

1. `supabase-player-options-setup.sql`
2. `supabase-bonus-questions-2026-setup.sql`
3. `supabase-player-options-2026-seed.sql`

Last deretter opp oppdatert `app.js`, `styles.css` og dokumentasjonsfiler til
GitHub slik at Vercel publiserer frontenden.

## Tipping og poengtavler

- Full VM-tippingen har egne underfaner for kamptips, bonusspørsmål og
  sluttspill.
- Poengtavlesiden har tydelige faner for Full VM, Daglig samlet og I dag.
- I dag viser både dagens poeng og samlet Daglig-poeng.
- Full VM-poengtavlen summerer kamppoeng og bonuspoeng.
- Oversikten har snarveier til alle tre poengtavlene.
- Dagens kamper med gruppe/runde eller sluttspillfase erstatter neste
  Norge-kamp på oversikten.
- Ny migrasjon: `supabase-scoreboards-2026-setup.sql`.
