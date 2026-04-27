# Studos

Global projektstatus for Studos: Laravel web/admin/API, XAMPP MySQL-database
og native React Native iPhone-app.

Denne README er en "start her igen"-note, saa projektet kan tages op uden at
miste konteksten.

Se ogsaa `DETTE_MANGLER_VI.md` for konkrete produkt-/feature-noter, der ikke
maa glemmes.

## Produktide

Studos er en privat klassehub til studenteraret. En klasse kan oprettes paa web,
faa en privat invitekode og et offentligt KlasseID, og derefter bruge en native
app til alt det praktiske og sociale omkring studenterforlobet.

Hovedideen:

- `Laravel`: website, admin, login, roller, API og database/migrations.
- `mobile`: elevernes native app med join-flow, klasseforside, countdown,
  events, chat og senere feed, billeder, blaa bog og notifikationer.
- `database`: rigtig SQL via XAMPP MariaDB/MySQL, saa data kan ses og styres i
  phpMyAdmin.

## Struktur

```text
studenter-app/
  app/        Laravel app-kode og controllers
  bootstrap/ Laravel bootstrap/cache
  config/    Laravel konfiguration
  database/  Laravel migrations/seeders
  public/    XAMPP/Apache webroot
  resources/ Blade views og frontend-kilder
  routes/    Laravel web/API routes
  storage/   Laravel cache/log/session storage
  apps/
    mobile/  Expo/React Native app til iPhone
  packages/
    shared/  Plads til delte typer/helpers senere
  docs/      Produktnoter og arkitektur
```

## Laravel web/API

- Korer via XAMPP/Apache paa `http://localhost/studenter-app/public/`.
- Kan ogsaa koeres med `npm run web:dev` eller `php artisan serve`.
- Bruger XAMPP MariaDB/MySQL via socket:
  `/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock`.
- Database hedder `studenter_app`.
- Tabeller: `schools`, `classes`, `members`, `events`, `event_rsvps`,
  `event_invites`, `member_connections`, `member_blocks`, `member_reports`,
  `moderation_violations`, `member_auth_tokens`,
  `chat_conversations`, `chat_participants`, `chat_messages`,
  `chat_moderation_events` plus Laravels egne tabeller.
- Medlemsroller: `owner`, `moderator`, `student`. Alle tre har fuld adgang
  lige nu, indtil adgangsniveauerne bliver defineret.
- Medlemsstatus: `pending`, `active`, `removed`.
- Medlemsprofil i API/app: skole, fornavn/mellemnavne, efternavn, email,
  valgfri telefon, foedselsdag og valgfrit profilbillede-reference.
- Elevprofiler har `password_hash` paa `members`. Email bruges som login-navn.
- Elevprofiler gemmer accept af vilkaar/privatlivspolitik med version, saa
  App Store/privacy-flowet er struktureret fra start.
- Elevprofiler har ogsaa en unik personlig `Studos-kode` i formatet
  `FORNAVN-SJOVTORD`, fx `CHRIS-HYPE`, som kan bruges til fremtidige
  connect-requests paa tvaers af klasser uden at dele kontaktinfo.
- Personlige connections er samtykke-baserede: en Studos-kode sender kun en
  request, og forbindelsen bliver foerst aktiv naar modtageren accepterer.

API endpoints:

- `GET /api/health`
- `GET /api/roles`
- `GET /api/schools`
- `GET /api/classes`
- `POST /api/classes`
- `GET /api/classes/id/:classId`
- `GET /api/classes/invite/:code`
- `POST /api/classes/join`
- `GET /api/members/code/:personalCode`
- `GET /api/members/:memberId/connections`
- `POST /api/connections/request`
- `POST /api/connections/:connectionId/respond`
- `POST /api/session/login`
- `POST /api/session/request-code`
- `POST /api/session/verify-code`
- `GET /api/session/me`
- `POST /api/profile/photo`
- `POST /api/classes/:classId/members/:memberId/access`
- `POST /api/events`
- `POST /api/events/:eventId/rsvp`
- `GET /api/chat/conversations`
- `POST /api/chat/realtime/auth`
- `POST /api/chat/conversations/direct`
- `POST /api/chat/conversations/group`
- `GET /api/chat/conversations/:conversationId/messages`
- `POST /api/chat/conversations/:conversationId/messages`
- `POST /api/chat/conversations/:conversationId/read`
- `POST /api/chat/conversations/:conversationId/mute`
- `POST /api/chat/conversations/:conversationId/report`
- `POST /api/chat/conversations/:conversationId/block`
- `POST /api/chat/conversations/:conversationId/hide`
- `POST /api/chat/conversations/:conversationId/leave`
- `DELETE /api/chat/conversations/:conversationId`
- `POST /api/chat/messages/:messageId/report`
- `DELETE /api/chat/messages/:messageId`

