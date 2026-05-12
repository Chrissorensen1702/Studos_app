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
    @include('partials.app-topbar')
    @include('partials.app-header')

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

    @include('partials.landing-footer')
    @include('partials.cookie-consent')

    <script src="{{ url('/app.js') }}?v={{ filemtime(public_path('app.js')) }}" type="module"></script>
  </body>
</html>
