@extends('layouts.studos')

@section('title', 'Studos')
@section('bodyClass', 'landing-body')

@section('headerActions')
  <a class="button primary" href="#landing-features-title">Se appen</a>
  <a class="button subtle" href="{{ route('faq') }}">FAQ</a>
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

            <div class="landing-mockup-slide" data-feature-slide="duel" data-feature-title="Dyst og challenges" aria-hidden="true">
              <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Dyst.png') }}" alt="Dyst i Studos appen">
            </div>

            <div class="landing-mockup-slide" data-feature-slide="walls" data-feature-title="Galleri" aria-hidden="true">
              <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Walls.png') }}" alt="Galleri i Studos appen">
            </div>

            <div class="landing-mockup-slide" data-feature-slide="caps" data-feature-title="Overblik" aria-hidden="true">
              <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Overblik.png') }}" alt="Overblik i Studos appen">
            </div>

            <div class="landing-mockup-slide" data-feature-slide="games" data-feature-title="Arcade Hub" aria-hidden="true">
              <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Spil.png') }}" alt="Arcade Hub i Studos appen">
            </div>

            <div class="landing-mockup-slide" data-feature-slide="battle" data-feature-title="Leaderboard" aria-hidden="true">
              <img class="landing-mockup-image" src="{{ asset('assets/index-mockups/Klassedyst.png') }}" alt="Klassedyst og leaderboard i Studos appen">
            </div>

            <div class="landing-mockup-slide" data-feature-slide="emergency" data-feature-title="Nødkontakter" aria-hidden="true">
              <div class="emergency-mockup-screen" aria-hidden="true">
                <div class="emergency-mockup-top">
                  <span class="emergency-mockup-title">Nødkontakter</span>
                  <span class="emergency-mockup-action">Ret</span>
                </div>
                <div class="emergency-mockup-own">
                  <span>Min nødkontakt</span>
                  <strong>Mor · +45 20 12 34 56</strong>
                </div>
                <div class="emergency-mockup-tabs">
                  <span class="is-active">Klasse</span>
                  <span>Venner</span>
                </div>
                <div class="emergency-mockup-list">
                  <span><strong>Emma</strong><small>Far · +45 22 45 18 90</small></span>
                  <span><strong>Noah</strong><small>Mor · +45 31 77 42 11</small></span>
                  <span><strong>Alma</strong><small>Nødkontakt synlig</small></span>
                  <span><strong>Oliver</strong><small>Kun for udvalgte</small></span>
                </div>
              </div>
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
            Kalender, chat, overblik, Dyst, Galleri, Arcade Hub,
            leaderboard og Nødkontakter samlet i appen.
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
            <span class="landing-feature-label">Kalender</span>
          </div>
          <h3>Kalender og RSVP</h3>
          <p>Opret events med tid, sted og cover. Klassen kan svare, om de kommer, se deltagerlisten og få påmindelser, når noget nærmer sig.
            <br><br>Alt ligger i appen, så aftaler, adresser og spontane planer er samlet der, hvor klassen allerede følger med.</p>
        </article>

        <article class="landing-feature-card accent-coral" data-feature-card="chat" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <img class="landing-feature-raster-icon" src="{{ asset('assets/footer-chat.png') }}" alt="">
            </span>
            <span class="landing-feature-label">Chat</span>
          </div>
          <h3>Direkte chat og grupper</h3>
          <p>Skriv 1:1 eller i gruppechats, se ulæste beskeder og reager hurtigt på det, der bliver sendt. Samtalerne opdateres løbende i appen.
            <br><br>Det gør det nemmere at samle planer, spørgsmål og små beskeder uden at de forsvinder i tilfældige tråde.</p>
        </article>

        <article class="landing-feature-card accent-gold" data-feature-card="duel" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <span class="landing-app-icon app-icon-flash">
                <span></span>
              </span>
            </span>
            <span class="landing-feature-label">Dyst</span>
          </div>
          <h3>Dyst og challenges</h3>
          <p>Udfordr en klassekammerat, sæt Caps på højkant og lad appen holde styr på invitationer, svar, deadlines og resultat.
            <br><br>Det kan være alt fra små interne missioner til dyster, der kræver dommer eller fælles godkendelse.</p>
        </article>

        <article class="landing-feature-card accent-blue" data-feature-card="walls" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <img class="landing-feature-raster-icon" src="{{ asset('assets/footer-walls.png') }}" alt="">
            </span>
            <span class="landing-feature-label">Galleri</span>
          </div>
          <h3>Galleri og albummer</h3>
          <p>Lav fælles eller private albummer, upload flere billeder ad gangen, swipe gennem minderne og gem udvalgte billeder på telefonen.
            <br><br>Klassen får ét sted til de billeder, der skal huskes, og indhold kan rapporteres direkte i appen.</p>
        </article>

        <article class="landing-feature-card accent-ink" data-feature-card="caps" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <img class="landing-feature-raster-icon landing-feature-coin-icon" src="{{ asset('assets/caps-coin.png') }}" alt="">
            </span>
            <span class="landing-feature-label">Overblik</span>
          </div>
          <h3>Overblik og Caps</h3>
          <p>Se profil, Studos-kode, kommende events, seneste aktivitet og din Caps-balance. Overblikket samler det vigtigste for dig.
            <br><br>Caps kan optjenes gennem weekly streak, ugens gode gerning, QR-check-in og de dyster, klassen selv sætter i gang.</p>
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
            <span class="landing-feature-label">Arcade</span>
          </div>
          <h3>Arcade Hub</h3>
          <p>Brug små spil, randomizer og hurtige missioner, når klassen mangler et startskud. Det er bygget til pauser, vognture og spontane indslag.
            <br><br>Træk en mission, start en leg eller lad appen vælge næste move direkte fra appens menu.</p>
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
            <span class="landing-feature-label">Leaderboard</span>
          </div>
          <h3>Leaderboard</h3>
          <p>Følg klassens placering mod andre klasser og se, hvem der ligger stærkest internt. Ranglisten bruger Caps pr. aktiv elev.
            <br><br>Det gør det fair for både små og store klasser, og giver lidt ekstra grund til at åbne appen igen.</p>
        </article>

        <article class="landing-feature-card accent-emergency" data-feature-card="emergency" role="button" tabindex="0" aria-pressed="false">
          <div class="landing-feature-card-head">
            <span class="landing-feature-icon" aria-hidden="true">
              <span class="landing-app-icon app-icon-phone">
                <span></span>
              </span>
            </span>
            <span class="landing-feature-label">Nødkontakt</span>
          </div>
          <h3>Nødkontakter</h3>
          <p>Gem din egen nødkontakt og vælg, hvem der må se den. Det kan være hele klassen, venner eller kun udvalgte personer.
            <br><br>Når der er brug for det, kan klassen hurtigt finde de relevante kontaktoplysninger direkte i appen.</p>
        </article>
        </div>
      </div>

      <section class="landing-how" aria-labelledby="landing-how-title">
        <div class="landing-how-copy">
          <p class="landing-how-kicker">Sådan gør du</p>
          <h2 id="landing-how-title">
            Kom i gang med
            <span class="landing-inline-wordmark" aria-label="Studos">
              <span class="landing-inline-wordmark-row" aria-hidden="true">
                <span class="landing-inline-wordmark-light">Stu</span><span>dos</span>
              </span>
              <span class="landing-inline-wordmark-underline" aria-hidden="true"></span>
            </span>
          </h2>
          <p>
            Hele klassen samles i appen. Opret, invitér og begynd at bruge
            Studos på få minutter.
          </p>
        </div>

        <div class="landing-how-steps" aria-label="Sådan kommer du i gang">
          <article class="landing-how-step">
            <span class="landing-how-number">01</span>
            <h3>Hent appen</h3>
            <p>Download Studos, når appen åbner i App Store og Google Play.</p>
          </article>

          <article class="landing-how-step">
            <span class="landing-how-number">02</span>
            <h3>Opret klassen</h3>
            <p>Klasseejer opretter klassen direkte i appen med skole og årgang.</p>
          </article>

          <article class="landing-how-step">
            <span class="landing-how-number">03</span>
            <h3>Invitér alle</h3>
            <p>Del klassekoden, og lad eleverne joine fra deres egen telefon.</p>
          </article>

          <article class="landing-how-step">
            <span class="landing-how-number">04</span>
            <h3>Brug Studos</h3>
            <p>Planlæg events, chat, optjen Caps, lav Dyst og find nødkontakter.</p>
          </article>
        </div>
      </section>

    </div>
  </section>
  </div>
@endsection