## Web

- Website ligger som Blade view i `resources/views/home.blade.php`.
- CSS/JS/assets ligger i `public/`.
- Logoer:
  - `public/assets/studos-mark.svg`
  - `public/assets/studos-logo.svg`
- Landingpage har header, CTA'er, produktsektion og links til login/opret
  klasse.
- `/opret-klasse` opretter foerste bruger og klasse samtidig. Brugeren bliver
  automatisk `owner`.
- Klasseoprettelse i web bruger skolevalg fra `schools`-dropdown, saa skolen
  ikke skrives frit i oprettelsesflowet.
- Hver klasse har et offentligt `KlasseID`, som kan deles til fremtidig
  connection med andre klasser. Invitekoden er stadig privat og bruges kun til
  at joine klassen.
- Hver elev har en personlig `Studos-kode`, som kan deles manuelt for at finde
  personen og starte et samtykke-baseret connect-flow senere.
- Native appen har en `Connections`-side under `Andre klasser`, hvor man kan
  sende og besvare personlige connection-requests.
- `/admin` kraever login. Hvis brugeren allerede har en klasse, aabner admin
  direkte paa klassens CMS.
- En bruger med aktiv klasseadgang kan kun oprette/administrere een klasse i
  web-flowet.

Web test-login:

```text
URL: http://localhost/studenter-app/public/login
Email: chris@skole.dk
Password: studos123
```

## Mobile/iPhone

- Expo/React Native app ligger i `apps/mobile`.
- Appen hedder visuelt `Studos`.
- Appens foerste flow er invitekode -> profiloprettelse -> overblik.
- Appen gemmer lokal session i `expo-secure-store`, saa brugeren lander direkte
  paa overblik efter genstart.
- Foerste side har link til eksisterende profil-login med email/adgangskode og
  web-oprettelse af klasse.
- Profiloprettelse kraever skolevalg fra API-dropdown. Backend afviser join,
  hvis den valgte skole ikke matcher klassen bag invitekoden.
- Profiloprettelse bruger `expo-image-picker` til valgfrit profilbillede.
- Profiloprettelse kraever adgangskode, som gemmes hashet paa medlemmet.
- Efter login har appen bundnavigation med `Kalender`, `Chat`, `Overblik`,
  `Wallet` og `Walls`.
- `Overblik` er pt. en forside med titel, dynamisk countdown til
  studenterugen, check-in/stemning, social-score/klip-kort og en lille
  studenterhat over O'et.
- Topbaren viser skole/klasse, Studos-wordmark, custom hamburger-menu og synlig
  skygge over sideindholdet.
- Sidebaren er en kompakt, ikke-scrollende drawer. `Mit crew` ligger som en
  selvstaendig top-entry med medlemstal, mens `Din klasse` og `Andre klasser`
  samler de oevrige sociale klassefeatures.
- Sidebar-ikonerne bruger en fast Studos-palette (`lyseblaa`, `gul`, `roed`,
  `moerk`) og er bygget som simple React Native `View`-former, hvor flerfarve
  giver mening, i stedet for svaere SVG'er.
- `Chat` har foerste rigtige version med 1-1 samtaler, gruppechats,
  gruppebillede, tekst/emoji, unread-count, kronologisk sortering,
  1-1 sendt/laest-status, mute/unmute, skjul direkte chat, forlad gruppe og
  slet gruppe som ejer.
- Chatforsiden har long-press paa en samtale for chatindstillinger. Inde i en
  individuel chat kan man long-press'e en besked for at slette egen besked
  eller rapportere en anden persons besked.
- Individuelle chats har fuldskaermsvisning uden global topbar/footer,
  keyboard-tilpasset inputfelt paa iOS/Android og swipe fra venstre mod hoejre
  tilbage til chatlisten med chatlisten synlig under traekket.
- Chat og oprettelsesflows bruger indholdsfilter via `ContentModeration`, og
  overtraedelser logges i `moderation_violations`. Chatrapporter og
  beskedrapporter gemmes i `member_reports`, og chathandlinger logges i
  `chat_moderation_events`.
