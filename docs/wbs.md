# WBS - Grupp 6

## Syfte

Detta dokument delar upp projektets obligatoriska arbete enligt uppgiftsbeskrivningen.
Ansvariga fylls i efter intern fördelning i gruppen.

## Tider och inlämning

- Redovisning: Fredag 10/4 kl 08:00
- Deadline: Fredag 10/4 kl 23:59
- Inlämning: Public GitHub-repo, länk skickas via ItsLearning

## Krav att uppfylla

- CI/CD med GitHub Actions och Vercel
- GitHub Rulesets
- Tester: Unit, Integration, e2e (minst 1 test per sort och per deltagare.)
- Versionshantering med PR och Code Review
- Postgres med Supabase
- API-anrop
- Frontend

## Work Breakdown Structure

| ID | Område | Deluppgift | Leverabel | Ansvarig |
|---|---|---|---|---|
| 1 | Projektsetup | Repo-struktur med dokumentation och kodmappar | Organiserat projektrepo | Alla |
| 1.1 | Projektsetup | Lägg in behovsanalys i repo | Dokument tillgängligt i repot | Sebbe |
| 1.2 | Projektsetup | Lägg in mockups/övriga bilagor vid behov | Filer tillgängliga i repot | Alla |
| 1.3 | Projektsetup | Uppdatera README med ansvarsområden, Vercel-länk och ev. Trello-länk | Komplett README | Alla |
| 2 | Frontend bas | Grundstruktur i index.html | Startstruktur för appen | Sebbe |
| 2.1 | Frontend bas | Gemensam CSS-bas | Basstilar och layout | Sebbe |
| 3 | Sidlogik | Skapa en JS-fil per sida för rendering | Separata JS-filer per sida | Hampus |
| 3.1 | Sidlogik | Fördela sidor mellan gruppmedlemmar | Dokumenterad fördelning | Alla |
| 3.2 | Sidlogik | Varje medlem bygger minst en sida med API-anrop | Färdiga sidor med datahämtning | Alla |
| 4 | Databas | ER-diagram för nödvändiga tabeller | ER-diagram i repo | Hampus |
| 4.1 | Databas | Skapa Supabase DB med minst 5 tabeller och relationer | DB-struktur i Supabase | Hampus |
| 4.2 | Databas | Konfigurera Supabase API-åtkomst | Verifierade API-endpoints | Hampus |
| 5 | CI/CD och kvalitet | GitHub Actions CI enligt guide | Grön pipeline i GitHub Actions | Sebbe |
| 5.1 | CI/CD och kvalitet | Vercel deployment (CD) | Publik deployad app | Sebbe |
| 5.2 | CI/CD och kvalitet | GitHub rulesets | Aktiva branch/PR-regler | Sebbe |
| 6 | Tester | Unit-test per medlems del | Minst 1 unit-test per medlem | Alla |
| 6.1 | Tester | Integrationstest per medlems del | Minst 1 integrationstest per medlem | Alla |
| 6.2 | Tester | e2e-test per medlems del | Minst 1 e2e-test per medlem | Alla |
| 7 | Versionshantering | Arbete via feature branches, PR och code review | Samtliga ändringar via PR | Alla |
| 8 | Slutleverans | Kontrollera inlämningskrav och skicka repo-länk | Inlämning i tid | Alla |

## Milstolpar

| Milstolpe | Innehåll | Deadline | Klar |
|---|---|---|---|
| M1 | Setup, README och frontend-bas (index + CSS) | [Datum] | [ ] |
| M2 | ER-diagram + Supabase DB + API-atkomst | [Datum] | [ ] |
| M3 | Sidor med API-anrop + tester (unit/integration/e2e) | [Datum] | [ ] |
| M4 | CI/CD, rulesets, PR-review och slutkontroll | 10/4 23:59 | [ ] |

## Kommentarer

- Ansvar för JS-filer per sida fördelas senare av gruppen.
