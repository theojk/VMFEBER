# Kvalitetsrunde 7. juni 2026

## Rettet

- Sluttspillkampene kan avgjøres etter ekstraomganger og straffespark.
- Projisert vinner føres videre gjennom hele sluttspillet.
- Sluttspillkampene i kampoppsettet viser projiserte lag og kvalifiseringsvei.
- Masse-lagring melder tydelig fra dersom enkelte sluttspilltips er ugyldige.
- Hurtigutfylling lager gyldige sluttspillavgjørelser.
- Stillingen etter 120 minutter kan ikke være lavere enn etter 90 minutter.
- Mørk modus har fått tydeligere tekst, datoer, etiketter og knapper.
- Små trykkflater er økt og tastaturfokus er gjort tydelig.
- Prototype-tekst om demo-innlogging er fjernet.

## Datakvalitet

- Kampresultat etter ordinær tid lagres separat fra ekstraomganger og
  straffespark.
- Poengberegningen kan dermed bruke korrekt 90-minuttersresultat også i
  sluttspillkamper.
- Backup-snapshot og CSV inkluderer ordinær tid, ekstraomganger og straffespark.

## Dokumentasjon

- `PROJECT-STATUS.md` oppsummerer arkitektur, funksjoner og begrensninger.
- `MORNING-CHECKLIST.md` gir eksakt utrullings- og testrekkefølge.
- `TODO.md` beskriver åpne beslutninger om sluttspillpoeng og tredjeplasser.

## Verifisering

- JavaScript-syntaks kontrollert.
- Balanserte HTML-elementer og CSS-klammeparenteser kontrollert.
- Ingen dupliserte HTML-ID-er.
- Ingen kjente hemmelige nøkler funnet i prosjektfilene.
- Visuell nettlesertest kunne ikke kjøres fordi den lokale nettlesersandkassen
  ikke startet. Produksjonstesten i `MORNING-CHECKLIST.md` bør derfor følges.

