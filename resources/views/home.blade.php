@extends('layouts.studos')

@section('title', 'Studos')
@section('bodyClass', 'landing-body')

@section('headerActions')
  @auth
    <a class="button primary" href="{{ route('admin') }}">Gå til admin</a>
  @else
    <a class="button primary" href="{{ route('classes.create') }}">Opret klasse</a>
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
@endsection
