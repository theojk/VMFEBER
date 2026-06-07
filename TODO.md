# VM FEBER - TODO

## Administrasjon og brukere

- [ ] Lag en adminoversikt over alle registrerte brukere.
  - Vis brukernavn, e-post, registreringsdato og registreringskilde/invitasjonskode.
  - Vis hvilke ligaer brukeren er medlem av.
  - Vis antall lagrede tips i Full VM og Daglig.
  - Vis tidspunkt for siste aktivitet dersom dette kan registreres uten unødvendig sporing.
  - Gjør oversikten tilgjengelig kun for admin og hent data gjennom en
    tilgangskontrollert databasefunksjon.

- [ ] La admin opprette og administrere testbrukere.
  - Testbrukere skal merkes tydelig som testbrukere i adminoversikten.
  - Testbrukere og tipsene deres skal kun være synlige for admin.
  - Skjul testbrukere fra hovedkonkurransen, private ligamedlemslister og alle
    poengtavler som vanlige brukere kan se.
  - Ikke ta testbrukere med i vanlig deltakerstatistikk eller e-postbackuper.
  - La admin legge inn, endre og slette testbrukernes tips uten magic-link-login.
  - Krev bekreftelse før en testbruker og tilhorende tips slettes.

## Poengtavler og tipsinnsyn

- [ ] La ligamedlemmer klikke på en bruker i poengtavlen for å se brukerens tips
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

- [ ] Legg til hurtigvalg: **Jeg stoler på skjebnen**.
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
