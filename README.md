# VM FEBER

Norsk, mobilvennlig VM-tippeside publisert med Vercel og Supabase.

Se [PROJECT-STATUS.md](PROJECT-STATUS.md) for prosjektstatus,
[MORNING-CHECKLIST.md](MORNING-CHECKLIST.md) for neste utrulling og
[TODO.md](TODO.md) for planlagte forbedringer.

## Hva som finnes nå

- Mobilvennlig webapp som kan åpnes direkte i nettleser
- Magic-link-innlogging med Supabase
- To konkurranseformer:
  - Full VM-konkurranse med samlet frist før turneringsstart
  - Daglig konkurranse med frist kl. 12:00 norsk tid
- Private og offentlige ligaer med kode, beskrivelse og eierstyrt redigering
- Poengtavler som bare vises for ligaer brukeren er medlem av
- Klikkbart tipsinnsyn mellom ligamedlemmer etter relevant frist
- Regelfane som forklarer Full VM, Daglig og de separate poengtavlene
- Lagret toppscorertips og eksplisitt samtykke til konkurranserelatert e-post
- Privat adminstatistikk for påmeldinger, tips, ligaer og ligadeltakelse
- Autooppdaterte projiserte tabeller for alle 12 VM-grupper og tredjeplasser
- Valgfri flytende live-tabell på desktop som følger kampen brukeren tipper på
- Rundeetiketter og projisert sluttspill med FIFAs offisielle Annex C-fordeling
  av de åtte beste tredjeplassene
- Sluttspilltips med ekstraomganger og straffespark ved uavgjort
- Adminverktøy for invitasjoner, brukere, testbrukere og resultatsynkronisering

## Neste naturlige steg

1. Test tipsinnsyn mellom ligamedlemmer i produksjon.
2. Rull ut og test spillerregisteret og de nye bonusspørsmålene.
3. Legg inn norske TV-kanaler.

## Lokal bruk

Åpne `index.html` i nettleseren.

## Supabase-oppsett

1. Gå til Supabase-prosjektet ditt.
2. Åpne SQL Editor.
3. Lim inn innholdet fra `supabase-schema.sql` og kjør det.
4. Lim inn innholdet fra `supabase-after-schema.sql` og kjør det.
5. I `supabase-config.js`, fyll inn:
   - Project URL
   - anon public key
6. Gå til Authentication -> Sign In / Providers.
7. Sørg for at Email er aktivert.
8. Slå på magic link / passwordless email hvis Supabase-prosjektet ber om det.
9. Gå til Authentication -> URL Configuration.
10. Legg inn lokal/deployet adresse som tillatt redirect URL.

Du finner begge under Project Settings -> API i Supabase.

Ikke legg service role key i frontend. Den er hemmelig.

## Hosting pa Vercel

Anbefalt adresseforsok:

- `vmfeber.vercel.app`
- `vm-feber.vercel.app`
- `vmfeber2026.vercel.app`

Nar siden er publisert, legg denne inn i Supabase:

- Site URL: `https://DIN-VERCEL-ADRESSE.vercel.app`
- Redirect URL: `https://DIN-VERCEL-ADRESSE.vercel.app`

Dette ligger under Authentication -> URL Configuration.

## Verdier jeg trenger fra deg

Send meg disse to fra Supabase, sa kan jeg lime dem inn riktig:

- Project URL
- anon public key

Dette er ikke service role key. Ikke send service role key.

## Kampdata fra football-data.org

API-nokkelen skal lagres som en Supabase Edge Function-secret, aldri i frontend
eller GitHub.

1. Regenerer football-data.org-nokkelen dersom den har blitt delt.
2. Kjor `supabase-football-data-setup.sql` i Supabase SQL Editor.
3. Opprett Edge Function med innholdet fra `supabase/functions/sync-world-cup/index.ts`.
4. Legg inn secret med navnet `FOOTBALL_DATA_API_KEY`.
5. Deploy funksjonen `sync-world-cup`.
6. Kall funksjonen mens du er innlogget som admin for a fylle `matches`.

## Lagring av tips

Kjor `supabase-predictions-setup.sql` i Supabase SQL Editor. Den oppretter
serverstyrt lagring og handhever begge fristene i databasen.

Daglig tipping speiler Full VM-tipset dersom brukeren ikke har lagt inn et eget
daglig tips. Ved dagsfristen kopieres manglende tips permanent til den daglige
konkurransen for backup og poengberegning.

Kjor `supabase-settings-setup.sql` for sikre profilinnstillinger. Den begrenser
brukere til a endre eget brukernavn, uten tilgang til adminflagget.

Kjor `supabase-profile-repair.sql` for a reparere Auth-brukere som mangler
profil, og for automatisk profilopprettelse ved fremtidige registreringer.

