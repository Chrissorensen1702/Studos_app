# Studos

Studos er en privat klassehub til studenteraret: Laravel web/admin/API,
Laravel Cloud drift og en Expo/React Native app til iOS/Android. Denne README
er projektets aktuelle "start her igen"-note.

Status er opdateret 2026-05-03 efter dynamiske Caps, Klassedyst,
Optjen Caps, weekly streak og forenklet claim-flow for ugens gode gerning.

Se ogsaa:

- `DETTE_MANGLER_VI.md` for korte produktnoter, der ikke maa glemmes.
- `apps/mobile/README.md` for mobil-specifikke build- og pushnoter.
- `docs/blueprint.md` og `docs/decisions.md` for tidlige produktbeslutninger.

## Aktuel status

- Web/API koerer i Laravel og bruges som kilde til sandhed.
- Lokal web ligger paa `http://localhost/studenter-app/public/`.
- Public index/landing page bruger hero, store-badges, feature-kort og
  app-mockups fra `public/assets`.
- Headeren bruger Studos-logo som forside-link, `Funktioner` dropdown,
  `Om Studos`, `Moderation`, `FAQ` og CTA-knapper i hoejre side.
- FAQ ligger som offentlig Laravel-side paa `/faq`.
- Cloud ligger paa `https://studos.laravel.cloud`.
- Cloud API ligger paa `https://studos.laravel.cloud/api`.
- Mobilappen ligger i `apps/mobile` og bruger Expo SDK 55 / React Native 0.83.
- Caps er nu en dynamisk backend-enhed via `members.caps_balance` og
  `cap_transactions`.
- Klassedyst bruger API-data og rangerer klasser efter Caps pr. aktiv elev.
- Optjen Caps-siden samler weekly streak, ugens gode gerning, QR-check-in og
  duel-indgange.
- Ugens gode gerning er et simpelt claim: 25 Caps, direkte godkendt, maks en
  gang pr. bruger pr. uge.
- Weekly streak checker automatisk ind, naar appen aabnes, og giver 100 Caps
  efter 7 dage i traek.
- Native release-builds kan bygges med Cloud-env baked ind og kraever ikke
  Metro.
- Expo Go/dev-client bruger Metro til udvikling; release-builds maa ikke vaere
  afhaengige af lokal dev-server.
- PWA-wrapperen er fjernet. Appdistribution sker via native iOS/Android builds.
- Medlems-email er nu entydig på tværs af systemet; én email kan kun knyttes til
  én klasse. Dette håndhæves i backend-validering og database-indekset
  `members.email`.

## Struktur

```text
studenter-app/
  app/        Laravel controllers, models og supportkode
  bootstrap/ Laravel bootstrap/cache
  config/    Laravel konfiguration
  database/  Migrations og seeders
  public/    XAMPP/Apache webroot og web-assets
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
- Eksisterende profil kan nu logges ind uden invitekode (hvis emailen kun findes i
  én klasse).
- Profilbilleder, eventcovers og gruppechat-billeder via Laravel `Storage`.
- Events med dato/tid, cover, invitationer, RSVP, rediger/slet og rapportering.
- Chat med direkte samtaler, gruppechats, Reverb/polling, mute, hide, leave,
  delete, report og block.
- Connections via personlig Studos-kode.
- Caps-wallet via `caps_balance`, transaktionslog i `cap_transactions`,
  Klassedyst, ugens gode gerning og weekly check-in.
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
POST /api/session/request-code
POST /api/session/verify-code
GET  /api/session/me
POST /api/profile/photo
GET  /api/class-battle
GET  /api/good-deeds/current
POST /api/good-deeds/claims
GET  /api/check-ins/weekly
POST /api/check-ins/weekly
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
DELETE /api/members/me
POST /api/notifications/push-token
POST /api/notifications/test
```

## Public Landing Page

Indexsiden (`resources/views/home.blade.php`) er den aktuelle offentlige
landing page.

Hero:

- Bruger `public/assets/landing-hero.png` som fuld hero-baggrund.
- Viser Studos-wordmark og download-badges oven paa hero-billedet.
- Download-badges ligger direkte under hero-teksten og matcher officielle
  store-badge-stile.
- Den interaktive mockup-carousel ligger oven paa hero-billedet i samme
  placering som det tidligere iPhone-mockup og kan skiftes med pile.
