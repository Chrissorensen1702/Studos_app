# Publish Checklist

Denne liste er til den sidste fase foer App Store/TestFlight/Google Play og
produktion. Brug den som en konkret afkrydsningsliste, saa vigtige driftsting
ikke bliver glemt.

## VIGTIGT: Server og Drift

- [ ] Laravel Scheduler er aktiv i produktion/cloud.
  - Dyst bruger `php artisan duels:expire` hvert minut til at udloebe gamle
    dyster og refundere escrow-Caps.
  - Lokalt kan det testes med `php artisan schedule:work`.
  - Paa server/cloud skal en scheduler/cron kalde `php artisan schedule:run`
    hvert minut.
- [ ] Reverb kører i produktion og bruger production host/key/port/scheme.
- [ ] API og Reverb kører over HTTPS/TLS.
- [ ] Ingen production-builds peger på lokale `http://192.168...`,
  `localhost`, Mac `.local` eller XAMPP-stier.
- [ ] `APP_URL` peger på production-domain.
- [ ] `EXPO_PUBLIC_API_URL` peger på production API.
- [ ] `EXPO_PUBLIC_CREATE_CLASS_URL` peger på production opret-klasse.
- [ ] `EXPO_PUBLIC_REVERB_*` peger på production Reverb.
- [ ] Laravel Cloud/server env er sat, ikke kun lokale `.env` filer.
- [ ] Database migrations er kørt i production.
- [ ] Der er en backup-plan for production database.
- [ ] Demo/test-data er fjernet eller bevidst isoleret fra production.
- [ ] Queue/worker-strategi er besluttet. Hvis `QUEUE_CONNECTION=sync` bruges i
  production, er det bevidst; ellers kører queue workers stabilt.
- [ ] Cache/config/routes er clearet og gen-cachet efter deploy, hvis serveren
  bruger cache: `config:cache`, `route:cache`, `view:cache`.
- [ ] Log-niveau er production-egnet, fx ikke alt for støjende debug logs.

## VIGTIGT: Realtime, Baggrund og Automatik

- [ ] Reverb-serveren kører i production og restarter automatisk ved crash/deploy.
- [ ] Reverb host, port, scheme, app key og app secret matcher backend og app-build.
- [ ] Private Reverb-kanaler kan auth'es med bearer token.
- [ ] Chat realtime er testet på to fysiske enheder.
- [ ] Chat polling fallback er testet ved at stoppe Reverb.
- [ ] Dyst realtime er testet på to fysiske enheder.
- [ ] Dyst polling fallback er testet ved at stoppe Reverb.
- [ ] Dyst realtime-kanalen `duels.member.{memberId}` opdaterer kun relevante
  deltagere/dommer.
- [ ] Scheduler kører hvert minut i production, ikke kun manuelt lokalt.
- [ ] `php artisan duels:expire` er testet på production/staging med en udløbet
  test-dyst.
- [ ] Udløb/refundering virker også, når ingen brugere åbner appen.
- [ ] Hvis push-notifikationer er aktive, kører push credentials og channels på
  både Android og iOS.
- [ ] Hvis appen bruger polling fallback, er intervallet acceptabelt for server-load.
- [ ] Der er en plan for at genstarte Reverb/scheduler/queue workers ved deploy.

## VIGTIGT: Observability og Rollback

- [ ] Production logs kan læses hurtigt ved fejl.
- [ ] Laravel errors, 500-fejl og validation-fejl kan findes i logs.
- [ ] Reverb-fejl kan findes i logs.
- [ ] Scheduler-kørsler kan verificeres efter deploy.
- [ ] Mail-fejl kan findes i logs/provider dashboard.
- [ ] Upload/storage-fejl kan findes i logs.
- [ ] Der er en simpel rollback-plan for API/backend deploy.
- [ ] Der er en simpel rollback-plan for app-build, hvis en build skal stoppes.
- [ ] Seneste database-backup er verificeret før større release.
- [ ] Production smoke test køres lige efter deploy.

## Storage og Uploads

