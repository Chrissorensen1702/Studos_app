# Studos

Global projektstatus for Studos: Laravel web/admin/API, lokal XAMPP
MySQL-database, Laravel Cloud deployment, React Native iOS/Android-app og en
midlertidig PWA til hurtig test.

Denne README er en "start her igen"-note, saa projektet kan tages op uden at
miste konteksten.

Se ogsaa `DETTE_MANGLER_VI.md` for konkrete produkt-/feature-noter, der ikke
maa glemmes.

## Produktide

Studos er en privat klassehub til studenteraret. En klasse kan oprettes paa web,
faa en privat invitekode og et offentligt KlasseID, og derefter bruge en native
app til alt det praktiske og sociale omkring studenterforlobet.

Hovedideen:

- `Laravel`: website, admin, login, roller, API, database/migrations,
  realtime og storage-integration.
- `mobile`: elevernes native iOS/Android-app med join-flow, klasseforside,
  countdown, events, chat og senere feed, billeder, blaa bog og notifikationer.
- `pwa`: midlertidig web-wrapper af appen, saa venner kan teste flowet foer
  TestFlight/App Store er klar.
- `database`: rigtig SQL lokalt via XAMPP MariaDB/MySQL og i drift via Laravel
  Cloud MySQL.

## Struktur

```text
studenter-app/
  app/        Laravel app-kode og controllers
  bootstrap/ Laravel bootstrap/cache
  config/    Laravel konfiguration
  database/  Laravel migrations/seeders
  public/    XAMPP/Apache webroot, PWA-shell, exports og assets
  resources/ Blade views og frontend-kilder
  routes/    Laravel web/API routes
  storage/   Laravel cache/log/session storage
  apps/
    mobile/  Expo/React Native app til iOS/Android
  packages/
    shared/  Plads til delte typer/helpers senere
  docs/      Produktnoter og arkitektur
```

## Laravel web/API

- Korer via XAMPP/Apache paa `http://localhost/studenter-app/public/`.
- Kan ogsaa koeres med `npm run web:dev` eller `php artisan serve`.
- Korer i drift paa Laravel Cloud: `https://studos.laravel.cloud`.
- Laravel Cloud har app compute, MySQL database, Laravel Reverb WebSockets og
  bucket/S3-compatible storage til uploads.
- Bruger XAMPP MariaDB/MySQL via socket:
  `/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock`.
- Database hedder `studenter_app`.
- Tabeller: `schools`, `classes`, `class_content_blocks`, `members`,
  `events`, `event_rsvps`, `event_invites`, `member_connections`,
  `member_blocks`, `member_reports`, `moderation_violations`,
  `member_auth_tokens`,
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
- Uploads gaar via Laravel `Storage`-disk. Databasen gemmer storage-paths
  (`uploads/...`), mens API'et returnerer en URL, der passer til miljoeet:
  lokal `/storage/...` i dev og bucket/S3 i Cloud.
- `league/flysystem-aws-s3-v3` er installeret, saa Laravel Cloud bucket kan
  bruges direkte.

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
- `PATCH /api/events/:eventId`
- `DELETE /api/events/:eventId`
- `POST /api/events/:eventId/update`
- `POST /api/events/:eventId/delete`
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

## Mobile / PWA

- Expo/React Native app ligger i `apps/mobile`.
- Appen hedder visuelt `Studos` paa iOS/Android.
- PWA'en ligger i `public/pwa/index.html` og kan testes paa
  `https://studos.laravel.cloud/pwa/?v=9`.
- PWA'en er en hurtig test-wrapper af samme app-bundle. Den bruger browser
  storage i stedet for `expo-secure-store`, saa login virker i Safari/PWA.
- Appens foerste flow er invitekode -> profiloprettelse -> overblik.
- Appen gemmer lokal session i `expo-secure-store`, saa brugeren lander direkte
  paa overblik efter genstart.
- Foerste side har link til eksisterende profil-login med email/adgangskode og
  web-oprettelse af klasse.
- Profiloprettelse kraever skolevalg fra API-dropdown. Backend afviser join,
  hvis den valgte skole ikke matcher klassen bag invitekoden.
- Profiloprettelse bruger `expo-image-picker` til valgfrit profilbillede og
  sender billedet som base64 til backend, saa Cloud kan gemme det i bucket.
- Profiloprettelse kraever adgangskode, som gemmes hashet paa medlemmet.
- Efter login har appen bundnavigation med `Kalender`, `Chat`, `Overblik`,
  `Wallet` og `Walls`.
