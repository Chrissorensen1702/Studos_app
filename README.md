# Studos

Studos er en privat klassehub til studenteraret: Laravel web/admin/API,
Laravel Cloud drift og en Expo/React Native app til iOS/Android. Denne README
er projektets aktuelle "start her igen"-note.

Status er opdateret 2026-05-08 efter aktivitetslog, dynamisk
Overblik-preview, GDPR-filtrering, activity-feed indexes og seneste
sikkerhedsstramninger.

Se ogsaa:

- `DETTE_MANGLER_VI.md` for korte produktnoter, der ikke maa glemmes.
- `PUBLISH_CHECKLIST.md` for VIGTIG publish-/release-tjekliste.
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
- Mobilappen ligger i `apps/mobile` og bruger Expo SDK 55 / React Native 0.74.
- Caps er nu en dynamisk backend-enhed via `members.caps_balance` og
  `cap_transactions`.
- Dyst vurderes v1-klar i kodebasen. Flowet mangler stadig fuld QA paa to
  fysiske enheder og production/staging smoke-test foer publish.
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
- Dyst-siden i mobilappen er koblet paa backend med oprettelse, accept/afvis,
  Caps-escrow, resultatbekraeftelse, dommerflow, arkiv og 24 timers svarfrist.
- Dyst opdaterer nu mere levende via Reverb realtime, polling fallback,
  foreground-refresh og optimistisk action-feedback i knapperne.
- Notifikationer for dyster er bevidst parkeret, indtil Apple Developer/push-flow
  er paa plads.
- PWA-wrapperen er fjernet. Appdistribution sker via native iOS/Android builds.
- Medlems-email er nu entydig paa tvaers af systemet; én email kan kun knyttes
  til én klasse. Dette haandhaeves i backend-validering og database-indekset
  `members.email`.
- Walls/galleri er implementeret: klassealbums med synlighedsregler,
  fotoupload, billedvisning, rapportering, kategori-tabs, soegning, sortering
  og dynamisk cover-fallback. Backend bruger `galleries` og `gallery_photos`.
- Aktivitetsloggen er implementeret som et globalt klassefeed med
  adgangsfiltrering: brugeren ser kun events, albums og uploads, som brugeren
  faktisk har adgang til.
- Overblik-kortet `Seneste aktivitet` henter nu de 3 nyeste aktiviteter fra
  samme feed og fungerer som live-preview ind til aktivitetsloggen.
- Device adaptation: top-bar og footer tilpasser sig automatisk alle iPhones
  (SE, notch, Dynamic Island) og Android (gesture-nav vs. knap-nav) via
  dimensionsbaseret inset-beregning uden externe biblioteker.
- Android push-token registrering er bevidst platform-gated til `android`,
  indtil Apple Developer/APNs-flowet er klar.
- Rate limiting strammet: personlig kode-opslag (`/members/code/{code}`) er
  nu throttlet 30/min.

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

Bemærk til platformforskelle (Windows vs. Mac):

Nogle scripts sætter miljøvariabler før kommandoerne (fx `EXPO_PUBLIC_*`). Det
gøres med `cross-env`, så de virker på både MacOS og Windows uden at skrive to
forskellige varianter af samme kommando.

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
  delete, report, block, gruppeinfo, tilfoej medlemmer og aendring af
  gruppechatnavn.
- Connections via personlig Studos-kode.
- Caps-wallet via `caps_balance`, transaktionslog i `cap_transactions`,
  Klassedyst, ugens gode gerning og weekly check-in.
- Android push-token registrering og chat-push. iOS/APNs er parkeret, indtil
  Apple Developer/provisioning er klar.
- Walls: gallerier og fotoupload via `galleries` og `gallery_photos` med
  synlighedsregler (`private`/`class`/`public`), soft-delete, rapportering og
  album-previewdata til dynamiske cover-collager.
