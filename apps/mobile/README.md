# Studos Mobile

Expo/React Native appen er selve Studos-produktet. Webdelen bruges kun til
forside, Om Studos, FAQ, politikker, cookievalg og supportinfo.

Status pr. 2026-05-12: appen er klar til TestFlight/internal testing, med
Laravel Cloud som production-backend.

## Appen Indeholder

- Klassekode, login og klasseoprettelse direkte i appen.
- Profiloprettelse med skole, alder, samtykker, profilfoto og nodkontakt.
- Overblik med Mit Studos, Studos-kode/QR, hueklip, Caps, kommende events,
  aktivitet og Dyst-preview.
- Kalender med events, coverbilleder, invitationer og RSVP.
- Chat med direkte chats, gruppechats, reactions, unread, mute, report,
  block, read-state og Reverb realtime med polling fallback.
- Dyst/Challenges med Caps, accept/afvis, deadlines, dommerflow, arkiv og
  resultater.
- Galleri med albummer, private/faelles synligheder, upload, viewer, gem pa
  telefon, sletning og rapportering.
- Aktiviteter, Optjen Caps, Leaderboard, Arcade Hub, Mit crew, Nodkontakter og
  Indstillinger.
- Klasseprofil og rapporteringer for owner/moderator.

## Tech

- Expo / React Native
- SecureStore til auth-token og lokal session
- Expo Notifications til push-token og notifikationer
- Expo Image Picker / Media Library til billeder og gem-pa-telefon
- Laravel API som backend
- Laravel Reverb via `laravel-echo`, `pusher-js` og React Native WebSocket

## Production Links

Policy-links i appen skal pege pa:

```text
https://studos.laravel.cloud/privatlivspolitik
https://studos.laravel.cloud/brugervilkaar
https://studos.laravel.cloud/slet-konto
```

Relevante env-vars til app-builds:

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

Production/TestFlight builds ma ikke pege pa `localhost`, `192.168.*`,
`.local` eller XAMPP-stier.

## Lokal Udvikling

Fra projektroden:

```bash
npm install
npm run mobile:start
```

Med native dev-client:

```bash
npm run mobile:start:dev-client
```

Hvis realtime skal testes lokalt:

```bash
npm run reverb:start
```

## Builds

iOS build:

```bash
npm run mobile:build:ios
```

Android preview build:

```bash
npm run mobile:build:android
```

Production submit til TestFlight/App Store:

```bash
npx eas-cli submit --platform ios --profile production
```

## TestFlight Smoke Test

- Opret klasse i appen og join med klassekode.
- Log ind som eksisterende medlem.
- Tjek profil, samtykker og links til brugervilkaar/privatliv/slet konto.
- Tjek Overblik, hueklip-modal, Caps og aktivitetsfeed.
- Opret/rediger/slet event og test RSVP.
- Send direkte chat og gruppechat pa to fysiske enheder.
- Test reactions, unread, mute, report og block.
- Upload profilfoto, eventcover og galleribilleder.
- Test Dyst/Challenge med Caps, accept/afvis, deadline og arkiv.
- Tjek Leaderboard, Optjen Caps, Arcade Hub, Mit crew og Nodkontakter.
- Test logout, app-genstart og token-udlob.

## Hurtige Checks

```bash
node --check apps/mobile/App.js
npm run mobile:push:check
npm --workspace @studenter-app/mobile exec expo export -- --platform ios --output-dir /private/tmp/studos-ios-export --clear
```
