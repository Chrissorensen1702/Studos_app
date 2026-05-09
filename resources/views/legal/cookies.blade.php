@extends('layouts.studos')

@section('title', 'Cookiepolitik · Studos')

@section('content')
  <section class="page legal-page">
    <header class="legal-hero">
      <p class="eyebrow">Cookiepolitik</p>
      <h1>Cookies på studos.dk</h1>
      <p>
        Denne cookiepolitik forklarer hvilke cookies og lignende teknologier vi bruger
        på studos.dk, hvorfor vi bruger dem, og hvordan du kan styre dem. Politikken
        gælder kun hjemmesiden — mobilappen bruger ikke cookies.
      </p>
      <div class="legal-meta">
        <span><strong>Version:</strong> 1.1</span>
        <span><strong>Senest opdateret:</strong> 8. maj 2026</span>
        <span><strong>Udbyder:</strong> PlateDigital EMV · CVR 42456187</span>
      </div>
    </header>

    <div class="legal-content">
      <article id="hvad-er-cookies" class="legal-section">
        <h2>1. Hvad er cookies?</h2>
        <p>
          Cookies er små tekstfiler, som gemmes i din browser, når du besøger en
          hjemmeside. De bruges blandt andet til at huske dit login, sikre formularer
          mod misbrug og forbedre brugeroplevelsen. Lignende teknologier omfatter
          local storage og session storage.
        </p>
      </article>

      <article id="hvordan-bruger-vi" class="legal-section">
        <h2>2. Hvordan vi bruger cookies</h2>
        <p>
          Studos.dk bruger udelukkende <strong>strengt nødvendige cookies</strong>.
          Vi bruger ikke cookies til markedsføring, profilering eller deling med
          tredjeparts-annoncører. Vi har derfor ikke et cookie-banner, men oplyser
          her åbent om de cookies, der sættes.
        </p>
      </article>

      <article id="oversigt" class="legal-section">
        <h2>3. Oversigt over cookies</h2>
        <table class="legal-table">
          <thead>
            <tr>
              <th>Navn</th>
              <th>Formål</th>
              <th>Type</th>
              <th>Levetid</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>studos-session</code></td>
              <td>Holder dig logget ind på CMS og opretholder din session.</td>
              <td>Nødvendig</td>
              <td>Session / 2 timer</td>
            </tr>
            <tr>
              <td><code>XSRF-TOKEN</code></td>
              <td>Beskytter formularer mod CSRF-angreb (Laravel-standard).</td>
              <td>Nødvendig</td>
              <td>Session / 2 timer</td>
            </tr>
            <tr>
              <td><code>remember_web_*</code></td>
              <td>Sættes kun, hvis du aktivt vælger "Husk mig" ved login. Du giver dermed udtrykkeligt samtykke til, at cookien sættes.</td>
              <td>Nødvendig (valgfri aktivering)</td>
              <td>30 dage</td>
            </tr>
          </tbody>
        </table>
        <p>
          Vi bruger ikke Google Analytics, Facebook Pixel, Hotjar eller lignende
          tredjeparts-tracking. Hvis det ændrer sig, opdaterer vi denne politik og
          indfører et samtykke-banner inden ikrafttrædelse.
        </p>
      </article>

      <article id="tredjepart" class="legal-section">
        <h2>4. Tredjepartscookies</h2>
        <p>
          Pt. sætter studos.dk <strong>ingen</strong> tredjepartscookies. Vi indlejrer
          ikke YouTube-, Vimeo- eller andre videoer, som ville sætte cookies, og vi
          bruger ikke kort eller chat-widgets fra tredjeparter på hjemmesiden.
        </p>
      </article>

      <article id="samtykke" class="legal-section">
        <h2>5. Samtykke</h2>
        <p>
          Da vi kun bruger strengt nødvendige cookies, kræves der efter ePrivacy-
          direktivet og cookiebekendtgørelsen ikke samtykke. Du kan dog altid afvise
          eller slette cookies via din browsers indstillinger — bemærk dog, at det
          kan betyde, at du ikke kan logge ind på CMS.
        </p>
      </article>

      <article id="styring" class="legal-section">
        <h2>6. Sådan styrer du cookies</h2>
        <p>
          Du kan blokere eller slette cookies i din browsers indstillinger. Vejledninger:
        </p>
        <ul>
          <li><a href="https://support.google.com/chrome/answer/95647" rel="noopener">Google Chrome</a></li>
          <li><a href="https://support.mozilla.org/kb/cookies-information-websites-store-on-your-computer" rel="noopener">Mozilla Firefox</a></li>
          <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" rel="noopener">Apple Safari</a></li>
          <li><a href="https://support.microsoft.com/microsoft-edge" rel="noopener">Microsoft Edge</a></li>
        </ul>
      </article>

      <article id="mobilappen" class="legal-section">
        <h2>7. Cookies og lokal lagring i mobilappen</h2>
        <p>
          <strong>Studos-mobilappen bruger ikke cookies.</strong> Den native app
          gemmer alene en login-token i enhedens sikre lagring (Keychain på iOS,
          Keystore på Android) samt anonyme præferencer (fx om du har set
          notifikations-prompten) og en eventuel Expo Push Token, hvis du har
          sagt ja til notifikationer. Disse oplysninger er beskrevet i vores
          <a href="{{ route('legal.privacy') }}">privatlivspolitik</a>. Appen
          indeholder ingen tracking-SDK'er eller analyseværktøjer.
        </p>
      </article>

      <article id="aendringer" class="legal-section">
        <h2>8. Ændringer</h2>
        <p>
          Vi kan opdatere denne cookiepolitik, hvis vi tager nye værktøjer i brug.
          Ændringer offentliggøres på denne side med opdateringsdato.
        </p>
      </article>

      <article id="kontakt" class="legal-section">
        <h2>9. Kontakt</h2>
        <p>
          Spørgsmål til cookiepolitikken sendes til
          <a href="mailto:hej@studos.dk">hej@studos.dk</a>.<br>
          <strong>PlateDigital EMV</strong><br>
          CVR: 42456187<br>
          Kærmindevej 12, 7441 Bording<br>
          Telefon: <a href="tel:+4520631299">+45 20 63 12 99</a>
        </p>
      </article>
    </div>
  </section>
@endsection
