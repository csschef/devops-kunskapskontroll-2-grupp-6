# DevOps Kunskapskontroll 2 - Grupp 6

## Projektbeskrivning

Projektet utvecklar en smart inköpsapp som hjälper användaren att handla snabbare genom att sortera inköpslistan efter butikens faktiska gångordning. Lösningen bygger på crowdsourcad butikslayout och fokuserar på ett enkelt grundflöde: skapa lista, välj butik, få sorterad ordning och checka av varor. På sikt utökas appen med prediktiva förslag för återkommande inköp baserat på användarbeteende.

## Länkar

- Vercel: [Fyll i länk]
- Trello/Jira (valfritt): [Fyll i länk]

## Ansvarsområden

Detaljerad arbetsuppdelning finns i [WBS](docs/wbs.md).

## Teknikstack

- Frontend: Vite + JavaScript
- Tester: Vitest + Playwright
- Linting: ESLint
- Databas/API: Supabase (planerad)

## Struktur

- docs/: dokumentation (logg, WBS, analyser)
- src/: applikationskod
- tests/unit: enhetstester
- tests/integration: integrationstester
- tests/e2e: e2e-tester

## Kom igång

1. Installera beroenden:
   npm install
2. Starta utvecklingsserver:
   npm run dev
3. Bygg projektet:
   npm run build
4. Förhandsgranska build:
   npm run preview
5. Kör tester:
   npm test

## Script

- npm run dev
- npm run build
- npm run preview
- npm run lint
- npm test
- npm run test:e2e