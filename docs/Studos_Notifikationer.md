# Studos – Notifikationer (oversigt)

Denne fil beskriver alle push-notifikationer Studos sender, hvornår de udløses, og præcis hvad brugeren ser i titel og brødtekst på iOS / Android.

Pladsholdere som `{senderName}`, `{eventTitle}`, `{when}` osv. bliver erstattet med rigtige værdier på sendetidspunktet.

---

## 1. Chat & gruppechats

### chat_message
- **Hvornår:** Når et klassemedlem sender en besked i en chat (direkte eller gruppe), og modtageren ikke har muted samtalen.
- **Titel:** `{senderName}`
- **Body (gruppe):** `{groupTitle} · {messagePreview}`
- **Body (direkte):** `{messagePreview}`
- **Eksempel:** "Mathias" / "3.A drengene · Skal vi spille til frikvarter?"

### group_chat_invite
- **Hvornår:** Når en bruger bliver tilføjet til en gruppechat (både ved oprettelse og ved senere `addParticipants`).
- **Titel:** `Du er tilfoejet i en gruppechat`
- **Body:** `{inviterName} tilfoejede dig i "{groupTitle}".`
- **Eksempel:** "Anna tilfoejede dig i \"Bestyrelse\"."

---

## 2. Dyster (point duels)

### duel_invite
- **Hvornår:** Når en bruger bliver udfordret (oprettelse af ny dyst eller challenge).
- **Titel (versus):** `Du er udfordret til en dyst`
- **Titel (challenge):** `Ny challenge til dig`
- **Body:** `{creatorName}: {challengeText}` (klippet til 100 tegn)

### duel_response
- **Hvornår:** Når modparten har svaret på dysten.
- **Titel (accepted):** `Din dyst er accepteret` / `Din challenge er accepteret`
- **Titel (declined):** `Din dyst er afvist` / `Din challenge er afvist`
- **Body (accepted):** `{responderName} tog handsken op.`
- **Body (declined):** `{responderName} takkede nej.`

### duel_action_required
- **Hvornår:**
  - Når en deltager `complete`r dysten og modparten skal bekræfte resultatet.
  - Når en dommer skal godkende et resultat (versus med dommer).
  - Når en dommer afviser, og det går tilbage til at modparten skal foreslå nyt resultat.
- **Titel (confirm_result):** `Bekraeft dystens resultat`
- **Body (confirm_result):** `Modparten har foreslaaet et resultat — bekraeft eller afvis.`
- **Titel (judge_review):** `Du skal afgoere en dyst`
- **Body (judge_review):** `Du er valgt som dommer. Godkend eller afvis det foreslaaede resultat.`

### duel_result
- **Hvornår:** Når dysten er endeligt afsluttet (efter modpart-bekræftelse eller dommerens godkendelse). Sendes til både vinder og taber.
- **Titel (vinder, versus):** `Du vandt dysten!`
- **Titel (vinder, challenge):** `Du klarede din challenge!`
- **Titel (taber):** `Dysten er afsluttet`
- **Body (vinder):** `Caps er udbetalt — godt klaret.`
- **Body (taber):** `Resultatet er bekraeftet. {opponentName} tog sejren.`

### duel_expiring
- **Hvornår:** Cron-job en gang i timen fanger dyster hvis `deadline_at` er inden for 2 timer (statusser: awaitingOpponent, awaitingCreatorConfirm, active, awaitingResultConfirm, awaitingJudgeApproval). Sendes én gang pr. dyst pr. modtager (dedup-key: `duel_expiring:{duelId}`).
- **Titel:** `Dyst udløber snart`
- **Body:** `"{challengeText}" udløber om ca. {hours} time(r).`

---

## 3. Events / gilder

### event_invite
- **Hvornår:** Ved oprettelse af event til alle inviterede medlemmer (undtagen opretteren selv). Også ved `updateEvent` hvis nye medlemmer er blevet tilføjet til gæstelisten.
- **Titel:** `Ny invitation: {eventTitle}` (klippet til 60 tegn)
- **Body:** `{inviterName} har inviteret dig ({datoMåned}).`
- **Eksempel:** "Ny invitation: Hyttetur" / "Sofie har inviteret dig (12. okt)."

### event_change
- **Hvornår:** Ved `updateEvent` hvis en eller flere af følgende ændrer sig: dato, tidspunkt (`starts_at`), sted. Kun til allerede inviterede (ikke nye, de får i stedet `event_invite`).
- **Titel:** `Aendring i: {eventTitle}` (klippet til 60 tegn)
- **Body:** `{changeNotes}` · `{datoMåned}` (changeNotes er kommasepareret af "ny dato", "nyt tidspunkt", "nyt sted")
- **Eksempel:** "Aendring i: Hyttetur" / "ny dato, nyt sted · 19. okt"

### event_reminder
- **Hvornår:** Cron-job en gang i timen.
  - **24t-bucket:** events hvor `starts_at` ligger 22–26 timer ud i fremtiden (eller `event_date` falder i den dato hvis tidspunkt ikke er sat).
  - **2t-bucket:** events hvor `starts_at` ligger 90–150 minutter ud i fremtiden.
  - Hver bucket har egen dedup-key så hver bruger højst får én 24t-reminder og én 2t-reminder pr. event.
