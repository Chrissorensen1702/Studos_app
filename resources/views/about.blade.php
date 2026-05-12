@extends('layouts.studos')

@section('title', 'Om Studos · Studos')

@section('content')
  <section class="page about-page">
    <header class="about-hero">
      <div class="about-hero-copy">
        <h1>
          En privat klasseapp til studenteråret.
        </h1>
        <p>
          Studos samler kalender, chat, Dyst, Galleri, Caps, leaderboard og
          nødkontakter i én app, så klassen har et fælles sted til både planer,
          minder og praktiske detaljer.
        </p>

        <div class="about-actions" aria-label="Læs mere om Studos">
          <a class="button primary" href="{{ route('home') }}#landing-features-title">Se appens funktioner</a>
          <a class="button subtle" href="{{ route('faq') }}">Læs FAQ</a>
        </div>
      </div>

      <div class="about-hero-visual" aria-hidden="true">
        <div class="about-brand-card">
          <img class="about-brand-mark" src="{{ asset('assets/studos-mark.svg') }}" alt="">
          <span class="landing-inline-wordmark" aria-label="Studos">
            <span class="landing-inline-wordmark-row" aria-hidden="true">
              <span class="landing-inline-wordmark-light">Stu</span><span>dos</span>
            </span>
            <span class="landing-inline-wordmark-underline" aria-hidden="true"></span>
          </span>
        </div>

        <div class="about-phone-card">
          <img src="{{ asset('assets/index-mockups/Overblik.png') }}" alt="">
        </div>
      </div>
    </header>

    <section class="about-intro" aria-label="Kort om Studos">
      <p>
        Studos er bygget til klasser, der vil samle studenteråret uden at gøre
        fællesskabet offentligt. Appen er lukket om den enkelte klasse, og nye
        elever kommer ind via klassens eget adgangsflow.
      </p>
      <p>
        Websiden er kun information, vilkår, privatliv og support. Oprettelse,
        invitationer, klasseprofil, events, medlemmer og indstillinger foregår i
        appen.
      </p>
    </section>

    <section class="about-card-grid" aria-label="Det Studos er bygget til">
      <article class="about-card">
        <span class="about-card-number">01</span>
        <h2>Klassen først</h2>
        <p>
          Studos er ikke et åbent socialt medie. Det er et lukket rum for klassen,
          hvor aftaler, billeder og beskeder bliver samlet omkring dem, der faktisk
          skal bruge dem.
        </p>
      </article>

      <article class="about-card">
        <span class="about-card-number">02</span>
        <h2>Alt i appen</h2>
        <p>
          Kalender, chat, Dyst, Caps, Galleri, Arcade Hub, Leaderboard og
          Nødkontakter ligger i appen. Webdelen skal ikke være et CMS eller et
          ekstra sted at administrere klassen.
        </p>
      </article>

      <article class="about-card">
        <span class="about-card-number">03</span>
        <h2>Bygget med sikkerhed</h2>
        <p>
          Studos har rapportering, blokering, notifikationsvalg, lukkede albummer
          og nødkontakter med synlighedsstyring, så fællesskabet kan være sjovt
          uden at blive ligegyldigt med grænser.
        </p>
      </article>
    </section>

    <section class="about-band" aria-labelledby="about-test-title">
      <div>
        <h2 id="about-test-title">Studos er i testfase</h2>
        <p>
          Appen er kun tilgængelig pr. invitation lige nu. Download-knapperne på
          websiden vises som design-preview, indtil Studos åbner bredere for
          klasser.
        </p>
      </div>
      <a class="button primary" href="mailto:chris.sorensen1702@gmail.com">Kontakt Studos</a>
    </section>
  </section>
@endsection
