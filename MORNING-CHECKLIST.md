# VM FEBER - sjekkliste for neste utrulling

## 1. Supabase SQL Editor

Kjør `supabase-knockout-predictions-setup.sql`.

Filen kan kjøres på nytt dersom du er usikker på om den ble fullført. Den
sletter ikke eksisterende tips.

## 2. GitHub

Last opp alle endrede prosjektfiler. De viktigste er:

- `app.js`
- `styles.css`
- `index.html`
- `supabase-schema.sql`
- `supabase-football-data-setup.sql`
- `supabase-knockout-predictions-setup.sql`
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
3. Velg Full VM.
4. Fyll alle seks kampene i én gruppe og kontroller at lag går inn i
   16-delsfinalen.
5. Tipp en sluttspillkamp uavgjort.
6. Kontroller at ekstraomganger vises.
7. Tipp også ekstraomgangene uavgjort og kontroller at straffespark vises.
8. Velg en straffevinner og kontroller at laget føres videre.
9. Lagre tipset, last siden på nytt og kontroller at alle feltene er bevart.

Merk: poengberegningen bruker foreløpig stillingen etter 90 minutter.
Bestem senere om riktig lag videre også skal gi egne sluttspillpoeng.

## 5. Ved feil

Ta skjermbilde av feilen og noter hvilket steg i funksjonstesten som feilet.
Ikke del hemmelige Supabase- eller API-nøkler i skjermbildet.
