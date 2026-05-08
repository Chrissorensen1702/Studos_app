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
        <span><strong>Version:</strong> 1.0</span>
        <span><strong>Senest opdateret:</strong> 8. maj 2026</span>
        <span><strong>Dataansvarlig:</strong> PlateDigital</span>
      </div>
    </header>

    <div class="legal-content">
      <article id="dataansvarlig" class="legal-section">
        <h2>1. Dataansvarlig</h2>
        <p>
          <strong>PlateDigital</strong><br>
          E-mail: <a href="mailto:hej@studos.dk">hej@studos.dk</a><br>
          Telefon: <a href="tel:+4520631299">+45 20 63 12 99</a>
        </p>
        <p>
          Henvendelser om dine rettigheder, indsigt, sletning eller dataportabilitet
          sendes til <a href="mailto:hej@studos.dk">hej@studos.dk</a>. Vi svarer som
          udgangspunkt inden for 30 dage.
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
              <td>Profil</td>
              <td>For-/efternavn, e-mail, telefonnummer (valgfri), fødselsdag, profilbillede, klasse, skole</td>
              <td>Du selv ved oprettelse</td>
            </tr>
            <tr>
              <td>Adgang og login</td>
              <td>Hashet adgangskode, login-tokens, login-koder (engangs)</td>
              <td>Du selv / system</td>
            </tr>
            <tr>
              <td>Brugerindhold</td>
              <td>Beskeder, billeder, begivenheder, dyste, kommentarer, gallerier</td>
              <td>Du selv</td>
            </tr>
            <tr>
              <td>Nødkontakt (valgfri)</td>
              <td>Navn og telefon på pårørende</td>
              <td>Du selv</td>
            </tr>
            <tr>
              <td>Push-token</td>
              <td>Expo Push Token, enhedsnavn, app-version, OS-version</td>
              <td>Din enhed</td>
            </tr>
            <tr>
              <td>Aktivitet</td>
              <td>Caps-saldo, dyste-historik, deltagelse i events, RSVP</td>
              <td>Genereret ved brug</td>
            </tr>
            <tr>
              <td>Moderation</td>
              <td>Rapporter, blokeringer, advarsler</td>
              <td>Brugere / moderatorer</td>
            </tr>
            <tr>
              <td>Tekniske data</td>
              <td>Sidste login, sidste set-tidspunkt, IP-adresse til rate limiting</td>
              <td>Server</td>
            </tr>
          </tbody>
        </table>
        <p>
          Vi indsamler <strong>ikke</strong> præcis lokation, biometriske data eller
          oplysninger fra dit kontaktkartotek. Vi sælger aldrig dine data.
        </p>
      </article>

      <article id="formaal" class="legal-section">
        <h2>3. Formål og retsgrundlag</h2>
        <ul>
          <li><strong>Levere tjenesten</strong> (kontooprettelse, login, chat, kalender, dyste) — retsgrundlag: opfyldelse af aftale, GDPR art. 6(1)(b).</li>
          <li><strong>Sikkerhed og misbrug</strong> (login-koder, blokering, rapporter, rate limiting) — retsgrundlag: legitim interesse, GDPR art. 6(1)(f).</li>
          <li><strong>Push-notifikationer</strong> — retsgrundlag: samtykke, GDPR art. 6(1)(a). Du kan til enhver tid trække samtykket tilbage i app-indstillingerne.</li>
          <li><strong>Forbedring af tjenesten</strong> (anonyme statistikker over brug) — retsgrundlag: legitim interesse, GDPR art. 6(1)(f).</li>
          <li><strong>Lovbestemte krav</strong> (ved myndighedsanmodning) — retsgrundlag: retlig forpligtelse, GDPR art. 6(1)(c).</li>
        </ul>
      </article>

      <article id="deling" class="legal-section">
        <h2>4. Hvem vi deler data med</h2>
        <p>
          Vi deler kun data med tredjeparter, når det er nødvendigt for at drive tjenesten,
          og altid på baggrund af en databehandleraftale (DPA):
        </p>
        <ul>
          <li><strong>Hosting / database:</strong> Laravel Cloud (Storage og MySQL).</li>
          <li><strong>Push-notifikationer:</strong> Expo Push Service (Expo Inc., USA).</li>
          <li><strong>App-distribution:</strong> Apple App Store og Google Play.</li>
          <li><strong>Support og e-mail:</strong> Vores e-mailudbyder til support@studos.dk og hej@studos.dk.</li>
        </ul>
        <p>
          Andre brugere ser kun det indhold, du selv vælger at dele i din klasse, i
          gruppechats, i direktechat eller med dine connections.
        </p>
      </article>

      <article id="opbevaring" class="legal-section">
        <h2>5. Opbevaringsperioder</h2>
        <ul>
          <li><strong>Aktiv konto:</strong> Så længe din konto er aktiv.</li>
          <li><strong>Slettet konto:</strong> Personoplysninger anonymiseres straks. Visse referencefelter (fx "Slettet bruger") bevares for at undgå brudte historikker.</li>
          <li><strong>Login-tokens:</strong> Op til 90 dage efter sidste brug.</li>
          <li><strong>Login-koder:</strong> 15 minutter.</li>
          <li><strong>Push-tokens:</strong> Slettes når du slår notifikationer fra eller sletter kontoen.</li>
          <li><strong>Moderationsdata (rapporter):</strong> Op til 24 måneder af hensyn til misbrugsforebyggelse, derefter anonymiseres.</li>
          <li><strong>Server-logs:</strong> Op til 30 dage.</li>
        </ul>
      </article>

      <article id="sikkerhed" class="legal-section">
        <h2>6. Sikkerhed</h2>
        <ul>
          <li>Adgangskoder gemmes som saltede hashes (bcrypt).</li>
          <li>Al trafik krypteres i transit med TLS.</li>
          <li>Adgang til produktionsdata er begrænset og logges.</li>
          <li>Rate limits beskytter mod misbrug og brute force.</li>
          <li>Vi anmelder personhenførbare brud til Datatilsynet inden for 72 timer, jf. GDPR art. 33.</li>
        </ul>
      </article>

      <article id="rettigheder" class="legal-section">
        <h2>7. Dine rettigheder</h2>
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
          beskytte din konto.
        </p>
      </article>

      <article id="boern" class="legal-section">
        <h2>8. Børn under 15 år</h2>
        <p>
          Studos er rettet mod elever på ungdomsuddannelser. Den danske aldersgrænse
          for selvstændigt samtykke til informationssamfundstjenester er 15 år.
        </p>
        <p>
          Hvis du er under 15 år, skal en forælder eller værge give samtykke til,
          at du opretter en konto. Vi kan på anmodning fremsende en samtykkeskabelon.
          Bliver vi opmærksomme på, at en konto er oprettet af et barn under 15 år
          uden forældresamtykke, sletter vi kontoen.
        </p>
      </article>

      <article id="cookies-tracking" class="legal-section">
        <h2>9. Cookies og tracking</h2>
        <p>
          <strong>Mobilappen</strong> bruger ikke cookies. Vi bruger heller ikke
          tracking-SDK'er som Apple ATT eller Google UMP, da vi ikke deler data med
          tredjepartsannoncører.
        </p>
        <p>
          <strong>Hjemmesiden studos.dk</strong> bruger kun nødvendige cookies (session,
          CSRF-beskyttelse). Læs mere i vores
          <a href="{{ route('legal.cookies') }}">cookiepolitik</a>.
        </p>
      </article>

      <article id="push" class="legal-section">
        <h2>10. Push-notifikationer</h2>
        <p>
          Push-notifikationer er valgfrie og kræver dit aktive samtykke i mobilen.
          Når du aktiverer notifikationer, gemmer vi din Expo Push Token sammen med
          enhedsnavn og app-version. Tokenet bruges udelukkende til at sende
          notifikationer fra Studos. Du kan til enhver tid slå notifikationer fra
          i app-indstillingerne — så slettes/deaktiveres tokenet.
        </p>
      </article>

      <article id="tredjeparter" class="legal-section">
        <h2>11. Tredjepartstjenester</h2>
        <table class="legal-table">
          <thead>
            <tr><th>Tjeneste</th><th>Formål</th><th>Placering</th></tr>
          </thead>
          <tbody>
            <tr><td>Laravel Cloud</td><td>Hosting + database</td><td>EU</td></tr>
            <tr><td>Expo Push Service</td><td>Push-notifikationer</td><td>USA (SCC)</td></tr>
            <tr><td>Apple App Store / Google Play</td><td>App-distribution</td><td>EU/USA</td></tr>
          </tbody>
        </table>
      </article>

      <article id="overfoersel" class="legal-section">
        <h2>12. Overførsel til lande uden for EU</h2>
        <p>
          Visse leverandører er placeret i USA (fx Expo). Overførsler sker på baggrund
          af EU-Kommissionens standardkontraktbestemmelser (SCC, art. 46) og vurderes
          via en transfer impact assessment (TIA).
        </p>
      </article>

      <article id="aendringer" class="legal-section">
        <h2>13. Ændringer i politikken</h2>
        <p>
          Vi kan opdatere denne politik. Væsentlige ændringer varsles i appen mindst
          14 dage før ikrafttræden. Den til enhver tid gældende version er tilgængelig
          på denne side med versionsnummer og opdateringsdato.
        </p>
      </article>

      <article id="klage" class="legal-section">
        <h2>14. Klage til Datatilsynet</h2>
        <p>
          Hvis du er utilfreds med vores behandling af dine personoplysninger, kan du
          klage til Datatilsynet:<br>
          <strong>Datatilsynet</strong>, Carl Jacobsens Vej 35, 2500 Valby<br>
          Telefon: +45 33 19 32 00 · <a href="https://www.datatilsynet.dk">datatilsynet.dk</a>
        </p>
      </article>

      <article id="kontakt" class="legal-section">
        <h2>15. Kontakt</h2>
        <p>
          <strong>PlateDigital</strong><br>
          E-mail: <a href="mailto:hej@studos.dk">hej@studos.dk</a><br>
          Telefon: <a href="tel:+4520631299">+45 20 63 12 99</a>
        </p>
      </article>
    </div>
  </section>
@endsection
