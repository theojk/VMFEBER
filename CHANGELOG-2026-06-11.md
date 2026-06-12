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
- Oversikt viser nå en egen Nyheter-fane med de nye fristreglene.

## Sluttspill

- Senere sluttspillrunder oppdateres nå også mens brukeren står i
  Sluttspill-fanen.

## Automatisk poengoppdatering

- `sync-world-cup` kan nå kjøres sikkert fra en Supabase-tidsplan.
- `supabase-sync-schedule.sql` vekker synkroniseringen hvert 15. minutt.
- Football-data.org kalles først to timer etter kampstart og deretter høyst
  én gang per time mens aktuelle kamper fortsatt ikke er ferdige.
- Admin-knappen for manuell oppdatering beholdes som reserve.

## Ny kamppoengregel

- Eksakt resultat gir 3 poeng.
- Riktig målforskjell, men ikke eksakt resultat, gir 2 poeng.
- Riktig HUB, men ikke riktig målforskjell, gir 1 poeng.
- `supabase-goal-difference-points-setup.sql` rekalkulerer også ferdige kamper.

## Resultater i tippingen

- Ferdige kamper viser faktisk resultat i både Daglig og Full VM.
- Poeng vises i stedet for «Låst»: mørkegrønn for 3, lysegrønn for 2,
  gul for 1 og rød for 0 poeng.
- Adminsynkronisering oppdaterer kampkort og poengvisning uten sidelasting.

## Utrulling

1. Kjør `supabase-scoreboards-2026-setup.sql` i Supabase SQL Editor.
2. Kjør `supabase-deadlines-2026-06-11-setup.sql` sist i Supabase SQL Editor.
3. Deploy den oppdaterte Edge Function-filen
   `supabase/functions/create-prediction-backup/index.ts`.
4. Kjør den oppdaterte backup-planen fra `supabase-backup-schedule.local.sql`.
5. Publiser nettsidefilene til Vercel.
