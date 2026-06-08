# VM FEBER - prosjektstatus

Sist oppdatert: 7. juni 2026.

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
- Invitasjonskoder og adminoversikt.
- Testbrukerstøtte er skrevet, men databaseoppsettet bør verifiseres i
  produksjon før funksjonen regnes som ferdig utrullet.
- Automatisk kamp- og resultatsynkronisering.
- Automatiske tipsbackuper og backup-e-post.
- Projiserte tabeller for alle 12 grupper og rangering av tredjeplasser.
- Projisert sluttspill som følger brukerens tips.
- Sluttspilltips med ordinær tid, ekstraomganger og straffespark.
- Mobilmeny, mørk modus og valgfri flytende gruppetabell på desktop.

## Viktige begrensninger

- Den eksakte fordelingen av de åtte beste tredjeplassene krever FIFAs
  kombinasjonstabell. Appen viser foreløpig mulige kandidater.
- Bonusfeltene for verdensmester, finalist, toppscorer og gruppevinnere er
  foreløpig kun en visuell skisse og lagres ikke.
- Visning av andre brukeres tips etter fristen står fortsatt på TODO-listen.
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

1. Test hele sluttspillflyten med en innlogget bruker.
2. Implementer trygg visning av andre brukeres tips etter fristen.
3. Bestem og implementer endelige bonusspørsmål og bonuspoeng.
4. Legg inn norsk TV-kanal manuelt eller via en godkjent datakilde.
5. Implementer FIFAs kombinasjonstabell for eksakt plassering av tredjeplasser.
