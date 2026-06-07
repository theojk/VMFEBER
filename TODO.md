# VM FEBER - TODO

## Kampoppsett

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

