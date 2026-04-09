# Kravspecifikation - AISLE

## Syfte

AISLE är en webbapplikation som hjälper användare att handla snabbare och mer effektivt. Appen sorterar inköpslistan automatiskt efter butikens gångordning, baserat på crowdsourcade butikslayouter skapade av användarna själva.

---

## Funktionella krav

### Autentisering

- Användaren ska kunna registrera ett konto med e-post och lösenord
- Användaren ska kunna logga in och logga ut
- Skyddade sidor ska kräva inloggning; ej inloggad användare omdirigeras till login
- Sessionshantering sköts via Supabase Auth

### Startsida (Home)

- Inloggad användare ska mötas av en startsida med navigation till appens funktioner
- Sidan ska ge en snabb överblick och tydlig ingångspunkt

### Skapa inköpslista (Create List)

- Användaren ska kunna skapa en ny inköpslista
- Användaren ska kunna söka efter och lägga till produkter/varor i listan
- Produkter ska vara kopplade till butikskategorier (sektioner)

### Inköpslista (Shopping List)

- Användaren ska kunna se sin aktiva inköpslista sorterad efter butikens gångordning
- Varor ska kunna bockas av under pågående handling
- Sorteringen baseras på användarens valda butikslayout

### Layout-editor

- Användaren ska kunna skapa en butikslayout för en specifik butik och stad
- Layouten bygger på sektioner som dras i rätt ordning (drag-and-drop)
- Drag-and-drop ska fungera på både desktop (mus) och mobil (touch)
- Användaren ska kunna uppdatera en befintlig layout
- Systemet ska detektera om en layout redan finns för given butik och stad
- Det ska inte gå att spara en tom layout
- Sparaknappen ska bara visas när det finns osparade ändringar

### Profilsida

- Inloggad användare ska kunna se sitt konto och sina sparade butikslayouter samt sina shoppinglistor.
- Användaren ska kunna navigera till layout-editorn för att redigera en befintlig layout

---

## Icke-funktionella krav

### Prestanda

- Sidan ska laddas och vara interaktiv inom rimlig tid på vanlig mobil uppkoppling
- Drag-and-drop ska vara snabb och responsiv utan fördröjning

### Responsivitet

- Applikationen ska fungera väl på både mobil och desktop
- Layout och navigering ska anpassas efter skärmstorlek

### Tillgänglighet

- Interaktiva element ska ha tydliga `aria`-attribut och etiketter
- Formulärfält ska ha kopplade `<label>`-element
- Statusmeddelanden ska använda `aria-live` för skärmläsare

### Säkerhet

- Autentisering och dataaccess hanteras via Supabase med Row Level Security (RLS)
- Känsliga nycklar ska hanteras via miljövariabler, aldrig i källkod

### Kodkvalitet

- Koden ska klara linting (ESLint) utan fel
- Enhetstester och integrationstester ska finnas och köras i CI
- E2e-tester ska verifiera autentiseringsflödet

---

## Tekniska krav

| Område | Teknik |
|--------|--------|
| Frontend | Vite + Vanilla JavaScript |
| Stilmall | Vanilla CSS med CSS-variabler |
| Databas/API | Supabase (PostgreSQL + Auth) |
| Hosting | Vercel |
| Tester | Vitest (unit/integration), Playwright (e2e) |
| Linting | ESLint |
| CI/CD | GitHub Actions |

---

## Sidor och routing

| Sökväg | Sida | Autentisering krävs |
|--------|------|---------------------|
| `/` | Startsida (Home) | Ja |
| `/login` | Inloggning | Nej |
| `/register` | Registrering | Nej |
| `/create-list` | Skapa inköpslista | Ja |
| `/shopping-list` | Aktiv inköpslista | Ja |
| `/layout-editor` | Skapa/redigera butikslayout | Ja |
| `/profile` | Profil och mina layouter | Ja |
