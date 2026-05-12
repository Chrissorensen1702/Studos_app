# Studos

Studos er en privat klasseapp til studenteraret. Selve produktet ligger i
mobilappen, mens Laravel leverer API, realtime, scheduler, public web og de
juridiske sider.

Status pr. 2026-05-12: appen er gjort klar til TestFlight/internal testing.
Webdelen er nu en offentlig informationsside.

## Kort Fortalt

- Mobilappen er bygget i Expo/React Native.
- Backend og public web er bygget i Laravel.
- Production-domain: `https://studos.laravel.cloud`.
- Production API: `https://studos.laravel.cloud/api`.
- Klasseoprettelse, login, klasseadmin og moderation foregar i appen.
- Public web bruges til forside, Om Studos, FAQ, politikker, cookievalg og
  supportinfo.
- Tidligere webbaserede appflows redirecter til forsiden.

## Struktur

```text
studenter-app/
  app/             Laravel controllers, models, events og supportkode
  config/          Laravel konfiguration
  database/        Migrations, seeders og factories
  public/          Webroot, styles, JS og assets
  resources/       Blade views og partials
  routes/          Laravel web/API/console routes
  tests/           Laravel feature tests
  apps/mobile/     Expo/React Native app
  docs/            Produkt- og tekniske noter
  packages/shared/ Plads til delte helpers/typer senere
```

## Public Web

Aktuelle public sider:

- `/`
- `/om-studos`
- `/faq`
- `/brugervilkaar`
- `/privatlivspolitik`
- `/cookiepolitik`
- `/slet-konto`

Webdelen har global header, topbar, footer og cookie-consent partials.
Cookievalget gemmes i browserens `localStorage`, og brugeren kan aendre valget
igen fra footer eller cookiepolitikken.

Alle produktflows, klasseflows og rollebaserede vaerktojer ligger i appen.

## Mobilappen

Appens hovedomrader:

- Klassekode, eksisterende login og opret klasse i appen.
- Profiloprettelse med skole, alder, samtykke, profilfoto og valgfri
  nodkontakt.
- Overblik med Mit Studos, QR/Studos-kode, hueklip, Caps, kommende kalender,
  seneste aktivitet og Dyst-preview.
- Kalender med events, covers, invitationer og RSVP.
- Chat med direkte chats, gruppechats, reactions, unread, mute, report,
  block, read-state og Reverb realtime med polling fallback.
- Dyst/Challenges med Caps, accept/afvis, deadlines, dommerflow, arkiv og
  resultater.
- Galleri med albummer, private/faelles synligheder, multi-upload,
  multi-select, swipe viewer, gem pa telefon, sletning og rapportering.
- Aktiviteter som filtreret klassefeed.
- Optjen Caps, Leaderboard, Arcade Hub, Mit crew, Nødkontakter og
  Indstillinger.
- Klasseprofil og Rapporteringer for relevante roller.

Roller:

- `owner`: klasseprofil, medlemmer, join-policy, events, rapporter og
  moderation.
- `moderator`: rapporteringer og moderation.
- `student`: almindelig appadgang uden adminsektion.

Datamodellen bruger `members` som appens rigtige klasseprofil. `users` kan
senere bruges som platform-identitet til fx intern support pa tvaers af
klasser.

## Produktion Og Links

Appens public policy-links skal pege pa:

```text
https://studos.laravel.cloud/privatlivspolitik
https://studos.laravel.cloud/brugervilkaar
https://studos.laravel.cloud/slet-konto
```

Relevante mobile env-vars:

```env
EXPO_PUBLIC_API_URL=https://studos.laravel.cloud/api
EXPO_PUBLIC_WEBSITE_URL=https://studos.laravel.cloud
EXPO_PUBLIC_TERMS_URL=https://studos.laravel.cloud/brugervilkaar
EXPO_PUBLIC_PRIVACY_URL=https://studos.laravel.cloud/privatlivspolitik
EXPO_PUBLIC_DELETE_ACCOUNT_URL=https://studos.laravel.cloud/slet-konto
EXPO_PUBLIC_REVERB_APP_KEY=...
EXPO_PUBLIC_REVERB_HOST=...
EXPO_PUBLIC_REVERB_PORT=443
EXPO_PUBLIC_REVERB_SCHEME=https
EXPO_PUBLIC_SUPPORT_EMAIL=...
```

Production-builds ma ikke pege pa `localhost`, `192.168.*`, `.local` eller
XAMPP-stier.

## Lokal Start

Installer dependencies:

```bash
composer install
npm install
```

Klargor database:

```bash
php artisan migrate
php artisan db:seed --class=SchoolSeeder
```

Start Laravel lokalt:

```bash
npm run web:dev
```

Start Reverb lokalt, hvis realtime skal testes:

```bash
npm run reverb:start
```

Start appen:

```bash
npm run mobile:start
```

Udvikling med native dev-client:

```bash
npm run mobile:start:dev-client
```

## Skoler Og Klasseoprettelse

Appens `Opret klasse` flow bruger `schools` som obligatorisk valgliste.
Efter en frisk lokal database skal skoler derfor seedes, foer klasseoprettelse
kan bruges:

```bash
php artisan db:seed --class=SchoolSeeder
```

`SchoolSeeder` indeholder pt. 30 danske gymnasier, inkl.
`Herningsholm Gymnasium, HHX og HTX Herning`.

Ved klasseoprettelse gemmes dimissionsdatoen kun som metadata på klassen
(`classes.graduation_date`). Den opretter ikke længere et automatisk
`Dimission` event i kalenderen.

## TestFlight / Release

Foer TestFlight:

- Laravel Cloud er deployet og migrations er koert.
- `schools` er seedet/opdateret i production.
- Scheduler/cron kører `php artisan schedule:run` hvert minut.
- Reverb kører over HTTPS/TLS.
- Production env-vars er sat i EAS/Laravel Cloud.
- APNs/FCM credentials er sat i EAS.
- Policy-links og support-email peger pa production.
- App version/build number er opdateret ved behov.

iOS build til intern test/TestFlight:

```bash
npm run mobile:build:ios
```

Production submit, nar buildet er klar:

```bash
npx eas-cli submit --platform ios --profile production
```

Android preview build:

```bash
npm run mobile:build:android
```

Android production build:

```bash
npx eas-cli build --platform android --profile production
```

## Verifikation

Backend:

```bash
php artisan test
php artisan view:cache
```

Mobil JS:

```bash
node --check apps/mobile/App.js
```

Push/Firebase config:

```bash
npm run mobile:push:check
```

Expo export sanity:

```bash
npm --workspace @studenter-app/mobile exec expo export -- --platform ios --output-dir /private/tmp/studos-ios-export --clear
```

## Driftsting Der Ikke Ma Glemmes

- Scheduler er paakraevet for Dyst-udlob og reminder-notifikationer.
- Reverb skal restarte automatisk ved deploy/crash.
- Upload/storage skal virke for profilbilleder, eventcovers, chatbilleder og
  galleri.
- App Review skal have demo-login eller tydelig testvej via klassekode.
- Privacy labels/Data Safety skal matche appens faktiske data.
- Rapportering, blokering, strikes og kontosletning skal smoke-testes pa en
  production-lignende build.

Se ogsa `PUBLISH_CHECKLIST.md` for den lange release-checkliste og
`apps/mobile/README.md` for app-specifikke noter.
