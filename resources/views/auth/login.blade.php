@extends('layouts.studos')

@section('title', 'Login · Studos')
@section('bodyClass', 'login-body')
@section('hideHeader', '1')

@section('content')
  <section class="login-screen">
    <div class="login-brand-panel">
      <a class="login-logo" href="{{ route('home') }}" aria-label="Studos forside">
        <img src="{{ asset('assets/studos-logo.svg') }}" alt="Studos">
      </a>

      <div class="login-copy">
        <p class="eyebrow">CMS til studentertiden</p>
        <h1>Styr klassen, invitationerne og indholdet ét sted.</h1>
        <p>Studos samler klasseadministration, CMS-blokke og events i et roligt værktøj bygget til gentagen brug.</p>
        <ul>
          <li>Invitér medlemmer med klassekode</li>
          <li>Administrér roller, indhold og kalender</li>
          <li>Hold appens oplysninger opdateret fra web</li>
        </ul>
      </div>
    </div>

    <div class="login-card-shell">
      <div class="auth-panel login-card">
        <div class="login-card-heading">
          <p class="eyebrow">Login</p>
          <h2>Åbn Studos admin</h2>
          <span>Brug din ejer- eller moderatorprofil.</span>
        </div>

        <form class="form-grid single" action="{{ route('login.store') }}" method="post">
          @csrf

          <label>
            Email
            <input name="email" value="{{ old('email') }}" type="email" autocomplete="email" required>
          </label>

          <label>
            Adgangskode
            <input name="password" type="password" autocomplete="current-password" required>
          </label>

          <label class="check-row">
            <input name="remember" type="checkbox" value="1">
            <span>Husk mig</span>
          </label>

          <div class="form-actions">
            <button class="button primary" type="submit">Login</button>
          </div>
        </form>
      </div>

      <p class="login-secondary-action">
        Skal du oprette en klasse?
        <a href="{{ route('classes.create') }}">Start her</a>
      </p>
    </div>
  </section>
@endsection