- `Overblik` er nu den mest polerede mobile forside: titel, dynamisk countdown
  til studenterugen, `Mit Studos`-kort, hueklip, stemnings-check-in og dagens
  kalender.
- Topbaren viser skole/klasse, Studos-wordmark, custom hamburger-menu og synlig
  skygge over sideindholdet.
- Sidebaren er en kompakt, ikke-scrollende drawer. `Mit crew` ligger som en
  selvstaendig top-entry med medlemstal, mens `Din klasse` og `Andre klasser`
  samler de oevrige sociale klassefeatures.
- Sidebar-ikonerne bruger en fast Studos-palette (`lyseblaa`, `gul`, `roed`,
  `moerk`) og er bygget som simple React Native `View`-former, hvor flerfarve
  giver mening, i stedet for svaere SVG'er.
- `Chat` har foerste rigtige version med 1-1 samtaler, gruppechats,
  gruppebillede, tekst/emoji, unread-count inkl. footer-boble, kronologisk
  sortering, 1-1 sendt/laest-status, mute/unmute, skjul direkte chat, forlad
  gruppe og slet gruppe som ejer.
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
  `Deltager`/`Deltager ikke`. Egne begivenheder kan redigeres og slettes fra
  en diskret `...`-menu paa eventkortet. Redigering genbruger opret-siden med
  eksisterende data, og sletning kraever en bekraeftelsesmodal.
- Mobilappen bruger `POST /api/events/:eventId/update` og
  `POST /api/events/:eventId/delete` til rediger/slet, fordi det er mere
  stabilt paa telefon/proxy end rene `PATCH`/`DELETE`. Backend understoetter
  stadig begge varianter.
- Overblik viser nu en lille `Min kalender i dag`-container baseret paa de
  rigtige events. Foerste event vises som `Naeste event`, op til tre flere
  vises under `Flere events`, og resten skjules som `+N skjult i kalenderen`.
  Event-raekkerne har timepill, lokationsikon og pil. Tryk paa en event-raekke
  sender pt. kun videre til kalenderen, indtil event-detail-siderne bliver
  bygget.
- Chatten bruger Laravel Reverb til realtime via private kanaler. Hvis en
  development build mangler native NetInfo-modulet, falder appen tilbage til
  polling.
- Native release-builds har API/Reverb-env baked ind ved build-tidspunktet og
  kraever ikke Metro. Metro bruges kun til Expo Go/dev-client udvikling.
- Cloud-start til Expo/Metro findes som `npm run mobile:start:cloud` og
  `npm run mobile:start:cloud:tunnel`.
- iOS release mod Cloud kan bygges med `npm run mobile:ios:release:cloud`.
- Android preview/dev bygges via EAS scripts:
  `npm run mobile:build:android` og `npm run mobile:build:android:dev`.
- Android release-lignende testbuild mod Cloud bygges med
  `npm run mobile:build:android:cloud`. Den bruger EAS `preview`-profilen,
  er ikke Expo Dev Client, og har Cloud API/Reverb-env baked ind.
- Seneste Android Cloud testbuild er startet paa EAS 2026-04-28 kl. 23.46:
  `https://expo.dev/accounts/chrissorensen/projects/studos/builds/23a3ddaa-796a-449c-9001-4389d8b2efec`.
  Den bruger `preview`/APK-profilen med Cloud API/Reverb baked ind og skal
  indeholde Android push/Firebase, Studos notification-icon config, chat-push,
  `projectId` fallback, foerste-aabning popup til notifikationer,
  sidebar-fix, midlertidigt flyttet `Indstillinger` op i sidebaren og de
  seneste Metro-warning fixes.
- Lige foer Android-buildet blev startet, blev `npm run mobile:push:check`
  koert groent, og Expo JS export blev koert groent for baade Android og iOS.
  De konkrete warning-fixes er: deprecated React Native `SafeAreaView` fjernet,
  duplicate React keys dedupet paa chat/events/attendees, og Reverb/Echo paa
  React Native peger nu paa den rigtige `Pusher` constructor.
- `apps/mobile/app.config.js` skal blive ved med at bruge Expo's `config`
  argument fra `app.json`; ellers fejler `expo doctor` paa common config check.
- Android development-build bruger separat navn og package:
  `Studos-dev` / `dk.studenterapp.mobile.dev`, saa den kan ligge ved siden af
  normal `Studos` / `dk.studenterapp.mobile`.