Kjor `supabase-admin-users-setup.sql` for ekte invitasjonskoder og en
adminbeskyttet oversikt over registrerte brukere. Filen validerer
invitasjonskoder, teller registreringer og begrenser lesing av e-postadresser
til brukeren selv og admin.

Kjor `supabase-test-users-setup.sql` for testbrukere som kun finnes i
adminomradet. Testbrukerne kan fa tilfeldige Full VM- og Daglig-tips, men
holdes helt utenfor ekte ligaer, poengtavler og backuper.
Deploy deretter den oppdaterte `sync-world-cup` Edge Function-koden, slik at
testbrukernes poeng ogsa beregnes etter kampdatasynkronisering.

Kjør `supabase-knockout-predictions-setup.sql` for å lagre sluttspilltips med
ordinær tid, ekstraomganger og straffespark. Deploy deretter både
`sync-world-cup` og `create-prediction-backup` på nytt. Synkroniseringen lagrer
ordinær tid separat slik at sluttspillkamper kan poengberegnes riktig.

## Ligaer og poengtavler

Kjor `supabase-leagues-setup.sql` i SQL Editor. Den aktiverer:

- opprettelse av offentlige eller private ligaer med automatisk generert kode
- innmelding i ligaer med kode
- utforsking og direkte innmelding i offentlige ligaer
- Full VM-poengtavle for hver liga
- daglig poengtavle per kampdato
- samlet daglig poengtavle gjennom hele VM
- tilgangskontroll slik at bare ligamedlemmer kan hente poengtavlen

Kjør `supabase-league-prediction-visibility-setup.sql` for å la ligamedlemmer
se hverandres tips etter relevant frist. Databasefunksjonen kontrollerer både
ligamedlemskap og frist før tipsene returneres.

Kjør `supabase-consent-and-top-scorer-setup.sql` for lagret toppscorertips og
e-postsamtykke. Det må i tillegg etableres en testet driftsprosedyre som
fjerner eller anonymiserer alle e-postadresser senest 26. juli 2026.

## Bonusspørsmål og spillerregister

Kjør disse filene i denne rekkefølgen:

1. `supabase-player-options-setup.sql`
2. `supabase-bonus-questions-2026-setup.sql`
3. `supabase-player-options-2026-seed.sql`
4. `supabase-scoreboards-2026-setup.sql`

Seed-filen er generert fra FIFAs offisielle troppsliste datert 10. juni 2026
og inneholder 48 lag og 1 248 spillere. Den kan kjøres flere ganger uten å
duplisere spillere. `tools/generate_player_seed.py` kan brukes til å generere
en ny seed når FIFA publiserer en oppdatert troppsliste.

Bonusspørsmålene er del av Full VM og bruker lagvalg, spillersøk, tallfelt og
ja/nei-valg. Gruppeplasseringer avledes fortsatt fra kamptipsene og vises ikke
som separate bonusfelt.

`supabase-scoreboards-2026-setup.sql` gjør Full VM-poengtavlen til summen av
kamppoeng og bonuspoeng. Den legger også til en I dag-visning som viser både
dagens poeng og samlet Daglig-poeng per ligamedlem.

Kjør `supabase-admin-statistics-setup.sql` for den adminbeskyttede
statistikkoversikten. Hovedkonkurransen holdes utenfor tallene for opprettede
ligaer og ligadeltakelse.

Kjør `supabase-league-descriptions-setup.sql` for valgfrie ligabeskrivelser.
Kun ligaeieren kan endre beskrivelsen etter at ligaen er opprettet.

Poengtavlene summerer feltet `points` i lagrede kamptips. Kampresultater ma
derfor poengberegnes etter synkronisering for at listene skal fa poeng. Den
oppdaterte Edge Function `sync-world-cup` beregner automatisk 3 poeng for
eksakt resultat og 1 poeng for riktig kamputfall etter synkronisering.

## Automatisk backup av alle tips

Ved hver frist lagres et uforanderlig snapshot av alle relevante tips i
`prediction_backups`. Samme snapshot sendes som CSV til admin.

1. Kjor `supabase-backup-setup.sql` i SQL Editor.
2. Deploy `supabase/functions/create-prediction-backup/index.ts` som
   `create-prediction-backup`.
3. Legg inn Edge Function-secrets:
   - `RESEND_API_KEY`
   - `BACKUP_EMAIL`
   - `BACKUP_CRON_SECRET`
   - valgfritt: `BACKUP_FROM_EMAIL`
4. Fyll inn placeholderne og kjor `supabase-backup-schedule.sql`.

`BACKUP_EMAIL` bør være e-postadressen som eier Resend-kontoen dersom
Resends testavsender `onboarding@resend.dev` brukes. Da trengs ikke eget domene.
