@extends('layouts.studos')

@section('title', $schoolClass->class_name.' · Studos')

@section('nav')
  @if ($canManageClass)
    <a href="#medlemmer">Medlemmer</a>
  @endif
  @if ($canManageContent)
    <a href="#cms">CMS</a>
  @endif
  @if ($canManageEvents)
    <a href="#events">Events</a>
  @endif
@endsection

@section('headerActions')
  <form action="{{ route('logout') }}" method="post">
    @csrf
    <button class="button subtle" type="submit">Log ud</button>
  </form>
@endsection

@section('content')
  <section class="page class-page">
    <div class="class-hero full-bleed">
      <div>
        <a class="back-link" href="{{ route('admin') }}">Til admin</a>
        <p class="eyebrow">{{ $schoolClass->school_name }}</p>
        <h1>{{ $schoolClass->class_name }} · {{ $schoolClass->graduation_year }}</h1>
      </div>
      <div class="class-hero-actions">
        <div class="invite-box">
          <span>Klassekode</span>
          <strong>{{ $schoolClass->invite_code }}</strong>
          <button class="button subtle" type="button" data-copy="{{ $schoolClass->invite_code }}">Kopier</button>
        </div>
      </div>
    </div>

    <div class="class-panel-grid">
      @if ($canManageClass)
        <section class="panel" id="indstillinger">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Klasse</p>
            <h2>Overblik</h2>
          </div>
        </div>

        <div class="metric-grid panel-metrics">
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

        <form class="form-grid" action="{{ route('classes.settings.update', $schoolClass->id) }}" method="post">
          @csrf
          @method('PATCH')

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
          <div class="member-heading-title">
            <p class="eyebrow">Adgang</p>
            <div class="member-title-row">
              <h2>Administrer medlemmer</h2>
              <div class="member-title-actions">
                <button class="button primary" type="button" data-dialog-open="add-member-dialog" data-focus-target="member-display-name">
                  Tilføj medlem
                </button>
                @if ($removedMembers->isNotEmpty())
                  <button class="button subtle" type="button" data-dialog-open="removed-members-dialog">
                    Se fjernede medlemmer ({{ $removedMembers->count() }})
                  </button>
                @endif
              </div>
            </div>
          </div>
        </div>

      <div class="data-list">
        @forelse ($members as $member)
          @php($hasAccount = filled($member->password_hash ?? null))
          <div class="member-row">
            <label class="member-select">
              <input
                form="bulk-remove-members-form"
                name="memberIds[]"
                type="checkbox"
                value="{{ $member->id }}"
                aria-label="Vælg {{ $member->display_name }}"
              >
            </label>

            <div class="person">
              <strong>{{ $member->display_name }}</strong>
              <span>{{ $member->email ?: 'Ingen email' }}</span>
            </div>

            <div class="member-access-controls">
              <div class="account-status" aria-label="Status for {{ $member->display_name }}">
                <strong class="account-status-badge @if ($hasAccount) is-active @else is-pending @endif">
                  {{ $hasAccount ? 'Aktiv' : 'Afventer oprettelse' }}
                </strong>
              </div>

              <form class="row-controls" action="{{ route('classes.members.update', [$schoolClass->id, $member->id]) }}" method="post">
                @csrf
                @method('PATCH')
                <select name="role" aria-label="Rolle for {{ $member->display_name }}">
                  @foreach ($roles as $value => $label)
                    <option value="{{ $value }}" @selected($member->role === $value)>{{ $label }}</option>
                  @endforeach
                </select>
                <button class="button subtle" type="submit">Gem rolle</button>
              </form>
            </div>

          </div>
        @empty
          <div class="empty-state">
            <strong>Ingen aktive medlemmer endnu.</strong>
            <span>Tilføj et medlem med knappen ovenfor, eller gendan et fjernet medlem fra arkivet.</span>
          </div>
        @endforelse
      </div>

      @if ($members->isNotEmpty())
        <form id="bulk-remove-members-form" class="bulk-actions" action="{{ route('classes.members.destroy-many', $schoolClass->id) }}" method="post">
          @csrf
          @method('DELETE')
          <span>Vælg flere brugere og fjern dem samlet.</span>
          <button class="button danger" type="submit">Fjern valgte</button>
        </form>
      @endif

      </section>

      <dialog
        id="add-member-dialog"
        class="modal"
        aria-labelledby="add-member-title"
        @if ($errors->has('displayName') || $errors->has('email') || $errors->has('emergencyContactName') || $errors->has('emergencyContactPhone')) data-open-on-load data-focus-target="member-display-name" @endif
      >
        <div class="modal-panel">
          <div class="modal-heading">
            <div>
              <p class="eyebrow">Adgang</p>
              <h2 id="add-member-title">Tilføj medlem</h2>
            </div>
            <button class="button subtle" type="button" data-dialog-close>Luk</button>
          </div>

          <form class="modal-form" action="{{ route('classes.members.store', $schoolClass->id) }}" method="post">
            @csrf
            <label>
              Navn
              <input id="member-display-name" name="displayName" value="{{ old('displayName') }}" required>
              @error('displayName')
                <span class="field-error">{{ $message }}</span>
              @enderror
            </label>

            <label>
              Email
              <input name="email" value="{{ old('email') }}" type="email" autocomplete="email" required>
              @error('email')
                <span class="field-error">{{ $message }}</span>
              @enderror
            </label>

            <label>
              Rolle
              <select name="role" required>
                @foreach ($roles as $value => $label)
                  <option value="{{ $value }}" @selected(old('role', 'student') === $value)>{{ $label }}</option>
                @endforeach
              </select>
            </label>

            <label>
              Fulde navn
              <input name="emergencyContactName" value="{{ old('emergencyContactName') }}">
              @error('emergencyContactName')
                <span class="field-error">{{ $message }}</span>
              @enderror
            </label>

            <label>
              Mobilnummer
              <input name="emergencyContactPhone" value="{{ old('emergencyContactPhone') }}" inputmode="tel">
              @error('emergencyContactPhone')
                <span class="field-error">{{ $message }}</span>
              @enderror
            </label>

            <div class="form-actions">
              <button class="button subtle" type="button" data-dialog-close>Annuller</button>
              <button class="button primary" type="submit">Opret medlem</button>
            </div>
          </form>
        </div>
      </dialog>

    @if ($removedMembers->isNotEmpty())
      <dialog id="removed-members-dialog" class="modal" aria-labelledby="removed-members-title">
        <div class="modal-panel">
          <div class="modal-heading sticky">
            <div>
              <p class="eyebrow">Arkiv</p>
              <h2 id="removed-members-title">Fjernede medlemmer</h2>
            </div>
            <button class="button subtle" type="button" data-dialog-close>Luk</button>
          </div>

          <div class="data-list removed-list">
            @foreach ($removedMembers as $member)
              <div class="member-row removed-member-row">
                <div class="person">
                  <strong>{{ $member->display_name }}</strong>
                  <span>{{ $member->email ?: 'Ingen email' }} · {{ $roles[$member->role] ?? ucfirst($member->role) }}</span>
                </div>

                <form action="{{ route('classes.members.update', [$schoolClass->id, $member->id]) }}" method="post">
                  @csrf
                  @method('PATCH')
                  <input type="hidden" name="role" value="{{ $member->role }}">
                  <input type="hidden" name="status" value="active">
                  <button class="button subtle" type="submit">Gendan</button>
                </form>
              </div>
            @endforeach
          </div>
        </div>
      </dialog>
    @endif
      @else
        <section class="panel" id="indstillinger">
          <div class="empty-state">
            <strong>Klasseindstillinger og medlemmer kræver ejeradgang.</strong>
            <span>Moderatorer kan stadig styre CMS og events.</span>
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

      @if ($canManageEvents)
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
          @if ($canManageEvents)
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
    </div>
  </section>
@endsection