- [ ] Production storage er offentligt korrekt sat op til billeder.
- [ ] Profilbilleder kan uploades og hentes på fysisk enhed.
- [ ] Event covers kan uploades og hentes.
- [ ] Gruppechat-billeder kan uploades og hentes.
- [ ] Lokale `php artisan storage:link`-fixes er ikke antaget som production
  setup, medmindre serveren faktisk bruger samme filesystem-struktur.
- [ ] Maks filstørrelser og upload-fejl giver forståelige beskeder.

## Mail

- [ ] Production mail provider er sat op.
- [ ] `MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`,
  `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS` og `MAIL_FROM_NAME` er production values.
- [ ] Klasseoprettelse/invitation sender rigtig mail.
- [ ] Login-koder eller andre auth-mails virker.
- [ ] Mail ender ikke i spam ved normal test.
- [ ] Fejl ved mail-sendning logges og giver brugeren en brugbar fejl.

## App Builds

- [ ] iOS build bruger production API/Reverb.
- [ ] Android build bruger production API/Reverb.
- [ ] Development/local env ligger ikke i build-konfiguration.
- [ ] `apps/mobile/.env` er ikke committet og bruges kun lokalt.
- [ ] Root `.env` er ikke committet og bruges kun lokalt/server-side.
- [ ] `.env.example` og eventuelle mobile env-eksempler er opdaterede.
- [ ] App version/build number er opdateret.
- [ ] App navn, ikon, splash og bundle identifiers er korrekte.
- [ ] Android Firebase config matcher production package name.
- [ ] iOS/Android push credentials er sat, hvis push er med i releasen.

## Juridisk og App Review

- [ ] Privacy policy er klar og offentlig tilgængelig.
- [ ] Terms/EULA er klar og offentlig tilgængelig.
- [ ] Supportside eller support-email er aktiv.
- [ ] Konto-sletning er tydeligt tilgængelig i appen eller via websupport.
- [ ] Slet-konto flow anonymiserer/sletter efter de regler, der beskrives.
- [ ] App Store privacy labels matcher appens faktiske dataindsamling.
- [ ] Google Play Data Safety matcher appens faktiske dataindsamling.
- [ ] UGC/chat/moderation er beskrevet korrekt til review.
- [ ] Demo-login til App Review er klar, hvis Apple/Google skal bruge det.
- [ ] Review notes forklarer, hvordan man tester klasse, chat, kalender og Dyst.

## Moderation og Sikkerhed

- [ ] Reports kan ses og håndteres af admin/moderator.
- [ ] Blocks virker på chat og relevante sociale flows.
- [ ] Moderation violations logges og kan gennemgås.
- [ ] Chat-beskeder modereres.
- [ ] Dyst challenge-tekst modereres.
- [ ] Event-input modereres, hvor det giver mening.
- [ ] Rate limits er sat på følsomme endpoints.
- [ ] Auth/session-fejl sender brugeren pænt tilbage til login.
- [ ] Private kanaler i Reverb kan kun tilgås af relevante medlemmer.
- [ ] Ingen secrets/API keys ligger i Git.

## QA: Konto og Klasse

- [ ] Ny bruger kan oprette profil fra klassekode.
- [ ] Eksisterende bruger kan logge ind med email/password.
- [ ] Forkert login viser korrekt fejl.
- [ ] Session holder efter app-genstart.
- [ ] Logout virker.
- [ ] Slet konto virker.
- [ ] Opret klasse virker.
- [ ] Join klasse afviser forkert skole/klasse korrekt.
- [ ] Brugere kan ikke tilmelde samme email i flere klasser, hvis det er reglen.
- [ ] Profilredigering virker.
- [ ] Profilbillede virker efter app-genstart.

## QA: Kalender

- [ ] Opret event.
- [ ] Rediger event som opretter/owner.
- [ ] Ikke-opretter kan ikke redigere event.
- [ ] Slet event.
- [ ] RSVP: deltager.
- [ ] RSVP: deltager ikke.
- [ ] Tidligere events vises korrekt efter dato/tid.
- [ ] Cover-upload virker.
- [ ] Cover-skabeloner virker.
- [ ] Invitationer til klasse/crew/valgte personer virker.
- [ ] Tomme states ser ordentlige ud.

## QA: Chat