- Aktiviteter: samlet klassefeed med adgangsfiltrering for events, albums,
  uploads, foedselsdage, nye klassemedlemmer og Dyst/Challenge-resultater.

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
GET  /api/overview/stats
GET  /api/activities
GET  /api/good-deeds/current
POST /api/good-deeds/claims
GET  /api/check-ins/weekly
POST /api/check-ins/weekly
GET  /api/duels
POST /api/duels
POST /api/duels/{duel}/accept
POST /api/duels/{duel}/decline
POST /api/duels/{duel}/cancel
POST /api/duels/{duel}/confirm
POST /api/duels/{duel}/complete
POST /api/duels/{duel}/forfeit
POST /api/duels/{duel}/approve
POST /api/duels/{duel}/reject
POST /api/events
POST /api/events/{event}/update
POST /api/events/{event}/delete
POST /api/events/{event}/report
POST /api/events/{event}/rsvp
GET  /api/chat/conversations
POST /api/chat/conversations/direct
POST /api/chat/conversations/group
POST /api/chat/conversations/{conversation}/messages
POST /api/chat/conversations/{conversation}/participants
PATCH /api/chat/conversations/{conversation}
POST /api/chat/conversations/{conversation}/report
POST /api/chat/conversations/{conversation}/block
POST /api/chat/conversations/{conversation}/leave
DELETE /api/chat/conversations/{conversation}
POST /api/chat/messages/{message}/report
DELETE /api/chat/messages/{message}
DELETE /api/members/me
POST /api/notifications/push-token
POST /api/notifications/test
GET  /api/galleries
POST /api/galleries
PUT  /api/galleries/{gallery}
DELETE /api/galleries/{gallery}
POST /api/galleries/{gallery}/report
GET  /api/galleries/{gallery}/photos
POST /api/galleries/{gallery}/photos
DELETE /api/gallery-photos/{photo}
POST /api/gallery-photos/{photo}/report
```

`GET /api/galleries` understotter paginering og server-side filtrering via
`page`, `perPage`, `visibility`, `sort` og `q`. Svaret indeholder
`pagination` samt `previewPhotos` med op til fire nyeste albumfotos pr.
galleri. Mobilappen bruger dem til automatisk cover-fallback, hvis brugeren
ikke har valgt et specifikt cover.

`GET /api/activities` returnerer et kort, filtreret klassefeed med seneste
relevante aktiviteter. Feedet inkluderer foedselsdage, nye klassemedlemmer,
oprettede events, oprettede albums, uploadede billeder, vundne `Mod hinanden`
dyster og gennemfoerte challenges. Endpointet sender kun noedvendige felter
til mobilappen, filtrerer blokerede/slettede profiler vaek, udelader private
events/albums brugeren ikke er en del af, og undgaar challenge-detaljer.

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
  `Spil.png` og `Klassedyst.png`.

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
- `Dyst`
- `Walls`

Sidebar:

- `Din klasse`: Optjen Caps, Leaderboard,
  Tilfaeldig vaelger.
- `Andre klasser`: Andre klasser, Klassedyster.
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
- `Seneste aktivitet` henter dynamisk de 3 nyeste aktiviteter fra
  aktivitetsloggen og viser kompakte preview-raekker.
- Der er nederste kort til `Dine dyste`.

Aktiviteter:

- Siden bruger samme faste header/under-scroll som Overblik.
- Feedet er globalt for klassen, men ikke offentligt: events, albums og uploads
  vises kun, hvis brugeren er en del af dem eller har adgang til dem.
- Viser foedselsdage, nye klassemedlemmer, oprettede events, faelles/private
  album-oprettelser, billeduploads, vundne `Mod hinanden` dyster og
  gennemfoerte challenges.
- Event-oprettelser og nye klassemedlemmer bruger profilbillede/initialer som
  log-ikon. `Mod hinanden` bruger lyseblaa pile, og Challenge bruger tre
  stjerner.
- Kun nyeste aktivitet fremhaeves med fed tekst; resten er roligere for hurtig
  scanning.
- Info-knappen forklarer, at loggen kun viser relevante klasseaktiviteter og
  filtrerer aktivitet, brugeren ikke er en del af, af hensyn til GDPR.

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
- Gruppechats har delt avatar-fallback med op til tre medlemmer, klikbar
  gruppeheader, medlemsliste, ejer-pill, tilfoej medlemmer og aendring af
  chatnavn for ejeren.
- Gruppechat-beskeder viser afsenderens fornavn diskret over boblen paa andres
  beskeder, saa stock-avatar/initialer ikke er eneste identifikation.
- Rapportering, direkte blokering og moderation logs er startet.
- Realtime bruger Laravel Reverb, med polling fallback.

Klassedyst:

- Siden henter dynamisk rangliste fra `GET /api/class-battle`.
- Klasser rangeres efter Caps pr. aktiv elev, saa store og smaa klasser kan
  sammenlignes mere fair.
- Ranglisten viser total Caps, Caps pr. elev, medaljefarver til top 3 og
  markerer brugerens egen klasse.
- Topkort viser klassens placering, brugerens Caps og brugerens klasseandel.
- Ugens gode gerning kan claimes direkte paa kortet og opdaterer Caps.

Dyst:

- Dyst er produktnavnet for det tidligere Duel-flow.
- Opret dyst aabner som overlay oven paa Dyst-siden og kan swipes tilbage paa
  samme maade som chat-overlayet.
- Der kan oprettes to typer: `Mod hinanden` til 1:1-konkurrencer og `Challenge`
  til envejs-udfordringer.
- Opret-flowet er poleret til v1: `Vaelg din dyst`, tydelige type-ikoner,
  dynamisk `Vaelg modstander`/`Vaelg person`, native dato- og tidsvaelger,
  Caps-indsats/beloenning med capcoin, deadline og valgfri dommer.
- Dommer kan kun vaelges paa `Mod hinanden`. Naar togglen slaas til, aabner en
  centreret dommermodal med soegefelt; lukker man uden valg, slaas dommer fra
  igen.
- `Mod hinanden` er gensidig indsats: begge parter laaser samme antal Caps i
  escrow, og vinderen faar puljen.
- `Challenge` er envejs-bounty: opretteren laaser beloenningen i escrow,
  modtageren betaler ingen Caps, og opretteren faar beloenningen retur ved
  afvisning, annullering eller udloeb.
- Challenge har ingen dommer og kan ikke give Caps begge veje. Modtageren faar
  kun beloenningen, hvis opretteren godkender gennemfoerslen.
- Afventende dystanmodninger viser en 24 timers svarfrist i status-pill i stedet
  for en statisk `Afventer svar` tekst.
- Afventende dystkort bruger lyseblaa container, mens svarfrist-pill kan vaere
  gul eller roed, naar fristen er taet paa at udloebe.
- Sendte dyster vises adskilt fra indkommende afventede dyster. Brugeren ser
  modtagerens navn/billede, en groenne pil-retning, annuller-knap og svarfrist.
- Aktive `Mod hinanden`-dyster bruger `Vaelg vinder`. Uden dommer skal begge
  parter bekraefte resultatet, foer Caps udbetales.
- Aktive `Challenge`-dyster kan kun markeres gennemfoert af modtageren og har
  ikke dommer. Resultatet kraever opretterens bekraeftelse, foer beloenningen
  udbetales.
- Modtageren kan bruge `Giv op` paa en aktiv `Challenge`; challengen lukkes som
  tabt for modtageren, og opretteren faar beloenningen retur med det samme.
- Top-right status-pills er forenklet: `I GANG`, `GENNEMFOERT` og, naar det er
  brugerens tur til sidste godkendelse, `BEKRAEFT VINDER`.
- Foreslaaet vinder vises som groent meta-element. De nederste action/info-felter
  fortaeller, om resultatet ligger hos modpart, opretter eller dommer.
- Alle Dyst- og Challenge-resultater skal vaere godkendt foer deadline. Hvis
  deadline passerer, mens en dyst stadig er aktiv eller afventer godkendelse,
  udloeber den, og escrow-Caps returneres.
- Hvis der er dommer paa en `Mod hinanden`-dyst, sendes resultatet til
  dommergodkendelse, og dommeren kan godkende eller afvise via en separat
  dommermodal.
- Dommeropgaver vises kun, naar brugeren faktisk har afventende
  dommergodkendelser, med lille badge/tal paa Dyst-siden.
- Dyst-ikonet i footeren viser en lille badge med antal handlinger, der kraever
  brugerens input: indkommende dyster og dommergodkendelser.
- Afventede og aktive hovedsektioner kan foldes ind/ud. Afventede er som
  udgangspunkt lukket, aktive er aaben, naar der er aktive dyster.
- Afsluttede, afviste, annullerede og udloebne dyster ligger i arkivmodalen.
- Backend gemmer dyster i `point_duels`, validerer Caps-balance, laaser
  indsats/beloenning i escrow og skriver bevaegelser i `cap_transactions`.
- Udlober en aktiv dyst, eller udlober en anmodning efter 24 timer uden accept,
  arkiveres den som udloebet og escrow-Caps refunderes.
- Dyst-udloeb koeres via `php artisan duels:expire`, som er registreret i
  Laravel Scheduler hvert minut. Ved publish skal scheduler/cron vaere aktiv,
  ellers koerer udloeb kun, naar en involveret bruger rammer duel-endpoints.
- Realtime bruger private Reverb-kanaler pr. medlem, med polling fallback og
  foreground-refresh, saa Dyst-siden opdaterer uden at brugeren skal forlade
  siden.
- Notifikationer for dyster er bevidst parkeret, indtil Apple Developer/push-flow
  er paa plads.

Walls:

- Walls er klassens billedgalleri, opdelt i navngivne albums (gallerier).
- Gallerioversigten viser albumkort med cover, navn, antal fotos og
  synligheds-pill (`Privat`/`Faelles`).
- Oversigten har kategori-tabs (`Alle`, `Faelles`, `Private`), soegefelt og
  sortering via filterknappen (`Seneste`, `Flest billeder`, `A-Z`).
- Sorteringsvalget i filtermodalen er midlertidigt, indtil brugeren trykker
  `Anvend`; en lille `x`-knap nulstiller sortering direkte fra oversigten.
- Naar Galleri forlades og aabnes igen, resettes oversigten til `Alle`,
  `Seneste` og tom soegning.
- Et galleri kan oprettes med navn og synlighed; synlighedsregler styrer hvem
  der kan se albummet.
- Hvis flere album har samme navn, advarer appen, men blokerer ikke gem.
- Hvis brugeren har valgt et specifikt cover, bruges det altid. Uden specifikt
  cover viser tomme album et grafisk Studos-cover; album med billeder bruger
  automatisk de nyeste billeder som cover: 1 foto i fuld bredde, 2-3 fotos som
  lodrette felter og 4+ fotos som 2x2-collage.
- Album-skærmen viser alle fotos i et grid og har upload-knap.
- Long-press paa et album viser `Om albummet`; brugere med adgang ser ogsaa
  `Upload billede`, som aabner albummet og starter billedvaelgeren automatisk.
- Fotoupload bruger expo-image-picker og sender til `POST /api/galleries/{gallery}/photos`.
- Enkeltfotovisning aabner i en fullscreen viewer med download/slet/rapport-actions.
- Rapportering og sletning er tilgaengelig for uploader og klasse-admin.
- Backend soft-deleter gallerier og fotos og gemmer `deleted_by_member_id`.

Optjen Caps:

- Siden bruger samme headerstil som de andre app-sider.
- Weekly streak registreres automatisk ved app-aabning.
- Dag 7 giver 100 Caps, viser reward-modal og starter derefter en ny streak.
- Andre maader at optjene Caps ligger i en intern scroll-container:
  Ugens gode gerning, Check-in med `Scan QR`, og dyster med point paa hoejkant.
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
- Aktivitetsloggen minimerer data, filtrerer synlighed pr. bruger og viser ikke
  private challenge-detaljer i feedet.
- Android push er feature-gated og ikke aktiv for iOS.
- Android mikrofonpermission er nu fjernet/blokeret.
- Backend koerer paa HTTPS i Cloud.
- Caps har ingen pengevaerdi, kan ikke koebes, saelges, veksles eller bruges til
  praemier. Dette skal skrives tydeligt i vilkaar/politik foer publish, saa Dyst
  ikke kan misforstaas som gambling eller real-money contest.
- Dyst/Caps er socialt og internt til Studos, men review notes boer forklare
  kort, hvordan Caps, Dyst, Challenge og escrow virker.

Release-blokkere foer Apple/Google:

- Kontosletning er implementeret i appen (`DELETE /api/members/me`) med
  tydelig irreversibel advarsel og anonymiseringsflow.
- Chat er funktionelt TestFlight-klar, men production-builds skal tvinges til
  HTTPS-only backend/Reverb via EAS env (`EXPO_PUBLIC_API_URL`,
  `EXPO_PUBLIC_REVERB_HOST`, `EXPO_PUBLIC_REVERB_PORT=443`,
  `EXPO_PUBLIC_REVERB_SCHEME=https`). Release-builds maa ikke falde tilbage til
  lokale `http://localhost`, `.local`, `10.*` eller `192.168.*` endpoints.
