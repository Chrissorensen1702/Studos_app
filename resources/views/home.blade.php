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
  <div class="landing-feature-browser" data-feature-browser>
  <section class="landing-hero" aria-labelledby="landing-title">
    <img class="landing-image" src="{{ asset('assets/landing-hero.png') }}" alt="">
    <div class="landing-shade"></div>

    <div class="landing-content">
      <p class="eyebrow">
        <span>GØR STUDENTERTIDEN LIDT SJOVERE</span>
        <span class="landing-eyebrow-highlight">HELT GRATIS</span>
      </p>
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

    <aside class="landing-feature-preview landing-feature-preview-hero" aria-label="App mockups">
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

            <div class="landing-mockup-slide" data-feature-slide="duel" data-feature-title="Udfordr dine klassekammerater" aria-hidden="true">
              <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Dyst.png') }}" alt="Dyst i Studos appen">
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

            <div class="landing-mockup-slide" data-feature-slide="battle" data-feature-title="Klassedyst" aria-hidden="true">
              <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Klassedyst.png') }}" alt="Klassedyst i Studos appen">
            </div>
          </div>
        </div>
      </div>
    </aside>
  </section>

  <section class="landing-feature-section" aria-labelledby="landing-features-title">
    <div class="landing-feature-inner">
      <div class="landing-feature-heading">
        <h2 id="landing-features-title">Features der holder festen og vognen i gang 🚌🍻</h2>
        <p class="landing-feature-intro">
          <span>
            Planlæg events, hold chatten samlet, dyst med klassen og gem
            minderne fra studenteråret ét sted.
          </span>
          <span class="landing-feature-hint">
            Vælg et kort herunder for at skifte previewet og se, hvordan
            funktionen ser ud i appen.
          </span>
        </p>
      </div>

      <div class="landing-feature-layout">
        <div class="landing-feature-grid" aria-label="App features">
        <article class="landing-feature-card accent-mint is-active" data-feature-card="calendar" role="button" tabindex="0" aria-pressed="true">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <img class="landing-feature-raster-icon" src="{{ asset('assets/footer-calendar.png') }}" alt="">
            </span>
            <span class="landing-feature-label">Plan</span>
          </div>
          <h3>Kalender og events</h3>
          <p>Saml klassens events, aftaler og vigtige datoer i én kalender, så ingen misser hvad der sker. Fra vognture og fester til mødetider, adresser og spontane planer.
            <br><br>Fælles overblik, hurtige opdateringer og styr på hvem der kommer. Resten kan klassen tage, når dagen rammer.</p>
        </article>

        <article class="landing-feature-card accent-coral" data-feature-card="chat" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <img class="landing-feature-raster-icon" src="{{ asset('assets/footer-chat.png') }}" alt="">
            </span>
            <span class="landing-feature-label">Live</span>
          </div>
          <h3>Chat og beskeder</h3>
          <p>Hold klassens samtaler samlet, så planer, aftaler og jokes ikke forsvinder i gamle tråde. Direkte chats, gruppechats og fælles beskeder gør det nemt at få fat i dem, der skal med.
            <br><br>Fra hurtige beskeder før et event til de små ting, der sker undervejs. Klassen har ét sted at skrive, spørge og følge med.</p>
        </article>

        <article class="landing-feature-card accent-gold" data-feature-card="duel" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <span class="landing-app-icon app-icon-duel">
                <span class="app-icon-duel-shield app-icon-duel-shield-outline"></span>
                <span class="app-icon-duel-shield app-icon-duel-shield-fill"></span>
                <span class="app-icon-duel-swords"></span>
              </span>
            </span>
            <span class="landing-feature-label">Dyst</span>
          </div>
          <h3>Udfordr dine klassekammerater</h3>
          <p>Lav challenges til klassen, sæt Caps på højkant, og følg dramaet på leaderboardet. Hvem tager føringen, når klassen dyster i sjove missioner, interne jokes og små kaotiske klassikere?
            <br><br>Outfit-check, fællessang eller flest mobilnumre på en uge. Det er klassen, der bestemmer udfordringen.</p>
        </article>

        <article class="landing-feature-card accent-blue" data-feature-card="walls" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <img class="landing-feature-raster-icon" src="{{ asset('assets/footer-walls.png') }}" alt="">
            </span>
            <span class="landing-feature-label">Wall</span>
          </div>
          <h3>Minder og walls</h3>
          <p>Gem billeder, opslag og øjeblikke på klassens egne walls, så minderne ikke drukner i kamerarullen eller tilfældige chats. Fra vognture og fester til interne jokes og de billeder, alle skal se igen.
            <br><br>Klassen kan bygge sin egen billedvæg løbende. Det bliver lidt sjovere at kigge tilbage, når alt ligger samlet.</p>
        </article>

        <article class="landing-feature-card accent-ink" data-feature-card="caps" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <img class="landing-feature-raster-icon landing-feature-coin-icon" src="{{ asset('assets/caps-coin.png') }}" alt="">
            </span>
            <span class="landing-feature-label">Caps</span>
          </div>
          <h3>Cap-coins</h3>
          <p>Alle starter med 1000 caps, og så er det ellers op til klassen at finde på, hvordan de skal bruges. Sæt dem på højkant i challanges, giv dem som belønning for gode gerninger, eller lav jeres helt egne regler for hvad de skal bruges til.
            <br><br>Følg klassens leaderboard og aktivitet. Jo mere klassen bruger Studos, jo mere sker der i overblikket.</p>
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
          <p>Små spil, randomizer og hurtige challenges giver klassen noget at samles om mellem de store events. Perfekt til pauser, vognture og de øjeblikke, hvor nogen skal sætte gang i stemningen.
            <br><br>Træk en mission, start en leg eller lad appen vælge næste move. Det skal være nemt at få lidt kaos i gang.</p>
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
          <p>Lad klasser dyste mod hinanden med point, placeringer og små mål, der kan mærkes i hverdagen. Det giver lidt ekstra energi, når parallelklassen pludselig ligger foran.
            <br><br>Følg stillingen, jagt næste placering og gør hverdagen til en venlig kamp om håneretten.</p>
        </article>
        </div>
      </div>

      <section class="landing-early-access" aria-labelledby="landing-early-access-title">
        <div class="landing-early-access-copy">
          <p class="landing-early-access-kicker">EARLY ACCESS</p>
          <h2 id="landing-early-access-title">
            Skal din klasse være blandt de første på
            <span class="landing-inline-wordmark" aria-label="Studos">
              <span class="landing-inline-wordmark-row" aria-hidden="true">
                <span class="landing-inline-wordmark-light">Stu</span><span>dos</span>
              </span>
              <span class="landing-inline-wordmark-underline" aria-hidden="true"></span>
            </span>?
          </h2>
          <p>
            Gør jer klar til studenteråret med kalender, chat, Caps, challenges,
            gallerier og klassedyster samlet ét sted. Nye klasser kan allerede
            oprette sig og komme tidligt med.
          </p>
        </div>
        <a class="landing-early-access-button" href="{{ route('classes.create') }}">
          Opret din klasse nu
        </a>
        <img
          class="landing-early-access-student"
          src="{{ asset('assets/landing-early-access-student-v2.png') }}"
          alt=""
          aria-hidden="true"
        >
      </section>
    </div>
  </section>
  </div>

  <footer class="landing-footer" aria-label="Studos footer">
    <div class="landing-footer-surface">
      <div class="landing-footer-inner">
        <section class="landing-footer-section landing-footer-section-brand">
          <a class="landing-footer-brand" href="{{ route('home') }}" aria-label="Studos forside">
            <img class="landing-footer-mark" src="{{ asset('assets/studos-mark.svg') }}" alt="">
            <span class="landing-footer-wordmark" aria-hidden="true">
              <span class="landing-footer-wordmark-row">
                <span class="landing-footer-wordmark-light">Stu</span><span>dos</span>
              </span>
              <span class="landing-footer-wordmark-underline"></span>
            </span>
          </a>

          <div class="landing-footer-brand-panel">
            <p class="landing-footer-mini-heading">Kontakt</p>
            <div class="landing-footer-contact">
              <strong>PlateDigital</strong>
              <a href="mailto:hej@studos.dk">hej@studos.dk</a>
              <a href="tel:+4520631299">+45 20 63 12 99</a>
            </div>
          </div>

          <div class="landing-footer-powered-brand">
            <p class="landing-footer-powered-by">En del af</p>
            <img
              class="landing-footer-powered-logo"
              src="{{ asset('assets/PlateDigital-logo-saas.svg') }}"
              alt="PlateDigital"
            >
          </div>
        </section>

        <section id="det-med-smaat" class="landing-footer-section">
          <div class="landing-footer-section-header">
            <h2 class="landing-footer-section-title">Navigation</h2>
          </div>

          <nav class="landing-footer-nav" aria-label="Footer navigation">
            <a href="{{ route('home') }}">Forside</a>
            <a href="#landing-title">Om Studos</a>
            <a href="#landing-features-title">Funktioner i appen</a>
            <a href="{{ route('login') }}">CMS-login</a>
            <a href="{{ route('classes.create') }}">Opret din klasse</a>
          </nav>
        </section>

        <section class="landing-footer-section">
          <div class="landing-footer-section-header">
            <h2 class="landing-footer-section-title">Det med småt</h2>
          </div>

          <nav class="landing-footer-nav" aria-label="Betingelser og privatliv">
            <a href="#det-med-smaat">Privatlivspolitik</a>
            <a href="#det-med-smaat">Handelsbetingelser</a>
            <a href="#det-med-smaat">Cookiepolitik</a>
            <a href="#det-med-smaat">Moderation og brug</a>
            <a href="#det-med-smaat">Support</a>
          </nav>
        </section>

        <section class="landing-footer-section landing-footer-section-contact">
          <div class="landing-footer-section-header">
            <h2 class="landing-footer-section-title">Hold kontakten</h2>
          </div>

          <div class="landing-footer-download">
            <p class="landing-footer-mini-heading">Hent appen</p>

            <div class="landing-footer-store-links" aria-label="Download Studos appen">
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

          <div class="landing-footer-social" aria-label="Studos på sociale medier">
            <p class="landing-footer-mini-heading">Sociale medier</p>

            <div class="landing-footer-social-links">
              <span class="landing-footer-social-icon social-icon-instagram" role="img" aria-label="Instagram"></span>
              <span class="landing-footer-social-icon social-icon-facebook" role="img" aria-label="Facebook"></span>
            </div>
          </div>
        </section>
      </div>
    </div>

    <div class="landing-footer-subbar">
      <div class="landing-footer-subbar-inner">
        <span>&copy; {{ now()->year }} Studos</span>
        <span>Privat klassehub til studenteråret</span>
      </div>
    </div>
  </footer>
@endsection
