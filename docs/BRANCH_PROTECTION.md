# Required checks før featurekode merges

Når repositoryet kobles til GitHub, skal default branch beskyttes med minst:

- `npm run lint`
- `npm run architecture`
- `npm run secret:scan`
- `npm run build`
- `npm run test:compiled`

Direkte push til default branch skal blokkeres. Minst én menneskelig review skal kreves for brukerrettet tekst, lydpolicy eller Human-First-kontrakt.

Denne filen oppretter ikke server-side branch protection; den fastsetter bootstrapkravet som må aktiveres ved tilkobling.
