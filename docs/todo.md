# Todo

## Sidor

**Framsida**
- Login prompt direkt man öppnar upp sidan (ej inloggad).
- Om man är inloggad kommer man till den riktiga framsidan.

Till "riktiga" framsidan:
- En "Välkommen (namn)" högst upp.
- En container med aktiva inköpslistor.
- En "skapa"-knapp som redirectar till en extern sida för skapande av ny inköpslista.
- En container för avslutade inköpslistor (ta 3 senaste typ).

**Skapa inköpslistan**
Layout: Val av butik --> Skapa butikslayout (om inte butikslayout finns redan, annars gå till nästa direkt) --> Skapa inköpslistan (uppsatt layout för butik)

**Val av butik**
- Auto complete sök för butik. Sök på stad eller butiksnamn för att få upp vilken butik du vill välja. (sökfält)
- Sina senaste butikslayouter man har använt listas i en container nedanför sökrutan.
- Man ska kunna klicka på "använd" på dessa butikslayouter man redan har använt och skickas då direkt till "skapa inköpslistan".
- I sökrutans svar (dropdown) bör det stå exempelvis "Vi fann inga alternativ för din sökning, vill du skapa en butikslayout för butiken eller vill du använda en standard layout?". Behöver absolut inte stå så här, men tänket iaf.
- Söker man på en butik och stad så bör man få upp alla butikslayouter för denna, som har skapats av användare. Dessa svar/alternativ ska rangordnas på totala användare som använder butikslayouten (föredraget kanske att man tar antalet inköpslistor som använder butikslayouten - max 1 per användare). Sin egenskapade layout för butiken bör vara högst upp, därefter alternativen från andra användare. - Alltid möjligheten till att skapa egen.
- **Flöde:** Du söker efter en butik, du skapar en butikslayout om den inte finns (skickas då till butikslayout sidan för skapande), därefter skickas du in i inköpslistan (där är både skapande och visande samma sida).

**Skapa/redigera butikslayout**
- Instruktion, kanske en collapsible div box så den inte behöver ta upp all plats på skärmen.
- Namn i butiken i en input till vänster och en input med stadsnamn till höger.
- Lista med alla sektioner/kategorier. En aktiv lista och en inaktiv, så man kan dra in något som kanske inte finns i butiken i den inaktiva listan. (exempelvis har inte alla butiker en chark)
- Spara knapp längst ner.

**Inköpslista**
- Använder den layouten för butiken som redan är uppsatt.
- Inköpslistans namn högst upp (ändringsbart, default ska vara butikens namn och stad). Sätt en ikon på en penna bredvid namnet så man vet att den är ändringsbar. Bör vara ändringsbar så fort man klickar på texten.
- Byt butik-knapp (lite mindre, så den inte tar över).
- En sökruta där man söker efter varor. Klickar man på varan så läggs den till i listan. När man har valt produkt, så bör fokuset på sökrutan komma tillbaka så man bara kan skriva och klicka enter. Snabbt och enkelt.
- En container under sökrutan som visar förslag på varor man oftast använder (visa exempelvis de 10 vanligaste och klickar man bort eller väljer ett alternativ så så fylls listan på med nästa på tur). Dessa alternativ ska kunna klickas bort, men även vara en lista som är collapsible (default: synlig). Har man inga produkter eller att man har klickat bort alla produkter så bör listan och containern försvinna helt från sidan så den inte tar onödig plats.
- En container under förslags-containern som visar alla dina valda produkter, som automatiskt mappas utifrån kategori på produkten och butikslayouten. Längst ner i denna listan ska det finnas en "Diverse"-kategori som man själv kan skriva in artiklar som inte finns i vår databas, så som tv-apparater, kläder osv som vissa enskilda butiker kanske har.
- När varan läggs till i listan så bör den populeras med en checkbox och en soptunna. Produkten bör också vara klickbar, så man kan lägga till en anteckning (exempelvis hur mycket man ska köpa av varan).
- Spara automatiskt efter varje ändring.

**Min profil**
- Längst upp ha namn, email (persondata liksom). Lägg även till en logga ut knapp.
- "Mina butikslayouter" i en container. - Redigerbara
- "Mina inköpslistor" i en container. - Redigerbara