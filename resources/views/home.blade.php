@extends('layouts.studos')

@section('title', 'Studos')
@section('bodyClass', 'landing-body')

@section('headerActions')
  @auth
    <a class="button primary" href="{{ route('admin') }}">Gå til admin</a>
  @else
    <a class="button primary" href="{{ route('classes.create') }}">Opret klasse</a>
    <a class="button subtle" href="{{ route('login') }}">Login</a>
  @endauth
@endsection

@section('content')
  <section class="landing-hero" aria-labelledby="landing-title">
    <img class="landing-image" src="{{ asset('assets/landing-hero.png') }}" alt="">
    <div class="landing-shade"></div>

    <div class="landing-content">
      <p class="eyebrow">GØR STUDENTERTIDEN LIDT SJOVERE</p>
      <h1 id="landing-title" class="landing-wordmark" aria-label="Studos">
        <span class="landing-wordmark-row" aria-hidden="true">
          <span class="landing-wordmark-light">Stu</span><span>dos</span>
        </span>
        <span class="landing-wordmark-underline" aria-hidden="true"></span>
      </h1>
      <p>
        Jeres private hub til alt, der gør studenteråret nemmere at planlægge og
        sjovere at opleve – og hvor I kan connecte, chatte og dyste på tværs af
        klasser.
      </p>

      <div id="download-app" class="landing-store-actions" aria-label="Download Studos appen">
        <a class="store-badge" href="#download-app" aria-label="Hent Studos på Google Play">
          <span class="store-badge-mark google-play-mark" aria-hidden="true">
            <svg viewBox="0 0 42 46" focusable="false">
              <path d="M4 2L26 23L4 44Z" fill="#29c45a" />
              <path d="M26 23L34 15L39 18C42 20 42 26 39 28L34 31Z" fill="#ffd23f" />
              <path d="M4 2L34 15L26 23Z" fill="#24b6f2" />
              <path d="M4 44L26 23L34 31Z" fill="#f35b5f" />
            </svg>
          </span>
          <span class="store-badge-copy">
            <span class="store-badge-kicker">GET IT ON</span>
            <span class="store-badge-name">Google Play</span>
          </span>
        </a>

        <a class="store-badge" href="#download-app" aria-label="Hent Studos i App Store">
          <span class="store-badge-mark apple-mark" aria-hidden="true"></span>
          <span class="store-badge-copy">
            <span class="store-badge-kicker">Download on the</span>
            <span class="store-badge-name">App Store</span>
          </span>
        </a>

      </div>
    </div>

    <div class="landing-device-stage" aria-hidden="true">
      <div class="landing-device">
        <div class="landing-device-screen">
          <span class="landing-device-notch"></span>
          <img src="{{ asset('assets/mockup-index.png') }}" alt="">
        </div>
      </div>
    </div>
  </section>

  <section class="landing-feature-section" aria-labelledby="landing-features-title">
    <div class="landing-feature-inner">
      <div class="landing-feature-heading">
        <h2 id="landing-features-title">Det der holder vognen i gang 🚌🍻</h2>
      </div>

      <div class="landing-feature-layout" data-feature-browser>
        <div class="landing-feature-grid" aria-label="App features">
        <article class="landing-feature-card accent-mint is-active" data-feature-card="calendar" role="button" tabindex="0" aria-pressed="true">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <img class="landing-feature-raster-icon" src="{{ asset('assets/footer-calendar.png') }}" alt="">
            </span>
            <span class="landing-feature-label">Plan</span>
          </div>
          <h3>Kalender og events</h3>
          <p>Samler datoer, tider, adresser og de kommende aftaler, så klassen altid ved hvad der sker.</p>
        </article>

        <article class="landing-feature-card accent-coral" data-feature-card="chat" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <img class="landing-feature-raster-icon" src="{{ asset('assets/footer-chat.png') }}" alt="">
            </span>
            <span class="landing-feature-label">Live</span>
          </div>
          <h3>Chat og beskeder</h3>
          <p>Direkte chats, gruppechats og fælles beskeder gør det nemt at holde kontakten i hverdagen.</p>
        </article>

        <article class="landing-feature-card accent-gold" data-feature-card="duel" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <span class="landing-app-icon app-icon-duel">
                <span class="app-icon-duel-shield app-icon-duel-shield-outline"></span>
                <span class="app-icon-duel-shield app-icon-duel-shield-fill"></span>
                <span class="app-icon-duel-swords">
                  <span></span>
                  <span></span>
                </span>
              </span>
            </span>
            <span class="landing-feature-label">Duel</span>
          </div>
          <h3>Dueller og gilder</h3>
          <p>Dyst, udfordringer og gilde-overblik giver appen mere energi end en almindelig klassekalender.</p>
        </article>

        <article class="landing-feature-card accent-blue" data-feature-card="walls" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <img class="landing-feature-raster-icon" src="{{ asset('assets/footer-walls.png') }}" alt="">
            </span>
            <span class="landing-feature-label">Wall</span>
          </div>
          <h3>Minder og walls</h3>
          <p>Billeder, opslag og minder bliver samlet omkring klassen i stedet for at forsvinde i tilfældige tråde.</p>
        </article>

        <article class="landing-feature-card accent-ink" data-feature-card="caps" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <span class="landing-app-icon app-icon-overview">
                <span class="app-icon-overview-chimney"></span>
                <span class="app-icon-overview-roof"></span>
                <span class="app-icon-overview-house"><span></span></span>
              </span>
            </span>
            <span class="landing-feature-label">Caps</span>
          </div>
          <h3>Caps og overblik</h3>
          <p>Point, status og små klasse-signaler gør forsiden levende og giver eleverne en grund til at kigge ind.</p>
        </article>

        <article class="landing-feature-card accent-games" data-feature-card="games" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <span class="landing-app-icon app-icon-dice">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </span>
            <span class="landing-feature-label">Spil</span>
          </div>
          <h3>Mini games</h3>
          <p>Små spil, randomizer og klasse-challenges er på vej, så der også sker noget mellem events.</p>
        </article>

        <article class="landing-feature-card accent-awards" data-feature-card="awards" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <span class="landing-app-icon app-icon-badge">
                <span class="app-icon-badge-ribbon app-icon-badge-ribbon-left"></span>
                <span class="app-icon-badge-ribbon app-icon-badge-ribbon-right"></span>
                <span class="app-icon-badge-medal"><span></span></span>
              </span>
            </span>
            <span class="landing-feature-label">Awards</span>
          </div>
          <h3>Klassewards</h3>
          <p>Stem på klassens egne awards og saml de små titler, folk kommer til at citere hele året.</p>
        </article>

        <article class="landing-feature-card accent-battle" data-feature-card="battle" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <span class="landing-app-icon app-icon-podium">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </span>
            <span class="landing-feature-label">Battle</span>
          </div>
          <h3>Klassedyst</h3>
          <p>Klasser kan dyste mod hinanden med point, placeringer og små mål, der gør hverdagen lidt mere intens.</p>
        </article>
        </div>

        <aside class="landing-feature-preview" aria-label="App mockups">
          <h3 class="landing-feature-preview-title" data-feature-title>Kalender</h3>
          <div class="landing-feature-phone" aria-live="polite">
            <div class="landing-feature-preview-controls">
              <button class="landing-feature-arrow" type="button" data-feature-prev aria-label="Forrige mockup">
                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                  <path d="M15 18 9 12l6-6"></path>
                </svg>
              </button>
              <button class="landing-feature-arrow" type="button" data-feature-next aria-label="Næste mockup">
                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                  <path d="m9 18 6-6-6-6"></path>
                </svg>
              </button>
            </div>

            <div class="landing-feature-phone-shell">
              <span class="landing-feature-phone-notch" aria-hidden="true"></span>
              <div class="landing-feature-phone-screen">
                <div class="landing-mockup-slide is-active" data-feature-slide="calendar" data-feature-title="Kalender" aria-hidden="false">
                  <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Kalender.png') }}" alt="Kalender i Studos appen">
                </div>

                <div class="landing-mockup-slide" data-feature-slide="chat" data-feature-title="Chat" aria-hidden="true">
                  <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Chats.png') }}" alt="Chat i Studos appen">
                </div>

                <div class="landing-mockup-slide" data-feature-slide="duel" data-feature-title="Duel" aria-hidden="true">
                  <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Dyst.png') }}" alt="Duel i Studos appen">
                </div>

                <div class="landing-mockup-slide" data-feature-slide="walls" data-feature-title="Walls" aria-hidden="true">
                  <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Walls.png') }}" alt="Walls i Studos appen">
                </div>

                <div class="landing-mockup-slide" data-feature-slide="caps" data-feature-title="Overblik" aria-hidden="true">
                  <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Overblik.png') }}" alt="Overblik i Studos appen">
                </div>

                <div class="landing-mockup-slide" data-feature-slide="games" data-feature-title="Mini games" aria-hidden="true">
                  <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Spil.png') }}" alt="Mini games i Studos appen">
                </div>

                <div class="landing-mockup-slide" data-feature-slide="awards" data-feature-title="Klassewards" aria-hidden="true">
                  <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Klasseawards.png') }}" alt="Klassewards i Studos appen">
                </div>

                <div class="landing-mockup-slide" data-feature-slide="battle" data-feature-title="Klassedyst" aria-hidden="true">
                  <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Klassedyst.png') }}" alt="Klassedyst i Studos appen">
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </section>
@endsection