- Android push-notifikationer er startet med `expo-notifications`.
  Notifikationskode koerer kun paa Android i runtime, og config-plugin'et bliver
  kun aktiveret for Android-builds via `STUDOS_ENABLE_ANDROID_NOTIFICATIONS=1`,
  saa iOS/free signing ikke faar APNs-entitlement endnu.
- Android push kraever Firebase/FCM, ikke kun Expo-kode. Lokal config leder nu
  automatisk efter den Firebase-fil, der matcher build-varianten. Uden
  matchende `google-services*.json` giver Android fejlen `Default FirebaseApp
  is not initialized`.
- Firebase Android config er lagt ind for begge varianter:
  `apps/mobile/google-services.json` matcher `dk.studenterapp.mobile`, og
  `apps/mobile/google-services.dev.json` matcher `dk.studenterapp.mobile.dev`.
  Firebase project id er `studos-app-820f7`, project number er `959040548905`.
  FCM V1 service account key er uploadet til EAS credentials for baade
  `preview` / `dk.studenterapp.mobile` og
  `development` / `dk.studenterapp.mobile.dev`.
  `app.config.js` auto-vaelger Firebase config efter build-variant:
  preview/APK bruger `google-services.json` for `dk.studenterapp.mobile`, mens
  development/dev-client bruger `google-services.dev.json` eller en samlet
  `google-services.json`, hvis den indeholder `dk.studenterapp.mobile.dev`.
  `npm run mobile:push:check` validerer begge og er groen. Seneste Android
  preview/APK build er startet; naar den er faerdig og installeret, kan
  Firebase-configen testes i den installerede app.
- Chat-push er koblet paa backend: naar en ny chatbesked gemmes, sender
  backend en Expo push til aktive Android-modtagere med gemt push-token.
  Afsender faar ikke push, og muted chats bliver sprunget over.
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

Status pr. 2026-04-29:

- Projektet er migreret fra statisk web + Node API til Laravel web/API.
- XAMPP URL virker lokalt: `http://localhost/studenter-app/public/`.
- Laravel Cloud deployment virker paa `https://studos.laravel.cloud`.
- API health er testet i Cloud: `https://studos.laravel.cloud/api/health`.
- SQL koerer lokalt via XAMPP/phpMyAdmin og i drift via Laravel Cloud MySQL.
- Laravel Cloud har Reverb WebSockets og bucket/S3-compatible storage tilkoblet.
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
- Native iOS release-build kan koere direkte mod Cloud uden Metro, naar den er
  bygget med Cloud-env.
- Android har EAS preview/dev scripts, og dev-build har separat navn/package
  (`Studos-dev`), saa den ikke konflikter med normal app.
- PWA'en ligger live under `/pwa/` og er opdateret til cache-version `v9`.
- Mobilappen/PWA'en har footer-navigation: Kalender, Chat, Overblik, Wallet,
  Walls.
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
  cover-upload, dato/tid, invitationer, personvaelger med soegning, RSVP,
  afventer-svar-side, deltagerliste-modal samt rediger/slet for egne events.
- Rediger/slet-events er ejerstyret i backend. Kun `created_by_member_id` maa
  redigere eller slette. Naar inviterede aendres, beholdes svar for personer
  der stadig er inviteret, nye inviterede staar som afventer, og fjernede
  inviterede faar deres RSVP fjernet.
- Overblik har dynamisk `Dage til studenterugen`, et `Mit Studos`-kort med
  profilbillede/navn, QR-boble, statistik-pills, hueklip-ikoner og
  stemnings-check-in.
- `Mit Studos`-kortet har roed/gul/lyseblaa topaccent, boelget bund, QR-modal
  med personlig Studos-kode og QR, samt hueklip-ikoner der kan markeres som
  gennemfoert via modal. Hueklip-status er pt. lokal UI-state.
- Stemnings-check-in ligger nederst i `Mit Studos`-kortet og skifter mellem
  roed/groen alt efter om brugeren har checket ind i dag. Den nulstiller ved
  lokal midnat, men er pt. kun lokal state og ikke gemt paa backend.
- Under `Mit Studos` ligger `Min kalender i dag`, som bruger rigtige events for
  dags dato. Den viser maks fire: foerste som `Naeste event`, de naeste tre som
  `Flere events`, og resten skjult. Hvis der kun er et event, vises teksten
  `Du har ikke flere planlagte events i dag.`
- Lokal dev-data paa Chris/demo-klassen har fire events i dag, saa
  Overblik-kalenderen kan testes med reelt indhold.
