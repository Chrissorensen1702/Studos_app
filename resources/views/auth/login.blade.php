@extends('layouts.studos')

@section('title', 'Login · Studos')

@section('headerActions')
  <a class="button primary" href="{{ route('classes.create') }}">Opret klasse</a>
@endsection

@section('content')
  <section class="auth-page">
    <div class="auth-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Login</p>
          <h1>Åbn Studos admin</h1>
        </div>
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
  </section>
@endsection