- `Kalender` har en rigtig begivenhedsoversigt og oprettelsesflow til
  studentergilder med cover-billede, datovaelger, iOS-lignende tidshjul,
  invitationer til hele klassen/crew/valgte personer og RSVP
  `Deltager`/`Deltager ikke`.
- Chatten bruger Laravel Reverb til realtime via private kanaler. Hvis en
  development build mangler native NetInfo-modulet, falder appen tilbage til
  polling.
- `Walls`, `Wallet` og flere sidebar-sider er stadig foerste
  placeholder-/skitse-sider. `Kalender` har foerste rigtige event-flow, men
  skal stadig produktionspolishes.
- App-ikonet er lavet ud fra Studos-marken som 1024x1024 PNG uden alpha.
- Ikonfiler:
  - `apps/mobile/assets/icon.png`
  - `apps/mobile/assets/adaptive-icon.png`
  - `apps/mobile/assets/splash-icon.png`
  - `apps/mobile/ios/StudenterApp/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`
- Den interne bundle id er stadig `dk.studenterapp.mobile`, fordi gratis Apple
  signing allerede virker med den.
- Den rigtige fremtidige bundle id kan vaere `dk.studos.mobile`, men den
  kraever ny provisioning profile/Apple Developer setup.

## App Store-godkendelse og drift

VIGTIGT: Alt i native appen skal bygges med det formaal, at appen senere skal
kunne godkendes i App Store.

Det betyder blandt andet:

- UI maa ikke efterligne eller skjule iOS-systemfunktioner paa en vildledende
  maade.
- Statusbar, notch/safe areas, permissions, login-flow og navigation skal foeles
  native og vaere tydelige for brugeren.
- Permissions skal have klare forklaringer og kun bruges, naar funktionen
  kraever det.
- Appen maa ikke kraeve uventede eksterne dev-servere, debug-flows eller lokal
  netvaerksadgang i produktion.
- Sociale features som billeder, chat, kalender-events, moderation og
  notifikationer skal designes med Apples privacy-, safety- og content-regler i
  tankerne.
- Oprettelse skal indsamle accept af vilkaar og privatlivspolitik. Der er
  databasefelter til samtykke/version, kontosletning samt tabeller til
  rapportering og blokering, saa sociale features kan bygges App Store-klar.
- Content rating i App Store Connect og Google Play Console skal svare aerligt
  paa, at appen har brugerchat og brugergenereret indhold. Det er bedre med en
  korrekt aldersrating end en afvisning for skjult UGC.
- App Review Notes skal indeholde demo-login, kort forklaring af chat/moderation
  og hvor reviewer finder rapporter/blokering.
- Der skal vaere fungerende links til privatlivspolitik, vilkaar og support.
- Der skal vaere en reel moderationsproces: rapporter skal kunne ses og
  behandles hurtigt, og groft indhold/brugere skal kunne fjernes eller
  suspenderes.

Mobile test-login:

```text
Invitekode: STU-DEMO26
Email: chris@skole.dk
Password: studos123
```

## Hvor vi er lige nu

Status pr. 2026-04-27:

- Projektet er migreret fra statisk web + Node API til Laravel web/API.
- XAMPP URL virker: `http://localhost/studenter-app/public/`.
- Laravel API virker under `/api/...`.
- SQL-databasen er XAMPP/phpMyAdmin-kompatibel.
- Web kan oprette klasse, login-bruger, admin-dashboard og invitekode.
- Klasser har nu offentligt KlasseID ved siden af privat invitekode.
- API kan gemme og hente klasser, profiler, medlemmer, roller, status og
  events.
- Klasseejeren oprettes som `owner`, og elever der joiner via invitekode bliver
  `student`; ved join policy `approval` faar de status `pending`.
- Owner, moderator og student har fuld adgang lige nu, indtil adgangsniveauerne
  bliver defineret.
- Admin-web kan redigere klasseindstillinger, roller/medlemmer, CMS-blokke og
  begivenheder.
- Mobilappen kan slaa invitekode op i Laravel API'et, oprette profil og vise
  foerste overblik med countdown og personlig Studos-kode.
