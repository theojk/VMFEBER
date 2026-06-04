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
