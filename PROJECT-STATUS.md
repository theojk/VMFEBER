# VM FEBER - prosjektstatus

Sist oppdatert: 8. juni 2026.

## Produksjon

- Nettside: `https://vmfeber.vercel.app`
- Frontend hostes av Vercel fra GitHub.
- Database, innlogging og Edge Functions kjører i Supabase.
- Kampdata hentes fra football-data.org.
- Adminbruker: `olejoergen@gmail.com`

Ikke legg service role-nøkkel, Football-Data-nøkkel, Resend-nøkkel eller
`BACKUP_CRON_SECRET` i GitHub eller frontend.

## Funksjoner som finnes

- Magic-link-innlogging og norske brukerflater.
- Full VM og Daglig tipping med serverstyrte frister.
- Daglige tips arves fra Full VM dersom brukeren ikke leverer egne tips.
- Offentlige og private ligaer med delbar kode.
- Full VM-, Daglig total- og Daglig per dato-poengtavler.
- Sikkert tipsinnsyn mellom ligamedlemmer etter relevant frist.
- Invitasjonskoder og adminoversikt.
- Testbrukerstøtte er skrevet, men databaseoppsettet bør verifiseres i
  produksjon før funksjonen regnes som ferdig utrullet.
- Automatisk kamp- og resultatsynkronisering.
- Automatiske tipsbackuper og backup-e-post.
- Projiserte tabeller for alle 12 grupper og rangering av tredjeplasser.
- Projisert sluttspill som følger brukerens tips og FIFAs offisielle Annex C-
  fordeling av de åtte beste tredjeplassene.
- Sluttspilltips med ordinær tid, ekstraomganger og straffespark.
- Mobilmeny, mørk modus og valgfri flytende gruppetabell på desktop.

## Viktige begrensninger

- Ved helt lik poengsum, målforskjell og antall scorede mål mellom projiserte
  tredjeplasser bruker appen grupperekkefølge som stabil simulert avgjørelse.
  Tipsene inneholder ikke kortpoeng eller historisk FIFA-ranking.
- Bonusfeltene for verdensmester, finalist, toppscorer og gruppevinnere er
  foreløpig kun en visuell skisse og lagres ikke.
- Norske TV-kanaler er ikke lagt inn ennå.

## Databasemigrasjoner

Den nyeste migrasjonen for sluttspilltips er
`supabase-knockout-predictions-setup.sql`. Den legger til ekstraomganger og
straffespark på tips, oppdaterer lagringsfunksjonen og sørger for at Daglig kan
arve hele sluttspilltipset.

## Edge Functions

- `sync-world-cup`: synkroniserer kampdata og beregner poeng.
- `create-prediction-backup`: lager snapshots og sender backup-e-post.

Etter endringer i filer under `supabase/functions/` må funksjonene deployes
separat i Supabase. GitHub/Vercel deployerer dem ikke automatisk.

## Anbefalt neste produktarbeid

1. Test tipsinnsyn mellom ligamedlemmer i produksjon.
2. Bestem og implementer endelige bonusspørsmål og bonuspoeng.
3. Legg inn norsk TV-kanal manuelt eller via en godkjent datakilde.