- Privatlivspolitik, vilkaar/EULA og supportside skal vaere live og linket fra
  appen/store listings.
- App Privacy / Data Safety skal udfyldes med email, navn, bruger-ID,
  profilbilleder/uploads, aktivitetslog, chatindhold, events, push-token og
  supportdata.
- Der skal vaere en reel admin/moderationsside til rapporter, blocks og
  moderation violations.
- Foer App Store-release boer gruppechat-medlemslisten have konkrete
  medlemshandlinger til `Rapporter medlem` og `Bloker medlem`, saa UGC-kravet
  om brugerblokering og rapportering ogsaa er tydeligt inde i gruppechat.
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
- Push-notifikationer for dyster.
- Backend-persistens for hueklip.
- Kalender-push.
- Glemt adgangskode/email reset.
- Join approval-flow i web/admin.
- QR-invite/QR-scan flow.
- Admin/moderationsside.
- Offentlige privacy/terms/EULA/support-sider til store review.
- Endelig moderation-haandtering for rapporter i web/admin.
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

Senest koert 2026-05-08 efter aktivitetslog og dynamisk Overblik-preview:

```bash
node -e "require('@babel/parser').parse(require('fs').readFileSync('apps/mobile/App.js','utf8'),{sourceType:'module',plugins:['jsx']}); console.log('App.js babel ok')"
git diff --check
php artisan test
```

