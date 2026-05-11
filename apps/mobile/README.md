# Mobile

Native app til eleverne. Foerste flow er klassekode, profiloprettelse med
skolevalg, samtykke, adgangskode og overblik med klasseinfo, nedtaelling og
elevdata. Hvis brugeren allerede har en profil, kan vedkommende logge ind direkte
med email og adgangskode uden at skulle kende klassekoden.

Profiloprettelse indeholder skole fra API-dropdown, fornavn/mellemnavne,
efternavn, email, foedselsdag, valgfri telefon, valgfri nødkontakt (navn +
nummer) og valgfrit profilbillede via
`expo-image-picker`. Backend afviser join, hvis den valgte skole ikke matcher
klassen bag klassekoden. Email fungerer som login-navn, og adgangskoden gemmes
hashet i Laravel.

`Min profil` findes i sidebaren. Den kan vise profiloplysninger, håndtere
avatar-skift via ikon i billedcirklen, logge ud og slette konto. Upload af
profilbillede sendes til Laravel som base64-image og gemmes under
`uploads/profile-photos` via Laravel `Storage`-disk, hvor stien ligger på
medlemmet. API'et returnerer en lokal `/storage/...` URL i dev og en
bucket/S3 URL i Cloud.

`Slet konto` bruger en irreversibel delete-flow med bekræftelse i UI og
`DELETE /api/members/me` i backend. Ved gennemført sletning bliver brugeren
logget ud og data anonymiseret efter de interne regler.

Der er ikke længere et separat profile-fane/ekstra profilbillede-container nederst på
profil-skærmen; avatar-handlingen er samlet i selve profil-sektionen.

Brugeren skal acceptere vilkaar og privatlivspolitik ved oprettelse. Backend
gemmer samtykket med version, saa appen bygges med App Store-godkendelse for
oeje fra starten.

Hver profil har en personlig Studos-kode, som vises paa Overblik og senere kan
bruges til at connecte med en enkelt person fra en anden klasse. Under
`Andre klasser` ligger `Connections`, hvor man kan sende request via Studos-kode
og acceptere/afvise indgaaende requests.

Appen gemmer en sikker bearer-token session i `expo-secure-store`, saa en
oprettet profil aabner direkte paa overblik naeste gang. Ny telefon/ny
installation kan bruge eksisterende profil-flowet med email og adgangskode.
For både nye og gamle brugere valideres klassetilknytning robust i backend efter
det samme mønster. Backend finder brugeren ud fra tokenet og maa ikke stole paa
`memberId` fra klienten til private handlinger.

Efter login har appen en topbar med skole/klasse, side-menu med sektionerne
`Din klasse`, `Andre klasser` og `Kommer snart`, samt fast footernavigation
mellem:

- Kalender
- Chat
- Overblik
- Dyst
- Galleri

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
stedet for modal, cover-upload eller cover-skabelon, dato-pill med kalender,
tidshjul for time/minut, invitationer til hele klassen/crew/valgte personer og
RSVP `Deltager`/`Deltager ikke`. Tidligere events findes via en fuldbredde
knap nederst paa kalendersiden og beregnes paa lokal dato/tid.

`Overblik` har dynamisk countdown til studenterugen, `Mit Studos`, lokal
hueklip-persistens, Caps-container, `Min kommende kalender`, `Seneste aktivitet`
og `Klassedyster`.

`Galleri` er klassens album-univers. Oversigten viser albums med dynamiske
covers, kategori-tabs, soegning og sortering. Album-siden har header med
tilbageknap, centreret albumnavn, groent tilfoej-ikon og toggle til valg-mode.
Billeder vises i 3 kolonner, og brugeren kan long-presse et billede for at
starte valg-mode direkte. Naar valg-mode er aktivt, vises en bundlinje med
`Gem`, `Slet` og `Vaelg alle`, hvor handlinger kraever mindst ét valgt billede.
Upload kan vaelge flere billeder i native picker og viser progress som
`Uploader 3/10`. Fullscreen viewer understotter swipe mellem billeder,
gem/slet/rapport-actions samt metadata for uploader og uploadtidspunkt.

Rigtig "Gem paa telefon" bruger `expo-media-library`, saa eksisterende
development/preview builds skal genbygges, naar modulet eller native
fototilladelser er aendret. `app.json` indeholder baade
`NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` og Expo
MediaLibrary permission-tekster.

## App-shell og navigation

Topbaren viser menu, skole, klasse og Studos-wordmark. Overblik-headeren
clamper ved scroll, og hovedindholdet scroller under headeren ligesom paa de
andre sider.
`Klassedyst` bruger samme sidetitel-stil som `Overblik`, `Chat` og `Kalender`
med en kompakt podium-grafik i Studos-farver og en kort intro under titlen.

