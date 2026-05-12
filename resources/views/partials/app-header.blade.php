<header class="app-header">
  <a class="brand" href="{{ route('home') }}" aria-label="Studos">
    <img class="brand-logo" src="{{ asset('assets/studos-mark.svg') }}" alt="">
    <span class="sr-only">Studos</span>
  </a>

  <nav class="top-nav" aria-label="Hovednavigation">
    <a href="{{ route('about') }}">Om Studos</a>
    <a href="{{ route('legal.terms') }}">Brugervilkår</a>
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
        <a class="button primary" href="{{ route('home') }}#landing-features-title">Se appen</a>
      @endauth
    @endif
  </div>
</header>
