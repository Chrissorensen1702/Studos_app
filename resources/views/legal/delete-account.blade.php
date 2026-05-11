@extends('layouts.studos')

@section('title', 'Slet konto · Studos')

@section('content')
  <section class="page legal-page">
    <header class="legal-hero">
      <p class="eyebrow">Slet din konto</p>
      <h1>Anmod om sletning af din Studos-konto</h1>
      <p>
        Du kan altid slette din Studos-konto. Den hurtigste måde er direkte i appens
        indstillinger — det sletter kontoen øjeblikkeligt og pseudonymiserer dine
        personoplysninger. Hvis du ikke har adgang til appen, kan du anmode om
        sletning her.
      </p>
      <div class="legal-meta">
        <span><strong>Effektiv:</strong> straks (i app) / op til 7 dage (via formular)</span>
        <span><strong>Senest opdateret:</strong> 11. maj 2026</span>
      </div>
    </header>

    <div class="legal-content">
      <article class="legal-section">
        <h2>1. Slet i appen (anbefalet)</h2>
        <ol>
          <li>Åbn Studos-appen og log ind.</li>
          <li>Gå til <strong>Indstillinger</strong> i menuen.</li>
          <li>Rul ned til sektionen <strong>Konto</strong>.</li>
          <li>Tryk på <strong>Slet konto permanent</strong> og bekræft.</li>
        </ol>
        <p>
          Sletningen sker øjeblikkeligt: din profil markeres som slettet,
          personoplysninger fjernes/pseudonymiseres, login-tokens og adgangskode
          slettes, og push-tokens deaktiveres.
        </p>
      </article>

      <article class="legal-section">
        <h2>2. Hvad bliver slettet</h2>
        <ul>
          <li>For-/efternavn, e-mail, telefon, fødselsdag, profilbillede.</li>
          <li>Adgangskode (hash) og alle aktive login-sessioner.</li>
          <li>Push-tokens og enhedsnavne.</li>
          <li>Personlig Studos-kode.</li>
          <li>Nødkontaktoplysninger.</li>
          <li>Private mediefiler, der kun er knyttet til din profil, fx profilbillede.</li>
        </ul>
      </article>

      <article class="legal-section">
        <h2>3. Hvad kan blive bevaret midlertidigt</h2>
        <p>
          Visse oplysninger kan opbevares i en kortere periode af lovgivnings-
          eller sikkerhedsmæssige grunde. De er ikke længere knyttet til din
          identitet via direkte identifikatorer, men kan i juridisk forstand
          betragtes som <em>pseudonymiseret</em> snarere end fuldt anonymiseret —
          se vores <a href="{{ route('legal.privacy') }}">privatlivspolitik</a> pkt. 7.
        </p>
        <ul>
          <li><strong>Aggregerede aktivitetsdata:</strong> Caps-saldo, dyste-historik og lignende afkobles fra din identitet, så klassens historik bevares.</li>
          <li><strong>Beskeder i fælles chats:</strong> Beskeder, du har sendt i fælles chats eller på opslagstavler, fjernes ikke automatisk, men dit afsendernavn vises som "Slettet bruger". Du kan slette enkelte beskeder før kontosletning.</li>
          <li><strong>Billeder i fælles albummer:</strong> Billeder, du har uploadet til et fælles album, fjernes ikke altid automatisk, hvis de indgår i klassens fælles historik. Du kan slette egne billeder før kontosletning eller bede os vurdere konkrete billeder til fjernelse. Efter sletning pseudonymiseres uploader-oplysninger.</li>
          <li><strong>Moderationsdata:</strong> Eventuelle rapporter, du har indsendt eller været genstand for, opbevares i op til 24 måneder af hensyn til misbrugsforebyggelse og DSA-dokumentationspligt.</li>
          <li><strong>Server-logs:</strong> Op til 30 dage.</li>
          <li><strong>Support-korrespondance:</strong> Op til 24 måneder, medmindre længere opbevaring kræves af lov.</li>
        </ul>
      </article>

      <article class="legal-section">
        <h2>4. Er du klasse-ejer (owner)?</h2>
        <p>
          Hvis du er den eneste aktive ejer (owner) af en klasse, skal du først
          overdrage ejerskabet til en anden i klassen, før du kan slette din
          konto. Det sikrer, at klassen ikke står uden administrator. Du kan
          overdrage ejerskab i appens klasse-indstillinger.
        </p>
        <p>
          Har du brug for hjælp til at overdrage ejerskabet, eller er klassen
          tom for andre aktive medlemmer, så skriv til
          <a href="mailto:hej@studos.dk">hej@studos.dk</a>, så hjælper vi dig
          videre.
        </p>
      </article>

      <article class="legal-section">
        <h2>5. Anmod via formular (uden app)</h2>
        <p>
          Hvis du ikke har adgang til appen, kan du sende en anmodning til
          <a href="mailto:hej@studos.dk?subject=Anmodning%20om%20sletning%20af%20konto&body=Hej%20Studos%2C%0A%0AJeg%20anmoder%20om%20sletning%20af%20min%20konto.%0A%0ANavn%3A%20%0AE-mail%20p%C3%A5%20kontoen%3A%20%0AKlasse%20og%20skole%20(hvis%20du%20husker)%3A%20%0AGrund%20(valgfri)%3A%20%0A%0ATak.">hej@studos.dk</a>
          med følgende oplysninger, så vi kan finde og verificere din konto:
        </p>
        <ul>
          <li>Navn på kontoen.</li>
          <li>E-mail tilknyttet kontoen.</li>
          <li>Klasse og skole (hvis du husker dem).</li>
          <li>Eventuelt grunden til sletningen (valgfri).</li>
        </ul>
        <p>
          Vi behandler anmodningen <strong>inden for 7 arbejdsdage</strong>. For at
          beskytte din konto mod misbrug kan vi kontakte dig fra den e-mail, kontoen
          er oprettet med, for at bekræfte anmodningen.
        </p>
        <div class="legal-actions">
          <a class="button primary" href="mailto:hej@studos.dk?subject=Anmodning%20om%20sletning%20af%20konto&body=Hej%20Studos%2C%0A%0AJeg%20anmoder%20om%20sletning%20af%20min%20konto.%0A%0ANavn%3A%20%0AE-mail%20p%C3%A5%20kontoen%3A%20%0AKlasse%20og%20skole%20(hvis%20du%20husker)%3A%20%0AGrund%20(valgfri)%3A%20%0A%0ATak.">
            Anmod om sletning via e-mail
          </a>
        </div>
      </article>

      <article class="legal-section">
        <h2>6. Hvad sker der efter sletning?</h2>
        <ul>
          <li>Du kan ikke længere logge ind på kontoen.</li>
          <li>Du modtager ingen push-notifikationer fra Studos.</li>
          <li>Dit display-navn i historiske beskeder vises som "Slettet bruger".</li>
          <li>Eventuelle billeder i fælles albummer kan fortsat være synlige for den oprindelige målgruppe, men uden direkte uploader-identitet.</li>
          <li>Hvis du senere ønsker at bruge Studos igen, skal du oprette en ny konto.</li>
        </ul>
      </article>

      <article class="legal-section">
        <h2>7. Børn og forældreanmodninger</h2>
        <p>
          Studos er rettet mod elever på ungdomsuddannelser, og som
          forretningsregel skal man være mindst 15 år for at oprette en konto.
          Forældre eller værger, der ønsker at få en konto slettet på vegne af
          deres barn — uanset alder — kan skrive til
          <a href="mailto:hej@studos.dk">hej@studos.dk</a>. Vi prioriterer disse
          anmodninger særligt højt og besvarer dem inden for 3 arbejdsdage.
        </p>
      </article>

      <article class="legal-section">
        <h2>8. Spørgsmål</h2>
        <p>
          Har du spørgsmål til sletningsprocessen, eller er du i tvivl om hvad der
          sker med dine data, så skriv til
          <a href="mailto:hej@studos.dk">hej@studos.dk</a> eller ring
          <a href="tel:+4520631299">+45 20 63 12 99</a>. Du kan også læse vores
          <a href="{{ route('legal.privacy') }}">privatlivspolitik</a> og
          <a href="{{ route('legal.terms') }}">brugervilkår</a>.
        </p>
        <p>
          <strong>PlateDigital EMV</strong><br>
          CVR: 42456187<br>
          Kærmindevej 12, 7441 Bording<br>
          E-mail: <a href="mailto:hej@studos.dk">hej@studos.dk</a>
        </p>
      </article>
    </div>
  </section>
@endsection
