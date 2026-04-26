@extends('layouts.studos')

@section('title', $schoolClass->class_name.' · Studos')

@section('nav')
  <a href="#medlemmer">Medlemmer</a>
  <a href="#cms">CMS</a>
  <a href="#events">Events</a>
@endsection

@section('headerActions')
  <button class="button subtle" type="button" data-copy="{{ $inviteUrl }}">Kopier invite</button>
@endsection

@section('content')
  <section class="page">
    <div class="class-hero">
      <div>
        <a class="back-link" href="{{ route('admin') }}">Til admin</a>
        <p class="eyebrow">{{ $schoolClass->school_name }}</p>
        <h1>{{ $schoolClass->class_name }} · {{ $schoolClass->graduation_year }}</h1>
        <div class="hero-meta">
          <span>KlasseID <code>{{ $schoolClass->public_id }}</code></span>
          <span>Invite <code>{{ $schoolClass->invite_code }}</code></span>
          <span>{{ $joinPolicies[$schoolClass->join_policy] ?? $schoolClass->join_policy }}</span>
          <span>Owner {{ $schoolClass->owner_name }}</span>
          <span>Din rolle {{ ucfirst($currentMember->role) }}</span>
        </div>
      </div>
      <div class="class-hero-actions">
        <div class="invite-box">
          <span>KlasseID</span>
          <strong>{{ $schoolClass->public_id }}</strong>
          <button class="button primary" type="button" data-copy="{{ $schoolClass->public_id }}">Kopier</button>
        </div>
        <div class="invite-box">
          <span>Invitekode</span>
          <strong>{{ $schoolClass->invite_code }}</strong>
          <button class="button subtle" type="button" data-copy="{{ $schoolClass->invite_code }}">Kopier</button>
        </div>
      </div>
    </div>

    <div class="metric-grid">
      <div class="metric">
        <span>Aktive</span>
        <strong>{{ $stats['activeMembers'] }}</strong>
      </div>
      <div class="metric">
        <span>Afventer</span>
        <strong>{{ $stats['pendingMembers'] }}</strong>
      </div>
      <div class="metric">
        <span>Events</span>
        <strong>{{ $stats['events'] }}</strong>
      </div>
      <div class="metric">
        <span>CMS</span>
        <strong>{{ $stats['contentBlocks'] }}</strong>
      </div>
    </div>

    @if ($canManageClass)
      <section class="panel" id="indstillinger">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Klasse</p>
          <h2>Indstillinger</h2>
        </div>
      </div>

      <form class="form-grid" action="{{ route('classes.settings.update', $schoolClass->id) }}" method="post">
        @csrf
        @method('PATCH')

        <label>
          Skole
          <input name="schoolName" value="{{ old('schoolName', $schoolClass->school_name) }}" required>
        </label>

        <label>
          Klasse
          <input name="className" value="{{ old('className', $schoolClass->class_name) }}" required>
        </label>

        <label>
          Studenterår
          <input name="graduationYear" value="{{ old('graduationYear', $schoolClass->graduation_year) }}" inputmode="numeric" maxlength="4" required>
        </label>

        <label>
          Dimission
          <input name="graduationDate" value="{{ old('graduationDate', $schoolClass->graduation_date) }}" type="date">
        </label>

        <label>
          KlasseID
          <input value="{{ $schoolClass->public_id }}" readonly>
        </label>

        <label>
          Invitekode
          <input name="inviteCode" value="{{ old('inviteCode', $schoolClass->invite_code) }}" required>
        </label>

        <label>
          Join
          <select name="joinPolicy" required>
            @foreach ($joinPolicies as $value => $label)
              <option value="{{ $value }}" @selected(old('joinPolicy', $schoolClass->join_policy) === $value)>{{ $label }}</option>
            @endforeach
          </select>
        </label>

        <label class="check-row">
          <input name="allowMemberPosts" type="checkbox" value="1" @checked(old('allowMemberPosts', $schoolClass->allow_member_posts))>
          <span>Medlemmer kan oprette indhold</span>
        </label>

        <label class="check-row">
          <input name="requireApprovalForPhotos" type="checkbox" value="1" @checked(old('requireApprovalForPhotos', $schoolClass->require_approval_for_photos))>
          <span>Billeder kræver godkendelse</span>
        </label>

        <div class="form-actions wide">
          <button class="button primary" type="submit">Gem indstillinger</button>
        </div>
      </form>
    </section>

    <section class="panel" id="medlemmer">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Adgang</p>
          <h2>Medlemmer</h2>
        </div>
      </div>

      <form class="inline-create" action="{{ route('classes.members.store', $schoolClass->id) }}" method="post">
        @csrf
        <input name="displayName" value="{{ old('displayName') }}" placeholder="Navn" required>
        <input name="email" value="{{ old('email') }}" type="email" placeholder="Email">
        <select name="role" required>
          @foreach ($roles as $value => $label)
            <option value="{{ $value }}" @selected(old('role', 'student') === $value)>{{ $label }}</option>
          @endforeach
        </select>
        <select name="status" required>
          @foreach ($statuses as $value => $label)
            <option value="{{ $value }}" @selected(old('status', 'active') === $value)>{{ $label }}</option>
          @endforeach
        </select>
        <button class="button primary" type="submit">Tilføj</button>
      </form>

      <div class="data-list">
        @foreach ($members as $member)
          <div class="member-row">
            <div class="person">
              <strong>{{ $member->display_name }}</strong>
              <span>{{ $member->email ?: 'Ingen email' }}</span>
            </div>

            <form class="row-controls" action="{{ route('classes.members.update', [$schoolClass->id, $member->id]) }}" method="post">
              @csrf
              @method('PATCH')
              <select name="role" aria-label="Rolle for {{ $member->display_name }}">
                @foreach ($roles as $value => $label)
                  <option value="{{ $value }}" @selected($member->role === $value)>{{ $label }}</option>
                @endforeach
              </select>
              <select name="status" aria-label="Status for {{ $member->display_name }}">
                @foreach ($statuses as $value => $label)
                  <option value="{{ $value }}" @selected($member->status === $value)>{{ $label }}</option>
                @endforeach
              </select>
              <button class="button subtle" type="submit">Gem</button>
            </form>

            <form action="{{ route('classes.members.destroy', [$schoolClass->id, $member->id]) }}" method="post">
              @csrf
              @method('DELETE')
              <button class="button danger" type="submit">Fjern</button>
            </form>
          </div>
        @endforeach
      </div>
    </section>
    @else
      <section class="panel" id="indstillinger">
        <div class="empty-state">
          <strong>Klasseindstillinger og medlemmer kræver adgang til klassen.</strong>
          <span>Alle roller har fuld adgang lige nu, indtil adgangsniveauerne bliver defineret.</span>
        </div>
      </section>
    @endif

    <section class="panel" id="cms">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Indhold</p>
          <h2>CMS</h2>
        </div>
      </div>

      @if ($canManageContent)
        <form class="content-create" action="{{ route('classes.content.store', $schoolClass->id) }}" method="post">
        @csrf
        <div class="form-grid">
          <label>
            Type
            <select name="type" required>
              @foreach ($contentTypes as $value => $label)
                <option value="{{ $value }}">{{ $label }}</option>
              @endforeach
            </select>
          </label>
          <label>
            Titel
            <input name="title" placeholder="Vigtig info" required>
          </label>
          <label>
            Sortering
            <input name="sortOrder" type="number" min="0" max="999" value="100">
          </label>
          <label class="check-row">
            <input name="isPinned" type="checkbox" value="1">
            <span>Fastgjort</span>
          </label>
          <label class="wide">
            Tekst
            <textarea name="body" rows="4" required></textarea>
          </label>
        </div>
        <div class="form-actions">
          <button class="button primary" type="submit">Opret CMS-blok</button>
        </div>
      </form>
      @endif

      <div class="data-list split-list">
        @forelse ($contentBlocks as $block)
          @if ($canManageContent)
            <form class="editor-row" action="{{ route('classes.content.update', [$schoolClass->id, $block->id]) }}" method="post">
            @csrf
            @method('PATCH')
            <div class="editor-title">
              <strong>{{ $block->title }}</strong>
              <span>{{ $contentTypes[$block->type] ?? $block->type }}</span>
            </div>
            <div class="form-grid compact">
              <label>
                Type
                <select name="type">
                  @foreach ($contentTypes as $value => $label)
                    <option value="{{ $value }}" @selected($block->type === $value)>{{ $label }}</option>
                  @endforeach
                </select>
              </label>
              <label>
                Titel
                <input name="title" value="{{ $block->title }}" required>
              </label>
              <label>
                Sortering
                <input name="sortOrder" type="number" min="0" max="999" value="{{ $block->sort_order }}">
              </label>
              <label class="check-row">
                <input name="isPinned" type="checkbox" value="1" @checked($block->is_pinned)>
                <span>Fastgjort</span>
              </label>
              <label class="wide">
                Tekst
                <textarea name="body" rows="4" required>{{ $block->body }}</textarea>
              </label>
            </div>
            <div class="row-actions">
              <button class="button subtle" type="submit">Gem</button>
            </div>
          </form>

          <form class="delete-row" action="{{ route('classes.content.destroy', [$schoolClass->id, $block->id]) }}" method="post">
            @csrf
            @method('DELETE')
            <button class="button danger" type="submit">Slet {{ $block->title }}</button>
          </form>
          @else
            <article class="editor-row">
              <div class="editor-title">
                <strong>{{ $block->title }}</strong>
                <span>{{ $contentTypes[$block->type] ?? $block->type }}</span>
              </div>
              <p>{{ $block->body }}</p>
            </article>
          @endif
        @empty
          <div class="empty-state">
            <strong>Ingen CMS-blokke endnu</strong>
            <span>Opret første globale tekst til klassen.</span>
          </div>
        @endforelse
      </div>
    </section>

    <section class="panel" id="events">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Kalender</p>
          <h2>Begivenheder</h2>
        </div>
      </div>

      @if ($canManageContent)
        <form class="content-create" action="{{ route('classes.events.store', $schoolClass->id) }}" method="post">
        @csrf
        <div class="form-grid">
          <label>
            Titel
            <input name="title" placeholder="Vogntur" required>
          </label>
          <label>
            Dato
            <input name="eventDate" type="date" required>
          </label>
          <label>
            Sted
            <input name="location" placeholder="Skolen">
          </label>
          <label>
            RSVP
            <input name="rsvpCount" type="number" min="0" max="9999" value="0">
          </label>
          <label class="wide">
            Beskrivelse
            <textarea name="description" rows="3"></textarea>
          </label>
        </div>
        <div class="form-actions">
          <button class="button primary" type="submit">Opret event</button>
        </div>
      </form>
      @endif

      <div class="data-list split-list">
        @forelse ($events as $event)
          @if ($canManageContent)
            <form class="editor-row" action="{{ route('classes.events.update', [$schoolClass->id, $event->id]) }}" method="post">
            @csrf
            @method('PATCH')
            <div class="editor-title">
              <strong>{{ $event->title }}</strong>
              <span>{{ filled($event->event_date) ? date('d.m.Y', strtotime($event->event_date)) : 'Ingen dato' }}</span>
            </div>
            <div class="form-grid compact">
              <label>
                Titel
                <input name="title" value="{{ $event->title }}" required>
              </label>
              <label>
                Dato
                <input name="eventDate" value="{{ $event->event_date }}" type="date" required>
              </label>
              <label>
                Sted
                <input name="location" value="{{ $event->location }}">
              </label>
              <label>
                RSVP
                <input name="rsvpCount" type="number" min="0" max="9999" value="{{ $event->rsvp_count }}">
              </label>
              <label class="wide">
                Beskrivelse
                <textarea name="description" rows="3">{{ $event->description }}</textarea>
              </label>
            </div>
            <div class="row-actions">
              <button class="button subtle" type="submit">Gem</button>
            </div>
          </form>

          <form class="delete-row" action="{{ route('classes.events.destroy', [$schoolClass->id, $event->id]) }}" method="post">
            @csrf
            @method('DELETE')
            <button class="button danger" type="submit">Slet {{ $event->title }}</button>
          </form>
          @else
            <article class="editor-row">
              <div class="editor-title">
                <strong>{{ $event->title }}</strong>
                <span>{{ filled($event->event_date) ? date('d.m.Y', strtotime($event->event_date)) : 'Ingen dato' }}</span>
              </div>
              <p>{{ $event->description }}</p>
            </article>
          @endif
        @empty
          <div class="empty-state">
            <strong>Ingen events endnu</strong>
            <span>Opret første begivenhed for klassen.</span>
          </div>
        @endforelse
      </div>
    </section>
  </section>
@endsection
