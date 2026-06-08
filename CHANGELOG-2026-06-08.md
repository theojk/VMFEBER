# Sluttspillfordeling 8. juni 2026

## Forbedret

- Brukerflaten har fått et nytt turneringsstudio-uttrykk med sterkere norsk
  identitet, mørk stadionnavigasjon og tydeligere visuelt hierarki.
- Oversikten har fått en mer engasjerende hovedflate, kraftigere statuskort og
  tydeligere handlingsknapp.
- Kampkort, resultatfelt, sluttspill, ligaer og poengtavler har fått mer
  særpreg og bedre lesbarhet.
- Mobilvisningen har fått kompaktere statuskort og tydeligere kampkort uten å
  endre tipsflyten.
- Rettet en CSS-kaskadekonflikt som kunne gi desktop-kolonner og synlig
  sidepanel på mobil etter designoverhalingen.
- Gruppetabellene bruker nå to kolonner på brede desktopskjermer og én kolonne
  før statistikkfeltene blir for smale. Kolonnebredder og typografi er
  komprimert uten å skjule kampstatistikken.
- Mobil har fått en tydelig **Logg inn for å tippe**-knapp som åpner
  innloggingspanelet.
- Magic-link-beskjeden forklarer at e-posten kommer fra Supabase og kan havne
  i søppelpost/spam.
- Registrering krever eksplisitt e-postsamtykke og forklarer at adressen kun
  brukes til konkurransen og slettes senest én uke etter VM.
- En ny regelfane forklarer forskjellen mellom Full VM og Daglig, inkludert at
  Daglig har en egen full sammenlagttabell.
- Toppscorertips kan nå lagres og lastes inn igjen som del av Full VM.
- De åtte beste projiserte tredjeplassene får nå hver sin eksakte
  16-delsfinale.
- Fordelingen bruker alle de 495 offisielle kombinasjonene fra Annex C i
  reglementet for FIFA World Cup 2026.
- Projiserte vinnere kan dermed føres videre gjennom et reelt sluttspill uten
  kandidatlisten med flere mulige tredjeplasser.
- Ekstraomgangsfelt skjules og tømmes straks ordinært resultat ikke lenger er
  uavgjort.
- Straffesparkfelt skjules og tømmes straks stillingen etter 120 minutter ikke
  lenger er uavgjort.
- Hurtigutfylling oppdaterer nå sluttspillfeltene også når et tidligere
  uavgjort tips erstattes med seier til ett av lagene.
- Ligamedlemmer kan klikke på brukere i poengtavlen og se tips, kampresultat
  og poeng etter relevant frist.
- Tipsinnsyn kontrolleres i databasen og krever medlemskap i samme valgte liga.

## Begrensning

- Dersom projiserte tredjeplasser er helt like på poeng, målforskjell og
  scorede mål, bruker appen grupperekkefølge som stabil simulert avgjørelse.
  Kortpoeng og historisk FIFA-ranking kan ikke utledes fra brukernes tips.

## Verifisering

- Alle 495 kombinasjoner er kontrollert.
- Hver kombinasjon bruker åtte forskjellige kvalifiserte grupper.
- Hver tredjeplass er kontrollert mot de tillatte motstanderne i kampoppsettet.
- JavaScript-syntaks er kontrollert.
