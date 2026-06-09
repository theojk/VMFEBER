# VM FEBER - TODO

## Før videre produktarbeid

- [ ] Bekreft hvilke av de nyeste migrasjonene som er kjørt i Supabase.
- [ ] Bekreft at alle nyeste frontendfiler er lastet opp til GitHub og publisert
  av Vercel.
- [ ] Gjennomfør funksjonstesten i `MORNING-CHECKLIST.md`.
- [ ] Verifiser testbrukerstøtten i produksjon.

## Administrasjon og brukere

- [ ] Etabler og test sletting/anonymisering av alle e-postadresser senest
  26. juli 2026, én uke etter VM-finalen.
  - Fjern adressene både fra Supabase Auth og profiler uten å slette nødvendig
    konkurransehistorikk.
  - Dokumenter og test prosedyren før turneringen starter.
  - Send bare konkurranserelatert e-post til brukere med lagret samtykke.

- [x] Lag en adminoversikt over alle registrerte brukere.
  - Vis brukernavn, e-post, registreringsdato og registreringskilde/invitasjonskode.
  - Vis hvilke ligaer brukeren er medlem av.
  - Vis antall lagrede tips i Full VM og Daglig.
  - Vis tidspunkt for siste aktivitet dersom dette kan registreres uten unødvendig sporing.
  - Gjør oversikten tilgjengelig kun for admin og hent data gjennom en
    tilgangskontrollert databasefunksjon.

- [x] La admin opprette og administrere testbrukere.
  - Testbrukere skal merkes tydelig som testbrukere i adminoversikten.
  - Testbrukere og tipsene deres skal kun være synlige for admin.
  - Skjul testbrukere fra hovedkonkurransen, private ligamedlemslister og alle
    poengtavler som vanlige brukere kan se.
  - Ikke ta testbrukere med i vanlig deltakerstatistikk eller e-postbackuper.
  - La admin legge inn, endre og slette testbrukernes tips uten magic-link-login.
  - Krev bekreftelse før en testbruker og tilhorende tips slettes.

## Poengtavler og tipsinnsyn

- [ ] Bestem endelig poengregel for sluttspill.
  - Ordinært kampresultat sammenlignes nå med stillingen etter 90 minutter.
  - Avklar om riktig lag videre etter ekstraomganger eller straffespark også
    skal gi egne poeng.
  - Avklar om korrekt resultat etter 120 minutter eller straffespark skal gi
    bonuspoeng.

- [x] La ligamedlemmer klikke på en bruker i poengtavlen for å se brukerens tips
  og opptjente poeng.
  - Vis kun tips til andre brukere etter at fristen for den relevante
    konkurransen eller kampdagen har utløpt.
  - For Daglig tipping: vis dagens tips etter kl. 12:00 norsk tid, også før
    kampene er ferdigspilt.
  - For Full VM: vis tipsene etter den samlede Full VM-fristen.
  - Vis kampresultat, brukerens tips og tildelte poeng på hver kamp.
  - Forklar poengene tydelig: eksakt resultat, riktig kamputfall eller ingen
    poeng.
  - Stott filtrering mellom Full VM, Daglig totalt og en bestemt kampdato.
  - Brukere skal bare kunne åpne profiler til medlemmer i ligaer de selv er
    medlem av.
  - Testbrukere og testbrukernes tips skal fortsatt kun være synlige for admin.

## Kampoppsett

- [x] Vis kampfase og projisert vei gjennom sluttspillet.
  - Merk gruppespillkampene med gruppe og runde 1, 2 eller 3.
  - Merk sluttspillkampene med 16-delsfinale, åttedelsfinale, kvartfinale,
    semifinale, bronsefinale eller finale.
  - Vis hvilke gruppeplasseringer som går inn i hver sluttspillkamp.
  - Bytt gruppeplasseringene til projiserte lagnavn og behold kvalifiseringsveien
    når gruppetipsene er komplette.

- [x] Implementer FIFAs kombinasjonstabell for å plassere de åtte beste
  tredjeplassene eksakt i 16-delsfinalene.

- [x] Avgjør uavgjorte sluttspilltips med ekstraomganger og eventuelle
  straffespark, slik at projisert vinner kan føres videre.

- [x] Legg til hurtigvalg: **Jeg stoler på skjebnen**.
  - Fyll automatisk inn resultatet for alle synlige og ulåste kamper.
  - Trekk hjemme- og bortemål uavhengig som tilfeldige heltall mellom 0 og 4.
  - Skal fungere separat for både Full VM og Daglig tipping.
  - Vis de tilfeldige tipsene før lagring. Brukeren må selv trykke lagre.
  - Knappen skal kunne brukes på nytt for å trekke nye tilfeldige resultater.
  - Be om bekreftelse før eksisterende, ulagrede tips overskrives.
  - Nyttig både som enkel hurtigutfylling og ved testing av mange tips.

- [ ] Vis hvor hver kamp sendes i Norge, for eksempel `NRK1`, `NRK TV`,
  `TV 2 Direkte`, `TV 2 Sport 1` eller `TV 2 Play`.
  - Vis kanal ved siden av kampstart i kampoppsettet.
  - Stott flere kanaler/plattformer per kamp.
  - Kanaldata ma kunne korrigeres manuelt av admin.
  - Ikke vis ubekreftet kanal som fakta.

### Undersokte datakilder

- **NRK EPG API:** NRK har en dokumentert programguide:
  `https://psapi.nrk.no/tv/epg/{channelIds}?date=YYYY-MM-DD`.
  Den dekker NRKs egne kanaler, men kampene ma matches mot programtitler.
  NRKs publiserte EPG-vilkar sier at bruk av metadata normalt skal skje etter
  avtale med NRK. Avklar vilkar for bruk for integrasjon.
- **TV 2:** Ingen offentlig dokumentert TV 2-programguide-API funnet. Ikke bygg
  mot en intern eller uoffisiell TV 2-endpoint uten tillatelse.
- **Sportmonks:** Har et dokumentert `TV Stations by Fixture ID`-endepunkt.
  Verifiser at VM 2026 og norske kanaler er dekket, samt pris, for integrasjon.
- **SoccersAPI:** Har broadcast schedule og TV-kanaler. Broadcast-planen er
  oppgitt fra EUR 60 per maned. Verifiser norsk VM-dekning i en proveperiode.

### Anbefalt losning

Start med feltene `broadcaster`, `channel` og `streaming_service` pa kampene,
med manuell administrasjon. Dette er billig og palitelig for 104 kamper. Legg
til automatisk synkronisering senere dersom Sportmonks eller en annen tilbyder
kan dokumentere komplett norsk VM-dekning.