- **Titel (24t):** `Begivenhed i morgen`
- **Titel (2t):** `Begivenhed om kort tid`
- **Body:** `{eventTitle} · {datoMåned, tid}`
- **Eksempel:** "Begivenhed om kort tid" / "Hyttetur · 19. okt, 18:00"

### rsvp_reminder
- **Hvornår:** Dagligt kl. 17:00 lokal tid. Finder events hvor `event_date` ligger 2–4 dage ude i fremtiden, og henter inviterede der endnu ikke har svaret RSVP. Én reminder pr. event pr. bruger.
- **Titel:** `Du mangler at svare`
- **Body:** `{eventTitle} venter paa dit svar (afholdes {datoMåned}).`

---

## 4. Albums / gallerier

### gallery_new
- **Hvornår:** Når et offentligt galleri oprettes.
  - `audience = everyone` → alle aktive medlemmer i klassen (undtagen opretteren).
  - `audience = specific` → kun de medlems-id'er der er valgt i `member_ids`.
  - Private gallerier giver ikke push.
- **Titel:** `Nyt album: {galleryName}` (klippet til 60 tegn)
- **Body:** `{creatorName} har oprettet et nyt fælles album.`

### gallery_photos
- **Hvornår:** Når der lægges et nyt billede op i et offentligt galleri. Sendes til samme målgruppe som ovenfor (undtagen uploaderen selv). Anti-spam: én notifikation pr. uploader/galleri pr. 30-min vindue (dedup-key kombinerer `galleryId`, uploader-id og 30-min bucket).
- **Titel:** `Nye billeder i {galleryName}` (klippet til 60 tegn)
- **Body:** `{uploaderName} har lagt nye billeder op.`

---

## 5. Connections

### connection_request
- **Hvornår:** Når en bruger sender en connection-request (`/connections/request`). Sendes til modtageren.
- **Titel:** `Ny connection request`
- **Body:** `{requesterName} vil gerne connecte med dig.`

### connection_accepted
- **Hvornår:**
  - Når modtageren accepterer en pending request (`/connections/{id}/respond` med status=accepted).
  - Når en mutual-pending shortcut auto-accepter en request (begge har sendt request til hinanden).
  - Sendes til den oprindelige requester.
- **Titel:** `Connection accepteret`
- **Body:** `{accepterName} accepterede din request.`

---

## 6. Caps & ugentlige aktiviteter

### good_deed_reminder
- **Hvornår:** Hver fredag kl. 17:00 lokal tid. Finder alle aktive medlemmer der ikke har claimet ugens gode gerning (current ISO-week). Én reminder pr. uge pr. bruger.
- **Titel:** `Ugens gode gerning venter`
- **Body:** `Du har endnu ikke claimet ugens gode gerning — drys lidt godhed og tjen Caps.`

### streak_reminder
- **Hvornår:** Dagligt kl. 19:00 lokal tid. Finder medlemmer der havde en streak (1–6 dage) i går, og som ikke har checked in i dag. Sendes som "streaken er i fare".
- **Titel:** `Din streak er paa spil`
- **Body:** `Du har ikke checket ind i dag — bevar din streak inden midnat.`

---

## 7. Test (eksisterer fra før)

### Testnotifikation (manuel)
- **Hvornår:** Brugeren trykker "Send testnotifikation" i indstillingerne.
- **Titel:** `Studos test` (default) / brugerdefineret hvis sendt med custom title
- **Body:** `Hvis du ser den her, virker push.`
- **Endpoint:** `POST /notifications/test`

---

## Brugerstyring

Brugeren kan slå hver kategori til/fra individuelt under **Indstillinger → "Hvad vil du have notifikation om?"** i mobil-appen.

Endpoints:
- `GET /notifications/preferences` – henter nuværende værdier (defaults til alle "true" hvis ikke gemt).
- `PUT /notifications/preferences` – body `{ "preferences": { "duel_invite": false, ... } }` opdaterer kun de kategorier der sendes med.

Disse opt-outs respekteres af `PushNotifier::send()` før der sendes — også ved scheduler-jobs.

Derudover er der to overordnede afbrydere:
- **System-niveau** (iOS/Android indstillinger) – brugeren kan altid slukke push for hele appen.
- **App-niveau toggle** – "Push-notifikationer" øverst i indstillinger deaktiverer enhedens token via `POST /notifications/push-token/disable`.

---

## Cron-schedule

Tilføjet i `routes/console.php`:

| Kommando | Cadence |
| --- | --- |
| `notifications:duels-expiring` | hver time |
| `notifications:event-reminders` | hver time |
| `notifications:rsvp-reminders` | dagligt kl. 17:00 |
| `notifications:good-deed-reminders` | fredag kl. 17:00 |
| `notifications:streak-reminders` | dagligt kl. 19:00 |

Kræver at Laravel scheduler kører (`* * * * * php artisan schedule:run` på serveren).

---

## Tekniske noter
- Alle push'es sendes via Expo Push API (`https://exp.host/--/api/v2/push/send`).
- Alle udløsere kører efter DB-transaktioner (sendes ikke ved rollback).
- Dedup forhindrer duplikat-pushes – tabel `notification_dispatch_log` med unique index på `(member_id, dedup_key)`.
- Ugyldige tokens (DeviceNotRegistered) deaktiveres automatisk via `member_push_tokens.disabled_at`.
- Android sender altid med `channelId: studos-default`.
- Bodyer afkortes til max 240 tegn, titler til 80 tegn (Apple/Google's maksgrænser).
