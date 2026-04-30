# Studos

Studos er en privat klassehub til studenteraret: Laravel web/admin/API,
Laravel Cloud drift og en Expo/React Native app til iOS/Android. Denne README
er projektets aktuelle "start her igen"-note.

Status er opdateret 2026-04-29 efter oprydning, kalender-/overblikspolish,
sidebar-aendringer og App Store/Google Play gennemgang.

Se ogsaa:

- `DETTE_MANGLER_VI.md` for korte produktnoter, der ikke maa glemmes.
- `apps/mobile/README.md` for mobil-specifikke build- og pushnoter.
- `docs/blueprint.md` og `docs/decisions.md` for tidlige produktbeslutninger.

## Aktuel status

- Web/API koerer i Laravel og bruges som kilde til sandhed.
- Lokal web ligger paa `http://localhost/studenter-app/public/`.
- Cloud ligger paa `https://studos.laravel.cloud`.
- Cloud API ligger paa `https://studos.laravel.cloud/api`.
- Mobilappen ligger i `apps/mobile` og bruger Expo SDK 55 / React Native 0.83.
- Native release-builds kan bygges med Cloud-env baked ind og kraever ikke
  Metro.
- Expo Go/dev-client bruger Metro til udvikling; release-builds maa ikke vaere
  afhaengige af lokal dev-server.
- PWA'en er midlertidig test-wrapper under `public/pwa/`, pt. cache-version
  `v15`. Den er ikke hovedproduktet til release.

## Struktur

```text
studenter-app/
  app/        Laravel controllers, models og supportkode
  bootstrap/ Laravel bootstrap/cache
  config/    Laravel konfiguration
  database/  Migrations og seeders
  public/    XAMPP/Apache webroot, PWA-shell og web-assets
  resources/ Blade views
  routes/    Laravel web/API routes
  storage/   Laravel cache/log/session storage
  apps/
    mobile/  Expo/React Native app
  packages/
    shared/  Plads til delte typer/helpers senere
  docs/      Produktnoter og arkitektur
```

## Hurtig Start

Installer dependencies fra projektroden:

```bash
composer install
npm install
```

Klargor database lokalt:

```bash
php artisan migrate
```

Start Laravel dev-server:

```bash
npm run web:dev
```

Start Expo/Metro lokalt:

```bash
npm run mobile:start
```

Start Expo/Metro mod Laravel Cloud:

```bash
npm run mobile:start:cloud
```

Hvis en fysisk telefon ikke kan naa Metro paa samme netvaerk:

```bash
npm run mobile:start:cloud:tunnel
```

Start Reverb lokalt til chat realtime:

```bash
npm run reverb:start
```

## Vigtige Scripts

```bash
npm run mobile:ios:release
npm run mobile:ios:release:cloud
npm run mobile:build:android:cloud
npm run mobile:push:check
php artisan test
php artisan optimize:clear
```

Brug denne export som hurtig JS/build-sanity for iOS:

```bash
npm --workspace @studenter-app/mobile exec expo export -- --platform ios --output-dir /private/tmp/studos-ios-export --clear
```

## Laravel/API

Kernen er:

- Klasser, skoler, medlemmer, roller og invitekode/KlasseID.
- Medlemslogin med email/adgangskode og bearer-token.
- Profilbilleder, eventcovers og gruppechat-billeder via Laravel `Storage`.
- Events med dato/tid, cover, invitationer, RSVP, rediger/slet og rapportering.
- Chat med direkte samtaler, gruppechats, Reverb/polling, mute, hide, leave,
  delete, report og block.
- Connections via personlig Studos-kode.
- Android push-token registrering og chat-push.

Roller pr. 2026-04-29:

- `owner`: kan styre klasseindstillinger, invite/join-policy, medlemmer,
  roller, CMS, events og moderation.
- `moderator`: kan styre CMS, events og moderation, men kan ikke aendre
  klasseindstillinger, medlemmer eller roller.
- `student`: kan bruge appen, chatten og events, men har ikke web-admin/CMS
  adgang.

