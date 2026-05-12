@extends('layouts.studos')

@section('title', 'Slet konto · Studos')

@section('content')
  <section class="page legal-page">
    <header class="legal-hero">
      <h1>Slet din Studos-konto</h1>
      <p>
        Du kan slette din konto direkte i appen. Hvis du ikke har adgang til appen,
        kan du anmode om sletning via e-mail.
      </p>
      <div class="legal-meta">
        <span><strong>Effekt:</strong> straks i appen / normalt inden for 7 arbejdsdage via e-mail</span>
        <span><strong>Senest opdateret:</strong> 12. maj 2026</span>
      </div>
    </header>

    <div class="legal-content">
      <article class="legal-section">
        <h2>1. Slet i appen</h2>
        <ol>
          <li>Åbn Studos-appen og log ind.</li>
          <li>Gå til <strong>Indstillinger</strong>.</li>
          <li>Find <strong>Slet konto</strong>.</li>
          <li>Læs advarslen og bekræft, hvis du vil slette kontoen permanent.</li>
        </ol>
        <p>
          Når du bekræfter, lukkes kontoen, og du kan ikke længere logge ind.
          Aktive login-sessioner og push-tokens slettes, og direkte personoplysninger
          fjernes eller pseudonymiseres.
        </p>
      </article>

      <article class="legal-section">
        <h2>2. Det bliver fjernet eller pseudonymiseret</h2>
        <ul>
          <li>Navn, e-mail, telefonnummer og fødselsdato.</li>
          <li>Profilbillede og private profiloplysninger.</li>
          <li>Adgangskode-hash og aktive login-sessioner.</li>
          <li>Push-tokens, enhedsnavn og push-registreringer.</li>
          <li>Personlig Studos-kode.</li>
          <li>Nødkontaktoplysninger.</li>
          <li>Direkte koblinger til rapporter, strikes og moderationsposter, hvor det er muligt.</li>
        </ul>
      </article>

      <article class="legal-section">
        <h2>3. Det kan blive bevaret</h2>
        <p>
          Noget fælles historik kan blive bevaret, fordi den tilhører klassens fælles
          forløb eller er nødvendig af sikkerheds- eller dokumentationshensyn. I de
          tilfælde fjernes direkte identifikatorer normalt, og dit navn vises som
          "Slettet bruger".
        </p>
        <ul>
          <li><strong>Fælles chats og beskeder:</strong> Beskeder slettes ikke altid automatisk fra fælles tråde.</li>
          <li><strong>Events, dyster og Caps-historik:</strong> Kan bevares, så klassens historik ikke brydes.</li>
          <li><strong>Albummer og billeder:</strong> Fælles billeder kan blive liggende for den oprindelige målgruppe. Du kan slette egne billeder før kontosletning eller bede os vurdere konkrete billeder.</li>
          <li><strong>Rapporter og moderation:</strong> Kan bevares, hvis det er nødvendigt for sikkerhed, klagebehandling, misbrugsforebyggelse eller dokumentation.</li>
          <li><strong>Strikes og udelukkelse:</strong> Direkte medlemskoblinger fjernes ved kontosletning, hvor det er muligt, men dokumentation kan bevares, hvis den er nødvendig for at beskytte andre brugere eller håndtere en konkret sag.</li>
          <li><strong>Server-logs:</strong> Kan ligge i kort tid efter sletning, normalt op til 30 dage.</li>
          <li><strong>Support-korrespondance:</strong> Kan gemmes i en rimelig periode, normalt op til 24 måneder.</li>
        </ul>
      </article>

      <article class="legal-section">
        <h2>4. Hvis du er klasseejer</h2>
        <p>
          Hvis du er den eneste aktive ejer af en klasse, skal ejerskabet først
          overdrages til en anden aktiv bruger. Det sikrer, at klassen ikke mister
          administrationen. Kontakt os, hvis du ikke kan overdrage ejerskabet i appen.
        </p>
      </article>

      <article class="legal-section">
        <h2>5. Anmod via e-mail</h2>
        <p>
          Hvis du ikke har adgang til appen, kan du sende en sletningsanmodning til
          <a href="mailto:chris.sorensen1702@gmail.com?subject=Anmodning%20om%20sletning%20af%20konto&body=Hej%20Studos%2C%0A%0AJeg%20anmoder%20om%20sletning%20af%20min%20konto.%0A%0ANavn%3A%20%0AE-mail%20p%C3%A5%20kontoen%3A%20%0AKlasse%20og%20skole%20(hvis%20du%20husker)%3A%20%0A%0ATak.">chris.sorensen1702@gmail.com</a>.
          Skriv gerne:
        </p>
        <ul>
          <li>Navn på kontoen.</li>
          <li>E-mail tilknyttet kontoen.</li>
          <li>Klasse og skole, hvis du husker det.</li>
        </ul>
        <p>
          Vi kan bede dig bekræfte anmodningen fra kontoens e-mailadresse, så vi ikke
          sletter en konto på baggrund af en falsk anmodning.
        </p>
        <div class="legal-actions">
          <a class="button primary" href="mailto:chris.sorensen1702@gmail.com?subject=Anmodning%20om%20sletning%20af%20konto&body=Hej%20Studos%2C%0A%0AJeg%20anmoder%20om%20sletning%20af%20min%20konto.%0A%0ANavn%3A%20%0AE-mail%20p%C3%A5%20kontoen%3A%20%0AKlasse%20og%20skole%20(hvis%20du%20husker)%3A%20%0A%0ATak.">
            Anmod om sletning via e-mail
          </a>
        </div>
      </article>

      <article class="legal-section">
        <h2>6. Efter sletning</h2>
        <ul>
          <li>Du kan ikke længere logge ind på kontoen.</li>
          <li>Du modtager ikke længere push-notifikationer fra Studos.</li>
          <li>Dit display-navn kan blive vist som "Slettet bruger" i historisk indhold.</li>
          <li>Hvis du senere vil bruge Studos igen, skal du oprette en ny konto.</li>
        </ul>
      </article>

      <article class="legal-section">
        <h2>7. Forældre og værger</h2>
        <p>
          Studos kræver, at brugere er mindst 16 år. Forældre eller værger kan skrive
          til <a href="mailto:chris.sorensen1702@gmail.com">chris.sorensen1702@gmail.com</a>,
          hvis de mener, at et barn under 16 år har oprettet konto, eller hvis de har
          spørgsmål til sletning.
        </p>
      </article>

      <article class="legal-section">
        <h2>8. Spørgsmål</h2>
        <p>
          Har du spørgsmål, så skriv til
          <a href="mailto:chris.sorensen1702@gmail.com">chris.sorensen1702@gmail.com</a>
          eller ring <a href="tel:+4520631299">+45 20 63 12 99</a>. Læs også
          <a href="{{ route('legal.privacy') }}">privatlivspolitikken</a> og
          <a href="{{ route('legal.terms') }}">brugervilkårene</a>.
        </p>
        <p>
          <strong>PlateDigital EMV</strong><br>
          CVR: 42456187<br>
          Kærmindevej 12, 7441 Bording<br>
          E-mail: <a href="mailto:chris.sorensen1702@gmail.com">chris.sorensen1702@gmail.com</a>
        </p>
      </article>
    </div>
  </section>
@endsection