- Profile photos, event covers og gruppechat-billeder er flyttet over paa
  Laravel `Storage`-disk. Nye uploads gemmes som storage-paths, og API'et
  resolver dem til lokal dev-URL eller Cloud bucket-URL efter miljoe.
- Gamle `file://` billed-URL'er er ikke migreret. Upload paa ny, hvis gamle
  billeder ikke vises.
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
- Push-notifikationer er startet paa Android med testflow og chat-push. Der
  mangler stadig kalender-push, daglig stemningsreminder og brugerindstillinger
  for kanaler.
- TestFlight/App Store/EAS iOS distribution.
- Cloud smoke-test af nye image uploads paa iOS, Android og PWA efter bucket
  deploy.
- Persistens/API for stemnings-check-in, hueklip-status og de tre
  Overblik-statistikker (`Challenges`, `Gilder`, `Minder`).
- Event-detail-sider og kobling fra Overblik-eventpile direkte til det valgte
  event. Kalenderens egne kort kan dog nu administreres direkte via `...`.
- Rebuild af native iOS/Android, naar de seneste mobile/PWA fixes skal ind i
  installerede apps.
- Kontosletning/data-export UI, hvis det ikke allerede ender som support-flow.

## Foer drift / udgivelse

Dette er de vigtigste ting, der skal vaere styr paa, foer appen sendes til
App Store/Google Play eller bruges af en rigtig klasse:

- `APP_ENV=production`, `APP_DEBUG=false`, HTTPS, rigtige produktions-URL'er og
  ingen lokal XAMPP/LAN-IP i app-buildet.
- Bucket/S3 storage skal vaere korrekt sat op i Cloud: `FILESYSTEM_DISK`,
  `AWS_BUCKET`, `AWS_REGION`, `AWS_URL`/endpoint og
  `league/flysystem-aws-s3-v3`. Smoke-test profile photos, event covers og
  gruppechat-billeder efter hver deploy, der roerer uploadkode.
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
- Backups af database og bucket/uploads skal planlaegges, og `.env`/keys maa ikke
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

Seneste lokale Metro-dev har koert paa port `8081`. Hvis appen ikke forbinder,
start Metro igen med kommandoen ovenfor.

Start mobilappen i Expo mod Laravel Cloud:

```bash
npm run mobile:start:cloud
```

Hvis Android/iOS ikke kan naa lokal Metro paa samme netvaerk, brug tunnel:

```bash
npm run mobile:start:cloud:tunnel
```

Start Reverb i et separat terminalvindue, naar chat realtime skal testes:

```bash
npm run reverb:start
```

Byg og installer lokal iPhone-release:

```bash
npm run mobile:ios:release
```

Byg og installer iPhone-release med Cloud-env baked ind:

```bash
npm run mobile:ios:release:cloud
```

Byg Android APK til reel test mod Cloud:

```bash
npm run mobile:build:android:cloud
```

PWA-test i Cloud:

```text
https://studos.laravel.cloud/pwa/?v=9
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
npm --workspace @studenter-app/mobile exec expo export -- --platform web --output-dir /tmp/studos-web-export
npm --workspace @studenter-app/mobile exec expo run:ios -- --device "iPhone" --configuration Release --no-bundler --no-install
npm --workspace @studenter-app/mobile exec expo export -- --platform ios --output-dir /tmp/studos-overview-calendar-gap-export
php artisan test --filter test_students_can_create_calendar_events_and_update_rsvp
npx expo export --platform web --output-dir /tmp/studos-calendar-delete-post-check --clear
```

Resultat:

- `php artisan test`: seneste fulde status i denne note var 23 tests passed,
  277 assertions.
- Kalender feature-test med opret, RSVP, rediger, invite-sync og slet:
  1 test passed, 48 assertions.
- iOS export: OK.
- Web export/PWA bundle: OK.
- Web export efter kalender rediger/slet POST-routes: OK.
- iPhone Release build: OK.
- Direkte iPhone install: OK.
- Direkte iPhone launch: OK.
- PWA shell er senest versioneret til `v9` efter PWA API-base fix.
- Seneste mobile export efter Overblik/kalender-polish: OK.
- Android EAS Cloud testbuild med `expo-notifications`, chat-push,
  projectId-fallback, notification prompt, sidebar-fix og Cloud API/Reverb er
  startet paa EAS:
  `https://expo.dev/accounts/chrissorensen/projects/studos/builds/23a3ddaa-796a-449c-9001-4389d8b2efec`.
  Tidligere Android build foer de seneste Metro-warning fixes var:
  `https://expo.dev/accounts/chrissorensen/projects/studos/builds/8cab84a8-6386-4722-a5d9-79f6f01b75a1`.

