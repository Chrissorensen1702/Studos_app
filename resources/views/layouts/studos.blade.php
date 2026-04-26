<!doctype html>
<html lang="da">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'Studos')</title>
    <link rel="stylesheet" href="{{ url('/styles.css') }}?v={{ filemtime(public_path('styles.css')) }}">
  </head>
  <body>
    <header class="app-header">
      <a class="brand" href="{{ route('home') }}" aria-label="Studos">
        <img class="brand-logo" src="{{ asset('assets/studos-mark.svg') }}" alt="">
        <span>Studos</span>
      </a>

      <nav class="top-nav" aria-label="Hovednavigation">
        <a href="{{ route('home') }}">Forside</a>
        @auth
          <a href="{{ route('admin') }}">Admin</a>
        @else
          <a href="{{ route('classes.create') }}">Opret klasse</a>
          <a href="{{ route('login') }}">Login</a>
        @endauth
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
