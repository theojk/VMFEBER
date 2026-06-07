# VM FEBER

Første lokale prototype for en norsk VM-tippeside.

## Hva som finnes nå

- Mobilvennlig webapp som kan åpnes direkte i nettleser
- Demo av magic-link-innlogging
- To konkurranseformer:
  - Full VM-konkurranse med samlet frist før turneringsstart
  - Daglig konkurranse med frist kl. 12:00 norsk tid
- Private ligaer med kode
- Poengtavler som bare vises for ligaer brukeren er medlem av
- Enkel adminskisse for invitasjoner og resultater

## Neste naturlige steg

1. Koble på Supabase for ekte magic-link-login.
2. Lage database for brukere, ligaer, kamper, tips, resultater og poeng.
3. Bestemme endelige poengregler.
4. Publisere på Vercel med gratis nettadresse.

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
