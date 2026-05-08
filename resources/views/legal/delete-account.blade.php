@extends('layouts.studos')

@section('title', 'Slet konto · Studos')

@section('content')
  <section class="page legal-page">
    <header class="legal-hero">
      <p class="eyebrow">Slet din konto</p>
      <h1>Anmod om sletning af din Studos-konto</h1>
      <p>
        Du kan altid slette din Studos-konto. Den hurtigste måde er direkte i appens
        indstillinger — det sletter kontoen øjeblikkeligt og anonymiserer dine
        personoplysninger. Hvis du ikke har adgang til appen, kan du anmode om
        sletning her.
      </p>
      <div class="legal-meta">
        <span><strong>Effektiv:</strong> straks (i app) / op til 7 dage (via formular)</span>
        <span><strong>Senest opdateret:</strong> 8. maj 2026</span>
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
          personoplysninger anonymiseres, login-tokens og adgangskode fjernes,
          og push-tokens deaktiveres.
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
        </ul>
      </article>

      <article class="legal-section">
        <h2>3. Hvad kan blive bevaret midlertidigt</h2>
        <p>
          Visse oplysninger kan opbevares i en kortere periode af lovgivnings- eller
          sikkerhedsmæssige grunde. De er ikke længere knyttet til din identitet:
        </p>
        <ul>
          <li><strong>Aggregerede aktivitetsdata:</strong> Caps-saldo, dyste-historik og lignende anonymiseres, så klassens historik bevares uden personhenførbarhed.</li>
          <li><strong>Moderationsdata:</strong> Eventuelle rapporter du har indsendt eller været genstand for, opbevares anonymiseret i op til 24 måneder af hensyn til misbrugsforebyggelse.</li>
          <li><strong>Beskeder i gruppechats:</strong> Beskeder, du har sendt i fælles chats, fjernes ikke automatisk, men dit afsendernavn vises som "Slettet bruger". Du kan slette enkelte beskeder før kontosletning.</li>
          <li><strong>Server-logs:</strong> Op til 30 dage.</li>
        </ul>
        <p>
          Læs flere detaljer i vores
          <a href="{{ route('legal.privacy') }}">privatlivspolitik</a>.
        </p>
      </article>

      <article class="legal-section">
        <h2>4. Anmod via formular (uden app)</h2>
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
        <h2>5. Hvad sker der efter sletning?</h2>
        <ul>
          <li>Du kan ikke længere logge ind på kontoen.</li>
          <li>Du modtager ingen push-notifikationer fra Studos.</li>
          <li>Dit display-navn i historiske beskeder vises som "Slettet bruger".</li>
          <li>Hvis du senere ønsker at bruge Studos igen, skal du oprette en ny konto.</li>
        </ul>
      </article>

      <article class="legal-section">
        <h2>6. Børn under 15 år</h2>
        <p>
          Er du under 15 år, eller er du forælder/værge til et barn under 15 år, kan
          du anmode om sletning af kontoen ved at skrive til
          <a href="mailto:hej@studos.dk">hej@studos.dk</a>. Vi prioriterer disse
          anmodninger særligt højt og besvarer dem inden for 3 arbejdsdage.
        </p>
      </article>

      <article class="legal-section">
        <h2>7. Spørgsmål</h2>
        <p>
          Har du spørgsmål til sletningsprocessen, eller er du i tvivl om hvad der
          sker med dine data, så skriv til
          <a href="mailto:hej@studos.dk">hej@studos.dk</a> eller ring
          <a href="tel:+4520631299">+45 20 63 12 99</a>. Du kan også læse vores
          <a href="{{ route('legal.privacy') }}">privatlivspolitik</a> og
          <a href="{{ route('legal.terms') }}">brugervilkår</a>.
        </p>
      </article>
    </div>
  </section>
@endsection
