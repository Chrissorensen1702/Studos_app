@extends('layouts.studos')

@section('title', 'Privatlivspolitik · Studos')

@section('content')
  <section class="page legal-page">
    <header class="legal-hero">
      <h1>Sådan behandler Studos dine oplysninger</h1>
      <p>
        Her kan du se, hvilke personoplysninger Studos behandler, hvorfor vi
        behandler dem, hvem der kan se dem, hvor længe vi gemmer dem, og hvilke
        rettigheder du har.
      </p>
      <div class="legal-meta">
        <span><strong>Version:</strong> 1.3</span>
        <span><strong>Senest opdateret:</strong> 12. maj 2026</span>
        <span><strong>Dataansvarlig:</strong> PlateDigital EMV · CVR 42456187</span>
      </div>
    </header>

    <div class="legal-content">
      <div class="legal-callout">
        <strong>Kort fortalt:</strong> Studos er reklamefri og uden tracking til
        markedsføring. Vi sælger ikke dine data. Vi bruger oplysningerne til at
        drive en lukket klasseapp med chat, kalender, albummer, dyster, notifikationer
        og moderation.
      </div>

      <article id="dataansvarlig" class="legal-section">
        <h2>1. Dataansvarlig</h2>
        <p>
          <strong>PlateDigital EMV</strong><br>
          CVR: 42456187<br>
          Kærmindevej 12, 7441 Bording<br>
          E-mail: <a href="mailto:chris.sorensen1702@gmail.com">chris.sorensen1702@gmail.com</a><br>
          Telefon: <a href="tel:+4520631299">+45 20 63 12 99</a>
        </p>
        <p>
          Skriv til os, hvis du vil bruge dine rettigheder, har spørgsmål til
          privatliv eller vil anmode om sletning, indsigt eller rettelse. Vi svarer
          som udgangspunkt inden for 30 dage.
        </p>
      </article>

      <article id="data" class="legal-section">
        <h2>2. Oplysninger vi behandler</h2>
        <table class="legal-table">
          <thead>
            <tr><th>Kategori</th><th>Eksempler</th><th>Kilde</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Konto og identitet</td>
              <td>Bruger-ID, klasse-ID, skole, rolle, navn, e-mail, fødselsdato, personlig Studos-kode, profilbillede</td>
              <td>Dig selv og systemet</td>
            </tr>
            <tr>
              <td>Login og sikkerhed</td>
              <td>Hashet adgangskode, login-sessioner, auth-tokens, engangskoder, rate limiting og relevante server-logs</td>
              <td>Dig selv, din enhed og serveren</td>
            </tr>
            <tr>
              <td>Klasse og relationer</td>
              <td>Klassemedlemskab, rolle, connections, blokeringer, klassekode, invitationer og godkendelsesstatus</td>
              <td>Dig selv, klassen og systemet</td>
            </tr>
            <tr>
              <td>Brugerindhold</td>
              <td>Chatbeskeder, gruppechats, klassechat, emoji-reaktioner, events, RSVP, dyster, udfordringer, gallerier, albummer, billedtekster og covers</td>
              <td>Dig selv og andre brugere</td>
            </tr>
            <tr>
              <td>Billeder og billedmetadata</td>
              <td>Profilbilleder, album- og galleribilleder, uploader, uploadtidspunkt, synlighed, målgruppe, slette- og moderationsstatus</td>
              <td>Dig selv, andre brugere og systemet</td>
            </tr>
            <tr>
              <td>Appaktivitet</td>
              <td>Caps, check-ins, deltagelse i events, dyste-historik, sidste login, sidste set-tidspunkt og ulæste beskeder</td>
              <td>Genereret ved brug af appen</td>
            </tr>
            <tr>
              <td>Nødkontakt</td>
              <td>Navn og telefonnummer på din valgte nødkontakt samt hvem du har valgt kan se den</td>
              <td>Dig selv</td>
            </tr>
            <tr>
              <td>Push-notifikationer</td>
              <td>Expo Push Token, platform, enhedsnavn, app-variant, app-version og build-version</td>
              <td>Din enhed, hvis du tillader notifikationer</td>
            </tr>
            <tr>
              <td>Moderation</td>
              <td>Rapporter, blokeringsdata, årsag, detaljer, behandlingsstatus, strikes, strike-nummer, hvem der har behandlet sagen, udelukkelse og klager</td>
              <td>Brugere, klassemoderatorer og Studos</td>
            </tr>
            <tr>
              <td>Support</td>
              <td>E-mails og oplysninger, du sender til support</td>
              <td>Dig selv</td>
            </tr>
          </tbody>
        </table>
        <p>
          Vi indsamler ikke præcis lokation, kontaktbog, biometriske data eller
          helbredsoplysninger som faste funktioner i Studos. Brugere kan dog selv
          skrive eller uploade indhold, der indeholder personoplysninger. Del derfor
          kun oplysninger og billeder, du har ret til at dele.
        </p>
      </article>

      <article id="formaal" class="legal-section">
        <h2>3. Hvorfor vi behandler oplysninger</h2>
        <table class="legal-table">
          <thead>
            <tr><th>Formål</th><th>Eksempler</th><th>Retsgrundlag</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Levere appen</td>
              <td>Konto, login, klasse, chat, kalender, albummer, dyster, Caps og profil</td>
              <td>Aftale, GDPR art. 6, stk. 1, litra b</td>
            </tr>
            <tr>
              <td>Sikkerhed og misbrug</td>
              <td>Rate limits, blokeringer, rapporter, moderation, strikes og udelukkelse</td>
              <td>Legitim interesse, GDPR art. 6, stk. 1, litra f</td>
            </tr>
            <tr>
              <td>Notifikationer</td>
              <td>Push om chat, reaktioner, invitations- og klasseaktivitet, når du har tilladt det</td>
              <td>Samtykke, GDPR art. 6, stk. 1, litra a</td>
            </tr>
            <tr>
              <td>Support</td>
              <td>Besvare spørgsmål, fejlmeldinger og sletningsanmodninger</td>
              <td>Legitim interesse eller aftale</td>
            </tr>
            <tr>
              <td>Lovkrav</td>
              <td>Dokumentation, myndighedsanmodninger og eventuelle regnskabskrav</td>
              <td>Retlig forpligtelse, GDPR art. 6, stk. 1, litra c</td>
            </tr>
          </tbody>
        </table>
        <p>
          Vi bruger ikke dine oplysninger til målrettet annoncering, salg af data
          eller profilering til markedsføring. Vi træffer ikke automatiserede
          afgørelser med retsvirkning for dig uden menneskelig vurdering.
        </p>
      </article>

      <article id="deling-i-appen" class="legal-section">
        <h2>4. Hvem kan se dine oplysninger i Studos</h2>
        <p>
          Studos er et lukket klassefællesskab. Andre brugere kan kun se de oplysninger
          og det indhold, som appens funktioner giver dem adgang til, for eksempel din
          profil i klassen, beskeder i en chat, billeder i et album, events eller
          connections.
        </p>
        <p>
          Nødkontakt er valgfri. Hvis du tilføjer en nødkontakt, skal du selv vælge
          synligheden i appen og sikre dig, at oplysningerne må deles med den valgte
          målgruppe.
        </p>
        <p>
          Klasseejere og moderatorer kan få adgang til rapporter og moderationsdata,
          når det er nødvendigt for at behandle en sag.
        </p>
      </article>

      <article id="billeder" class="legal-section">
        <h2>5. Billeder og albummer</h2>
        <p>
          Billeder kan være personoplysninger, hvis personer kan genkendes. Den, der
          uploader et billede, skal sikre sig, at billedet lovligt kan deles i den
          valgte målgruppe, og at personer på billedet ikke bliver udstillet,
          krænket eller bragt i en privat eller sårbar situation.
        </p>
        <p>
          Albummer og gallerier er kun synlige for den målgruppe, der er valgt i appen.
          Det er ikke offentliggørelse på det åbne internet. Brugere med adgang kan dog
          se billedet og, hvor appen tillader det, gemme det på deres egen telefon.
          Videresendelse uden for Studos kræver samtykke eller andet lovligt grundlag.
        </p>
      </article>

      <article id="moderation" class="legal-section">
        <h2>6. Moderation, strikes og udelukkelse</h2>
        <p>
          Når indhold eller en bruger rapporteres, behandler vi oplysninger om rapporten,
          årsag, detaljer, mål, afsender, rapporteret bruger, status og afgørelse. Hvis
          en rapport fører til en strike, gemmes også strike-nummer, årsag, tidspunkt,
          eventuelle detaljer og hvem der udstedte den.
        </p>
        <p>
          Strike-systemet har en grænse på 3 aktive strikes. Ved 3 strikes bliver
          brugeren udelukket fra klassen. Alvorlige sager kan også føre til hurtigere
          begrænsning eller udelukkelse. Brugeren får besked i appen og kan klage til
          support.
        </p>
      </article>

      <article id="modtagere" class="legal-section">
        <h2>7. Leverandører og modtagere</h2>
        <p>
          Vi deler kun oplysninger, når det er nødvendigt for at drive Studos, beskytte
          brugere, overholde loven eller levere support.
        </p>
        <table class="legal-table">
          <thead>
            <tr><th>Modtager</th><th>Formål</th><th>Rolle</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Laravel Cloud</td>
              <td>Hosting, database og filopbevaring</td>
              <td>Databehandler</td>
            </tr>
            <tr>
              <td>Expo Push Service</td>
              <td>Afsendelse af push-notifikationer</td>
              <td>Databehandler eller underleverandør</td>
            </tr>
            <tr>
              <td>E-mailudbyder for supportmailen</td>
              <td>Support, rettighedsanmodninger og sletningsanmodninger</td>
              <td>Databehandler eller selvstændig udbyder, afhængigt af brug</td>
            </tr>
            <tr>
              <td>App-butikker</td>
              <td>Distribution af appen, hvis du henter den derfra</td>
              <td>Selvstændige dataansvarlige for deres egne tjenester</td>
            </tr>
            <tr>
              <td>Myndigheder</td>
              <td>Kun hvis loven kræver det, eller hvis det er nødvendigt ved alvorlig fare</td>
              <td>Selvstændige dataansvarlige</td>
            </tr>
          </tbody>
        </table>
        <p>
          Vi deler ikke personoplysninger med annoncører, datahandlere eller
          analysepartnere til markedsføring.
        </p>
      </article>

      <article id="overfoersel" class="legal-section">
        <h2>8. Overførsel uden for EU/EØS</h2>
        <p>
          Nogle leverandører kan behandle oplysninger uden for EU/EØS, for eksempel i
          forbindelse med push-notifikationer eller teknisk support. Hvis det sker, bruger
          vi relevante overførselsgrundlag, for eksempel EU-Kommissionens standardkontrakter,
          og vurderer behovet for supplerende beskyttelse.
        </p>
      </article>

      <article id="opbevaring" class="legal-section">
        <h2>9. Hvor længe vi gemmer oplysninger</h2>
        <ul>
          <li><strong>Aktiv konto:</strong> Konto- og klasseoplysninger gemmes, så længe kontoen er aktiv.</li>
          <li><strong>Login-sessioner:</strong> Auth-tokens slettes normalt senest 90 dage efter sidste brug eller efter tilbagekaldelse.</li>
          <li><strong>Engangskoder:</strong> Login-koder udløber efter kort tid, normalt 10-15 minutter.</li>
          <li><strong>Push-tokens:</strong> Slettes eller deaktiveres, når du slår notifikationer fra eller sletter kontoen. Ubrugte tokens ryddes løbende.</li>
          <li><strong>Server-logs:</strong> Opbevares normalt op til 30 dage.</li>
          <li><strong>Support:</strong> Opbevares normalt op til 24 måneder, medmindre sagen kræver længere opbevaring.</li>
          <li><strong>Rapporter og moderationssager:</strong> Opbevares så længe sagen er relevant for sikkerhed, klagebehandling og dokumentation. Lukkede sager opbevares normalt op til 24 måneder, medmindre lov, alvorlig misbrugshistorik eller en konkret tvist kræver længere opbevaring.</li>
          <li><strong>Strikes:</strong> Aktive strikes gemmes, så længe de er relevante for klassens sikkerhed og brugerens adgang til klassen. Ved kontosletning fjernes direkte medlemskoblinger, hvor det er muligt.</li>
          <li><strong>Fælles historik:</strong> Chatbeskeder, events, dyster og albummer kan bevares som en del af klassens historik, men direkte identifikatorer fjernes eller pseudonymiseres ved kontosletning.</li>
          <li><strong>Regnskab:</strong> Hvis der senere kommer betalte funktioner, kan bogføringsmateriale gemmes efter bogføringslovens regler.</li>
        </ul>
      </article>

      <article id="sletning" class="legal-section">
        <h2>10. Kontosletning og pseudonymisering</h2>
        <p>
          Du kan slette kontoen i appens indstillinger eller via
          <a href="{{ route('legal.delete-account') }}">studos.dk/slet-konto</a>.
          Når kontoen slettes, fjernes eller pseudonymiseres navn, e-mail, telefon,
          fødselsdato, adgangskode, profilbillede, push-tokens og aktive login-sessioner.
        </p>
        <p>
          I fælles historik kan dit navn blive erstattet med "Slettet bruger", mens selve
          historikken bevares for klassen. Det kan for eksempel være tidligere beskeder,
          events, dyster eller billeder i fælles albummer. Du kan altid kontakte os om
          konkrete beskeder eller billeder, du ønsker vurderet til sletning.
        </p>
        <p>
          Pseudonymiserede oplysninger er stadig personoplysninger, hvis de kan kobles
          til dig med yderligere information. Derfor behandler vi dem fortsat efter GDPR.
        </p>
      </article>

      <article id="rettigheder" class="legal-section">
        <h2>11. Dine rettigheder</h2>
        <p>Du har efter databeskyttelsesreglerne blandt andet ret til:</p>
        <ul>
          <li><strong>Oplysning og indsigt:</strong> Få at vide, hvilke oplysninger vi behandler om dig.</li>
          <li><strong>Rettelse:</strong> Få rettet forkerte eller mangelfulde oplysninger.</li>
          <li><strong>Sletning:</strong> Få slettet oplysninger, når betingelserne er opfyldt.</li>
          <li><strong>Begrænsning:</strong> Få begrænset behandlingen i særlige situationer.</li>
          <li><strong>Dataportabilitet:</strong> Få udleveret oplysninger, du selv har givet os, i et læsbart format, når betingelserne er opfyldt.</li>
          <li><strong>Indsigelse:</strong> Gøre indsigelse mod behandling baseret på legitim interesse.</li>
          <li><strong>Tilbagetrækning af samtykke:</strong> For eksempel ved at slå push-notifikationer fra.</li>
          <li><strong>Ikke kun automatiseret afgørelse:</strong> Moderationsklager vurderes af et menneske.</li>
        </ul>
        <p>
          Skriv til <a href="mailto:chris.sorensen1702@gmail.com">chris.sorensen1702@gmail.com</a>,
          hvis du vil bruge dine rettigheder. Vi kan bede om oplysninger, der bekræfter,
          at du er den rette kontoindehaver.
        </p>
      </article>

      <article id="unge" class="legal-section">
        <h2>12. Alder og unge brugere</h2>
        <p>
          Studos kræver, at brugere er mindst 16 år. Hvis vi bliver opmærksomme på en
          konto oprettet af en person under 16 år, kan vi lukke kontoen og slette eller
          pseudonymisere oplysningerne.
        </p>
        <p>
          Appen er bygget som et lukket klassefællesskab uden reklamer, uden tracking
          til markedsføring og med mulighed for at rapportere og blokere brugere.
        </p>
      </article>

      <article id="notifikationer" class="legal-section">
        <h2>13. Push-notifikationer</h2>
        <p>
          Push-notifikationer kræver, at du giver tilladelse på din telefon. Hvis du
          tillader dem, gemmer vi en push-token og tekniske oplysninger om enheden, så
          vi kan sende notifikationer om relevante hændelser, for eksempel chatbeskeder,
          reaktioner på dine beskeder, invitationer og aktiviteter i klassen.
        </p>
        <p>
          Du kan slå notifikationer fra i appen eller i telefonens indstillinger. Når
          du slår dem fra i appen, deaktiverer vi tokenet hos Studos.
        </p>
      </article>

      <article id="cookies" class="legal-section">
        <h2>14. Cookies og lokal lagring</h2>
        <p>
          Mobilappen bruger ikke browsercookies. Den gemmer nødvendige oplysninger lokalt
          på enheden, for eksempel login-session og visse appindstillinger. Hjemmesiden
          studos.dk bruger kun nødvendige cookies til session og sikkerhed. Se
          <a href="{{ route('legal.cookies') }}">cookiepolitikken</a>.
        </p>
      </article>

      <article id="sikkerhed" class="legal-section">
        <h2>15. Sikkerhed</h2>
        <ul>
          <li>Adgangskoder gemmes som saltede hashes.</li>
          <li>Transport mellem app og server krypteres med TLS, når appen bruger produktionsmiljø.</li>
          <li>Adgang til produktionsdata begrænses til relevante personer og formål.</li>
          <li>Rate limits og moderation hjælper med at forebygge misbrug.</li>
          <li>Ved brud på persondatasikkerheden følger vi reglerne om anmeldelse til Datatilsynet og underretning af berørte brugere.</li>
        </ul>
      </article>

      <article id="klage" class="legal-section">
        <h2>16. Klage til Datatilsynet</h2>
        <p>
          Du kan klage til Datatilsynet over vores behandling af personoplysninger:<br>
          <strong>Datatilsynet</strong>, Carl Jacobsens Vej 35, 2500 Valby<br>
          Telefon: +45 33 19 32 00 · <a href="https://www.datatilsynet.dk" rel="noopener">datatilsynet.dk</a>
        </p>
      </article>

      <article id="aendringer" class="legal-section">
        <h2>17. Ændringer</h2>
        <p>
          Vi opdaterer privatlivspolitikken, når appen, vores databehandling eller
          lovgivningen ændrer sig. Væsentlige ændringer varsles i appen eller på
          studos.dk, medmindre ændringen skal ske straks af sikkerheds- eller lovhensyn.
        </p>
      </article>

      <article id="kontakt" class="legal-section">
        <h2>18. Kontakt</h2>
        <p>
          <strong>PlateDigital EMV</strong><br>
          CVR: 42456187<br>
          Kærmindevej 12, 7441 Bording<br>
          E-mail: <a href="mailto:chris.sorensen1702@gmail.com">chris.sorensen1702@gmail.com</a><br>
          Telefon: <a href="tel:+4520631299">+45 20 63 12 99</a>
        </p>
      </article>
    </div>
  </section>
@endsection
