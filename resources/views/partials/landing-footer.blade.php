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
            <strong>PlateDigital EMV</strong>
            <span>CVR: 42456187</span>
            <span>Kærmindevej 12, 7441 Bording</span>
            <a href="mailto:chris.sorensen1702@gmail.com">chris.sorensen1702@gmail.com</a>
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
          <a href="{{ route('about') }}">Om Studos</a>
          <a href="{{ route('home') }}#landing-features-title">Funktioner i appen</a>
          <a href="{{ route('faq') }}">FAQ</a>
        </nav>
      </section>

      <section class="landing-footer-section">
        <div class="landing-footer-section-header">
          <h2 class="landing-footer-section-title">Det med småt</h2>
        </div>

        <nav class="landing-footer-nav" aria-label="Betingelser og privatliv">
          <a href="{{ route('legal.privacy') }}">Privatlivspolitik</a>
          <a href="{{ route('legal.terms') }}">Brugervilkår</a>
          <a href="{{ route('legal.cookies') }}">Cookiepolitik</a>
          <a href="{{ route('legal.delete-account') }}">Slet konto</a>
          <button type="button" data-cookie-consent-open>Cookieindstillinger</button>
          <a href="mailto:chris.sorensen1702@gmail.com">Support</a>
        </nav>
      </section>

      <section class="landing-footer-section landing-footer-section-contact">
        <div class="landing-footer-section-header">
          <h2 class="landing-footer-section-title">Hold kontakten</h2>
        </div>

        <div class="landing-footer-download">
          <p class="landing-footer-mini-heading">Hent appen</p>

          <div class="landing-footer-store-links" aria-label="Download Studos appen">
            <a class="store-badge" href="{{ route('home') }}#download-app" aria-label="Hent Studos på Google Play">
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
            <a class="store-badge" href="{{ route('home') }}#download-app" aria-label="Hent Studos i App Store">
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
