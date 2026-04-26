@extends('layouts.studos')

@section('title', 'Studos')

@section('headerActions')
  @auth
    <a class="button primary" href="{{ route('admin') }}">Gå til admin</a>
  @else
    <a class="button primary" href="{{ route('classes.create') }}">Opret klasse</a>
  @endauth
@endsection

@section('content')
  <section class="landing-hero">
    <img class="landing-image" src="{{ asset('assets/landing-hero.png') }}" alt="">
    <div class="landing-shade"></div>
    <div class="landing-content">
      <p class="eyebrow">Studenteråret samlet et sted</p>
      <h1>Studos</h1>
      <p>
        En privat klassehub til invite, medlemmer, events, globale beskeder og alt
        det praktiske omkring studenteråret.
      </p>
      <div class="landing-actions">
        @auth
          <a class="button primary" href="{{ route('admin') }}">Åbn admin</a>
        @else
          <a class="button primary" href="{{ route('classes.create') }}">Opret klasse</a>
          <a class="button light" href="{{ route('login') }}">Login</a>
        @endauth
      </div>
    </div>
  </section>

  <section class="page landing-page">
    <div class="section-heading">
      <p class="eyebrow">Web og app</p>
      <h2>Forsiden er offentlig. CMS ligger bag login.</h2>
    </div>

    <div class="feature-grid">
      <article class="feature-card">
        <span>01</span>
        <h3>Opret klasse</h3>
        <p>Første bruger oprettes sammen med klassen og bliver owner.</p>
      </article>
      <article class="feature-card">
        <span>02</span>
        <h3>Adminpanel</h3>
        <p>Klasseadgang styrer medlemmer, roller, invite og indstillinger.</p>
      </article>
      <article class="feature-card">
        <span>03</span>
        <h3>CMS</h3>
        <p>Globale beskeder, links, program og kontaktpersoner kræver login.</p>
      </article>
      <article class="feature-card">
        <span>04</span>
        <h3>Events</h3>
        <p>Dimission, vogntur, møder og deadlines samles på klassen.</p>
      </article>
    </div>
  </section>
@endsection