Resultat:

- `App.js babel ok`.
- `git diff --check`: OK.
- `php artisan test`: 44 tests passer, 599 assertions.
- `GET /api/activities` er testet for synlighedsfiltrering, blokeringer og
  minimalt payload.
- Overblik henter `GET /api/activities?limit=3` til aktivitetskortets preview.

Tidligere koert 2026-05-07 efter Walls cover-fallback, sortering og long-press
upload:

```bash
php -l app/Http/Controllers/StudosController.php
npm --workspace @studenter-app/mobile exec -- expo export --platform web --output-dir /private/tmp/studos-mobile-export-refresh-all
php artisan test
```

Resultat:

- `StudosController.php` lint OK.
- Expo web-export for mobilappen bygger OK.
- Walls `/api/galleries` returnerer nu paginerede album med server-side
  kategori, sortering, sogning og `previewPhotos` til cover fallback.
- Mobilappen bruger nu Studos-farvet pull-to-refresh paa de primaere
  server-drevne sider.

Tidligere koert 2026-05-06 efter Walls v1, UX og device adaptation:

```bash
node --check apps/mobile/App.js
php -l app/Http/Controllers/StudosController.php
```

Resultat:

- `apps/mobile/App.js` parser OK.
- `StudosController.php` lint OK.
- Walls-endpoints og gallery-migrationer verificeret i kodebasen.
- Push-token platform-validering er Android-only, indtil iOS/APNs goeres klar.
- Rate limit tilfojet paa `/members/code/{code}` (30/min).
- Device adaptation verificeret: top-bar og footer bruger nu dimensionsbaserede
  insets uden externe native biblioteker.