Sidebaren er delt op i `Din klasse`, `Andre klasser` og `Kommer snart`.
`Wallet` og `Blaa bog` ligger laast under kommende features. `Noedkontakter`
ligger i en roed low-opacity container lige over `Indstillinger` nederst.

Sidebar-ikonerne bruger en fast Studos-palette:

- Lyseblaa: `#75DED0`
- Gul: `#FFD46D`
- Roed: `#FF6F73`
- Moerk: `#172143`

Flerfarvede ikoner bygges som simple `View`-kompositioner i en fast ramme eller
som smaa PNG-assets, ikke som svaere SVG'er. Det goer dem nemmere at justere og
holde stabile i React Native.

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

Til Laravel Cloud test skal Expo startes med Cloud API og Reverb over TLS:

```bash
EXPO_PUBLIC_API_URL=https://DIT-CLOUD-DOMAENE/api \
EXPO_PUBLIC_CREATE_CLASS_URL=https://DIT-CLOUD-DOMAENE/opret-klasse \
EXPO_PUBLIC_REVERB_APP_KEY=DIN_REVERB_APP_KEY \
EXPO_PUBLIC_REVERB_HOST=DIN_REVERB_HOST \
EXPO_PUBLIC_REVERB_PORT=443 \
EXPO_PUBLIC_REVERB_SCHEME=https \
npm run mobile:start
```

`@react-native-community/netinfo` er tilfoejet, fordi Pusher bruger det i React
Native. Hvis en eksisterende Android/iOS development build ikke indeholder det
native modul, falder chatten tilbage til polling. Rigtig Reverb realtime
kraever et genbygget development build med NetInfo.

`expo-media-library` er tilfoejet til native gem-til-telefon i albummer. Hvis
simulator/device viser `Cannot find native module 'ExpoMediaLibrary'`, koerer
den et gammelt native build og skal genbygges.

Android keyboard-layout er sat til `resize` i `app.json`. Chatinputfeltet er
tilpasset keyboard paa baade iOS og Android, men skal stadig regressions-testes
paa rigtige enheder efter stoerre layoutaendringer.

## Push / Expo Notifications

Appen bruger `expo-notifications` og Expo Push Service til baade iOS og
Android. Klienten registrerer en `ExpoPushToken`, sender `platform: ios` eller
`platform: android` til Laravel, og backend sender alle push-notifikationer via
`App\Support\PushNotifier` og Expo Push Service
`https://exp.host/--/api/v2/push/send`.

Aktuel status pr. 2026-05-09:

- iOS/APNs push key er oprettet i EAS for bundle id
  `dk.studenterapp.mobile`.
- iOS push capability er synkroniseret hos Apple, og preview-build har hentet
  Expo push token paa fysisk iPhone.
- Testnotifikation fra Indstillinger er verificeret paa fysisk iPhone.
- Chat-push er verificeret mod Cloud API fra en anden bruger/enhed.
- Android Firebase/FCM setup er fortsat aktivt for production og
  development-client.
- Backend-notifikationer er udvidet til 17 kategorier: chat, gruppechat-invite,
  dyster, event-invitationer/aendringer/reminders, RSVP-reminders, galleri,
  connections, ugens gode gerning og weekly streak.
- Mobilappen har per-kategori opt-out under Indstillinger -> "Notifikationstyper".

Push er dermed klar som platform for iOS og Android. Test-push og chat-push er
verificeret paa fysisk iPhone; de nye 17 kategorier skal nu smoke-testes i
preview/internal builds paa iOS og Android. Klasse-announcements, Caps-optjent
digest og admin/moderation-pushes er bevidst parkeret til senere.

### iOS Push / APNs

iOS kraever en native build med push entitlement og APNs credentials. Koden er
klargjort med `expo-notifications` config plugin og `aps-environment`, og EAS
har en Apple Push Notifications key til projektet.

1. Log ind i EAS CLI med den Expo-konto, der ejer projektet.
2. Koer `npx eas-cli credentials --platform ios` fra `apps/mobile`.
3. Vaelg bundle identifier `dk.studenterapp.mobile`.
4. Brug den eksisterende Apple Push Notifications key, eller opret en ny hvis
   EAS melder at den mangler.
5. Byg en ny iOS intern/TestFlight build:

```bash
npm run mobile:build:ios
```

Fysisk iPhone/TestFlight eller en intern iOS build skal bruges til reel test.
Naar appen har hentet en `ExpoPushToken`, kan backendens test-endpoint bruges
til at teste vejen gennem Laravel og Expo Push Service.

### Android Push / Firebase

Push paa Android kraever Firebase/FCM native config. Metro/dev-server kan teste
JavaScript-flowet, men den native Android app skal vaere bygget med korrekt
Firebase config, foer `getExpoPushTokenAsync` virker.

For Android app-id `dk.studenterapp.mobile`:

1. Opret/vaelg Firebase-projekt.
2. Tilfoej en Android app med package name `dk.studenterapp.mobile`.
3. Hvis der testes i development-client, tilfoej ogsaa Android app med package
   name `dk.studenterapp.mobile.dev`.