- Eksisterende profil kan genskabes via invitekode, email og adgangskode.
- Mobilappen har footer-navigation: Kalender, Chat, Overblik, Wallet, Walls.
- Mobilappen har nu en kompakt app-shell med topbar, footer og sidebar. `Mit
  crew` er fremhaevet i toppen af sidebaren, og de oevrige sidebar-features
  ligger som placeholder-/skitse-sider.
- Chatten har backend-tabeller, API-routes, mobil chatforside, direkte chats,
  gruppechats, gruppebillede, beskedtraad, unread-count, Reverb/polling
  realtime-setup, mute/hide/leave/delete/block/report og long-press actions.
- Individuelle chats har swipe-tilbage, keyboard-haandtering, fuld bredde i
  chatsektionen, chatbobler, online-dot, aktivitetstekst og hardcodet
  `Klassens straeber` badge-visning som UI-test.
- Chatmoderation er startet: ord-/navnefilter, rapporter paa chat/besked,
  blokering, slet egen besked, moderation-log og throttling paa de vigtigste
  oprettelses-/rapport-endpoints.
- Kalenderen er ikke laengere wiped/placeholder: der er oprettelsesflow,
  cover-upload, dato/tid, invitationer, personvaelger med soegning og RSVP.
- Overblik har dynamisk `Dage til studenterugen`, check-in/stemning med
  modal, "sidst opdateret", klip-container og bruger-overblik som UI-spor.
- Seneste iPhone Release-build er bygget, installeret og launched paa parret
  iPhone via `devicectl`.
- Studos-branding er lagt paa website og app-ikoner.

Ikke lavet endnu / skal afklares:

- QR-invite.
- Join approval-flow i web/admin.
- Glemt adgangskode/email-reset.
- Walls/feed/galleri.
- Awards/afstemninger.
- Blaa bog.
- Admin/moderationsside hvor rapporter, moderation_violations og blocks kan
  gennemgaas og behandles.
- Push-notifikationer.
- TestFlight/App Store/EAS iOS distribution.
- Produktionshosting.
- Kontosletning/data-export UI, hvis det ikke allerede ender som support-flow.

## Foer drift / udgivelse

Dette er de vigtigste ting, der skal vaere styr paa, foer appen sendes til
App Store/Google Play eller bruges af en rigtig klasse:

- `APP_ENV=production`, `APP_DEBUG=false`, HTTPS, rigtige produktions-URL'er og
  ingen lokal XAMPP/LAN-IP i app-buildet.
- Skrivbare upload-mapper og korrekt webserver-setup for
  `public/uploads/profile-photos`, `public/uploads/event-covers` og
  `public/uploads/chat-groups`. Fejl her giver permission-denied ved uploads.
- Privatlivspolitik, vilkaar/EULA og support/kontakt skal vaere live og linket
  fra app/store listing.
- Vilkaar skal tydeligt forbyde chikanerende, diskriminerende, seksuelt,
  truende og ulovligt indhold samt misbrug af chat/billeder.
- App Store/Google Play content rating skal deklarere brugerchat/UGC korrekt.
- Der skal oprettes demo-konto/testklasse til review, med login-info i review
  notes.
- Moderationsdrift skal vaere reel: rapporter og overtraedelser skal kunne
  findes, vurderes og handles paa. Minimum: daglig gennemgang mens appen er ny.
- Blokering, rapportering, slet egen besked, skjul/forlad chats og filtrering
  skal testes paa baade iOS og Android.
- Reverb/websocket skal koere paa produktionshost med korrekt host/port/TLS,
  eller appen skal bevidst koere polling indtil realtime er klar.
- Mail/password reset skal vaere klar, hvis elever skal kunne komme tilbage
  uden manuel support.
- Backups af database og uploads skal planlaegges, og `.env`/keys maa ikke
  committes.
- Fjern/afklar demo-hardcoding foer release: fx hardcodede badge-tekster,
  demo-counts, testpersoner og placeholder-sider der kan forvirre reviewers.
- Test paa rigtige enheder: iPhone, Android, daensk keyboard, upload fra
  galleri/kamera, daarligt net, logout/login, ny installation og to-bruger chat.
- Push-notifikationer kan vente, men naar de tilfoejes skal stemnings-check-in
  have en daglig reminder, som kan slaas fra.

## Start lokalt

Forudsat at XAMPP er installeret, og MySQL/MariaDB er startet.

Installer PHP dependencies, hvis `vendor/` mangler:

```bash
composer install
```

Installer mobile dependencies, hvis `node_modules/` mangler:

