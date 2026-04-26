@extends('layouts.studos')

@section('title', 'Opret klasse · Studos Admin')

@section('headerActions')
  <form action="{{ route('logout') }}" method="post">
    @csrf
    <button class="button subtle" type="submit">Log ud</button>
  </form>
@endsection

@section('content')
  <section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">Admin</p>
        <h1>Opret din klasse</h1>
      </div>
      <div class="heading-copy">
        <span>Logget ind som</span>
        <strong>{{ auth()->user()->name }}</strong>
      </div>
    </div>

    <div class="home-grid">
      <section id="opret-klasse" class="panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Setup</p>
            <h2>Klasse</h2>
          </div>
        </div>

        <form class="form-grid" action="{{ route('classes.store') }}" method="post">
          @csrf

          <label>
            Skole
            <select name="schoolId" autocomplete="organization" required>
              <option value="">Vælg skole</option>
              @foreach ($schools as $school)
                <option value="{{ $school->id }}" @selected(old('schoolId') === $school->id)>{{ $school->name }}</option>
              @endforeach
            </select>
          </label>

          <label>
            Klasse
            <input name="className" value="{{ old('className') }}" placeholder="3.B" required>
          </label>

          <label>
            Studenterår
            <input name="graduationYear" value="{{ old('graduationYear', now()->year) }}" inputmode="numeric" maxlength="4" required>
          </label>

          <label>
            Dimission
            <input name="graduationDate" value="{{ old('graduationDate') }}" type="date">
          </label>

          <label class="wide">
            Join
            <select name="joinPolicy" required>
              @foreach ($joinPolicies as $value => $label)
                <option value="{{ $value }}" @selected(old('joinPolicy', 'approval') === $value)>{{ $label }}</option>
              @endforeach
            </select>
          </label>

          <div class="form-actions wide">
            <button class="button primary" type="submit">Opret klasse</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Studos</p>
            <h2>Én klasse</h2>
          </div>
        </div>

        <div class="empty-state">
          <strong>Ingen klasse endnu</strong>
          <span>Når klassen er oprettet, åbner admin direkte på klassens CMS.</span>
        </div>
      </section>
    </div>
  </section>
@endsection
