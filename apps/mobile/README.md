# Mobile

Native app til eleverne. Foerste flow er invitekode, profiloprettelse med
skolevalg, samtykke, adgangskode og overblik med klasseinfo, nedtaelling og
elevdata.

Profiloprettelse indeholder skole fra API-dropdown, fornavn/mellemnavne,
efternavn, email, foedselsdag, valgfri telefon og valgfrit profilbillede via
`expo-image-picker`. Backend afviser join, hvis den valgte skole ikke matcher
klassen bag invitekoden. Email fungerer som login-navn, og adgangskoden gemmes
hashet i Laravel.

`Min profil` findes i sidebaren. Den kan pt. vise profilinfo og uploade/skifte
profilbillede. Uploaden sendes til Laravel som base64-image, gemmes under
`public/uploads/profile-photos`, og URL'en gemmes paa medlemmet. `Test Jensen`
har et fiktivt AI-genereret demo-profilbillede.

Brugeren skal acceptere vilkaar og privatlivspolitik ved oprettelse. Backend
gemmer samtykket med version, saa appen bygges med App Store-godkendelse for
oeje fra starten.

Hver profil har en personlig Studos-kode, som vises paa Overblik og senere kan
bruges til at connecte med en enkelt person fra en anden klasse. Under
`Andre klasser` ligger `Connections`, hvor man kan sende request via Studos-kode
og acceptere/afvise indgaaende requests.

Appen gemmer en sikker bearer-token session i `expo-secure-store`, saa en
oprettet profil aabner direkte paa overblik naeste gang. Ny telefon/ny
installation kan bruge eksisterende profil-flowet med invitekode, email og
adgangskode. Backend finder brugeren ud fra tokenet og maa ikke stole paa
`memberId` fra klienten til private handlinger.

Efter login har appen en topbar med skole/klasse, side-menu med sektionerne
`Din klasse` og `Andre klasser`, samt fast footernavigation mellem:

- Kalender
- Chat
- Overblik
- Wallet
- Walls

`Chat` er ikke laengere en placeholder. Den har foerste rigtige version med
1-1 samtaler, gruppechats, gruppebillede, tekst/emoji, unread-count,
kronologisk sortering, 1-1 laest/sendt-status, mute/unmute, skjul direkte
chat, forlad gruppe og slet gruppe som ejer. Gruppechat har ikke
laest/ikke laest-status pr. aftale.

Chatforsiden er bygget som en ny `Chats`-side med titel, Studos-detalje, frie
ikoner til ny gruppechat/ny direkte chat, soegefelt og aabne samtaler under
soegefeltet. Samtaler sorteres efter seneste chataktivitet.

Paa den globale chatliste aabner long-press paa en samtale en tydelig
chatindstillingsmenu. Herfra kan brugeren slaa notifikationer fra/til, skjule,
forlade eller slette en chat, rapportere chatten og blokere en person i 1-1
chat. Det erstatter et tidligere globalt "administrer alle chats"-mode.

Ny direkte chat aabner en person-vaelger modal med soegning paa baade fornavn
og efternavn. Valg af person aabner samtalen.

Inde i en chat er visningen fuld skaerm uden global topbar/footer. Den har egen
chat-header, avatars, Studos-inspirerede taleboble-beskeder, tidspunkt og
visuel sendt/laest-status. Fra en aaben chat kan man swipe fra venstre mod
hoejre for at gaa tilbage til `Chats`; chattraaden foelger fingeren, saa
chatlisten vises bagved under traekket. Inputfeltet er tilpasset keyboard paa
iOS og Android, saa tekstfelt og send-knap kommer over tastaturet.

Long-press paa en besked inde i en individuel chat aabner en beskedhandling:
egen besked kan slettes, og andres beskeder kan rapporteres. Slettede beskeder
vises som slettet i traaden.

