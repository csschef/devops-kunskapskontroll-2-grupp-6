# DevOps Kunskapskontroll 2 - Grupp 6

## Gruppmedlemmar

[Sebastian](https://github.com/csschef)  
[Viktor](https://github.com/LifeGoal)  
[Hampus](https://github.com/HampusAndersson01)  
[Elsa](https://github.com/ElsaBacklund)  

## Uppgiftsbeskrivning

I denna uppgift arbetade vi i grupp med att ta fram ett fullstack-projekt där vi tillämpade DevOps-principer och integrerade flera av de tekniker vi lärt oss under kursen. Arbetet inleddes med en behovsanalys där vi identifierade ett relevant samhällsproblem och undersökte målgruppens behov, gärna med hjälp av AI och sociala medier. Vidare hade vi möjlighet att göra en marknadsanalys för att förstå konkurrens och betalvilja.

Utvecklingsfasen omfattade allt från att ta fram en kravspecifikation och skapa ett ER-diagram till att bygga upp en Postgres-databas i Supabase, som exponerades via ett API. Vi satte upp CI/CD-flöden med GitHub Actions och Vercel, och införde regler för kodgranskning och pull requests för att säkerställa kvalitet och samarbete. Testning var en central del, där vi implementerade både enhets-, integrations- och end-to-end-tester. Varje gruppmedlem ansvarade för minst en sida i applikationen, inklusive tillhörande API-anrop och tester.

## Projektbeskrivning

AISLE är en webbapplikation som hjälper användare att handla snabbare och mer effektivt. Användaren skapar en inköpslista och väljer sin butik - appen sorterar sedan listan automatiskt efter butikens gångordning, så att man handlar i rätt ordning utan att behöva gå fram och tillbaka. Butikslayouter skapas och delas av användarna själva via en inbyggd layout-editor.

## Länkar

- Vercel: https://devops-kunskapskontroll-2-grupp-6.vercel.app

## Ansvarsområden

| Namn | Ansvarsområden |
|------|----------------|
| Sebastian | Layout-editor, design system (global.css), CI/CD-pipeline, databaspopulering, mockup |
| Viktor | Login, registrering, autentisering, auth-service, home-sidan |
| Hampus | Databas & infrastruktur, ER-diagram, SPA-router, create-list, shopping-list |
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