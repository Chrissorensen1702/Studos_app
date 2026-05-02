<!doctype html>
<html lang="da">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'Studos')</title>
    <link rel="icon" href="{{ asset('assets/studos-mark.svg') }}" type="image/svg+xml">
    <link rel="stylesheet" href="{{ url('/styles.css') }}?v={{ filemtime(public_path('styles.css')) }}">
  </head>
  <body class="@yield('bodyClass')">
    @unless (trim($__env->yieldContent('hideHeader')))
    <div class="app-dev-topbar" role="status">
      <span>Studos er under udvikling.</span>
      <span>Appen er endnu ikke offentligt tilgængelig, og download-knapperne vises kun som design-preview.</span>
    </div>

    <header class="app-header">
      <a class="brand" href="{{ route('home') }}" aria-label="Studos">
        <img class="brand-logo" src="{{ asset('assets/studos-mark.svg') }}" alt="">
        <span class="sr-only">Studos</span>
      </a>

      <nav class="top-nav" aria-label="Hovednavigation">
        <div class="top-nav-dropdown">
          <button class="top-nav-trigger" type="button" aria-haspopup="true">
            <span>Funktioner</span>
            <span class="top-nav-chevron" aria-hidden="true"></span>
          </button>
          <div class="top-nav-menu">
            <a href="{{ route('home') }}#landing-features-title">Kalender</a>
            <a href="{{ route('home') }}#landing-features-title">Chat</a>
            <a href="{{ route('home') }}#landing-features-title">Caps</a>
            <a href="{{ route('home') }}#landing-features-title">Challenges</a>
            <a href="{{ route('home') }}#landing-features-title">Galleri</a>
            <a href="{{ route('home') }}#landing-features-title">Klasseawards</a>
            <a href="{{ route('home') }}#landing-features-title">Klassedyst</a>
          </div>
        </div>
        <a href="{{ route('home') }}#landing-title">Om Studos</a>
        <a href="{{ route('home') }}#det-med-smaat">Moderation</a>
        <a href="{{ route('faq') }}">FAQ</a>
        @yield('nav')
      </nav>

      <div class="header-slot">
        @hasSection('headerActions')
          @yield('headerActions')
        @else
          @auth
            <form action="{{ route('logout') }}" method="post">
              @csrf
              <button class="button subtle" type="submit">Log ud</button>
            </form>
          @else
            <a class="button primary" href="{{ route('login') }}">Login</a>
          @endauth
        @endif
      </div>
    </header>
    @endunless

    @if (session('status') || $errors->any())
      <div class="notice-wrap">
        @if (session('status'))
          <div class="notice success">{{ session('status') }}</div>
        @endif

        @if ($errors->any())
          <div class="notice error">
            <strong>Der mangler lidt.</strong>
            <span>{{ $errors->first() }}</span>
          </div>
        @endif
      </div>
    @endif

    <main>
      @yield('content')
    </main>

    <script src="{{ url('/app.js') }}?v={{ filemtime(public_path('app.js')) }}" type="module"></script>
  </body>
</html>
