# VM FEBER - sjekkliste for neste utrulling

Sist oppdatert: 9. juni 2026.

Før du starter: avklar hvilke steg som allerede er fullført. Annex C-fordeling,
sluttspilltips og Edge Functions er tidligere bekreftet i produksjon. Status
for de fire nyeste migrasjonene og den nyeste frontendpakken må bekreftes.

## 1. Supabase SQL Editor

Kjør `supabase-knockout-predictions-setup.sql`.
Kjør deretter `supabase-league-prediction-visibility-setup.sql`.
Kjør deretter `supabase-consent-and-top-scorer-setup.sql`.
Kjør deretter `supabase-admin-statistics-setup.sql`.
Kjør deretter `supabase-league-descriptions-setup.sql`.

Filen kan kjøres på nytt dersom du er usikker på om den ble fullført. Den
sletter ikke eksisterende tips.

## 2. GitHub

Last opp alle endrede prosjektfiler. De viktigste er:

- `app.js`
- `third-place-combinations.js`
- `styles.css`
- `index.html`
- `supabase-schema.sql`
- `supabase-football-data-setup.sql`
- `supabase-knockout-predictions-setup.sql`
- `supabase-league-prediction-visibility-setup.sql`
- `supabase-consent-and-top-scorer-setup.sql`
- `supabase-admin-statistics-setup.sql`
- `supabase-league-descriptions-setup.sql`
- `supabase/functions/sync-world-cup/index.ts`
- `supabase/functions/create-prediction-backup/index.ts`
- `PROJECT-STATUS.md`
- `MORNING-CHECKLIST.md`
- `HANDOFF-2026-06-09.md`

Vercel skal deretter deployere frontend automatisk.

## 3. Supabase Edge Functions

Deploy oppdatert kode for:

1. `sync-world-cup`
2. `create-prediction-backup`

Kjør deretter **Synkroniser kampdata** én gang som admin. Den oppdaterte
synkroniseringen lagrer ordinær tid separat fra ekstraomganger og straffespark.

## 4. Kort funksjonstest

1. Åpne `https://vmfeber.vercel.app` på mobil.
2. Velg mørk modus og kontroller at datoer og knapper er tydelige.
3. Kontroller at stadionnavigasjonen, hovedbildet og de tre statuskortene er
   tydelige uten horisontal rulling.
4. Logg ut på mobil, trykk **Logg inn for å tippe**, og kontroller at
   innloggingspanelet åpnes.
5. Kontroller at registrering krever e-postsamtykke, og at meldingen etter
   sending nevner Supabase og søppelpost/spam.
6. Logg inn som admin og kontroller at statistikkpanelet viser brukere, tips,
   ligaer og ligadeltakere.
7. Opprett en liga med beskrivelse og kontroller at beskrivelsen vises.
8. Kontroller at tilbakemeldingsadressen nederst åpner en ny e-post.
9. Velg Full VM.
10. Lagre toppscorertips, last siden på nytt og kontroller at tipset er bevart.
11. Fyll alle seks kampene i én gruppe og kontroller at lag går inn i
   16-delsfinalen.
12. Fyll alle gruppespillkampene og kontroller at hver av de åtte beste
   tredjeplassene får én bestemt 16-delsfinale, uten kandidatlisten med flere
   lag.
13. Tipp en sluttspillkamp uavgjort.
14. Kontroller at ekstraomganger vises.
15. Tipp også ekstraomgangene uavgjort og kontroller at straffespark vises.
16. Velg en straffevinner og kontroller at laget føres videre.
17. Lagre tipset, last siden på nytt og kontroller at alle feltene er bevart.
18. Åpne en poengtavle og klikk på et ligamedlem.
19. Kontroller at Full VM-tips er sperret før samlet frist.
20. Kontroller at Daglig-tips for en valgt dato er sperret før kl. 12:00 norsk
    tid og synlig etter fristen.
21. Kontroller at Full VM har underfanene Kamptips, Bonusspørsmål og Sluttspill.
22. Kontroller at oversikten viser dagens kamper med gruppe/runde eller
    sluttspillfase.
23. Kontroller poengtavlene Full VM, Daglig samlet og I dag.
24. Kontroller at I dag viser både dagens poeng og samlet Daglig-poeng.
25. Kontroller at Full VM-poengtavlen viser kamppoeng og bonuspoeng separat og
    summerer dem riktig.

Merk: poengberegningen bruker foreløpig stillingen etter 90 minutter.
Bestem senere om riktig lag videre også skal gi egne sluttspillpoeng.

## 5. Ved feil

Ta skjermbilde av feilen og noter hvilket steg i funksjonstesten som feilet.
Ikke del hemmelige Supabase- eller API-nøkler i skjermbildet.
