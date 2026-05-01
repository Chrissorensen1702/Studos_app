@extends('layouts.studos')

@section('title', 'FAQ · Studos')

@section('content')
  <section class="page faq-page">
    <div class="faq-hero">
      <p class="eyebrow">FAQ</p>
      <h1>Spørgsmål om Studos</h1>
      <p>
        Her finder du korte svar på de mest almindelige spørgsmål om appen,
        klasseoprettelse, CMS og moderation.
      </p>
    </div>

    <div class="faq-list">
      <details class="faq-item" open>
        <summary>Hvad er Studos?</summary>
        <p>
          Studos er en privat klassehub til studenteråret, hvor klassen kan samle
          kalender, chat, Caps, challenges, gallerier og klasseaktiviteter ét sted.
        </p>
      </details>

      <details class="faq-item">
        <summary>Hvordan opretter vi en klasse?</summary>
        <p>
          En klasseansvarlig opretter klassen via “Opret klasse”, vælger skole og
          klasseoplysninger og får adgang til klassens CMS efter oprettelse.
        </p>
      </details>

      <details class="faq-item">
        <summary>Hvad bruger vi CMS-login til?</summary>
        <p>
          CMS-login bruges af ejere og moderatorer til at administrere klasseinfo,
          medlemmer, events og indhold, som vises i appen.
        </p>
      </details>

      <details class="faq-item">
        <summary>Kan elever selv deltage?</summary>
        <p>
          Ja. Klassen kan invitere elever via klassekode eller invitation, og
          adgang kan styres af klassens ejer eller moderatorer.
        </p>
      </details>

      <details class="faq-item">
        <summary>Hvordan håndteres moderation?</summary>
        <p>
          Studos er bygget til private klassemiljøer med roller, godkendelser og
          moderation, så indhold og adgang kan holdes under kontrol.
        </p>
      </details>

      <details class="faq-item">
        <summary>Hvor kan vi få hjælp?</summary>
        <p>
          Skriv til <a href="mailto:hej@studos.dk">hej@studos.dk</a>, eller ring
          på <a href="tel:+4520631299">+45 20 63 12 99</a>.
        </p>
      </details>
    </div>
  </section>
@endsection
