# Studos

Global projektstatus for Studos: Laravel web/admin/API, XAMPP MySQL-database
og native React Native iPhone-app.

Denne README er en "start her igen"-note, saa projektet kan tages op uden at
miste konteksten.

## Produktide

Studos er en privat klassehub til studenteraret. En klasse kan oprettes paa web,
faa en privat invitekode og et offentligt KlasseID, og derefter bruge en native
app til alt det praktiske og sociale omkring studenterforlobet.

Hovedideen:

- `Laravel`: website, admin, login, roller, API og database/migrations.
- `mobile`: elevernes native app med join-flow, klasseforside, countdown,
  events og senere feed, billeder, blaa bog og notifikationer.
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
- Tabeller: `schools`, `classes`, `members`, `events`, `member_connections`,
  `member_blocks`, `member_reports` plus Laravels egne tabeller.
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
- `POST /api/classes/:classId/members/:memberId/access`

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
- `Overblik` er pt. en ren forside med titel, countdown, personlig
  `Studos-kode` og en lille studenterhat over O'et.
- Topbaren viser skole/klasse, Studos-wordmark, custom hamburger-menu og synlig
  skygge over sideindholdet.
- Sidebaren er en kompakt, ikke-scrollende drawer. `Mit crew` ligger som en
  selvstaendig top-entry med medlemstal, mens `Din klasse` og `Andre klasser`
  samler de oevrige sociale klassefeatures.
- Sidebar-ikonerne bruger en fast Studos-palette (`lyseblaa`, `gul`, `roed`,
  `moerk`) og er bygget som simple React Native `View`-former, hvor flerfarve
  giver mening, i stedet for svaere SVG'er.
- `Chat`, `Walls`, `Kalender`, `Wallet` og sidebar-siderne er oprettet som
  foerste placeholder-sider.
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

## App Store-godkendelse

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
- Fremtidige features som billeder, chat, moderation og notifikationer skal
  designes med Apples privacy-, safety- og content-regler i tankerne.
- Oprettelse skal indsamle accept af vilkaar og privatlivspolitik. Der er
  databasefelter til samtykke/version, kontosletning samt tabeller til
  rapportering og blokering, saa sociale features kan bygges App Store-klar.

Mobile test-login:

```text
Invitekode: STU-DEMO26
Email: chris@skole.dk
Password: studos123
```

## Hvor vi er lige nu

Status pr. 2026-04-26:

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
  ligger som placeholder-sider.
- Seneste iPhone Release-build er bygget, installeret og launched paa parret
  iPhone via `devicectl`.
- Studos-branding er lagt paa website og app-ikoner.

Ikke lavet endnu:

- QR-invite.
- Join approval-flow i web/admin.
- Glemt adgangskode/email-reset.
- Rigtig chat.
- Walls/feed/galleri.
- Awards/afstemninger.
- Blaa bog og moderation i UI.
- Push-notifikationer.
- TestFlight/App Store/EAS iOS distribution.
- Produktionshosting.

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
- Profilbilleder gemmes lige nu som lokal reference/URL, ikke som rigtig upload.
- Engangskode-endpoints findes stadig til senere email-flow, men appen bruger
  nu email + adgangskode.
- Notifikationer bor parkeret indtil Apple Developer-konto/provisioning er paa
  plads.
- Ved XAMPP 500-fejl paa Blade views skal `storage/` og `bootstrap/cache/` vaere
  skrivbare for Apache.

## Naeste gode skridt

1. Lav rigtig indhold til `Chat`.
2. Lav `Walls` som feed/galleri.
3. Lav `Awards` med foerste afstemningsflow.
4. Lav join approval-flow i web/admin.
5. Lav glemt adgangskode/email-reset.
6. Tilfoej QR/invitelink.
7. Udbyg profilbilleder med rigtig upload/storage i stedet for lokal reference.
8. Naar Apple Developer er klar: skift bundle id til `dk.studos.mobile`, opret
   provisioning, og saet notifikationer/TestFlight op.