```bash
npm install
```

Opret/opdater databasen:

```bash
php artisan migrate
```

Se databasen i phpMyAdmin:

```text
http://localhost/phpmyadmin
```

Aabn web via XAMPP/Apache:

```text
http://localhost/studenter-app/public/
```

Tjek Laravel API:

```text
http://localhost/studenter-app/public/api/health
```

Start valgfri Laravel dev-server:

```bash
npm run web:dev
```

Dev-server URL:

```text
http://127.0.0.1:8000
```

Start mobilappen i Expo:

```bash
npm run mobile:start
```

Start Reverb i et separat terminalvindue, naar chat realtime skal testes:

```bash
npm run reverb:start
```

Byg og installer lokal iPhone-release:

```bash
npm run mobile:ios:release
```

Hvis Expo bygger appen, men haenger paa `Connecting to iPhone`, kan den byggede
app installeres direkte med `devicectl`. Senest brugte device-id:

```text
100F26BB-736D-5079-81AD-7662E75652DF
```

Direkte install efter en succesfuld Xcode-build:

```bash
xcrun devicectl device install app --device 100F26BB-736D-5079-81AD-7662E75652DF /Users/chrise.sorensen/Library/Developer/Xcode/DerivedData/StudenterApp-bsagajrzdagfawebcdquhawcqgws/Build/Products/Release-iphoneos/StudenterApp.app
```

Direkte launch:

```bash
xcrun devicectl device process launch --device 100F26BB-736D-5079-81AD-7662E75652DF dk.studenterapp.mobile
```

## Seneste verificering

Senest koert og godkendt:

```bash
php artisan migrate
php artisan test
npm --workspace @studenter-app/mobile exec expo export -- --platform ios --output-dir /tmp/studos-export
npm --workspace @studenter-app/mobile exec expo run:ios -- --device "iPhone" --configuration Release --no-bundler --no-install
```

Resultat:

- `php artisan test`: 12 tests passed.
- iOS export: OK.
- iPhone Release build: OK.
- Direkte iPhone install: OK.
- Direkte iPhone launch: OK.

## Vigtige noter

- Projektet hed oprindeligt `Studenter App`, men produktbrandet er nu `Studos`.
- Nogle interne package-/mappe-/target-navne hedder stadig `studenter-app` eller
  `StudenterApp`. Det er ikke et problem lige nu; brugerens app-navn og
  web-brand er `Studos`.
- Laravel er nu kilden til web, admin, API og database-migrations.
- Mobilappen er Expo/React Native og kalder Laravel API'et.
- Appens lokale session ligger i `expo-secure-store`. Brug `Skift profil` i
  `Mere`, hvis onboarding/login skal testes igen.
- Chatten har foerste rigtige version og er App Store/Google Play-orienteret
  med filtering, reporting og blocking, men skal stadig testes grundigt paa to
  rigtige enheder med baade Reverb og fallback/polling.
- Udviklingsnote: `Mit crew` i sidebaren viser lige nu mindst `120 medlemmer`
  som layout-demo. Fjern demo-counten foer produktionsbuild, saa tallet igen
  kun kommer fra `activeMembers`.
- Profilbilleder kan uploades fra appen og gemmes under
  `public/uploads/profile-photos`.
- Engangskode-endpoints findes stadig til senere email-flow, men appen bruger
  nu email + adgangskode.
- Notifikationer bor parkeret indtil Apple Developer-konto/provisioning er paa
  plads.
- Ved XAMPP 500-fejl paa Blade views skal `storage/` og `bootstrap/cache/` vaere
  skrivbare for Apache.

## Naeste gode skridt

1. Lav admin/moderationsside til rapporter, blocks og
   `moderation_violations`.
2. Gennemfoer to-enheds-test af chat: iOS/Android, Reverb/polling, swipe,
   keyboard, long-press, rapportering og blokering.
3. Goer kalenderflowet produktionsklart: uploads, invitationer, RSVP og tomme
   states paa begge platforme.
4. Lav glemt adgangskode/email-reset og afklar kontosletning/data-export.
5. Lav `Walls` som feed/galleri og `Awards` med foerste afstemningsflow.
6. Lav join approval-flow i web/admin og QR/invitelink.
7. Naar Apple Developer er klar: skift bundle id til `dk.studos.mobile`, opret
   provisioning, saet TestFlight op og foerst derefter push-notifikationer.
