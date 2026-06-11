# Endringer 11. juni 2026

## Nye fristregler

- Full VM-kamp 1 og 2 låses ved egen kampstart.
- Full VM-kamp 3 og alle senere kamper låses ved kampstart i kamp 3.
- Bonusspørsmål låses ved kampstart i kamp 3.
- Daglig tipping låses ved kampstart for hver enkelt kamp.
- Startede kamper vises som låst og kan ikke endres.

## Kampdag

- «Dagens kamper», daglig tipping og dagens poengtavle følger
  `America/New_York`.
- Kampstart vises fortsatt i norsk tid.

## Sluttspill

- Senere sluttspillrunder oppdateres nå også mens brukeren står i
  Sluttspill-fanen.

## Utrulling

1. Kjør `supabase-scoreboards-2026-setup.sql` i Supabase SQL Editor.
2. Kjør `supabase-deadlines-2026-06-11-setup.sql` sist i Supabase SQL Editor.
3. Deploy den oppdaterte Edge Function-filen
   `supabase/functions/create-prediction-backup/index.ts`.
4. Kjør den oppdaterte backup-planen fra `supabase-backup-schedule.local.sql`.
5. Publiser nettsidefilene til Vercel.
