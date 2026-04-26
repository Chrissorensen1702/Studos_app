<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StudosController extends Controller
{
    private const PRIVACY_VERSION = '2026-04-26';

    private const ROLES = [
        [
            'id' => 'owner',
            'label' => 'Ejer',
            'description' => 'Kan alt i klassen og kan udpege andre ansvarlige.',
            'permissions' => ['manage_class', 'manage_members', 'manage_events', 'moderate_content'],
        ],
        [
            'id' => 'moderator',
            'label' => 'Moderator',
            'description' => 'Har fuld adgang i klassen, indtil adgangsniveauer bliver defineret.',
            'permissions' => ['manage_class', 'manage_members', 'manage_events', 'moderate_content'],
        ],
        [
            'id' => 'student',
            'label' => 'Elev',
            'description' => 'Har fuld adgang i klassen, indtil adgangsniveauer bliver defineret.',
            'permissions' => ['manage_class', 'manage_members', 'manage_events', 'moderate_content'],
        ],
    ];

    private const STATUSES = [
        [
            'id' => 'pending',
            'label' => 'Afventer',
            'description' => 'Medlemmet er inviteret eller venter paa godkendelse.',
        ],
        [
            'id' => 'active',
            'label' => 'Aktiv',
            'description' => 'Medlemmet har adgang til klassen.',
        ],
        [
            'id' => 'removed',
            'label' => 'Fjernet',
            'description' => 'Medlemmet er fjernet fra klassen.',
        ],
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

    public function health(): JsonResponse
    {
        DB::select('SELECT 1');

        return response()->json([
            'ok' => true,
            'service' => 'studos-laravel',
            'database' => config('database.connections.mysql.database'),
        ]);
    }

    public function roles(): JsonResponse
    {
        return response()->json([
            'roles' => self::ROLES,
            'statuses' => self::STATUSES,
        ]);
    }

    public function classes(): JsonResponse
    {
        return response()->json([
            'classes' => $this->hydrateClasses($this->classQuery()->orderByDesc('created_at')->get()),
        ]);
    }

    public function schools(): JsonResponse
    {
        return response()->json([
            'schools' => $this->schoolOptions(),
        ]);
    }

    public function storeClass(Request $request): JsonResponse
    {
        $data = $request->validate([
            'schoolId' => ['nullable', 'string', 'max:36'],
            'schoolName' => ['nullable', 'string', 'max:190'],
            'className' => ['required', 'string', 'max:100'],
            'graduationYear' => ['nullable', 'string', 'max:4'],
            'graduationDate' => ['nullable', 'date'],
            'ownerName' => ['required', 'string', 'max:190'],
            'ownerEmail' => ['required', 'email', 'max:190'],
            'joinPolicy' => ['nullable', Rule::in(['open', 'approval', 'closed'])],
        ]);

        [$schoolId, $schoolName] = $this->resolveSchoolForClass($data);
        $classId = (string) Str::uuid();
        $ownerId = (string) Str::uuid();
        $now = now()->format('Y-m-d H:i:s');
        $graduationDate = blank($data['graduationDate'] ?? null) ? null : $data['graduationDate'];
        $ownerName = trim($data['ownerName']);
        $ownerParts = preg_split('/\s+/', $ownerName, 2) ?: [];
        $publicId = $this->generateClassPublicId(
            $schoolName,
            $data['className'],
            $data['graduationYear'] ?? (string) now()->year,
        );

        DB::transaction(function () use ($data, $schoolId, $schoolName, $ownerName, $ownerParts, $classId, $ownerId, $now, $graduationDate, $publicId): void {
            DB::table('classes')->insert([
                'id' => $classId,
                'public_id' => $publicId,
                'school_id' => $schoolId,
                'school_name' => $schoolName,
                'class_name' => trim($data['className']),
                'graduation_year' => trim($data['graduationYear'] ?? (string) now()->year),
                'graduation_date' => $graduationDate,
                'owner_name' => $ownerName,
                'owner_email' => Str::lower(trim($data['ownerEmail'])),
                'invite_code' => $this->generateInviteCode($data['graduationYear'] ?? null),
                'join_policy' => $data['joinPolicy'] ?? 'approval',
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
                'display_name' => $ownerName,
                'first_name' => $ownerParts[0] ?? null,
                'last_name' => $ownerParts[1] ?? null,
                'email' => Str::lower(trim($data['ownerEmail'])),
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

        return response()->json([
            'class' => $this->loadClassById($classId),
        ], 201);
    }

    public function classByInvite(Request $request, string $code): JsonResponse
    {
        $schoolClass = $this->classQuery()
            ->where('invite_code', Str::upper(trim($code)))
            ->first();

        abort_unless($schoolClass, 404);

        return response()->json([
            'class' => $this->hydrateClasses(
                collect([$schoolClass]),
                $request->string('memberId')->toString() ?: null,
            )[0],
            'schools' => $this->schoolOptions(),
        ]);
    }

    public function classByPublicId(string $classId): JsonResponse
    {
        $schoolClass = DB::table('classes')
            ->select([
                'id',
                'public_id as classId',
                'school_id as schoolId',
                'school_name as schoolName',
                'class_name as className',
                'graduation_year as graduationYear',
                'created_at as createdAt',
            ])
            ->where('public_id', Str::upper(trim($classId)))
            ->first();

        abort_unless($schoolClass, 404);

        $activeMembers = DB::table('members')
            ->where('class_id', $schoolClass->id)
            ->where('status', 'active')
            ->count();

        return response()->json([
            'class' => [
                'classId' => $schoolClass->classId,
                'schoolId' => $schoolClass->schoolId,
                'schoolName' => $schoolClass->schoolName,
                'className' => $schoolClass->className,
                'graduationYear' => $schoolClass->graduationYear,
                'activeMembers' => $activeMembers,
                'createdAt' => $this->apiDateTime($schoolClass->createdAt),
            ],
        ]);
    }

    public function memberByPersonalCode(string $code): JsonResponse
    {
        $member = DB::table('members')
            ->join('classes', 'classes.id', '=', 'members.class_id')
            ->select([
                'members.id',
                'members.display_name as displayName',
                'members.first_name as firstName',
                'members.profile_photo_url as profilePhotoUrl',
                'classes.public_id as classId',
                'classes.school_name as schoolName',
                'classes.class_name as className',
                'classes.graduation_year as graduationYear',
            ])
            ->where('members.personal_code', Str::upper(trim($code)))
            ->where('members.status', 'active')
            ->first();

        abort_unless($member, 404);

        return response()->json([
            'member' => [
                'id' => $member->id,
                'displayName' => $member->displayName,
                'firstName' => $member->firstName,
                'profilePhotoUrl' => $member->profilePhotoUrl,
                'class' => [
                    'classId' => $member->classId,
                    'schoolName' => $member->schoolName,
                    'className' => $member->className,
                    'graduationYear' => $member->graduationYear,
                ],
            ],
        ]);
    }

    public function connectionsForMember(string $member): JsonResponse
    {
        $viewer = DB::table('members')
            ->where('id', $member)
            ->where('status', 'active')
            ->first();

        abort_unless($viewer, 404);

        $connections = DB::table('member_connections')
            ->where('requester_member_id', $member)
            ->orWhere('receiver_member_id', $member)
            ->orderByRaw("CASE status WHEN 'pending' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END")
            ->orderByDesc('created_at')
            ->get();

        $otherMemberIds = $connections
            ->flatMap(fn (object $connection): array => [
                $connection->requester_member_id,
                $connection->receiver_member_id,
            ])
            ->reject(fn (string $memberId): bool => $memberId === $member)
            ->unique()
            ->values();

        $memberPreviews = $this->memberPreviews($otherMemberIds);

        return response()->json([
            'connections' => $connections
                ->map(fn (object $connection): array => $this->serializeConnection($connection, $member, $memberPreviews))
                ->values()
                ->all(),
        ]);
    }

    public function requestConnection(Request $request): JsonResponse
    {
        $data = $request->validate([
            'requesterMemberId' => ['required', 'string', 'max:36'],
            'personalCode' => ['required', 'string', 'max:32'],
        ]);

        $requester = DB::table('members')
            ->where('id', $data['requesterMemberId'])
            ->where('status', 'active')
            ->first();
        $receiver = DB::table('members')
            ->where('personal_code', Str::upper(trim($data['personalCode'])))
            ->where('status', 'active')
            ->first();

        abort_unless($requester && $receiver, 404, 'Studos-koden findes ikke.');
        abort_if($requester->id === $receiver->id, 422, 'Du kan ikke connecte med dig selv.');

        $pairKey = $this->memberConnectionPairKey($requester->id, $receiver->id);
        $now = now()->format('Y-m-d H:i:s');
        $connection = DB::table('member_connections')->where('pair_key', $pairKey)->first();
        $statusCode = 200;

        if ($connection) {
            if ($connection->status === 'pending' && $connection->receiver_member_id === $requester->id) {
                DB::table('member_connections')->where('id', $connection->id)->update([
                    'status' => 'accepted',
                    'responded_at' => $now,
                    'updated_at' => $now,
                ]);
            } elseif ($connection->status === 'rejected') {
                DB::table('member_connections')->where('id', $connection->id)->update([
                    'requester_member_id' => $requester->id,
                    'receiver_member_id' => $receiver->id,
                    'status' => 'pending',
                    'responded_at' => null,
                    'updated_at' => $now,
                ]);
                $statusCode = 201;
            }

            $connection = DB::table('member_connections')->where('id', $connection->id)->first();
        } else {
            $connectionId = (string) Str::uuid();
            DB::table('member_connections')->insert([
                'id' => $connectionId,
                'pair_key' => $pairKey,
                'requester_member_id' => $requester->id,
                'receiver_member_id' => $receiver->id,
                'status' => 'pending',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $connection = DB::table('member_connections')->where('id', $connectionId)->first();
            $statusCode = 201;
        }

        $memberPreviews = $this->memberPreviews(collect([$requester->id, $receiver->id]));

        return response()->json([
            'connection' => $this->serializeConnection($connection, $requester->id, $memberPreviews),
        ], $statusCode);
    }

    public function respondToConnection(Request $request, string $connection): JsonResponse
    {
        $data = $request->validate([
            'memberId' => ['required', 'string', 'max:36'],
            'status' => ['required', Rule::in(['accepted', 'rejected'])],
        ]);

        $current = DB::table('member_connections')->where('id', $connection)->first();

        abort_unless($current, 404);
        abort_if($current->receiver_member_id !== $data['memberId'], 403, 'Kun modtageren kan svare paa requesten.');
        abort_if($current->status !== 'pending', 422, 'Requesten er allerede besvaret.');

        DB::table('member_connections')->where('id', $connection)->update([
            'status' => $data['status'],
            'responded_at' => now(),
            'updated_at' => now(),
        ]);

        $updatedConnection = DB::table('member_connections')->where('id', $connection)->first();
        $memberPreviews = $this->memberPreviews(collect([
            $updatedConnection->requester_member_id,
            $updatedConnection->receiver_member_id,
        ]));

        return response()->json([
            'connection' => $this->serializeConnection($updatedConnection, $data['memberId'], $memberPreviews),
        ]);
    }

    public function joinClass(Request $request): JsonResponse
    {
        $data = $request->validate([
            'inviteCode' => ['required', 'string', 'max:32'],
            'schoolId' => ['required', 'string', 'max:36'],
            'firstName' => ['required', 'string', 'max:100'],
            'lastName' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'birthday' => ['required', 'date'],
            'profilePhotoUrl' => ['nullable', 'string', 'max:2000'],
            'password' => ['required', 'string', 'min:8'],
            'passwordConfirmation' => ['required', 'same:password'],
            'termsAccepted' => ['accepted'],
            'privacyAccepted' => ['accepted'],
        ]);

        $inviteCode = Str::upper(trim($data['inviteCode']));
        $schoolId = trim($data['schoolId']);
        $firstName = trim($data['firstName']);
        $lastName = trim($data['lastName']);
        $displayName = trim($firstName.' '.$lastName);
        $email = Str::lower(trim($data['email']));
        $classId = null;
        $member = null;

        DB::transaction(function () use ($data, $inviteCode, $schoolId, $firstName, $lastName, $displayName, $email, &$classId, &$member): void {
            $schoolClass = DB::table('classes')
                ->where('invite_code', $inviteCode)
                ->first();
            $selectedSchool = DB::table('schools')->where('id', $schoolId)->first();

            abort_unless($schoolClass, 404);
            abort_unless($selectedSchool, 422, 'Vaelg en skole fra listen.');
            abort_if(($schoolClass->join_policy ?? 'approval') === 'closed', 403, 'Klassen er lukket for nye medlemmer.');

            $classSchoolId = $schoolClass->school_id ?: $this->ensureSchool(trim($schoolClass->school_name));

            if (blank($schoolClass->school_id)) {
                DB::table('classes')->where('id', $schoolClass->id)->update([
                    'school_id' => $classSchoolId,
                    'updated_at' => now(),
                ]);
            }

            abort_if(
                $selectedSchool->id !== $classSchoolId,
                422,
                'Du kan kun joine med den skole, klassen er oprettet paa.',
            );

            $classId = $schoolClass->id;
            $status = ($schoolClass->join_policy ?? 'approval') === 'open' ? 'active' : 'pending';
            $phone = blank($data['phone'] ?? null) ? null : trim($data['phone']);
            $profilePhotoUrl = blank($data['profilePhotoUrl'] ?? null) ? null : trim($data['profilePhotoUrl']);
            $acceptedAt = now()->format('Y-m-d H:i:s');
            $existingMember = DB::table('members')
                ->where('class_id', $classId)
                ->whereRaw('LOWER(email) = ?', [$email])
                ->first();

            if ($existingMember) {
                if (($existingMember->status ?? 'active') !== 'removed') {
                    abort(422, 'Emailen findes allerede i klassen. Log ind paa den eksisterende profil.');
                }

                $updates = [
                    'display_name' => $displayName,
                    'personal_code' => blank($existingMember->personal_code ?? null)
                        ? $this->generatePersonalCode($firstName)
                        : $existingMember->personal_code,
                    'school_id' => $classSchoolId,
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'email' => $email,
                    'phone' => $phone,
                    'birthday' => $data['birthday'],
                    'profile_photo_url' => $profilePhotoUrl,
                    'password_hash' => Hash::make($data['password']),
                    'terms_accepted_at' => $acceptedAt,
                    'privacy_accepted_at' => $acceptedAt,
                    'privacy_version' => self::PRIVACY_VERSION,
                    'deletion_requested_at' => null,
                    'deleted_at' => null,
                    'role' => 'student',
                    'status' => $status,
                ];

                DB::table('members')->where('id', $existingMember->id)->update($updates);

                $member = $this->serializeMember(DB::table('members')->where('id', $existingMember->id)->first(), true);

                return;
            }

            $displayNameTaken = DB::table('members')
                ->where('class_id', $classId)
                ->whereRaw('LOWER(display_name) = ?', [Str::lower($displayName)])
                ->exists();

            if ($displayNameTaken) {
                abort(422, 'Der findes allerede et medlem med det navn. Brug evt. mellemnavn eller initial.');
            }

            $memberId = (string) Str::uuid();
            $joinedAt = now()->format('Y-m-d H:i:s');

            DB::table('members')->insert([
                'id' => $memberId,
                'personal_code' => $this->generatePersonalCode($firstName),
                'class_id' => $classId,
                'school_id' => $classSchoolId,
                'display_name' => $displayName,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $email,
                'phone' => $phone,
                'birthday' => $data['birthday'],
                'profile_photo_url' => $profilePhotoUrl,
                'password_hash' => Hash::make($data['password']),
                'terms_accepted_at' => $acceptedAt,
                'privacy_accepted_at' => $acceptedAt,
                'privacy_version' => self::PRIVACY_VERSION,
                'role' => 'student',
                'status' => $status,
                'joined_at' => $joinedAt,
            ]);

            $member = $this->serializeMember(DB::table('members')->where('id', $memberId)->first(), true);
        });

        return response()->json([
            'session' => $this->sessionForMember($member),
            'class' => $this->loadClassById($classId),
        ]);
    }

    public function loginWithPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'inviteCode' => ['required', 'string', 'max:32'],
            'email' => ['required', 'email', 'max:190'],
            'password' => ['required', 'string'],
        ]);

        $inviteCode = Str::upper(trim($data['inviteCode']));
        $email = Str::lower(trim($data['email']));
        $schoolClass = DB::table('classes')->where('invite_code', $inviteCode)->first();

        abort_unless($schoolClass, 404);

        $member = DB::table('members')
            ->where('class_id', $schoolClass->id)
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('status', '!=', 'removed')
            ->first();

        abort_if(
            ! $member || blank($member->password_hash ?? null) || ! Hash::check($data['password'], $member->password_hash),
            422,
            'Email eller adgangskode er forkert.',
        );

        return response()->json([
            'session' => $this->sessionForMember($this->serializeMember($member, true)),
            'class' => $this->loadClassById($schoolClass->id),
        ]);
    }

    public function requestLoginCode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'inviteCode' => ['required', 'string', 'max:32'],
            'email' => ['required', 'email', 'max:190'],
        ]);

        $inviteCode = Str::upper(trim($data['inviteCode']));
        $email = Str::lower(trim($data['email']));
        $schoolClass = DB::table('classes')->where('invite_code', $inviteCode)->first();

        abort_unless($schoolClass, 404);

        $member = DB::table('members')
            ->where('class_id', $schoolClass->id)
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('status', '!=', 'removed')
            ->first();

        abort_unless($member, 404);

        $code = app()->environment(['local', 'testing'])
            ? '123456'
            : (string) random_int(100000, 999999);

        Cache::put($this->loginCodeCacheKey($schoolClass->id, $email), [
            'code' => $code,
            'memberId' => $member->id,
        ], now()->addMinutes(10));

        $response = [
            'ok' => true,
            'message' => 'Engangskoden er sendt til din email.',
        ];

        if (app()->environment(['local', 'testing'])) {
            $response['debugCode'] = $code;
        }

        return response()->json($response);
    }

    public function verifyLoginCode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'inviteCode' => ['required', 'string', 'max:32'],
            'email' => ['required', 'email', 'max:190'],
            'code' => ['required', 'digits:6'],
        ]);

        $inviteCode = Str::upper(trim($data['inviteCode']));
        $email = Str::lower(trim($data['email']));
        $schoolClass = DB::table('classes')->where('invite_code', $inviteCode)->first();

        abort_unless($schoolClass, 404);

        $cacheKey = $this->loginCodeCacheKey($schoolClass->id, $email);
        $loginCode = Cache::get($cacheKey);

        abort_if(! $loginCode || ! hash_equals($loginCode['code'], $data['code']), 422, 'Koden er forkert eller udlobet.');

        $member = DB::table('members')
            ->where('class_id', $schoolClass->id)
            ->where('id', $loginCode['memberId'])
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('status', '!=', 'removed')
            ->first();

        abort_unless($member, 404);

        Cache::forget($cacheKey);

        return response()->json([
            'session' => $this->sessionForMember($this->serializeMember($member, true)),
            'class' => $this->loadClassById($schoolClass->id),
        ]);
    }

    public function updateMemberAccess(Request $request, string $class, string $member): JsonResponse
    {
        $data = $request->validate([
            'role' => ['nullable', 'string', Rule::in($this->roleIds())],
            'status' => ['nullable', 'string', Rule::in($this->statusIds())],
        ]);

        if (! array_key_exists('role', $data) && ! array_key_exists('status', $data)) {
            abort(422, 'Rolle eller status mangler.');
        }

        $updatedMember = null;

        DB::transaction(function () use ($class, $member, $data, &$updatedMember): void {
            $current = DB::table('members')
                ->where('class_id', $class)
                ->where('id', $member)
                ->first();

            abort_unless($current, 404);

            $currentMember = $this->serializeMember($current);
            $nextRole = $data['role'] ?? $currentMember['role'];
            $nextStatus = $data['status'] ?? $currentMember['status'];
            $demotesLastOwner = $currentMember['role'] === 'owner'
                && $currentMember['status'] === 'active'
                && ($nextRole !== 'owner' || $nextStatus !== 'active')
                && ! $this->hasOtherActiveOwner($class, $member);

            if ($demotesLastOwner) {
                abort(422, 'Klassen skal have mindst en aktiv ejer.');
            }

            DB::table('members')->where('id', $member)->update([
                'role' => $nextRole,
                'status' => $nextStatus,
            ]);

            $updatedMember = [
                ...$currentMember,
                'role' => $nextRole,
                'status' => $nextStatus,
            ];
        });

        return response()->json([
            'member' => $updatedMember,
            'class' => $this->loadClassById($class),
        ]);
    }

    private function schoolOptions(): array
    {
        if (! Schema::hasTable('schools')) {
            return [];
        }

        return DB::table('schools')
            ->select(['id', 'name'])
            ->orderBy('name')
            ->get()
            ->map(fn (object $school): array => [
                'id' => $school->id,
                'name' => $school->name,
            ])
            ->values()
            ->all();
    }

    private function resolveSchoolForClass(array $data): array
    {
        if (! blank($data['schoolId'] ?? null)) {
            $school = DB::table('schools')->where('id', trim($data['schoolId']))->first();

            abort_unless($school, 422, 'Vaelg en skole fra listen.');

            return [$school->id, $school->name];
        }

        if (blank($data['schoolName'] ?? null)) {
            abort(422, 'Skole mangler.');
        }

        $schoolName = trim($data['schoolName']);

        return [$this->ensureSchool($schoolName), $schoolName];
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

    private function classQuery()
    {
        return DB::table('classes')->select([
            'id',
            'public_id as classId',
            'school_id as schoolId',
            'school_name as schoolName',
            'class_name as className',
            'graduation_year as graduationYear',
            'graduation_date as graduationDate',
            'owner_name as ownerName',
            'owner_email as ownerEmail',
            'invite_code as inviteCode',
            'join_policy as joinPolicy',
            'allow_member_posts as allowMemberPosts',
            'require_approval_for_photos as requireApprovalForPhotos',
            'created_at as createdAt',
            'updated_at as updatedAt',
        ]);
    }

    private function hydrateClasses($classRows, ?string $personalCodeMemberId = null): array
    {
        if ($classRows->isEmpty()) {
            return [];
        }

        $classIds = $classRows->pluck('id');
        $members = DB::table('members')
            ->whereIn('class_id', $classIds)
            ->orderBy('joined_at')
            ->get()
            ->groupBy('class_id');
        $events = DB::table('events')
            ->whereIn('class_id', $classIds)
            ->orderBy('event_date')
            ->get()
            ->groupBy('class_id');
        $contentBlocks = Schema::hasTable('class_content_blocks')
            ? DB::table('class_content_blocks')
                ->whereIn('class_id', $classIds)
                ->orderByDesc('is_pinned')
                ->orderBy('sort_order')
                ->get()
                ->groupBy('class_id')
            : collect();

        return $classRows
            ->map(fn ($schoolClass) => $this->serializeClass(
                $schoolClass,
                $members->get($schoolClass->id, collect()),
                $events->get($schoolClass->id, collect()),
                $contentBlocks->get($schoolClass->id, collect()),
                $personalCodeMemberId,
            ))
            ->values()
            ->all();
    }

    private function loadClassById(string $classId): array
    {
        $schoolClass = $this->classQuery()->where('id', $classId)->first();

        abort_unless($schoolClass, 404);

        return $this->hydrateClasses(collect([$schoolClass]))[0];
    }

    private function serializeClass(object $schoolClass, $members, $events, $contentBlocks, ?string $personalCodeMemberId = null): array
    {
        $serializedMembers = $members
            ->map(fn ($member) => $this->serializeMember($member, $member->id === $personalCodeMemberId))
            ->values();

        return [
            'id' => $schoolClass->id,
            'classId' => $schoolClass->classId,
            'schoolId' => $schoolClass->schoolId,
            'schoolName' => $schoolClass->schoolName,
            'className' => $schoolClass->className,
            'graduationYear' => $schoolClass->graduationYear,
            'graduationDate' => $this->apiDate($schoolClass->graduationDate),
            'ownerName' => $schoolClass->ownerName,
            'ownerEmail' => $schoolClass->ownerEmail,
            'inviteCode' => $schoolClass->inviteCode,
            'createdAt' => $this->apiDateTime($schoolClass->createdAt),
            'updatedAt' => $this->apiDateTime($schoolClass->updatedAt ?? null),
            'settings' => [
                'joinPolicy' => $schoolClass->joinPolicy ?? 'approval',
                'allowMemberPosts' => (bool) $schoolClass->allowMemberPosts,
                'requireApprovalForPhotos' => (bool) $schoolClass->requireApprovalForPhotos,
            ],
            'members' => $serializedMembers->all(),
            'memberSummary' => $this->memberSummary($serializedMembers),
            'events' => $events->map(fn ($event) => [
                'id' => $event->id,
                'title' => $event->title,
                'date' => $this->apiDate($event->event_date),
                'location' => $event->location ?? '',
                'description' => $event->description ?? '',
                'rsvpCount' => (int) $event->rsvp_count,
            ])->values()->all(),
            'contentBlocks' => $contentBlocks->map(fn ($block) => [
                'id' => $block->id,
                'type' => $block->type,
                'title' => $block->title,
                'body' => $block->body,
                'isPinned' => (bool) $block->is_pinned,
                'sortOrder' => (int) $block->sort_order,
                'updatedAt' => $this->apiDateTime($block->updated_at ?? null),
            ])->values()->all(),
        ];
    }

    private function serializeMember(object $member, bool $includePersonalCode = false): array
    {
        $firstName = $member->first_name ?? null;
        $lastName = $member->last_name ?? null;

        $serialized = [
            'id' => $member->id,
            'schoolId' => $member->school_id ?? null,
            'displayName' => $member->display_name,
            'firstName' => $firstName,
            'lastName' => $lastName,
            'email' => $member->email,
            'phone' => $member->phone ?? null,
            'birthday' => $this->apiDate($member->birthday ?? null),
            'profilePhotoUrl' => $member->profile_photo_url ?? null,
            'role' => $this->normalizeRole($member->role),
            'status' => $this->normalizeStatus($member->status ?? 'active'),
            'joinedAt' => $this->apiDateTime($member->joined_at),
        ];

        if ($includePersonalCode) {
            $serialized['personalCode'] = $member->personal_code ?? null;
        }

        return $serialized;
    }

    private function sessionForMember(array $member): array
    {
        return [
            'token' => 'demo-'.$member['id'],
            'member' => $member,
        ];
    }

    private function memberPreviews($memberIds)
    {
        $ids = collect($memberIds)->filter()->unique()->values();

        if ($ids->isEmpty()) {
            return collect();
        }

        return DB::table('members')
            ->join('classes', 'classes.id', '=', 'members.class_id')
            ->select([
                'members.id',
                'members.display_name as displayName',
                'members.first_name as firstName',
                'members.profile_photo_url as profilePhotoUrl',
                'classes.public_id as classId',
                'classes.school_name as schoolName',
                'classes.class_name as className',
                'classes.graduation_year as graduationYear',
            ])
            ->whereIn('members.id', $ids)
            ->get()
            ->keyBy('id');
    }

    private function serializeConnection(object $connection, string $viewerMemberId, $memberPreviews): array
    {
        $otherMemberId = $connection->requester_member_id === $viewerMemberId
            ? $connection->receiver_member_id
            : $connection->requester_member_id;
        $otherMember = $memberPreviews->get($otherMemberId);

        return [
            'id' => $connection->id,
            'status' => $connection->status,
            'direction' => $connection->requester_member_id === $viewerMemberId ? 'outgoing' : 'incoming',
            'createdAt' => $this->apiDateTime($connection->created_at),
            'updatedAt' => $this->apiDateTime($connection->updated_at ?? null),
            'respondedAt' => $this->apiDateTime($connection->responded_at ?? null),
            'otherMember' => $otherMember ? [
                'id' => $otherMember->id,
                'displayName' => $otherMember->displayName,
                'firstName' => $otherMember->firstName,
                'profilePhotoUrl' => $otherMember->profilePhotoUrl,
                'class' => [
                    'classId' => $otherMember->classId,
                    'schoolName' => $otherMember->schoolName,
                    'className' => $otherMember->className,
                    'graduationYear' => $otherMember->graduationYear,
                ],
            ] : null,
        ];
    }

    private function loginCodeCacheKey(string $classId, string $email): string
    {
        return 'studos-login-code:'.$classId.':'.sha1($email);
    }

    private function memberSummary($members): array
    {
        $roleCounts = array_fill_keys($this->roleIds(), 0);
        $statusCounts = array_fill_keys($this->statusIds(), 0);

        foreach ($members as $member) {
            $roleCounts[$member['role']] = ($roleCounts[$member['role']] ?? 0) + 1;
            $statusCounts[$member['status']] = ($statusCounts[$member['status']] ?? 0) + 1;
        }

        return compact('roleCounts', 'statusCounts');
    }

    private function generateInviteCode(?string $graduationYear): string
    {
        $suffix = Str::substr((string) $graduationYear, -2) ?: '26';

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

    private function memberConnectionPairKey(string $firstMemberId, string $secondMemberId): string
    {
        return collect([$firstMemberId, $secondMemberId])->sort()->values()->implode(':');
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

    private function hasOtherActiveOwner(string $classId, string $memberId): bool
    {
        return DB::table('members')
            ->where('class_id', $classId)
            ->where('id', '!=', $memberId)
            ->where('role', 'owner')
            ->where('status', 'active')
            ->exists();
    }

    private function roleIds(): array
    {
        return array_column(self::ROLES, 'id');
    }

    private function statusIds(): array
    {
        return array_column(self::STATUSES, 'id');
    }

    private function normalizeRole(?string $role): string
    {
        return match ($role) {
            'owner', 'moderator', 'student' => $role,
            'admin' => 'moderator',
            default => 'student',
        };
    }

    private function normalizeStatus(?string $status): string
    {
        return in_array($status, $this->statusIds(), true) ? $status : 'active';
    }

    private function apiDate(mixed $value): string
    {
        return blank($value) ? '' : Str::substr((string) $value, 0, 10);
    }

    private function apiDateTime(mixed $value): string
    {
        if (blank($value)) {
            return '';
        }

        $text = (string) $value;

        return str_contains($text, 'T') ? $text : str_replace(' ', 'T', $text).'.000Z';
    }
}
