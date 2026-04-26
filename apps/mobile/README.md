# Mobile

Native app til eleverne. Foerste flow er invitekode, profiloprettelse med
skolevalg, samtykke, adgangskode og overblik med klasseinfo, nedtaelling og
elevdata.

Profiloprettelse indeholder skole fra API-dropdown, fornavn/mellemnavne,
efternavn, email, foedselsdag, valgfri telefon og valgfrit profilbillede via
`expo-image-picker`. Backend afviser join, hvis den valgte skole ikke matcher
klassen bag invitekoden. Email fungerer som login-navn, og adgangskoden gemmes
hashet i Laravel.

Brugeren skal acceptere vilkaar og privatlivspolitik ved oprettelse. Backend
gemmer samtykket med version, saa appen bygges med App Store-godkendelse for
oeje fra starten.

Hver profil har en personlig Studos-kode, som vises paa Overblik og senere kan
bruges til at connecte med en enkelt person fra en anden klasse. Under
`Andre klasser` ligger `Connections`, hvor man kan sende request via Studos-kode
og acceptere/afvise indgaaende requests.

Appen gemmer sessionen i `expo-secure-store`, saa en oprettet profil aabner
direkte paa overblik naeste gang. Ny telefon/ny installation kan bruge
eksisterende profil-flowet med invitekode, email og adgangskode.

Efter login har appen en topbar med skole/klasse, side-menu med sektionerne
`Din klasse` og `Andre klasser`, samt fast footernavigation mellem:

- Kalender
- Chat
- Overblik
- Wallet
- Walls

## App-shell og navigation

Topbaren viser menu, skole, klasse og Studos-wordmark. Menu-ikonet er bygget af
simple React Native views, saa linjeafstand og placering kan styres stabilt i
stedet for at vaere bundet til et ikonfont-symbol.

Sidebaren er kompakt og ikke-scrollende. `Mit crew` ligger som en separat
top-entry med ikon, label, medlemstal og pil yderst til hoejre. Resten af
sidebaren er delt op i `Din klasse` og `Andre klasser`, med `Indstillinger` og
`Min profil` nederst.

Sidebar-ikonerne bruger en fast Studos-palette:

- Lyseblaa: `#75DED0`
- Gul: `#FFD46D`
- Roed: `#FF6F73`
- Moerk: `#172143`

Flerfarvede ikoner bygges som simple `View`-kompositioner i en fast ramme,
ikke som svaere SVG'er. Det goer dem nemmere at justere og holde stabile i
React Native.

## Start

Installer dependencies fra projektroden:

```bash
npm install
```

Start derefter Expo:

```bash
npm run mobile:start
```

Projektet er sat op til Expo SDK 55.

Appen kalder som standard Laravel API'et under:

```text
http://localhost/studenter-app/public/api
```

Ved fysisk iPhone kan API-url overrides ved build/start:

```bash
EXPO_PUBLIC_API_URL=http://DIN-MAC.local/studenter-app/public/api npm run mobile:start
```

## Lokal iPhone-install uden betalt Apple Developer

Det kan koeres via Xcode paa din Mac/PC-miljoe med en gratis Apple-konto. Det er
til lokal test paa din egen iPhone og erstatter ikke TestFlight/App Store.

1. Tilslut iPhone med kabel.
2. Tryk `Trust` paa iPhone, hvis den spoerger.
3. Slaa Developer Mode til paa iPhone: Settings > Privacy & Security >
   Developer Mode.
4. Log ind i Xcode med din Apple-konto under Settings > Accounts.
5. Koer:

```bash
npm run mobile:ios:device
```

Standalone-lignende lokal release-build:

```bash
npm run mobile:ios:release
```

Til aktiv udvikling direkte fra Xcode er `Run` sat til `Debug`. Start Metro
foerst med `npm run mobile:start`, saa appen kan hente JavaScript fra port
`8081`. Hvis Metro ikke koerer, kan Debug-buildet give hvid skaerm.

Brug `Release`, naar appen skal koere standalone uden Metro.

Hvis Xcode beder om signing/team, vaelg din personlige Apple-konto som Team.
Push-notifikationer er ikke sat op endnu og parkeres til senere.

Projektet har en lokal `tools/pod` wrapper, saa Expo kan finde CocoaPods paa
denne Mac uden at kraeve system-wide Ruby installation.

## Installerbar app

Foerste rigtige build laves med EAS.

Android APK:

```bash
npm run mobile:build:android
```

iPhone intern build:

```bash
npm run mobile:build:ios
```

Android-buildet kan installeres direkte fra EAS-linket. iPhone-buildet kraever
Apple Developer-konto og registreret enhed/TestFlight-flow.
