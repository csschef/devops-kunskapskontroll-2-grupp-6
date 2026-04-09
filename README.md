# DevOps Kunskapskontroll 2 - Grupp 6

## Projektbeskrivning

AISLE är en webbapplikation som hjälper användare att handla snabbare och mer effektivt. Användaren skapar en inköpslista och väljer sin butik - appen sorterar sedan listan automatiskt efter butikens gångordning, så att man handlar i rätt ordning utan att behöva gå fram och tillbaka. Butikslayouter skapas och delas av användarna själva via en inbyggd layout-editor.

## Länkar

- Vercel: https://devops-kunskapskontroll-2-grupp-6.vercel.app

## Ansvarsområden

| Namn | Ansvarsområden |
|------|----------------|
| Sebastian Valdemarsson | Layout-editor, design system (global.css), CI/CD-pipeline, databaspopulering, mockup |
| Viktor Lindqvist | Login, registrering, autentisering, auth-service, home-sidan |
| Hampus Andersson | Databas & infrastruktur, ER-diagram, SPA-router, create-list, shopping-list |
| Elsa | Profilsidan |

## Teknikstack

- Frontend: Vite + JavaScript
- Tester: Vitest + Playwright
- Linting: ESLint
- Databas/API: Supabase

## Struktur

- docs/: dokumentation (er-diagram, mockup, kravspec, todo, behovs- och marknadsanalys)
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