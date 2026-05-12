@extends('layouts.studos')

@section('title', 'Cookiepolitik · Studos')

@section('content')
  <section class="page legal-page">
    <header class="legal-hero">
      <h1>Cookies på studos.dk</h1>
      <p>
        Denne side forklarer, hvilke cookies og lignende teknologier Studos bruger
        på hjemmesiden. Mobilappen bruger ikke browsercookies.
      </p>
      <div class="legal-meta">
        <span><strong>Version:</strong> 1.4</span>
        <span><strong>Senest opdateret:</strong> 12. maj 2026</span>
        <span><strong>Udbyder:</strong> PlateDigital EMV · CVR 42456187</span>
      </div>
    </header>

    <div class="legal-content">
      <article id="hvad-er-cookies" class="legal-section">
        <h2>1. Hvad er cookies?</h2>
        <p>
          Cookies er små tekstfiler, som kan gemmes i din browser. De kan for
          eksempel bruges til at holde dig logget ind, beskytte formularer eller
          huske nødvendige valg.
        </p>
      </article>

      <article id="brug" class="legal-section">
        <h2>2. Hvordan Studos bruger cookies</h2>
        <p>
          Studos.dk bruger nødvendige cookies til session og sikkerhed. Vi
          bruger også browserens localStorage, hvis du vælger at gemme dit
          cookievalg, så banneret ikke vises igen ved hvert besøg.
        </p>
        <p>
          Vi bruger ikke cookies eller lignende teknologier til annoncering,
          marketing, profilering, statistik eller deling med annoncører. Hvis vi
          senere indfører nye formål, opdaterer vi politikken og beder om et nyt
          valg, før de teknologier bruges.
        </p>
      </article>

      <article id="oversigt" class="legal-section">
        <h2>3. Oversigt</h2>
        <table class="legal-table">
          <thead>
            <tr>
              <th>Navn / teknologi</th>
              <th>Formål</th>
              <th>Type</th>
              <th>Udbyder</th>
              <th>Levetid</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>studos-session</code></td>
              <td>Holder en nødvendig websession aktiv og får hjemmesiden til at fungere.</td>
              <td>Nødvendig førstepartscookie</td>
              <td>PlateDigital EMV</td>
              <td>Session / normalt op til 2 timer</td>
            </tr>
            <tr>
              <td><code>XSRF-TOKEN</code></td>
              <td>Beskytter formularer mod misbrug og forfalskede forespørgsler.</td>
              <td>Nødvendig førstepartscookie</td>
              <td>PlateDigital EMV</td>
              <td>Session / normalt op til 2 timer</td>
            </tr>
            <tr>
              <td><code>studos.cookieConsent.v2</code><br><small>localStorage</small></td>
              <td>Husker om du har valgt “Accepter alle” eller “Afvis ikke-nødvendige”, samt tidspunkt for valget.</td>
              <td>Samtykke-/valgstyring</td>
              <td>PlateDigital EMV</td>
              <td>Indtil du ændrer valget eller sletter browserdata</td>
            </tr>
          </tbody>
        </table>
      </article>

      <article id="tredjepart" class="legal-section">
        <h2>4. Tredjepartscookies</h2>
        <p>
          Studos.dk sætter ikke tredjepartscookies. Vi bruger ikke indlejrede
          annonce-, analyse- eller trackingværktøjer på hjemmesiden.
        </p>
      </article>

      <article id="mobilappen" class="legal-section">
        <h2>5. Mobilappen</h2>
        <p>
          Mobilappen bruger ikke browsercookies. Den gemmer nødvendige oplysninger
          lokalt på telefonen, for eksempel login-session og appindstillinger.
          Hvis du tillader push-notifikationer, gemmer vi også en push-token på
          serveren. Det er beskrevet i
          <a href="{{ route('legal.privacy') }}">privatlivspolitikken</a>.
        </p>
        <p>
          Når du vælger eller gemmer billeder i appen, bruges telefonens egne
          billedtilladelser eller systemvælgere. Studos får kun adgang til de
          billeder, du aktivt vælger eller gemmer.
        </p>
      </article>

      <article id="styring" class="legal-section">
        <h2>6. Sådan styrer og ændrer du cookies</h2>
        <p>
          Du kan altid ændre dit valg ved at åbne cookieindstillingerne igen. Når
          du ændrer valget, overskrives det tidligere valg i browserens
          localStorage.
        </p>
        <div class="legal-actions">
          <button class="button subtle" type="button" data-cookie-consent-open>
            Åbn cookieindstillinger
          </button>
        </div>
        <p>
          Du kan også blokere eller slette cookies og localStorage i din browsers
          indstillinger. Hvis du blokerer nødvendige cookies, kan dele af
          hjemmesiden holde op med at virke korrekt.
        </p>
      </article>

      <article id="samtykke" class="legal-section">
        <h2>7. Hvad betyder valgene?</h2>
        <p>
          Vælger du <strong>“Afvis ikke-nødvendige”</strong>, bruger Studos kun
          nødvendige cookies og gemmer dit nej tak til ikke-nødvendige teknologier.
        </p>
        <p>
          Vælger du <strong>“Accepter alle”</strong>, accepterer du de
          teknologier, der er nævnt i denne politik. I den nuværende version har
          Studos ingen statistik-, marketing- eller tredjepartscookies.
        </p>
      </article>

      <article id="aendringer" class="legal-section">
        <h2>8. Ændringer</h2>
        <p>
          Vi opdaterer cookiepolitikken, hvis vi ændrer brugen af cookies eller
          lignende teknologier. Den nyeste version ligger altid på denne side.
        </p>
      </article>

      <article id="kontakt" class="legal-section">
        <h2>9. Kontakt</h2>
        <p>
          Spørgsmål til cookiepolitikken sendes til
          <a href="mailto:chris.sorensen1702@gmail.com">chris.sorensen1702@gmail.com</a>.<br>
          <strong>PlateDigital EMV</strong><br>
          CVR: 42456187<br>
          Kærmindevej 12, 7441 Bording<br>
          Telefon: <a href="tel:+4520631299">+45 20 63 12 99</a>
        </p>
      </article>
    </div>
  </section>
@endsection
