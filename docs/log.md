# Grupp 6

## Uppstart med gruppen

*2026-03-31*

## Projektförslag baserat på marknadsanalys med ChatGPT

### Promptsektion (från problem till lösning)

**Prompt 1:** Beskriv problemet och grundidén

Utgångspunkt: handling i butik tar onödigt lång tid när inköpslistor är oorganiserade och inte följer butikens faktiska flöde. Idén är en app där användaren väljer butik, skriver in varor och får listan sorterad efter gångordning i butiken.

**Prompt 2:** Verifiera behovet

Analysera marknadsbehovet och undersök om problemet är återkommande i användarbeteenden och diskussioner.

**Prompt 3:** Kontrollera förutsättningar i butik

Undersök hur lika eller olika butikslayouter är mellan städer och butiker inom samma kedja.

**Prompt 4:** Hantera beroenden till butiker

Om butikssamarbeten är svåra i startfasen, flytta layoutarbetet till användarna med crowdsourcad struktur: byggt av användare för användare.

**Prompt 5:** Kvantifiera potentialen

Gör en grundanalys av problemets storlek: målgrupp, uppskattad tidsbesparing per vecka och möjlig betalningsvilja per månad.

**Prompt 6:** Definiera intelligent funktion

Lägg till en kommande funktion för beteendebaserad inlärning som föreslår återkommande varor på rätt plats i listan.

**Prompt 7:** Sammanfatta helheten

Ta fram en uppdaterad sammanfattning av idén med ovanstående förutsättningar.

### Från idé till utförande

1. Problemdefinition

Vi utgår från ett tydligt vardagsproblem: ineffektiv handling på grund av osorterade listor.

2. Marknadsvalidering

Vi verifierar att problemet är frekvent och upplevs av många användare.

3. Lösningsdesign

Vi definierar kärnprodukten: butikssorterad lista, crowdsourcad layout och prediktiva förslag.

4. Genomförbarhet

Vi minskar externa beroenden genom att börja B2C och låta användare bidra med layoutdata.

5. MVP-fokus

Vi prioriterar snabb nytta: skapa lista, välj butik, få sorterad ordning, checka av varor.

6. Iterativ utveckling

Vi lägger till smart inlärning efter grundflödet och förbättrar förslag utifrån faktisk användning.

### Idé (kort och tydligt)

En app som:

- låter användaren skriva en inköpslista
- sorterar varorna efter hur man faktiskt går i en specifik butik
- använder crowdsourcad butikslayout i stället för att kräva butikssamarbeten
- lär sig vad användaren brukar köpa och föreslår automatiskt återkommande varor

Positionering:

"En inköpslista som vet vad du behöver och visar rätt väg genom butiken."

### Marknadsläge

#### Problemet finns

- Folk handlar 1-2 gånger per vecka.
- 5-10 minuter per vecka slösas på ineffektivitet.
- Folk glömmer regelbundet varor de brukar köpa.
- Detta bekräftas tydligt i beteenden, till exempel egna organiserade listor och återkommande inköp.

Problemtyp:

- Frekvent
- Låg intensitet
- Hög irritation över tid
- Innehåller både fysisk ineffektivitet och mental belastning

#### Konkurrens

- Många listappar finns redan (Bring!, AnyList med flera).
- Vissa har enklare kategorisortering.

Men:

- ingen dominerar
- ingen kombinerar butikssortering, automatisering och beteendebaserade förslag

Marknaden är mättad på "listor", men inte på intelligenta lösningar.

### Potential

#### Storlek

- Sverige: cirka 1-1,5 miljoner relevanta användare
- Globalt: hundratals miljoner

#### Intäkt

- Realistiskt pris: 29-59 kr/mån
- Kan bli ett bra sidoprojekt (10k-100k/mån)
- Kan också bli en liten startup (1-3 MSEK/år)

#### Styrkor

- Veckovis användning ger hög retention
- Historik gör att produkten blir bättre över tid
- Enkel value proposition gör produkten lätt att förstå
- Prediktiva förslag ökar beroende

Switching cost ökar ju längre användaren stannar.

### Hinder och möjliga lösningar

1. Låg betalningsvilja

"Det är bara en inköpslista."

Lösning:

- tjänsten måste kännas magiskt smidig
- värdet måste visas direkt

2. Setup-friktion

Om användaren måste konfigurera för mycket dör användningen direkt.

Lösning:

- default-inställningar + snabb justering + crowdsourcing

3. Dataproblemet

- svårt att veta var produkter finns
- layout varierar mellan butiker

Lösning:

- kategorier + användardata (inte perfektion)

4. Butikerna

- har inget incitament att hjälpa till
- vill ofta ha ineffektiva flöden

Lösning:

- ignorera dem i början (B2C)

5. Cold start

Ingen historik innebär inga förslag i början.

Lösning:

- populära standardvaror
- enkla snabbval
- snabb inlärning under de första veckorna

### Svårigheter (det som faktiskt är svårt)

1. Produkt -> kategori -> zon

Exempel som "kikärtor", "proteinpudding" och "tortillabröd" måste mappas rätt utan att användaren behöver tänka.

Detta är kärnproblemet.

2. UX

- måste fungera direkt
- ingen onboarding-friktion
- måste kännas snabbare än Apple Notes
- smarta förslag får inte kännas påträngande

3. Prediction engine

- måste vara enkel men träffsäker
- timing är viktigare än avancerad AI
- fel förslag minskar förtroende snabbt

Detta är er differentiator.

4. Retention

Användaren ska känna: "Appen vet redan vad som behövs."

### Strategisk verklighet

Detta är inte:

- en unik idé
- en billion dollar-unicorn direkt

Detta är:

- ett tydligt problem
- en produkt som kan bli riktigt bra
- en execution-driven idé
- en potentiell vanebaserad assistent

### Slutbedömning

- Idé: 8/10 (starkare tack vare prediktiv funktion)
- Marknad: 8/10 (stor och med tydligt behov)
- Potential: 8/10 (bra indieprojekt till liten startup)
- Svårighet: 9/10 (svårt att göra riktigt bra)

### Viktigaste insikten

Framgången avgörs inte av idén, utan av hur lite användaren behöver tänka.

### Rekommendation

Detta är:

- värt att bygga som projekt
- värt att testa på riktigt
- starkare än den ursprungliga versionen
- fortfarande starkt beroende av riktigt bra UX

### Kärnan i produkten

En personlig inköpsassistent som lär sig beteenden över tid.

## Generell diskussion

- API finns för olika livsmedelsingredienser så att vi kan läsa in dem.
- Vi mappar ingredienserna efter olika butikssektioner.
- Användaren kan välja att dela sin plats och få förslag på butiker.

## Sidor

- Enkel startsida: Välkommen
- En sida för att skapa butikslayout
- En detaljsida med inköpslista (unikt ID för snabb delning inom familjen och för att kunna kringgå inloggning)
- Infosida med syfte samt kontakt/buggrapportering
- En sida för återkommande varor, med valmöjlighet att låta dem finnas med vid varje handling (när ska listan populeras?)