## Vigtige noter

- Projektet hed oprindeligt `Studenter App`, men produktbrandet er nu `Studos`.
- Nogle interne package-/mappe-/target-navne hedder stadig `studenter-app` eller
  `StudenterApp`. Det er ikke et problem lige nu; brugerens app-navn og
  web-brand er `Studos`.
- Laravel er nu kilden til web, admin, API og database-migrations.
- Mobilappen er Expo/React Native og kalder Laravel API'et. PWA'en bruger samme
  app-bundle i web-export.
- Appens lokale session ligger i `expo-secure-store`. Brug `Skift profil` i
  `Mere`, hvis onboarding/login skal testes igen.
- PWA/browser bruger localStorage wrapper, fordi `expo-secure-store` ikke findes
  i Safari.
- Native Release-builds kraever ikke Metro, men env er baked ind ved build.
  Skift mellem lokal/Cloud ved at bygge/starte med de rigtige `EXPO_PUBLIC_*`
  variabler/scripts.
- Chatten har foerste rigtige version og er App Store/Google Play-orienteret
  med filtering, reporting og blocking, men skal stadig testes grundigt paa to
  rigtige enheder med baade Reverb og fallback/polling.
- Udviklingsnote: `Mit crew` i sidebaren bruger nu det faktiske medlemstal fra
  `activeMembers`; den gamle demo-count er fjernet. Hold stadig oeje med andre
  demo-UI-tekster som hardcodede badges, klip/challenges/vibes og
  placeholder-sider foer produktionsbuild.
- Profilbilleder, event covers og gruppechat-billeder gaar via Laravel
  `Storage`-disk. Databasen gemmer `uploads/...` paths, og API'et resolver til
  lokal `/storage/...` i dev eller bucket/S3 i Cloud.
- QR-koden i `Mit Studos` er en rigtig lokal QR-rendering af den personlige
  Studos-kode, ikke bare en statisk mockup. Den skal stadig testes med et
  faktisk scan-flow, naar connection/QR-produktflowet bliver laast.
- Overblik-statistikkerne `Challenges`, `Gilder` og `Minder` er stadig
  demo-tal. Stemning og hueklip er lokal UI-state. Kalenderdelen bruger rigtige
  backend-events.
- Hvis PWA'en viser gammel UI efter deploy, aabn
  `https://studos.laravel.cloud/pwa/?v=9` eller fjern og installer PWA'en igen.
- Engangskode-endpoints findes stadig til senere email-flow, men appen bruger
  nu email + adgangskode.
- iOS-notifikationer bor parkeret indtil Apple Developer-konto/provisioning er
  paa plads. Android kan testes via foerste-aabning prompten eller
  `Indstillinger > Android push`, naar buildet med projectId-fallback er
  installeret.
- Chat-notifikationsteksten styres i `ChatController::sendChatPushNotifications`.
  Afsenderens navn sendes som notifikationens titel, beskeduddraget som body,
  og Studos-logoet sendes som `richContent.image`. Android styrer stadig den
  praecise placering/styling i systemnotifikationen.
- Ved XAMPP 500-fejl paa Blade views skal `storage/` og `bootstrap/cache/` vaere
  skrivbare for Apache.
- Ved "The route api/events/{id} could not be found" paa mobilen efter nye
  API-routes: koer `php artisan optimize:clear`, reload appen og sikre at
  buildet bruger de nye `POST /update` og `POST /delete` endpoints.

## Naeste gode skridt

1. Lav admin/moderationsside til rapporter, blocks og
   `moderation_violations`.
2. Gennemfoer to-enheds-test af chat: iOS/Android, Reverb/polling, swipe,
   keyboard, long-press, rapportering og blokering.
3. Goer Overblik-data rigtig: gem stemnings-check-in, hueklip-status og
   statistik-tal paa backend.
4. Regressionstest kalenderflowet paa rigtige enheder: opret, rediger, slet,
   deltag/ikke deltag, afventer-svar-side, deltagerliste og tomme states.
5. Lav glemt adgangskode/email-reset og afklar kontosletning/data-export.
6. Lav `Walls` som feed/galleri og `Awards` med foerste afstemningsflow.
7. Lav join approval-flow i web/admin og QR/invitelink.
8. Naar Apple Developer er klar: skift bundle id til `dk.studos.mobile`, opret
   provisioning, saet TestFlight op og foerst derefter push-notifikationer.
