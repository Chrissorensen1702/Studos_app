@extends('layouts.studos')

@section('title', 'Opret klasse · Studos')

@section('headerActions')
  <a class="button subtle" href="{{ route('login') }}">Login</a>
@endsection

@section('content')
  <section class="auth-page wide-auth">
    <div class="auth-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Kom i gang</p>
          <h1>Opret bruger og klasse</h1>
        </div>
      </div>

      <form class="form-grid" action="{{ route('classes.create.store') }}" method="post">
        @csrf

        <label>
          Dit navn
          <input name="ownerName" value="{{ old('ownerName') }}" autocomplete="name" placeholder="Chris Sørensen" required>
        </label>

        <label>
          Email
          <input name="ownerEmail" value="{{ old('ownerEmail') }}" type="email" autocomplete="email" placeholder="chris@skole.dk" required>
        </label>

        <label>
          Adgangskode
          <input name="password" type="password" autocomplete="new-password" required>
        </label>

        <label>
          Gentag adgangskode
          <input name="password_confirmation" type="password" autocomplete="new-password" required>
        </label>

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
    </div>
  </section>
@endsection