- [ ] Direkte chat kan oprettes.
- [ ] Gruppechat kan oprettes.
- [ ] Beskeder sendes og modtages realtime.
- [ ] Polling fallback virker, hvis Reverb ikke er klar.
- [ ] Unread-count virker.
- [ ] Mute/unmute virker.
- [ ] Skjul chat virker.
- [ ] Forlad gruppe virker.
- [ ] Slet gruppe som ejer virker.
- [ ] Rapportér chat virker.
- [ ] Rapportér besked virker.
- [ ] Bloker person virker.
- [ ] Keyboard/input virker på iOS og Android.

## QA: Dyst og Caps

- [ ] Opret Dyst mod en anden bruger.
- [ ] Udfordrer kan annullere, indtil modparten accepterer.
- [ ] Modpart kan acceptere.
- [ ] Modpart kan afvise.
- [ ] `Mod hinanden` låser Caps fra begge parter i escrow.
- [ ] `Challenge` låser kun opretterens belønning; modtager betaler ingen Caps.
- [ ] Accept gør dysten aktiv med det samme.
- [ ] `Mod hinanden` kan vælge vinder.
- [ ] Dommer kan kun vælges på `Mod hinanden`, ikke på `Challenge`.
- [ ] `Challenge` kan kun markeres gennemført af modtageren.
- [ ] `Challenge` kan opgives af modtageren med `Giv op`, og opretter får belønningen retur.
- [ ] Deadline udløber både aktive dyster og dyster, der stadig afventer godkendelse.
- [ ] Hvis deadline passerer før godkendelse, refunderes escrow-Caps til dem, der lagde dem.
- [ ] `Mod hinanden` uden dommer skal resultat bekræftes af den anden relevante part.
- [ ] `Mod hinanden` med dommer skal dommer godkende resultat.
- [ ] Dommer kan afvise resultat.
- [ ] `Mod hinanden`: vinder får puljen, taber mister indsats.
- [ ] `Challenge`: modtager får belønningen ved godkendt gennemførsel.
- [ ] Udløbne dyster refunderer escrow-Caps.
- [ ] `php artisan duels:expire` virker manuelt.
- [ ] Scheduler udløber dyster uden at brugerne åbner appen.
- [ ] Dyst realtime opdaterer begge brugeres skærme.
- [ ] Dyst polling fallback virker, hvis realtime ikke er klar.
- [ ] Arkiv viser afsluttede, afviste, annullerede og udløbne dyster.

## QA: Optjen Caps og Klassedyst

- [ ] Ugens gode gerning kan claimes.
- [ ] Caps tildeles kun én gang efter reglen.
- [ ] Weekly check-in virker.
- [ ] Caps balance opdateres i appen.
- [ ] Klassedyst leaderboard henter production data.
- [ ] Rangering efter Caps pr. aktiv elev ser korrekt ud.
- [ ] Egen klasse markeres korrekt.

## QA: Netværk og Fejl

- [ ] Appen håndterer API nede med forståelig fejl.
- [ ] Appen håndterer Reverb nede med polling/fallback.
- [ ] Dårligt netværk giver ikke dobbelt-oprettelser.
- [ ] Dobbelt-tap på vigtige knapper skaber ikke dubletter.
- [ ] App-genstart efter action viser korrekt state.
- [ ] Token udløbet sender brugeren til login.

## Screenshots og Store Materiale

- [ ] App Store screenshots er lavet.
- [ ] Google Play screenshots er lavet.
- [ ] App-beskrivelse er skrevet.
- [ ] Keywords/kategorier er valgt.
- [ ] Content rating er udfyldt korrekt.
- [ ] Review notes er skrevet.
- [ ] Support URL/email er testet.

## Sidste Smoke Test

- [ ] Frisk install på iPhone.
- [ ] Frisk install på Android.
- [ ] Login/opret profil.
- [ ] Upload billede.
- [ ] Opret event.
- [ ] Send chatbesked.
- [ ] Opret og afslut Dyst.
- [ ] Tjek Caps efter Dyst.
- [ ] Luk appen og åbn igen.
- [ ] Tjek at state stadig er korrekt.