- Har en bloed bund-fade i CSS, saa overgangen til feature-sektionen ikke bliver
  haard.

Feature-sektionen:

- Overskriften er `Det der holder vognen i gang` med kort introbroedtekst under.
- Layoutet har app-mockup-karussel i venstre kolonne og 8 UI-kort i hoejre
  kolonne.
- Kortene er SEO-laesbar HTML med `h3` og tekst, mens screenshots kun er visuel
  understoettelse.
- Aktivt kort styrer titel, highlight og farvet shadow paa mockuppen via
  `public/app.js`.
- Footer/sidebar-ikoner genbruges hvor de findes:
  `footer-calendar.png`, `footer-chat.png` og `footer-walls.png`.
- Nye lokale screenshots ligger i `public/assets/index-mockups/`:
  `Kalender.png`, `Chats.png`, `Dyst.png`, `Walls.png`, `Overblik.png`,
  `Spil.png`, `Klasseawards.png` og `Klassedyst.png`.

Header/footer pr. 2026-05-01:

- Header-nav viser ikke laengere `Forside` eller `Admin`; forside ligger paa
  logoet, og CMS-handlinger ligger i CTA/header-slot.
- Landing-headeren bruger samme cremebase og mint/coral gradientretning som
  footeren, men mere afdaempet, saa heroen stadig er hovedfokus.
- Landing-siden viser en midlertidig topbar, der forklarer at appen er under
  udvikling, og at download-knapperne kun er design-preview.
- `Funktioner` er en CSS-only hover/focus-dropdown med links til
  feature-sektionen.
- Klasse-CMS viser `Log ud` i header-slot; invitekopiering ligger stadig inde i
  klassevisningen.
- Footer er cremefarvet med mint/coral gradients, fire lige fordelte kolonner og
  diskret topskygge.
- Footerens brandkolonne viser Studos-logo, kontaktoplysninger for
  PlateDigital, og `En del af` + PlateDigital-logo fra
  `public/assets/PlateDigital-logo-saas.svg`.
- Footer-navigationen har `Navigation`, `Det med smaat` og `Hold kontakten`.
  `Hold kontakten` bruger kompakte store-badges og store originale Instagram /
  Facebook ikoner.

FAQ:

- Route: `GET /faq` (`route('faq')`).
- View: `resources/views/faq.blade.php`.
- Siden bruger native `details/summary` accordion-spoergsmaal om Studos,
  klasseoprettelse, CMS, elever, moderation og support.

## Mobilappen Lige Nu

Footer-navigation:

- `Kalender`
- `Chat`
- `Overblik`
- `Duel`
- `Walls`

Sidebar:

- `Din klasse`: Optjen Caps, Leaderboard, Dagens stemning, Klasseawards,
  Tilfaeldig vaelger.
- `Andre klasser`: Andre klasser, Klassedueller.
- `Kommende`: Wallet og Blaa bog er laast.
- Nederst: Noedkontakter og Indstillinger.

`Min profil` findes i sidebaren. Profilen viser elevoplysninger, QR/Studos-kode,
profilfoto, samt handlinger til at ændre avatar, logge ud og slette konto.
Sletning sker via `DELETE /api/members/me` med irreversibel flow, hvor brugeren
bliver advaret tydeligt i UI.

Overblik:

- Headeren clampler ved scroll.
- Main-content scroller under headeren.
- Kortene faar scroll-effekt og bliver mindre paa vej under headeren.
- `Mit Studos` viser profil, QR, hueklip og klasseinfo.
- Hueklip-gennemfoert gemmes lokalt pr. bruger, indtil brugeren selv aendrer
  det igen.
- Caps-container viser brugerens rigtige `DINE CAPS`, capcoin-logo og knap til
  Optjen Caps.
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

Klassedyst:

- Siden henter dynamisk rangliste fra `GET /api/class-battle`.
- Klasser rangeres efter Caps pr. aktiv elev, saa store og smaa klasser kan
  sammenlignes mere fair.
- Ranglisten viser total Caps, Caps pr. elev, medaljefarver til top 3 og
  markerer brugerens egen klasse.
- Topkort viser klassens placering, brugerens Caps og brugerens klasseandel.
- Ugens gode gerning kan claimes direkte paa kortet og opdaterer Caps.

Optjen Caps:

- Siden bruger samme headerstil som de andre app-sider.
- Weekly streak registreres automatisk ved app-aabning.
- Dag 7 giver 100 Caps, viser reward-modal og starter derefter en ny streak.
- Andre maader at optjene Caps ligger i en intern scroll-container:
  Ugens gode gerning, Check-in med `Scan QR`, og dueller med point paa hoejkant.
- Ugens gode gerning giver 25 Caps og kan kun claimes en gang pr. uge.

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

## Oprydning

2026-05-01:

- Fjernet den gamle PWA-wrapper under `public/pwa/`.
- Fjernet PWA-manifestet, Expo web-bundlet under `public/_expo/` og PWA-only
  assets under `public/assets/assets/`.
- Beholder kun `public/sw.js` som midlertidig cleanup-worker, der afregistrerer
  gamle service workers og sletter `studos-pwa-*` caches.
- Gamle `/pwa`-links redirecter til forsiden.
- Web/login/opret klasse/admin/CMS ligger fortsat i Laravel.

2026-04-29:

Ryddet op:

- Fjernet tom root-`app.json`, som kunne forvirre Expo config.
- Fjernet gamle ubrugte `footer-duel` PNG-assets. Duel-ikonet tegnes nu stabilt
  i React Native.
- Fjernet gamle ubrugte JS-bundles.
- Fjernet tom `public/favicon.ico` og peget web paa Studos SVG-marken som
  favicon.
- Blokeret Android mikrofonpermission.

## App Store / Google Play Status

Det der ser godt ud:

- Appen har ikke lokal dev-server/netvaerkspermission i produktions-iOS config.
- Photo permission er konkret og knyttet til brugerens egen handling.
- Chat/events har filtering, rapportering, blokering og throttling.
- Android push er feature-gated og ikke aktiv for iOS.
- Android mikrofonpermission er nu fjernet/blokeret.
- Backend koerer paa HTTPS i Cloud.

Release-blokkere foer Apple/Google:

- Kontosletning er implementeret i appen (`DELETE /api/members/me`) med
  tydelig irreversibel advarsel og anonymiseringsflow.
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
- Pointduel backend og duel-regler.
- Backend-persistens for Dagens stemning og hueklip.
- Kalender-push og daglig stemningsreminder.
- Glemt adgangskode/email reset.
- Join approval-flow i web/admin.
- QR-invite/QR-scan flow.
- Admin/moderationsside.
- Data-export flow.

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

Senest koert 2026-05-03 efter login/ email-regel/ Caps/Klassedyst/Optjen Caps-arbejdet:

```bash
php -l app/Http/Controllers/StudosController.php
php -l database/migrations/2026_05_02_010000_create_good_deed_and_cap_transaction_tables.php
php -l database/migrations/2026_05_02_030000_simplify_good_deed_claims.php
php -l tests/Feature/ExampleTest.php
node -e "const fs=require('fs'); const parser=require('@babel/parser'); const code=fs.readFileSync('apps/mobile/App.js','utf8'); parser.parse(code,{sourceType:'module',plugins:['jsx','optionalChaining','nullishCoalescingOperator','objectRestSpread']}); console.log('App.js parse ok');"
php artisan migrate
php artisan test --filter test_class_battle_ranks_classes_by_caps_per_active_member
php artisan test --filter test_weekly_good_deed_claim_awards_caps_once_without_buddy_or_photo
php artisan test --filter test_weekly_check_in_awards_caps_after_seven_days
php artisan test --filter test_existing_member_can_login_without_invite_code_when_email_is_unique
php artisan test --filter test_join_rejects_email_already_used_in_another_class
```

Resultat:

- PHP lint: OK.
- `App.js parse ok`.
- Migration koert lokalt.
- 5 maalrettede feature-tests passer.

## Naeste Gode Skridt

1. Færdiggør offentlig deletion URL + brugergodkendt slette-flow i websupport.
2. Opdater privacy policy, terms/EULA og supportside med tydelig deletion/anonymisering.
3. Lav admin/moderationsside.
4. Kør to-enheds QA af chat, kalender, uploads, blocking/reporting og login.
5. Gør Dagens stemning/hueklip rigtige i backend.
6. Lav App Store Connect metadata, screenshots, privacy labels og review notes.
7. Lav production iOS/TestFlight build og Android production AAB.