Web-admin aabner kun direkte for `owner` og `moderator`. En bruger, der er
aktiv `student` i en klasse, bliver ikke sendt ind i admin og kan ikke oprette
en ekstra klasse fra samme web-login.

Vigtige API-endpoints:

```text
GET  /api/health
POST /api/classes/join
POST /api/session/login
GET  /api/session/me
POST /api/profile/photo
POST /api/events
POST /api/events/{event}/update
POST /api/events/{event}/delete
POST /api/events/{event}/report
POST /api/events/{event}/rsvp
GET  /api/chat/conversations
POST /api/chat/conversations/direct
POST /api/chat/conversations/group
POST /api/chat/conversations/{conversation}/messages
POST /api/chat/conversations/{conversation}/report
POST /api/chat/conversations/{conversation}/block
POST /api/chat/messages/{message}/report
DELETE /api/chat/messages/{message}
POST /api/notifications/push-token
POST /api/notifications/test
```

## Mobilappen Lige Nu

Footer-navigation:

- `Kalender`
- `Chat`
- `Overblik`
- `Duel`
- `Walls`

Sidebar:

- `Din klasse`: Leaderboard, Dagens stemning, Klasseawards, Tilfaeldig vaelger.
- `Andre klasser`: Andre klasser, Klassedueller.
- `Kommende`: Wallet og Blaa bog er laast.
- Nederst: Noedkontakter og Indstillinger.

Overblik:

- Headeren clampler ved scroll.
- Main-content scroller under headeren.
- Kortene faar scroll-effekt og bliver mindre paa vej under headeren.
- `Mit Studos` viser profil, QR, hueklip og klasseinfo.
- Hueklip-gennemfoert gemmes lokalt pr. bruger, indtil brugeren selv aendrer
  det igen.
- Caps-container viser brugerens forelobige `1.000 Caps` og knap til Duel.
- `Min kommende kalender` viser alle dagens events og maks 3 kommende events.
- Klik paa et event i Overblik aabner Kalender paa den rigtige dag/eventkort.
- `Dagens stemning` gemmes lokalt pr. bruger og resetter ved lokal midnat.
- Der er nederste kort til `Seneste walls aktivitet` og `Klassedueller`.

Kalender:

- Events sorteres efter lokal dansk dato/tid.
- Et event bliver tidligere, naar dets starttidspunkt er passeret.
- Tidligere events ligger bag en fuldbredde knap nederst paa kalendersiden.
- Afholdte kort viser `Deltog` og `Deltog ikke`.
- Eventkort har titel paa coverbilledet, dato-container, avatar-stack, RSVP,
  cover-upload og stock-covervalg.
- Rediger/slet bruger stabile `POST /update` og `POST /delete` endpoints.

Chat:

- Direkte chats, gruppechats, gruppebillede og unread-count.
- Long-press paa samtaler/beskeder giver handlinger.
- Rapportering, blokering og moderation logs er startet.
- Realtime bruger Laravel Reverb, med polling fallback.

## Build-/Store-Konfiguration

iOS:

- Bundle id: `dk.studenterapp.mobile`.
- App-navn: `Studos`.
- Produktbuild fjerner lokal netvaerkspermission automatisk.
- Development variant kan bruge lokal netvaerkspermission til dev-server.
- Photo Library permission forklarer profilbillede og eventcover.
- iOS push/APNs er bevidst parkeret, indtil Apple Developer/provisioning er
  paa plads.

Android:

- Package: `dk.studenterapp.mobile`.
- Development package: `dk.studenterapp.mobile.dev`.
- Firebase config findes for begge varianter.
- Android notifications slaas kun til, naar
  `STUDOS_ENABLE_ANDROID_NOTIFICATIONS=1`.
- `android.permission.RECORD_AUDIO` er blokeret, fordi appen ikke har en reel
  mikrofonfeature lige nu.

## Oprydning 2026-04-29

Ryddet op:

- Fjernet tom root-`app.json`, som kunne forvirre Expo config.
- Fjernet gamle ubrugte `footer-duel` PNG-assets. Duel-ikonet tegnes nu stabilt
  i React Native.