4. Download `google-services.json`.
5. Laeg filen som `apps/mobile/google-services.json`.
6. Koer lokalt:

```bash
STUDOS_ENABLE_ANDROID_NOTIFICATIONS=1 npx expo config --type public
```

Outputtet skal vise:

```text
android.googleServicesFile: ./google-services.json
plugins: ... expo-notifications ...
extra.eas.projectId: b4da2c62-b9cd-442c-b8da-facc8e6dc689
```

Derudover skal FCM V1 service account key uploades til Expo/EAS credentials for
Android application identifier `dk.studenterapp.mobile`, saa Expo Push Service
kan sende beskeder videre til FCM. Hvis der skal sendes push til en
development-client med package `dk.studenterapp.mobile.dev`, skal den
application identifier ogsaa have FCM credentials. Private service-account
JSON-filer maa ikke committes; `.gitignore` ignorerer dem.
`google-services.json` er public-facing Firebase app config og kan godt ligge i
projektet.

Status pr. 2026-04-28:

- `apps/mobile/google-services.json` findes og matcher
  `dk.studenterapp.mobile`.
- `apps/mobile/google-services.dev.json` findes og matcher
  `dk.studenterapp.mobile.dev`.
- Firebase project id: `studos-app-820f7`.
- Firebase project number: `959040548905`.
- FCM V1 service account key er uploadet til EAS credentials for baade Android
  `preview` / `dk.studenterapp.mobile` og Android
  `development` / `dk.studenterapp.mobile.dev`.
- `app.config.js` auto-skifter Firebase config efter build-variant:
  `preview`/APK bruger `google-services.json` for `dk.studenterapp.mobile`,
  mens `development`/dev-client bruger `google-services.dev.json` eller en
  samlet `google-services.json`, hvis den indeholder
  `dk.studenterapp.mobile.dev`.
- `npm run mobile:push:check` validerer begge varianter og er groen.
- Seneste Android Cloud preview/APK build blev startet 2026-04-28 kl. 23.46:
  `https://expo.dev/accounts/chrissorensen/projects/studos/builds/23a3ddaa-796a-449c-9001-4389d8b2efec`.
  Det build er taenkt som den naeste rigtige Android-test med Cloud API/Reverb,
  Firebase push, chat-push og ny notification-icon config.

## Aktuel teknisk status

- `SafeAreaView has been deprecated` er rettet ved at fjerne importen fra
  React Native og bruge almindelige `View`-containere i appens root states.
- `Encountered two children with the same key` er rettet ved at dedupe
  conversations, messages, events og attendee previews foer render.
- `Chat realtime is unavailable in this build. [TypeError: constructor is not callable]`
  er rettet i `createChatEcho`: `pusher-js/react-native` eksporterer
  `Pusher`, og den sendes nu direkte til Laravel Echo via `Pusher` optionen.
- Albummer har native media-save via `expo-media-library`, flerbillede-upload,
  upload-progress, multi-select, swipe viewer og metadata i viewer.
- Android og iOS JS export blev koert groent efter rettelserne.

## Fortsaet Herfra

1. Byg nye preview/internal builds til iOS og Android, fordi
   `expo-media-library` og native fototilladelser kraever nyt native build.
2. Smoke-test albummer paa fysiske enheder: flerbillede-upload, progress,
   long-press valg-mode, multi-select, gem paa telefon, slet flere, swipe
   viewer, rapportering og synlighedsregler.
3. Smoke-test push: system-popup, push-toggle, kategori-opt-out, chat-push og
   de nye pushkategorier for Dyst, events, reminders, connections, galleri,
   ugens gode gerning og weekly streak.
4. Bekraeft at Laravel Scheduler koerer i Cloud, saa reminder-kommandoerne
   bliver afviklet.
5. Test chat paa to enheder med Cloud API/Reverb eller Metro paa `8081` og
   Reverb paa `8080`: send, read-status, realtime/polling, swipe tilbage,
   long-press, blokering, rapportering og keyboard paa iOS/Android.
6. Lav admin/moderationsside, saa `member_reports`,
   `moderation_violations`, blocks og chat-events kan gennemgaas og handles
   paa foer drift.
7. Gennemtest kalenderflowet paa rigtige enheder: cover-upload, dato/tid,
   invitationer, RSVP og tomme states.
8. Fjern/afklar demo-hardcoding og placeholders foer release, fx hardcodede
   tekster, testpersoner og ufaerdige sidebar-sider.
9. Klargoer drift: produktions-API/Reverb, HTTPS, uploads-permissions,
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

Hvis Xcode beder om signing/team, vaelg dit Apple Developer Team. Push
kraever at App ID/provisioning har push capability og at EAS/APNs credentials er
sat, foer Expo Push Service kan levere til iOS.

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
