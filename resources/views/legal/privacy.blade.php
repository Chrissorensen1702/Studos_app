@extends('layouts.studos')

@section('title', 'Privatlivspolitik · Studos')

@section('content')
  <section class="page legal-page">
    <header class="legal-hero">
      <p class="eyebrow">Privatlivspolitik</p>
      <h1>Sådan håndterer vi dine data</h1>
      <p>
        Vi tager dit privatliv alvorligt. Denne politik beskriver hvilke
        personoplysninger Studos indsamler, hvorfor vi gør det, hvordan vi beskytter
        dem, og hvilke rettigheder du har under databeskyttelsesforordningen (GDPR).
      </p>
      <div class="legal-meta">
        <span><strong>Version:</strong> 1.2</span>
        <span><strong>Senest opdateret:</strong> 11. maj 2026</span>
        <span><strong>Dataansvarlig:</strong> PlateDigital EMV · CVR 42456187</span>
      </div>
    </header>

    <div class="legal-content">
      <div class="legal-callout">
        <strong>Kort fortalt:</strong> Studos er reklamefri og uden tracking. Vi
        sælger aldrig dine data. Vi indsamler kun det, vi skal bruge for at drive
        klassehubben, herunder lukkede albummer i appen, og du kan slette din
        konto når som helst.
      </div>

      <article id="dataansvarlig" class="legal-section">
        <h2>1. Dataansvarlig</h2>
        <p>
          <strong>PlateDigital EMV</strong><br>
          CVR: 42456187<br>
          Kærmindevej 12, 7441 Bording<br>
          E-mail: <a href="mailto:hej@studos.dk">hej@studos.dk</a><br>
          Telefon: <a href="tel:+4520631299">+45 20 63 12 99</a>
        </p>
        <p>
          Henvendelser om dine rettigheder, indsigt, sletning eller dataportabilitet
          sendes til <a href="mailto:hej@studos.dk">hej@studos.dk</a>. Vi svarer som
          udgangspunkt inden for 30 dage, jf. GDPR art. 12, stk. 3.
        </p>
      </article>

      <article id="hvilke-data" class="legal-section">
        <h2>2. Hvilke oplysninger vi indsamler</h2>
        <table class="legal-table">
          <thead>
            <tr><th>Kategori</th><th>Eksempler</th><th>Kilde</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Identifikatorer</td>
              <td>Bruger-ID, klasse-ID, personlig Studos-kode</td>
              <td>Genereret ved oprettelse</td>
            </tr>
            <tr>
              <td>Kontaktoplysninger</td>
              <td>For- og efternavn, e-mail, telefonnummer (valgfri), fødselsdag, klasse, skole</td>
              <td>Du selv ved oprettelse</td>
            </tr>
            <tr>
              <td>Profilbillede / mediefiler</td>
              <td>Profilbillede, album- og galleribilleder, covers samt eventuelle billeder eller videoer i chats</td>
              <td>Du selv</td>
            </tr>
            <tr>
              <td>Adgang og login</td>
              <td>Hashet adgangskode (bcrypt), login-tokens, engangs-loginkoder</td>
              <td>Du selv / system</td>
            </tr>
            <tr>
              <td>Brugerindhold</td>
              <td>Chatbeskeder (1:1, grupper og klasse), opslag, kommentarer, begivenheder, RSVP, dyster, udfordringer, gallerier, albummer, albumnavne og albumindstillinger</td>
              <td>Du selv</td>
            </tr>
            <tr>
              <td>Album- og billedmetadata</td>
              <td>Uploader, uploadtidspunkt, synlighed, målgruppe, tilladelser, sortering, rapportstatus og slette-/moderationsstatus</td>
              <td>Du selv / system</td>
            </tr>
            <tr>
              <td>Connections og blokeringer</td>
              <td>Hvilke brugere du er forbundet med eller har blokeret</td>
              <td>Du selv</td>
            </tr>
            <tr>
              <td>Nødkontakt (valgfri)</td>
              <td>Navn og telefon på pårørende</td>
              <td>Du selv</td>
            </tr>
            <tr>
              <td>Push-notifikationsdata</td>
              <td>Expo Push Token, enhedsnavn, platform, app-variant, native app-version, native build-version</td>
              <td>Din enhed</td>
            </tr>
            <tr>
              <td>App- og brugsdata</td>
              <td>Caps-saldo, dyste-historik, deltagelse i events, sidste login, sidste set-tidspunkt</td>
              <td>Genereret ved brug</td>
            </tr>
            <tr>
              <td>Moderationsdata</td>
              <td>Indberetninger (notices), advarsler, suspenderinger, klagebehandling</td>
              <td>Brugere / moderatorer</td>
            </tr>
            <tr>
              <td>Diagnostik / sikkerhed</td>
              <td>IP-adresse til rate limiting og misbrugsforebyggelse, server-logs</td>
              <td>Server</td>
            </tr>
            <tr>
              <td>Support-korrespondance</td>
              <td>E-mails du sender til hej@studos.dk og vores svar</td>
              <td>Du selv / support</td>
            </tr>
          </tbody>
        </table>
        <p>
          Vi indsamler <strong>ikke</strong>: præcis lokation, biometriske data,
          oplysninger fra dit kontaktkartotek, helbreds- eller racemæssige
          oplysninger eller andre særlige kategorier, jf. GDPR art. 9. Vi sælger
          aldrig dine data og deler dem ikke med annoncører.
        </p>
      </article>

      <article id="formaal" class="legal-section">
        <h2>3. Formål og retsgrundlag</h2>
        <ul>
          <li><strong>Levere tjenesten</strong> (kontooprettelse, login, chat, kalender, dyster, albummer og billeddeling) — retsgrundlag: opfyldelse af aftale, GDPR art. 6, stk. 1, litra b.</li>
          <li><strong>Sikkerhed og misbrugsforebyggelse</strong> (login-koder, rate limiting, blokeringer, rapporter, moderation) — retsgrundlag: legitim interesse, GDPR art. 6, stk. 1, litra f.</li>
          <li><strong>Vise og administrere albummer</strong> (upload, visning, gem på telefon, sletning, rapportering, uploader- og datooplysninger) — retsgrundlag: opfyldelse af aftale, GDPR art. 6, stk. 1, litra b, og legitim interesse i et sikkert klassefællesskab, litra f.</li>
          <li><strong>Push-notifikationer</strong> — retsgrundlag: samtykke, GDPR art. 6, stk. 1, litra a. Du kan til enhver tid trække samtykket tilbage i app-indstillingerne.</li>
          <li><strong>Forbedring af tjenesten</strong> (aggregerede og anonyme statistikker over brug) — retsgrundlag: legitim interesse, GDPR art. 6, stk. 1, litra f.</li>
          <li><strong>Lovbestemte krav</strong> (myndighedsanmodninger, regnskabs- og bogføringspligt) — retsgrundlag: retlig forpligtelse, GDPR art. 6, stk. 1, litra c.</li>
        </ul>
        <p>
          Vi anvender ikke automatiserede afgørelser i GDPR art. 22's forstand,
          og vi profilerer ikke brugere til markedsføringsformål.
        </p>
      </article>

      <article id="album-billeder" class="legal-section">
        <h2>4. Albummer, billeder og personer på billeder</h2>
        <p>
          Albummer og gallerier i Studos er brugeroprettet indhold. Billeder kan
          være personoplysninger, når personer kan genkendes. Den bruger, der
          uploader et billede, skal derfor sikre sig, at billedet lovligt kan deles
          i den valgte målgruppe, og at personer på billedet ikke med rimelighed
          kan føle sig udstillet, krænket eller bragt i en privat eller følsom
          situation.
        </p>
        <p>
          Albummer er lukkede for den valgte Studos-målgruppe. "Offentlig" eller
          delt synlighed i appen betyder synlig for den valgte klasse, crew eller
          specifikke personer i Studos — ikke offentliggørelse på det åbne internet.
          Brugere med adgang til et album kan dog se billederne og, hvor funktionen
          er aktiveret, gemme dem på deres egen telefon. De må ikke videredele
          billeder uden for Studos uden samtykke eller andet lovligt grundlag.
        </p>
        <p>
          Vi viser uploader og uploadtidspunkt i billedviseren for at skabe
          gennemsigtighed og ansvarlighed. Billeder kan slettes af berettigede
          brugere eller fjernes af Studos efter rapport, indsigelse, misbrug,
          ulovligt indhold eller andre saglige grunde.
        </p>
      </article>

      <article id="deling" class="legal-section">
        <h2>5. Modtagere og databehandlere</h2>
        <p>
          Vi deler kun data med tredjeparter, når det er nødvendigt for at drive
          tjenesten. Tjenesteleverandører, der behandler personoplysninger på
          vores vegne, gør det altid på grundlag af en databehandleraftale (DPA),
          jf. GDPR art. 28:
        </p>
        <ul>
          <li><strong>Laravel Cloud</strong> — hosting, database, objektlagring (databehandler).</li>
          <li><strong>Expo Push Service (Expo Inc.)</strong> — afsendelse af push-notifikationer (databehandler).</li>
          <li><strong>E-mailudbyder for hej@studos.dk</strong> — håndtering af support-korrespondance (databehandler).</li>
        </ul>
        <p>
          <strong>Apple App Store</strong> og <strong>Google Play</strong> behandler
          personoplysninger som <em>selvstændige dataansvarlige</em> i forbindelse
          med distribution af appen og er <em>ikke</em> vores databehandlere. Læs
          deres egne politikker for, hvordan de behandler dine oplysninger.
        </p>
        <p>
          Andre brugere ser kun det indhold, du selv vælger at dele i din klasse,
          gruppechats, direktechat, albummer eller med dine connections. Indhold
          videregives aldrig til tredjeparter til markedsførings- eller
          analyseformål.
        </p>
      </article>

      <article id="opbevaring" class="legal-section">
        <h2>6. Opbevaringsperioder</h2>
        <ul>
          <li><strong>Aktiv konto:</strong> Så længe din konto er aktiv.</li>
          <li><strong>Slettet konto:</strong> Personoplysninger pseudonymiseres straks (navn, e-mail, telefon, fødselsdag, profilbillede mv. fjernes; bruger-ID bevares som intern reference for at undgå brudte historikker — se pkt. 7).</li>
          <li><strong>Albummer og billeder:</strong> Opbevares så længe albummet er aktivt for den valgte målgruppe, eller indtil billedet/albummet slettes af en berettiget bruger, fjernes efter rapport/indsigelse, eller kontoen/klassen afvikles efter gældende sletteflow.</li>
          <li><strong>Slettede albumfiler:</strong> Fjernes eller gøres utilgængelige hurtigst muligt. Tekniske sikkerhedskopier og logspor kan eksistere kortvarigt, og materiale knyttet til moderation kan opbevares efter nedenstående moderationsregel.</li>
          <li><strong>Login-tokens:</strong> Op til 90 dage efter sidste brug.</li>
          <li><strong>Login-koder (engangskoder):</strong> 15 minutter.</li>
          <li><strong>Push-tokens:</strong> Slettes når du slår notifikationer fra eller sletter kontoen.</li>
          <li><strong>Moderationsdata (rapporter, klager):</strong> Op til 24 måneder af hensyn til misbrugsforebyggelse og dokumentationspligt efter DSA, derefter pseudonymiseres yderligere eller slettes.</li>
          <li><strong>Server-logs:</strong> Op til 30 dage.</li>
          <li><strong>Support-korrespondance:</strong> Op til 24 måneder, medmindre længere opbevaring kræves af lov.</li>
          <li><strong>Bogføringspligtigt materiale</strong> (hvis Studos senere indfører betalte funktioner): 5 år efter regnskabsårets udløb, jf. bogføringslovens § 12.</li>
        </ul>
      </article>

      <article id="anonymisering" class="legal-section">
        <h2>7. Anonymisering, pseudonymisering og historik</h2>
        <p>
          Når du sletter din konto, fjerner vi de oplysninger, der direkte kan
          identificere dig (navn, e-mail, telefon, adgangskode, profilbillede mv.).
          Dit display-navn i historiske beskeder erstattes med "Slettet bruger".
        </p>
        <p>
          Visse interne identifikatorer (fx dit bruger-ID) bevares som stabil
          reference, så klassens fælles historik (chats, dyster, albummer, gallerier) ikke
          går i stykker. Det betyder, at sletningen i juridisk forstand er en
          <em>pseudonymisering</em> snarere end en fuld anonymisering — dine data
          er fortsat omfattet af GDPR, og du beholder dine rettigheder, jf.
          GDPR betragtning 26.
        </p>
        <p>
          Billeder, du har uploadet til fælles albummer, fjernes ikke altid
          automatisk ved kontosletning, hvis de indgår i klassens fælles historik.
          Din uploader-identitet pseudonymiseres, og du kan slette egne billeder
          før kontosletning eller kontakte os, hvis du ønsker bestemte billeder
          fjernet.
        </p>
        <p>
          Ønsker du yderligere udvanding (fx fjernelse af enkelte beskeder eller
          billeder, du selv har sendt), kan du kontakte
          <a href="mailto:hej@studos.dk">hej@studos.dk</a>.
        </p>
      </article>

      <article id="sikkerhed" class="legal-section">
        <h2>8. Sikkerhed</h2>
        <ul>
          <li>Adgangskoder gemmes som saltede hashes (bcrypt).</li>
          <li>Al trafik krypteres i transit med TLS.</li>
          <li>Adgang til produktionsdata er begrænset og logges.</li>
          <li>Rate limits beskytter mod misbrug og brute force.</li>
          <li>Vi anmelder personhenførbare brud til Datatilsynet inden for 72 timer, jf. GDPR art. 33, og underretter berørte brugere, hvor det er påkrævet, jf. art. 34.</li>
        </ul>
      </article>

      <article id="rettigheder" class="legal-section">
        <h2>9. Dine rettigheder</h2>
        <p>Du har under GDPR følgende rettigheder:</p>
        <ul>
          <li><strong>Indsigt</strong> (art. 15) — få en kopi af de oplysninger, vi har om dig.</li>
          <li><strong>Berigtigelse</strong> (art. 16) — få rettet forkerte oplysninger.</li>
          <li><strong>Sletning</strong> (art. 17) — få slettet dine data. Sker via app eller <a href="{{ route('legal.delete-account') }}">studos.dk/slet-konto</a>.</li>
          <li><strong>Begrænsning</strong> (art. 18) — få begrænset behandlingen i bestemte tilfælde.</li>
          <li><strong>Dataportabilitet</strong> (art. 20) — få dine data i et maskinlæsbart format.</li>
          <li><strong>Indsigelse</strong> (art. 21) — gøre indsigelse mod behandling baseret på legitim interesse.</li>
          <li><strong>Tilbagekaldelse af samtykke</strong> (art. 7) — særligt for push-notifikationer.</li>
        </ul>
        <p>
          Anmodninger sendes til <a href="mailto:hej@studos.dk">hej@studos.dk</a>. Vi
          besvarer henvendelser inden for 30 dage og kan kræve identifikation for at
          beskytte din konto. Du kan klage direkte til Datatilsynet uden først at
          kontakte os — se pkt. 15.
        </p>
        <p>
          Hvis et billede af dig er delt i et album, kan du også bede om
          begrænsning, sletning eller en konkret vurdering, selv om du ikke selv
          har uploadet billedet.
        </p>
      </article>

      <article id="boern" class="legal-section">
        <h2>10. Aldersgrænse og mindreårige</h2>
        <p>
          Studos er rettet mod elever på ungdomsuddannelser. Som forretningsregel
          skal du være mindst <strong>15 år</strong> for at oprette en konto.
        </p>
        <p>
          Bliver vi opmærksomme på, at en konto er oprettet af en bruger under
          15 år, sletter vi kontoen. Forældre eller værger kan kontakte
          <a href="mailto:hej@studos.dk">hej@studos.dk</a> for at anmode om
          sletning på vegne af deres barn — vi prioriterer disse henvendelser
          særligt højt og besvarer dem inden for 3 arbejdsdage.
        </p>
        <p>
          Som platform, der er tilgængelig for mindreårige, har vi indført særlige
          beskyttelsesforanstaltninger, jf. DSA art. 28: ingen reklamer, ingen
          profilering, ingen adfærdsbaseret målretning og lukkede klassebaserede
          fællesskaber. Se brugervilkårenes pkt. 11.
        </p>
        <p>
          Billeder af børn og unge kræver særlig omtanke. Vi fjerner eller
          begrænser billeder hurtigt, hvis de fremstår krænkende, private,
          seksuelle, ydmygende, ulovlige eller på anden måde uegnede for et
          ungdomsfællesskab.
        </p>
      </article>

      <article id="cookies-tracking" class="legal-section">
        <h2>11. Cookies og tracking</h2>
        <p>
          <strong>Mobilappen</strong> bruger ikke cookies og indeholder ingen
          tracking-SDK'er som Apple App Tracking Transparency, Google UMP,
          Facebook Pixel, Google Analytics eller Firebase Analytics.
        </p>
        <p>
          <strong>Hjemmesiden studos.dk</strong> bruger kun strengt nødvendige
          cookies (session, CSRF-beskyttelse). Læs mere i vores
          <a href="{{ route('legal.cookies') }}">cookiepolitik</a>.
        </p>
        <p>
          Når du vælger eller gemmer billeder i mobilappen, bruges iOS' og
          Androids native fototilladelser eller systemvælgere. Studos scanner ikke
          dit billedbibliotek og uploader kun de billeder, du aktivt vælger.
        </p>
      </article>

      <article id="push" class="legal-section">
        <h2>12. Push-notifikationer</h2>
        <p>
          Push-notifikationer er valgfrie og kræver dit aktive samtykke i mobilen.
          Når du aktiverer notifikationer, gemmer vi din Expo Push Token sammen
          med enhedsnavn, platform, app-variant, native app-version og native
          build-version. Disse oplysninger bruges udelukkende til at sende dig
          notifikationer fra Studos og til at fejlsøge afsendelser. Du kan til
          enhver tid slå notifikationer fra i app-indstillingerne — så slettes
          eller deaktiveres tokenet.
        </p>
      </article>

      <article id="tredjeparter" class="legal-section">
        <h2>13. Tredjepartstjenester</h2>
        <table class="legal-table">
          <thead>
            <tr><th>Tjeneste</th><th>Formål</th><th>Rolle</th><th>Placering</th></tr>
          </thead>
          <tbody>
            <tr><td>Laravel Cloud</td><td>Hosting + database + lagring</td><td>Databehandler</td><td>EU</td></tr>
            <tr><td>iOS/Android fototilladelser</td><td>Vælge og gemme albumfotos på brugerens egen enhed</td><td>Enheds-/platformsfunktion</td><td>På din enhed</td></tr>
            <tr><td>Expo Push Service (Expo Inc.)</td><td>Push-notifikationer</td><td>Databehandler</td><td>USA (SCC)</td></tr>
            <tr><td>Apple App Store</td><td>App-distribution</td><td>Selvstændig dataansvarlig</td><td>EU/USA</td></tr>
            <tr><td>Google Play</td><td>App-distribution</td><td>Selvstændig dataansvarlig</td><td>EU/USA</td></tr>
            <tr><td>E-mailudbyder for hej@studos.dk</td><td>Support og kommunikation</td><td>Databehandler</td><td>EU</td></tr>
          </tbody>
        </table>
      </article>

      <article id="overfoersel" class="legal-section">
        <h2>14. Overførsel til lande uden for EU/EØS</h2>
        <p>
          Visse leverandører er placeret i USA (fx Expo Inc.). Overførsler sker
          på baggrund af EU-Kommissionens standardkontraktbestemmelser
          (SCC, GDPR art. 46, stk. 2, litra c) og en transfer impact assessment
          (TIA), der vurderer eventuelle supplerende beskyttelses­foranstaltninger
          i lyset af Schrems II-praksis.
        </p>
      </article>

      <article id="klage" class="legal-section">
        <h2>15. Klage til Datatilsynet</h2>
        <p>
          Du har til enhver tid ret til at klage til Datatilsynet over vores
          behandling af dine personoplysninger — også uden først at kontakte os:<br>
          <strong>Datatilsynet</strong>, Carl Jacobsens Vej 35, 2500 Valby<br>
          Telefon: +45 33 19 32 00 · <a href="https://www.datatilsynet.dk">datatilsynet.dk</a>
        </p>
      </article>

      <article id="aendringer" class="legal-section">
        <h2>16. Ændringer i politikken</h2>
        <p>
          Vi kan opdatere denne politik. Væsentlige ændringer varsles i appen mindst
          14 dage før ikrafttræden. Den til enhver tid gældende version er tilgængelig
          på denne side med versionsnummer og opdateringsdato.
        </p>
      </article>

      <article id="kontakt" class="legal-section">
        <h2>17. Kontakt</h2>
        <p>
          <strong>PlateDigital EMV</strong><br>
          CVR: 42456187<br>
          Kærmindevej 12, 7441 Bording<br>
          E-mail: <a href="mailto:hej@studos.dk">hej@studos.dk</a><br>
          Telefon: <a href="tel:+4520631299">+45 20 63 12 99</a>
        </p>
      </article>
    </div>
  </section>
@endsection