- Fjernet tre gamle PWA JS-bundles, som ikke var refereret af `pwa/index.html`
  eller `sw.js`.
- Fjernet tom `public/favicon.ico` og peget web/PWA paa Studos SVG-marken som
  favicon.
- Opdateret PWA manifest fra cache-version `v9` til `v15`.
- Blokeret Android mikrofonpermission.

Ikke slettet:

- Native `ios/Pods` og Xcode Derived/native filer, fordi de er build-/native
  output og kan vaere noedvendige for lokal iOS release.
- PWA bundle/assets, der stadig er refereret af `public/pwa/index.html`,
  `public/sw.js` eller manifestet.

## App Store / Google Play Status

Det der ser godt ud:

- Appen har ikke lokal dev-server/netvaerkspermission i produktions-iOS config.
- Photo permission er konkret og knyttet til brugerens egen handling.
- Chat/events har filtering, rapportering, blokering og throttling.
- Android push er feature-gated og ikke aktiv for iOS.
- Android mikrofonpermission er nu fjernet/blokeret.
- Backend koerer paa HTTPS i Cloud.

Release-blokkere foer Apple/Google:

- Kontosletning skal kunne startes inde i appen og via offentlig webside.
- Privatlivspolitik, vilkaar/EULA og supportside skal vaere live og linket fra
  appen/store listings.
- App Privacy / Data Safety skal udfyldes med email, navn, bruger-ID,
  profilbilleder/uploads, chatindhold, events, push-token og supportdata.
- Der skal vaere en reel admin/moderationsside til rapporter, blocks og
  moderation violations.
- UGC-vilkaar skal klart forbyde chikane, diskrimination, trusler, seksuelt
  indhold, ulovligt indhold og misbrug af billeder/chat.
- Review-notes skal have demo-login, forklaring af invitekode og hvor reviewer
  finder rapporter/blokering.
- Placeholder/laaste features skal ikke markedsfoeres som faerdige features.
- Privacy manifest/required reason APIs skal kontrolleres i Xcode archive foer
  App Store Connect upload.
- Google Play target API skal kontrolleres ved EAS production AAB. Nye apps og
  updates skal ramme aktuel Play target API-krav.

## Ikke Lavet Endnu

- Wallet.
- Blaa bog.
- Walls/feed/galleri.
- Klasseawards/afstemninger.
- Noedkontakter.
- Pointduel backend, Caps-transaktioner og duel-regler.
- Backend-persistens for Dagens stemning og hueklip.
- Kalender-push og daglig stemningsreminder.
- Glemt adgangskode/email reset.
- Join approval-flow i web/admin.
- QR-invite/QR-scan flow.
- Admin/moderationsside.
- Kontosletning/data-export flow.

## Testdata

Mobile test-login:

```text
Invitekode: STU-DEMO26
Email: chris@skole.dk
Password: studos123
```

Web test-login:

```text
URL: http://localhost/studenter-app/public/login
Email: chris@skole.dk
Password: studos123
```

## Seneste Verificering

Senest koert 2026-04-29 efter oprydning og rolle/CMS-stramning:

```bash
php artisan test
npm run mobile:push:check
npm --workspace @studenter-app/mobile exec expo export -- --platform ios --output-dir /private/tmp/studos-cleanup-ios-export --clear
```

Resultat:

- `php artisan test`: 28 tests passed, 351 assertions.
- `npm run mobile:push:check`: OK for baade `dk.studenterapp.mobile` og
  `dk.studenterapp.mobile.dev`.
- iOS Expo export: OK. Kun kendte Node `NO_COLOR`/`FORCE_COLOR` warnings.

## Naeste Gode Skridt

1. Lav kontosletning i app + offentlig deletion URL.
2. Lav privacy policy, terms/EULA og supportside paa web.
3. Lav admin/moderationsside.
4. Kør to-enheds QA af chat, kalender, uploads, blocking/reporting og login.
5. Gør Dagens stemning/hueklip/Caps rigtige i backend.
6. Lav App Store Connect metadata, screenshots, privacy labels og review notes.
7. Lav production iOS/TestFlight build og Android production AAB.
