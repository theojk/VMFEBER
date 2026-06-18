# VM FEBER - prosjektstatus

Sist oppdatert: 12. juni 2026.

Les `HANDOFF-2026-06-09.md` først ved oppstart i en ny chat. Den skiller mellom
bekreftet produksjonsstatus og funksjoner som er utviklet lokalt, men fortsatt
må bekreftes utrullet og testet.

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
- Valgfri beskrivelse på ligaer.
- Full VM-, Daglig total- og Daglig per dato-poengtavler.
- Sikkert tipsinnsyn mellom ligamedlemmer etter relevant frist.
- E-postsamtykke ved registrering og tydelig informasjon om sletting etter VM.
- Invitasjonskoder og adminoversikt.
- Privat adminstatistikk for brukere, tips, ligaer og ligadeltakelse.
- Synlig tilbakemeldingsadresse i bunnteksten.
- Testbrukerstøtte er skrevet, men databaseoppsettet bør verifiseres i
  produksjon før funksjonen regnes som ferdig utrullet.
- Kamp- og resultatsynkronisering med poengberegning. Kampstyrt automatikk er
  klargjort: kontroll fra 15 minutter før kampstart, deretter høyst én
  API-kontroll per time til alle aktuelle kamper er ferdige.
- Automatiske tipsbackuper og backup-e-post.
- Daglig poengkontroll på e-post kl. 07:00 er klargjort, men må deployes og
  aktiveres med `supabase-points-health-report-schedule.sql`.
- Projiserte tabeller for alle 12 grupper og rangering av tredjeplasser.
- Projisert sluttspill som følger brukerens tips og FIFAs offisielle Annex C-
  fordeling av de åtte beste tredjeplassene.
- Sluttspilltips med ordinær tid, ekstraomganger og straffespark.
- Turneringsstudio-inspirert brukerflate med mobilmeny, mørk modus og valgfri
  flytende gruppetabell på desktop.
- Full VM-tipping med egne underfaner for kamptips, bonusspørsmål og sluttspill.
- Tydelige poengtavler for Full VM, Daglig samlet og I dag. I dag viser både
  dagens og samlet Daglig-poeng.
- Oversikten viser dagens kamper med gruppe/runde eller sluttspillfase.

## Viktige begrensninger

- Automatisk sletting/anonymisering av e-postadresser må etableres og testes
  før fristen 26. juli 2026.
- Ved helt lik poengsum, målforskjell og antall scorede mål mellom projiserte
  tredjeplasser bruker appen grupperekkefølge som stabil simulert avgjørelse.
  Tipsene inneholder ikke kortpoeng eller historisk FIFA-ranking.
- Generiske bonusspørsmål med lagvalg, spillersøk, tall og ja/nei er utviklet
  lokalt. Supabase-filene og frontend må rulles ut og produksjonstestes.
- Ny poengtavlemigrasjon `supabase-scoreboards-2026-setup.sql` må rulles ut og
  produksjonstestes.
- Automatisk resultatsynkronisering må aktiveres med `SYNC_CRON_SECRET` og
  `supabase-sync-schedule.sql`.
- Norske TV-kanaler er ikke lagt inn ennå.

## Databasemigrasjoner

Den nyeste migrasjonen for sluttspilltips er
`supabase-knockout-predictions-setup.sql`. Den legger til ekstraomganger og
straffespark på tips, oppdaterer lagringsfunksjonen og sørger for at Daglig kan
arve hele sluttspilltipset.

`supabase-consent-and-top-scorer-setup.sql` legger til e-postsamtykke,
samtykkestatus i adminoversikten og lagret toppscorertips.

## Edge Functions

- `sync-world-cup`: synkroniserer kampdata og beregner poeng.
- `create-prediction-backup`: lager snapshots og sender backup-e-post.

Etter endringer i filer under `supabase/functions/` må funksjonene deployes
separat i Supabase. GitHub/Vercel deployerer dem ikke automatisk.

## Anbefalt neste produktarbeid

1. Bekreft utrulling og produksjonstest av den nyeste lokale pakken ved hjelp
   av `MORNING-CHECKLIST.md`.
2. Bestem og implementer endelige sluttspillpoeng.
3. Rull ut og produksjonstest bonusspørsmål og spillerregister.
4. Legg inn norsk TV-kanal manuelt eller via en godkjent datakilde.
5. Etabler og test sletting/anonymisering av e-postadresser før 26. juli 2026.
