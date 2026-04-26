<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StudosWebController extends Controller
{
    private const ROLES = [
        'owner' => 'Owner',
        'moderator' => 'Moderator',
        'student' => 'Student',
    ];

    private const STATUSES = [
        'pending' => 'Afventer',
        'active' => 'Aktiv',
        'removed' => 'Fjernet',
    ];

    private const JOIN_POLICIES = [
        'open' => 'Åben',
        'approval' => 'Kræver godkendelse',
        'closed' => 'Lukket',
    ];

    private const CONTENT_TYPES = [
        'info' => 'Vigtig info',
        'program' => 'Program',
        'links' => 'Links',
        'rules' => 'Regler',
        'contact' => 'Kontaktpersoner',
    ];

    private const PERSONAL_CODE_WORDS = [
        'KAOS',
        'DISCO',
        'GLIMT',
        'FEST',
        'KONFETTI',
        'SOL',
        'VIBE',
        'SNACKS',
        'HYPE',
        'DANS',
        'GULD',
        'NAT',
        'BOOM',
        'LYN',
        'STJERNE',
        'MAGI',
        'BANGER',
        'SKÅL',
        'POP',
        'WOW',
    ];

    public function landing(): View
    {
        return view('home');
    }

    public function createClass(): View
    {
        return view('auth.register-class', [
            'joinPolicies' => self::JOIN_POLICIES,
            'schools' => $this->schoolOptions(),
        ]);
    }

    public function admin(): View|RedirectResponse
    {
        $schoolClass = $this->primaryManagedClass();

        if ($schoolClass) {
            return redirect()->route('classes.show', $schoolClass->id);
        }

        return view('admin.index', [
            'joinPolicies' => self::JOIN_POLICIES,
            'schools' => $this->schoolOptions(),
        ]);
    }

    public function storeClass(Request $request): RedirectResponse
    {
        $schoolClass = $this->primaryManagedClass();

        if ($schoolClass) {
            return redirect()
                ->route('classes.show', $schoolClass->id)
                ->withErrors(['class' => 'Du kan kun oprette én klasse pr. bruger.']);
        }

        $data = $request->validate([
            'schoolId' => ['required', 'string', Rule::exists('schools', 'id')],
            'className' => ['required', 'string', 'max:100'],
            'graduationYear' => ['required', 'digits:4'],
            'graduationDate' => ['nullable', 'date'],
            'joinPolicy' => ['required', Rule::in(array_keys(self::JOIN_POLICIES))],
        ]);

        $user = $request->user();
        $classId = $this->createClassForOwner($data, $user->name, $user->email);

        return redirect()
            ->route('classes.show', $classId)
            ->with('status', 'Klassen er oprettet, og du er owner.');
    }

    public function storeClassWithUser(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'ownerName' => ['required', 'string', 'max:190'],
            'ownerEmail' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'schoolId' => ['required', 'string', Rule::exists('schools', 'id')],
            'className' => ['required', 'string', 'max:100'],
            'graduationYear' => ['required', 'digits:4'],
            'graduationDate' => ['nullable', 'date'],
            'joinPolicy' => ['required', Rule::in(array_keys(self::JOIN_POLICIES))],
        ]);

        $user = User::create([
            'name' => trim($data['ownerName']),
            'email' => Str::lower(trim($data['ownerEmail'])),
            'password' => $data['password'],
        ]);
        $classId = $this->createClassForOwner($data, $user->name, $user->email);

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()
            ->route('classes.show', $classId)
            ->with('status', 'Din bruger og klasse er oprettet. Du er owner.');
    }

    public function redirectLegacyClass(string $class): RedirectResponse
    {
        return redirect()->route('classes.show', $class);
    }

    private function createClassForOwner(array $data, string $ownerName, string $ownerEmail): string
    {
        $classId = (string) Str::uuid();
        $ownerId = (string) Str::uuid();
        $now = now()->format('Y-m-d H:i:s');
        $graduationDate = blank($data['graduationDate'] ?? null) ? null : $data['graduationDate'];
        $ownerParts = preg_split('/\s+/', trim($ownerName), 2) ?: [];
        $school = $this->schoolById($data['schoolId']);
        $schoolId = $school->id;
        $schoolName = $school->name;
        $publicId = $this->generateClassPublicId($schoolName, $data['className'], $data['graduationYear']);

        DB::transaction(function () use ($data, $schoolId, $schoolName, $ownerName, $ownerEmail, $ownerParts, $classId, $ownerId, $now, $graduationDate, $publicId): void {
            DB::table('classes')->insert([
                'id' => $classId,
                'public_id' => $publicId,
                'school_id' => $schoolId,
                'school_name' => $schoolName,
                'class_name' => trim($data['className']),
                'graduation_year' => trim($data['graduationYear']),
                'graduation_date' => $graduationDate,
                'owner_name' => trim($ownerName),
                'owner_email' => Str::lower(trim($ownerEmail)),
                'invite_code' => $this->generateInviteCode($data['graduationYear']),
                'join_policy' => $data['joinPolicy'],
                'allow_member_posts' => true,
                'require_approval_for_photos' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('members')->insert([
                'id' => $ownerId,
                'personal_code' => $this->generatePersonalCode($ownerParts[0] ?? $ownerName),
                'class_id' => $classId,
                'school_id' => $schoolId,
                'display_name' => trim($ownerName),
                'first_name' => $ownerParts[0] ?? null,
                'last_name' => $ownerParts[1] ?? null,
                'email' => Str::lower(trim($ownerEmail)),
                'role' => 'owner',
                'status' => 'active',
                'joined_at' => $now,
            ]);

            if ($graduationDate) {
                DB::table('events')->insert([
                    'id' => (string) Str::uuid(),
                    'class_id' => $classId,
                    'title' => 'Dimission',
                    'event_date' => $graduationDate,
                    'location' => null,
                    'description' => null,
                    'rsvp_count' => 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        });

        return $classId;
    }

    public function show(string $class): View
    {
        $this->authorizeClassRole($class, ['owner', 'moderator', 'student']);

        return view('classes.show', [
            ...$this->classViewModel($class),
            'roles' => self::ROLES,
            'statuses' => self::STATUSES,
            'joinPolicies' => self::JOIN_POLICIES,
            'contentTypes' => self::CONTENT_TYPES,
        ]);
    }

    public function updateSettings(Request $request, string $class): RedirectResponse
    {
        $this->authorizeClassRole($class, ['owner', 'moderator', 'student']);

        $data = $request->validate([
            'schoolName' => ['required', 'string', 'max:190'],
            'className' => ['required', 'string', 'max:100'],
            'graduationYear' => ['required', 'digits:4'],
            'graduationDate' => ['nullable', 'date'],
            'inviteCode' => ['required', 'string', 'max:32', 'regex:/^[A-Za-z0-9-]+$/'],
            'joinPolicy' => ['required', Rule::in(array_keys(self::JOIN_POLICIES))],
        ]);

        $inviteCode = Str::upper(trim($data['inviteCode']));
        $inviteTaken = DB::table('classes')
            ->where('invite_code', $inviteCode)
            ->where('id', '!=', $class)
            ->exists();

        if ($inviteTaken) {
            return back()
                ->withErrors(['inviteCode' => 'Invitekoden bruges allerede.'])
                ->withInput();
        }

        $schoolName = trim($data['schoolName']);
        $schoolId = $this->ensureSchool($schoolName);

        DB::table('classes')->where('id', $class)->update([
            'school_id' => $schoolId,
            'school_name' => $schoolName,
            'class_name' => trim($data['className']),
            'graduation_year' => trim($data['graduationYear']),
            'graduation_date' => blank($data['graduationDate'] ?? null) ? null : $data['graduationDate'],
            'invite_code' => $inviteCode,
            'join_policy' => $data['joinPolicy'],
            'allow_member_posts' => $request->boolean('allowMemberPosts'),
            'require_approval_for_photos' => $request->boolean('requireApprovalForPhotos'),
            'updated_at' => now(),
        ]);

        return back()->with('status', 'Klasseindstillingerne er gemt.');
    }

    public function storeMember(Request $request, string $class): RedirectResponse
    {
        $this->authorizeClassRole($class, ['owner', 'moderator', 'student']);

        $data = $request->validate([
            'displayName' => ['required', 'string', 'max:190'],
            'email' => ['nullable', 'email', 'max:190'],
            'role' => ['required', Rule::in(array_keys(self::ROLES))],
            'status' => ['required', Rule::in(array_keys(self::STATUSES))],
        ]);

        $displayName = trim($data['displayName']);
        $nameParts = preg_split('/\s+/', $displayName, 2) ?: [];
        $nameTaken = DB::table('members')
            ->where('class_id', $class)
            ->whereRaw('LOWER(display_name) = ?', [Str::lower($displayName)])
            ->exists();

        if ($nameTaken) {
            return back()
                ->withErrors(['displayName' => 'Der findes allerede et medlem med det navn.'])
                ->withInput();
        }

        $schoolId = DB::table('classes')->where('id', $class)->value('school_id');

        DB::table('members')->insert([
            'id' => (string) Str::uuid(),
            'personal_code' => $this->generatePersonalCode($nameParts[0] ?? $displayName),
            'class_id' => $class,
            'school_id' => $schoolId,
            'display_name' => $displayName,
            'first_name' => $nameParts[0] ?? null,
            'last_name' => $nameParts[1] ?? null,
            'email' => blank($data['email'] ?? null) ? null : Str::lower(trim($data['email'])),
            'role' => $data['role'],
            'status' => $data['status'],
            'joined_at' => now(),
        ]);

        return back()->with('status', 'Medlemmet er tilføjet.');
    }

    public function updateMember(Request $request, string $class, string $member): RedirectResponse
    {
        $this->authorizeClassRole($class, ['owner', 'moderator', 'student']);

        $current = $this->memberForClass($class, $member);
        $data = $request->validate([
            'role' => ['required', Rule::in(array_keys(self::ROLES))],
            'status' => ['required', Rule::in(array_keys(self::STATUSES))],
        ]);

        if ($this->wouldRemoveLastOwner($current, $data['role'], $data['status'])) {
            return back()->withErrors(['member' => 'Klassen skal have mindst en aktiv owner.']);
        }

        DB::table('members')->where('id', $member)->update([
            'role' => $data['role'],
            'status' => $data['status'],
        ]);

        return back()->with('status', 'Medlemsadgangen er opdateret.');
    }

    public function destroyMember(string $class, string $member): RedirectResponse
    {
        $this->authorizeClassRole($class, ['owner', 'moderator', 'student']);

        $current = $this->memberForClass($class, $member);

        if ($this->wouldRemoveLastOwner($current, $current->role, 'removed')) {
            return back()->withErrors(['member' => 'Klassen skal have mindst en aktiv owner.']);
        }

        DB::table('members')->where('id', $member)->update(['status' => 'removed']);

        return back()->with('status', 'Medlemmet er fjernet fra klassen.');
    }

    public function storeContentBlock(Request $request, string $class): RedirectResponse
    {
        $this->authorizeClassRole($class, ['owner', 'moderator', 'student']);

        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(self::CONTENT_TYPES))],
            'title' => ['required', 'string', 'max:190'],
            'body' => ['required', 'string', 'max:4000'],
            'sortOrder' => ['nullable', 'integer', 'min:0', 'max:999'],
        ]);

        DB::table('class_content_blocks')->insert([
            'id' => (string) Str::uuid(),
            'class_id' => $class,
            'type' => $data['type'],
            'title' => trim($data['title']),
            'body' => trim($data['body']),
            'is_pinned' => $request->boolean('isPinned'),
            'sort_order' => $data['sortOrder'] ?? 100,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return back()->with('status', 'CMS-indholdet er oprettet.');
    }

    public function updateContentBlock(Request $request, string $class, string $block): RedirectResponse
    {
        $this->authorizeClassRole($class, ['owner', 'moderator', 'student']);

        $this->contentBlockForClass($class, $block);

        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(self::CONTENT_TYPES))],
            'title' => ['required', 'string', 'max:190'],
            'body' => ['required', 'string', 'max:4000'],
            'sortOrder' => ['nullable', 'integer', 'min:0', 'max:999'],
        ]);

        DB::table('class_content_blocks')->where('id', $block)->update([
            'type' => $data['type'],
            'title' => trim($data['title']),
            'body' => trim($data['body']),
            'is_pinned' => $request->boolean('isPinned'),
            'sort_order' => $data['sortOrder'] ?? 100,
            'updated_at' => now(),
        ]);

        return back()->with('status', 'CMS-indholdet er gemt.');
    }

    public function destroyContentBlock(string $class, string $block): RedirectResponse
    {
        $this->authorizeClassRole($class, ['owner', 'moderator', 'student']);

        $this->contentBlockForClass($class, $block);

        DB::table('class_content_blocks')->where('id', $block)->delete();

        return back()->with('status', 'CMS-indholdet er slettet.');
    }

    public function storeEvent(Request $request, string $class): RedirectResponse
    {
        $this->authorizeClassRole($class, ['owner', 'moderator', 'student']);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'eventDate' => ['required', 'date'],
            'location' => ['nullable', 'string', 'max:190'],
            'description' => ['nullable', 'string', 'max:4000'],
            'rsvpCount' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ]);

        DB::table('events')->insert([
            'id' => (string) Str::uuid(),
            'class_id' => $class,
            'title' => trim($data['title']),
            'event_date' => $data['eventDate'],
            'location' => blank($data['location'] ?? null) ? null : trim($data['location']),
            'description' => blank($data['description'] ?? null) ? null : trim($data['description']),
            'rsvp_count' => $data['rsvpCount'] ?? 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return back()->with('status', 'Begivenheden er oprettet.');
    }

    public function updateEvent(Request $request, string $class, string $event): RedirectResponse
    {
        $this->authorizeClassRole($class, ['owner', 'moderator', 'student']);

        $this->eventForClass($class, $event);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'eventDate' => ['required', 'date'],
            'location' => ['nullable', 'string', 'max:190'],
            'description' => ['nullable', 'string', 'max:4000'],
            'rsvpCount' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ]);

        DB::table('events')->where('id', $event)->update([
            'title' => trim($data['title']),
            'event_date' => $data['eventDate'],
            'location' => blank($data['location'] ?? null) ? null : trim($data['location']),
            'description' => blank($data['description'] ?? null) ? null : trim($data['description']),
            'rsvp_count' => $data['rsvpCount'] ?? 0,
            'updated_at' => now(),
        ]);

        return back()->with('status', 'Begivenheden er gemt.');
    }

    public function destroyEvent(string $class, string $event): RedirectResponse
    {
        $this->authorizeClassRole($class, ['owner', 'moderator', 'student']);

        $this->eventForClass($class, $event);

        DB::table('events')->where('id', $event)->delete();

        return back()->with('status', 'Begivenheden er slettet.');
    }

    private function classViewModel(string $class): array
    {
        $schoolClass = $this->classQuery()->where('id', $class)->first();
        abort_unless($schoolClass, 404);

        $members = DB::table('members')
            ->where('class_id', $class)
            ->orderByRaw("CASE role WHEN 'owner' THEN 1 WHEN 'moderator' THEN 2 WHEN 'student' THEN 3 ELSE 4 END")
            ->orderBy('display_name')
            ->get();
        $events = DB::table('events')
            ->where('class_id', $class)
            ->orderBy('event_date')
            ->get();
        $contentBlocks = DB::table('class_content_blocks')
            ->where('class_id', $class)
            ->orderByDesc('is_pinned')
            ->orderBy('sort_order')
            ->orderBy('title')
            ->get();

        return [
            'schoolClass' => $schoolClass,
            'members' => $members,
            'events' => $events,
            'contentBlocks' => $contentBlocks,
            'currentMember' => $this->currentMember($class),
            'canManageClass' => $this->hasClassRole($class, array_keys(self::ROLES)),
            'canManageContent' => $this->hasClassRole($class, array_keys(self::ROLES)),
            'stats' => [
                'activeMembers' => $members->where('status', 'active')->count(),
                'pendingMembers' => $members->where('status', 'pending')->count(),
                'removedMembers' => $members->where('status', 'removed')->count(),
                'events' => $events->count(),
                'contentBlocks' => $contentBlocks->count(),
            ],
            'inviteUrl' => url('/').'?invite='.$schoolClass->invite_code,
        ];
    }

    private function manageableClassQuery()
    {
        $userEmail = Str::lower(Auth::user()->email);

        return DB::table('classes')
            ->join('members', 'members.class_id', '=', 'classes.id')
            ->whereRaw('LOWER(members.email) = ?', [$userEmail])
            ->where('members.status', 'active')
            ->whereIn('members.role', ['owner', 'admin', 'moderator', 'student']);
    }

    private function primaryManagedClass(): ?object
    {
        if (! Schema::hasTable('classes') || ! Schema::hasTable('members')) {
            return null;
        }

        return $this->manageableClassQuery()
            ->select([
                'classes.id',
                'classes.public_id',
                'classes.school_name',
                'classes.class_name',
                'classes.graduation_year',
                'classes.created_at',
                'members.role as current_role',
            ])
            ->orderByRaw("CASE members.role WHEN 'owner' THEN 1 WHEN 'moderator' THEN 2 WHEN 'student' THEN 3 ELSE 4 END")
            ->orderByDesc('classes.created_at')
            ->first();
    }

    private function classQuery()
    {
        return DB::table('classes')->select([
            'id',
            'public_id',
            'school_id',
            'school_name',
            'class_name',
            'graduation_year',
            'graduation_date',
            'owner_name',
            'owner_email',
            'invite_code',
            'join_policy',
            'allow_member_posts',
            'require_approval_for_photos',
            'created_at',
            'updated_at',
        ]);
    }

    private function ensureClassExists(string $class): void
    {
        abort_unless(DB::table('classes')->where('id', $class)->exists(), 404);
    }

    private function currentMember(string $class): ?object
    {
        if (! Auth::check()) {
            return null;
        }

        return DB::table('members')
            ->where('class_id', $class)
            ->whereRaw('LOWER(email) = ?', [Str::lower(Auth::user()->email)])
            ->where('status', 'active')
            ->first();
    }

    private function hasClassRole(string $class, array $roles): bool
    {
        $member = $this->currentMember($class);

        return $member && in_array($this->normalizeRole($member->role), array_keys(self::ROLES), true);
    }

    private function authorizeClassRole(string $class, array $roles): object
    {
        $this->ensureClassExists($class);

        $member = $this->currentMember($class);
        abort_unless($member && in_array($this->normalizeRole($member->role), array_keys(self::ROLES), true), 403);

        return $member;
    }

    private function memberForClass(string $class, string $member): object
    {
        $current = DB::table('members')
            ->where('class_id', $class)
            ->where('id', $member)
            ->first();

        abort_unless($current, 404);

        return $current;
    }

    private function contentBlockForClass(string $class, string $block): object
    {
        $contentBlock = DB::table('class_content_blocks')
            ->where('class_id', $class)
            ->where('id', $block)
            ->first();

        abort_unless($contentBlock, 404);

        return $contentBlock;
    }

    private function eventForClass(string $class, string $event): object
    {
        $schoolEvent = DB::table('events')
            ->where('class_id', $class)
            ->where('id', $event)
            ->first();

        abort_unless($schoolEvent, 404);

        return $schoolEvent;
    }

    private function wouldRemoveLastOwner(object $member, string $nextRole, string $nextStatus): bool
    {
        if ($member->role !== 'owner' || $member->status !== 'active') {
            return false;
        }

        if ($nextRole === 'owner' && $nextStatus === 'active') {
            return false;
        }

        return ! DB::table('members')
            ->where('class_id', $member->class_id)
            ->where('id', '!=', $member->id)
            ->where('role', 'owner')
            ->where('status', 'active')
            ->exists();
    }

    private function schoolOptions()
    {
        return DB::table('schools')
            ->select(['id', 'name'])
            ->orderBy('name')
            ->get();
    }

    private function schoolById(string $schoolId): object
    {
        $school = DB::table('schools')->where('id', $schoolId)->first();

        abort_unless($school, 422, 'Vaelg en skole fra listen.');

        return $school;
    }

    private function ensureSchool(string $name): string
    {
        $name = trim($name);
        $key = $this->schoolKey($name);

        if ($key === '') {
            abort(422, 'Skole mangler.');
        }

        $existingSchool = DB::table('schools')->where('name_key', $key)->first();

        if ($existingSchool) {
            if ($existingSchool->name !== $name) {
                DB::table('schools')->where('id', $existingSchool->id)->update([
                    'name' => $name,
                    'updated_at' => now(),
                ]);
            }

            return $existingSchool->id;
        }

        $schoolId = (string) Str::uuid();

        DB::table('schools')->insert([
            'id' => $schoolId,
            'name' => $name,
            'name_key' => $key,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $schoolId;
    }

    private function schoolKey(string $name): string
    {
        return preg_replace('/[^a-z0-9]+/', '-', Str::lower(Str::ascii(trim($name)))) ?? '';
    }

    private function normalizeRole(?string $role): string
    {
        return match ($role) {
            'owner', 'moderator', 'student' => $role,
            'admin' => 'moderator',
            default => 'student',
        };
    }

    private function generateInviteCode(string $graduationYear): string
    {
        $suffix = Str::substr($graduationYear, -2);

        for ($attempt = 0; $attempt < 20; $attempt++) {
            $code = 'STU-'.$suffix.Str::upper(Str::random(4));

            if (! DB::table('classes')->where('invite_code', $code)->exists()) {
                return $code;
            }
        }

        return 'STU-'.Str::upper(Str::random(8));
    }

    private function generatePersonalCode(?string $name): string
    {
        $prefix = Str::limit($this->codePart((string) $name), 8, '') ?: 'STUDOS';

        foreach ($this->shuffledPersonalCodeWords($prefix) as $word) {
            $candidate = $prefix.'-'.$word;

            if (! DB::table('members')->where('personal_code', $candidate)->exists()) {
                return $candidate;
            }
        }

        for ($attempt = 2; $attempt < 100; $attempt++) {
            $candidate = $prefix.'-KAOS'.$attempt;

            if (! DB::table('members')->where('personal_code', $candidate)->exists()) {
                return $candidate;
            }
        }

        return $prefix.'-'.Str::upper(Str::random(4));
    }

    private function shuffledPersonalCodeWords(string $seed): array
    {
        $words = self::PERSONAL_CODE_WORDS;
        $count = count($words);
        $offset = $count ? hexdec(Str::substr(sha1($seed), 0, 2)) % $count : 0;

        return array_merge(array_slice($words, $offset), array_slice($words, 0, $offset));
    }

    private function generateClassPublicId(string $schoolName, string $className, string $graduationYear): string
    {
        $base = $this->baseClassPublicId($schoolName, $className, $graduationYear);

        for ($attempt = 0; $attempt < 20; $attempt++) {
            $suffix = $attempt === 0 ? '' : '-'.($attempt + 1);
            $candidate = Str::limit($base, 32 - strlen($suffix), '').$suffix;

            if (! DB::table('classes')->where('public_id', $candidate)->exists()) {
                return $candidate;
            }
        }

        return 'STU-'.Str::upper(Str::random(8));
    }

    private function baseClassPublicId(string $schoolName, string $className, string $graduationYear): string
    {
        $school = $this->schoolInitials($schoolName);
        $class = $this->codePart($className) ?: 'KLASSE';
        $year = Str::substr($this->codePart($graduationYear), -2) ?: now()->format('y');

        return Str::limit($school.'-'.$class.'-'.$year, 32, '');
    }

    private function schoolInitials(string $schoolName): string
    {
        $words = preg_split('/\s+/', trim($schoolName)) ?: [];
        $initials = collect($words)
            ->map(fn (string $word): string => Str::substr($this->codePart($word), 0, 1))
            ->filter()
            ->take(3)
            ->implode('');

        return $initials ?: Str::substr($this->codePart($schoolName), 0, 3) ?: 'STU';
    }

    private function codePart(string $value): string
    {
        return preg_replace('/[^A-Z0-9]/', '', Str::upper(Str::ascii($value))) ?? '';
    }
}