Chatten bruger Laravel Reverb til realtime. Mobilappen abonnerer paa private
chat-kanaler via `laravel-echo` og `pusher-js/react-native`, og backend signer
kanalen med bearer-auth, saa kun aktive deltagere i samtalen kan lytte med.

Chat og sociale input bruger backend-moderation via `ContentModeration`.
Blokerede ord/navne afvises, overtraedelser logges i `moderation_violations`,
chat-/beskedrapporter gemmes i `member_reports`, og chathandlinger logges i
`chat_moderation_events`.

`Kalender` har et rigtigt oprettelsesflow til studentergilder: egen side i
stedet for modal, cover-upload, dato-pill med kalender, tidshjul for time/minut,
invitationer til hele klassen/crew/valgte personer og RSVP
`Deltager`/`Deltager ikke`.

`Overblik` har dynamisk countdown til studenterugen, check-in-kortet
`Hvordan er stemningen i dag?`, sidste opdateret-tekst, stemningsmodal og en
foerste social-score/klip UI-retning.

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

Hvis der testes i en Android/iOS development build:

```bash
npm run mobile:start:dev-client
```

Start Reverb i et separat terminalvindue, naar chat realtime skal testes:

```bash
npm run reverb:start
```

Metro bruger port `8081`. Reverb bruger port `8080`. Ved fysisk telefon skal
`EXPO_PUBLIC_REVERB_HOST` pege paa Mac'ens LAN-IP, fx `192.168.1.114`.

Projektet er sat op til Expo SDK 55.

Appen kalder som standard Laravel API'et under den lokale LAN-adresse til
fysisk Android/iPhone test og falder derefter tilbage til localhost-varianter:

```text
http://192.168.1.114/studenter-app/public/api
http://localhost/studenter-app/public/api
http://127.0.0.1/studenter-app/public/api
```

Ved fysisk iPhone kan API-url overrides ved build/start:

```bash
EXPO_PUBLIC_API_URL=http://DIN-MAC.local/studenter-app/public/api npm run mobile:start
```

Realtime kan overrides paa samme maade:

```bash
EXPO_PUBLIC_REVERB_HOST=DIN-MAC-IP npm run mobile:start:dev-client
```

`@react-native-community/netinfo` er tilfoejet, fordi Pusher bruger det i React
Native. Hvis en eksisterende Android/iOS development build ikke indeholder det
native modul, falder chatten tilbage til polling. Rigtig Reverb realtime
kraever et genbygget development build med NetInfo.

Android keyboard-layout er sat til `resize` i `app.json`. Chatinputfeltet er
tilpasset keyboard paa baade iOS og Android, men skal stadig regressions-testes
paa rigtige enheder efter stoerre layoutaendringer.

## Fortsaet Herfra

1. Test chat paa to enheder med Metro paa `8081` og Reverb paa `8080`: send,
   read-status, realtime/polling, swipe tilbage, long-press, blokering,
   rapportering og keyboard paa iOS/Android.
2. Lav admin/moderationsside, saa `member_reports`,
   `moderation_violations`, blocks og chat-events kan gennemgaas og handles
   paa foer drift.
3. Gennemtest kalenderflowet paa rigtige enheder: cover-upload, dato/tid,
   invitationer, RSVP og tomme states.
4. Fjern/afklar demo-hardcoding og placeholders foer release, fx hardcodede
   badge-tekster, testpersoner og ufaerdige sidebar-sider.
5. Klargoer drift: produktions-API/Reverb, HTTPS, uploads-permissions,
   privacy/terms/support links, demo-login til review og korrekt content
   rating for brugerchat/UGC.

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

Android development client til hurtig test via Metro:

```bash
npm run mobile:build:android:dev
```

iPhone intern build:

```bash
npm run mobile:build:ios
```

Android-buildet kan installeres direkte fra EAS-linket. iPhone-buildet kraever
Apple Developer-konto og registreret enhed/TestFlight-flow.