Tidligere koert 2026-05-03 efter login/ email-regel/ Caps/Klassedyst/Optjen Caps-arbejdet:

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

## VIGTIG Publish-Tjekliste

- VIGTIGT: Laravel Scheduler skal vaere aktiv i produktion/cloud. Dyst bruger
  `php artisan duels:expire` hvert minut til at udloebe gamle dyster og
  refundere escrow-Caps. Lokalt kan det testes med `php artisan schedule:work`;
  paa server/cloud skal en scheduler/cron kalde `php artisan schedule:run` hvert
  minut.
- Reverb skal koere med production-host/keys, saa chat og Dyst realtime virker.
- `APP_URL`, `EXPO_PUBLIC_API_URL`, Reverb env og storage/public upload-setup
  skal pege paa production-domainer.
- iOS/TestFlight production builds skal bruge EAS environment secrets til
  HTTPS-only API/Reverb. Kontroller at appen ikke proever lokale HTTP endpoints
  i archive/review-builds.

## Naeste Gode Skridt

1. QA Aktiviteter paa to brugere/enheder: events med/uden invitation,
   faelles/private albums, billeduploads, medlem-tilfoejelse, foedselsdag,
   `Mod hinanden`, Challenge og blokering/synlighedsfiltrering.
2. QA Walls paa to brugere/enheder: opret galleri, filter/sortering/soegning,
   dynamisk cover-fallback ved 0/1/2/3/4 billeder, upload via long-press,
   fullscreen, slet, rapporter og synlighedsregler.
3. QA Dyst paa to brugere/enheder: opret, accept, afvis, vinderbekraeftelse,
   Challenge-gennemfoert, Challenge-giv-op, dommergodkendelse, udloeb,
   realtime/polling og Caps-refundering.
4. Koer to-enheds QA af chat, gruppechat-info, kalender, uploads,
   blocking/reporting og login.
5. Faa production drift paa plads: scheduler, Reverb, storage/uploads, mail,
   backups og production env.
6. Faa privacy policy, terms/EULA, supportside og Caps/Dyst-forklaring klar.
7. Faa account deletion/support-flow helt review-klar.
8. Lav admin/moderationsside til rapporter, blocks og violations samt
   gruppechat-medlemshandlinger til rapporter/bloker.
9. Goer hueklip rigtige i backend.
10. Lav App Store Connect metadata, screenshots, privacy labels, Data Safety og
   review notes.
11. Lav production iOS/TestFlight build og Android production AAB.
