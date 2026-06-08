# VM FEBER - sjekkliste for neste utrulling

## 1. Supabase SQL Editor

Kjør `supabase-knockout-predictions-setup.sql`.
Kjør deretter `supabase-league-prediction-visibility-setup.sql`.
Kjør deretter `supabase-consent-and-top-scorer-setup.sql`.

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
- `supabase/functions/sync-world-cup/index.ts`
- `supabase/functions/create-prediction-backup/index.ts`
- `PROJECT-STATUS.md`
- `MORNING-CHECKLIST.md`

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
6. Velg Full VM.
7. Lagre toppscorertips, last siden på nytt og kontroller at tipset er bevart.
8. Fyll alle seks kampene i én gruppe og kontroller at lag går inn i
   16-delsfinalen.
9. Fyll alle gruppespillkampene og kontroller at hver av de åtte beste
   tredjeplassene får én bestemt 16-delsfinale, uten kandidatlisten med flere
   lag.
10. Tipp en sluttspillkamp uavgjort.
11. Kontroller at ekstraomganger vises.
12. Tipp også ekstraomgangene uavgjort og kontroller at straffespark vises.
13. Velg en straffevinner og kontroller at laget føres videre.
14. Lagre tipset, last siden på nytt og kontroller at alle feltene er bevart.
15. Åpne en poengtavle og klikk på et ligamedlem.
16. Kontroller at Full VM-tips er sperret før samlet frist.
17. Kontroller at Daglig-tips for en valgt dato er sperret før kl. 12:00 norsk
    tid og synlig etter fristen.

Merk: poengberegningen bruker foreløpig stillingen etter 90 minutter.
Bestem senere om riktig lag videre også skal gi egne sluttspillpoeng.

## 5. Ved feil

Ta skjermbilde av feilen og noter hvilket steg i funksjonstesten som feilet.
Ikke del hemmelige Supabase- eller API-nøkler i skjermbildet.
