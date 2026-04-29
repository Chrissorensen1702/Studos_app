<?php

namespace App\Http\Controllers;

use App\Support\ContentModeration;
use App\Support\UploadedImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StudosController extends Controller
{
    private const PRIVACY_VERSION = '2026-04-26';

    private const EVENT_COVER_TEMPLATE_IDS = [
        'sunset',
        'cap',
        'night',
        'garden',
        'gold',
    ];

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
        $className = ContentModeration::cleanText($data['className'], 'className', 'Klassenavnet', [
            'source' => 'class_create',
            'member_id' => $ownerId,
            'class_id' => $classId,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
        $ownerName = ContentModeration::cleanName($data['ownerName'], 'ownerName', 'Navnet', [
            'source' => 'class_owner_name',
            'member_id' => $ownerId,
            'class_id' => $classId,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
        $ownerParts = preg_split('/\s+/', $ownerName, 2) ?: [];
        $publicId = $this->generateClassPublicId(
            $schoolName,
            $className,
            $data['graduationYear'] ?? (string) now()->year,
        );

        DB::transaction(function () use ($data, $schoolId, $schoolName, $className, $ownerName, $ownerParts, $classId, $ownerId, $now, $graduationDate, $publicId): void {
            DB::table('classes')->insert([
                'id' => $classId,
                'public_id' => $publicId,
                'school_id' => $schoolId,
                'school_name' => $schoolName,
                'class_name' => $className,
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

        abort_unless($schoolClass, 404, 'Invitekoden kunne ikke findes.');

        $currentMember = $this->authenticatedMemberFromRequest($request, false, false);
        $currentMemberId = $currentMember?->class_id === $schoolClass->id ? $currentMember->id : null;

        return response()->json([
            'class' => $this->hydrateClasses(
                collect([$schoolClass]),
                $currentMemberId,
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
                'profilePhotoUrl' => UploadedImage::publicUrl($member->profilePhotoUrl),
                'class' => [
                    'classId' => $member->classId,
                    'schoolName' => $member->schoolName,
                    'className' => $member->className,
                    'graduationYear' => $member->graduationYear,
                ],
            ],
        ]);
    }

    public function connectionsForMember(Request $request, string $member): JsonResponse
    {
        $viewer = $this->authenticatedMemberFromRequest($request);

        abort_if($viewer->id !== $member, 403, 'Du kan kun hente dine egne connections.');

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
            'personalCode' => ['required', 'string', 'max:32'],
        ]);

        $requester = $this->authenticatedMemberFromRequest($request);
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
            'status' => ['required', Rule::in(['accepted', 'rejected'])],
        ]);
        $member = $this->authenticatedMemberFromRequest($request);

        $current = DB::table('member_connections')->where('id', $connection)->first();

        abort_unless($current, 404);
        abort_if($current->receiver_member_id !== $member->id, 403, 'Kun modtageren kan svare paa requesten.');
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
            'connection' => $this->serializeConnection($updatedConnection, $member->id, $memberPreviews),
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
            'profilePhotoData' => ['nullable', 'string', 'max:7000000'],
            'password' => ['required', 'string', 'min:8'],
            'passwordConfirmation' => ['required', 'same:password'],
            'termsAccepted' => ['accepted'],
            'privacyAccepted' => ['accepted'],
        ]);

        $inviteCode = Str::upper(trim($data['inviteCode']));
        $schoolId = trim($data['schoolId']);
        $firstName = ContentModeration::cleanName($data['firstName'], 'firstName', 'Fornavnet', [
            'source' => 'member_signup_name',
            'invite_code' => $inviteCode,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
        $lastName = ContentModeration::cleanName($data['lastName'], 'lastName', 'Efternavnet', [
            'source' => 'member_signup_name',
            'invite_code' => $inviteCode,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
        $displayName = trim($firstName.' '.$lastName);
        $email = Str::lower(trim($data['email']));
        $classId = null;
        $member = null;

        DB::transaction(function () use ($request, $data, $inviteCode, $schoolId, $firstName, $lastName, $displayName, $email, &$classId, &$member): void {
            $schoolClass = DB::table('classes')
                ->where('invite_code', $inviteCode)
                ->first();
            $selectedSchool = DB::table('schools')->where('id', $schoolId)->first();

            abort_unless($schoolClass, 404, 'Invitekoden kunne ikke findes.');
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
            $acceptedAt = now()->format('Y-m-d H:i:s');
            $existingMember = DB::table('members')
                ->where('class_id', $classId)
                ->whereRaw('LOWER(email) = ?', [$email])
                ->first();

            if ($existingMember) {
                if (($existingMember->status ?? 'active') !== 'removed') {
                    abort(422, 'Emailen findes allerede i klassen. Log ind paa den eksisterende profil.');
                }

                $profilePhotoPath = $this->profilePhotoPathForSignup($data, $existingMember->id);
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
                    'profile_photo_url' => $profilePhotoPath,
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

                $member = $this->serializeMember(DB::table('members')->where('id', $existingMember->id)->first(), true, true);

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
            $profilePhotoPath = $this->profilePhotoPathForSignup($data, $memberId);
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
                'profile_photo_url' => $profilePhotoPath,
                'password_hash' => Hash::make($data['password']),
                'terms_accepted_at' => $acceptedAt,
                'privacy_accepted_at' => $acceptedAt,
                'privacy_version' => self::PRIVACY_VERSION,
                'role' => 'student',
                'status' => $status,
                'joined_at' => $joinedAt,
            ]);

            $member = $this->serializeMember(DB::table('members')->where('id', $memberId)->first(), true, true);
        });

        return response()->json([
            'session' => $this->sessionForMember($member, $this->issueMemberToken($member['id'])),
            'class' => $this->loadClassById($classId, $member['id']),
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

        abort_unless($schoolClass, 404, 'Invitekoden kunne ikke findes.');

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

        $serializedMember = $this->serializeMember($member, true, true);

        return response()->json([
            'session' => $this->sessionForMember($serializedMember, $this->issueMemberToken($serializedMember['id'])),
            'class' => $this->loadClassById($schoolClass->id, $serializedMember['id']),
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

        $serializedMember = $this->serializeMember($member, true, true);

        return response()->json([
            'session' => $this->sessionForMember($serializedMember, $this->issueMemberToken($serializedMember['id'])),
            'class' => $this->loadClassById($schoolClass->id, $serializedMember['id']),
        ]);
    }

    public function sessionMe(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request, true, false);
        $serializedMember = $this->serializeMember($member, true, true);

        return response()->json([
            'session' => [
                'tokenType' => 'Bearer',
                'expiresAt' => $this->apiDateTime($member->authTokenExpiresAt ?? null),
                'member' => $serializedMember,
            ],
            'class' => $this->loadClassById($member->class_id, $member->id),
        ]);
    }

    public function registerPushToken(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'expoPushToken' => ['required', 'string', 'max:255'],
            'platform' => ['required', Rule::in(['android'])],
            'deviceName' => ['nullable', 'string', 'max:190'],
            'projectId' => ['nullable', 'string', 'max:190'],
            'appVariant' => ['nullable', 'string', 'max:64'],
            'nativeApplicationVersion' => ['nullable', 'string', 'max:64'],
            'nativeBuildVersion' => ['nullable', 'string', 'max:64'],
        ]);

        abort_unless(
            Str::startsWith($data['expoPushToken'], ['ExpoPushToken[', 'ExponentPushToken[']),
            422,
            'Expo push token er ugyldig.'
        );

        $now = now()->format('Y-m-d H:i:s');
        $existingToken = DB::table('member_push_tokens')
            ->where('expo_push_token', $data['expoPushToken'])
            ->first();
        $values = [
            'member_id' => $member->id,
            'expo_push_token' => $data['expoPushToken'],
            'platform' => $data['platform'],
            'device_name' => $data['deviceName'] ?? null,
            'project_id' => $data['projectId'] ?? null,
            'app_variant' => $data['appVariant'] ?? null,
            'native_application_version' => $data['nativeApplicationVersion'] ?? null,
            'native_build_version' => $data['nativeBuildVersion'] ?? null,
            'last_registered_at' => $now,
            'disabled_at' => null,
            'updated_at' => $now,
        ];

        if ($existingToken) {
            DB::table('member_push_tokens')->where('id', $existingToken->id)->update($values);
            $tokenId = $existingToken->id;
        } else {
            $tokenId = (string) Str::uuid();

            DB::table('member_push_tokens')->insert([
                'id' => $tokenId,
                ...$values,
                'created_at' => $now,
            ]);
        }

        return response()->json([
            'ok' => true,
            'pushTokenId' => $tokenId,
            'registeredAt' => $this->apiDateTime($now),
        ]);
    }

    public function sendTestNotification(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:80'],
            'body' => ['nullable', 'string', 'max:180'],
        ]);
        $tokens = DB::table('member_push_tokens')
            ->where('member_id', $member->id)
            ->where('platform', 'android')
            ->whereNull('disabled_at')
            ->pluck('expo_push_token');

        abort_if($tokens->isEmpty(), 422, 'Der er ikke gemt en Android push-token endnu.');

        $messages = $tokens
            ->map(fn (string $token): array => [
                'to' => $token,
                'sound' => 'default',
                'channelId' => 'studos-default',
                'title' => $data['title'] ?? 'Studos test',
                'body' => $data['body'] ?? 'Hvis du ser den her, virker Android push.',
                'data' => [
                    'type' => 'test',
                    'screen' => 'overview',
                ],
            ])
            ->values()
            ->all();

        $response = Http::timeout(8)
            ->acceptJson()
            ->post('https://exp.host/--/api/v2/push/send', $messages);

        abort_if($response->failed(), 502, 'Expo Push Service kunne ikke sende testen.');

        return response()->json([
            'ok' => true,
            'sent' => count($messages),
            'message' => 'Testnotifikation sendt til Android.',
            'expoResponse' => $response->json(),
        ]);
    }

    public function updateProfilePhoto(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'profilePhotoData' => ['required', 'string', 'max:7000000'],
        ]);

        $profilePhotoPath = UploadedImage::storeBase64(
            $data['profilePhotoData'],
            'profile-photos',
            $member->id,
        );

        DB::table('members')->where('id', $member->id)->update([
            'profile_photo_url' => $profilePhotoPath,
        ]);

        $updatedMember = DB::table('members')->where('id', $member->id)->first();
        $serializedMember = $this->serializeMember($updatedMember, true, true);

        return response()->json([
            'session' => [
                'tokenType' => 'Bearer',
                'expiresAt' => $this->apiDateTime($member->authTokenExpiresAt ?? null),
                'member' => $serializedMember,
            ],
            'class' => $this->loadClassById($member->class_id, $member->id),
        ]);
    }

    private function profilePhotoPathForSignup(array $data, string $memberId): ?string
    {
        if (! blank($data['profilePhotoData'] ?? null)) {
            return UploadedImage::storeBase64($data['profilePhotoData'], 'profile-photos', $memberId);
        }

        return $this->trustedExternalImageUrl($data['profilePhotoUrl'] ?? null);
    }

    private function trustedExternalImageUrl(?string $value): ?string
    {
        if (blank($value)) {
            return null;
        }

        $url = trim($value);

        return Str::startsWith($url, ['http://', 'https://']) ? $url : null;
    }

    private function eventCoverTemplatePath(?string $templateId): ?string
    {
        if (blank($templateId)) {
            return null;
        }

        $templateId = trim($templateId);

        return in_array($templateId, self::EVENT_COVER_TEMPLATE_IDS, true)
            ? 'template:'.$templateId
            : null;
    }

    private function eventCoverTemplateIdFromPath(?string $value): ?string
    {
        if (blank($value) || ! Str::startsWith($value, 'template:')) {
            return null;
        }

        $templateId = Str::after($value, 'template:');

        return in_array($templateId, self::EVENT_COVER_TEMPLATE_IDS, true)
            ? $templateId
            : null;
    }

    private function resolveEventCoverPath(array $data, string $eventId, ?string $existingPath = null): ?string
    {
        $mode = $data['coverImageMode'] ?? null;

        if ($mode === 'keep') {
            return $existingPath;
        }

        if ($mode === 'none') {
            return null;
        }

        if ($mode === 'upload') {
            abort_if(blank($data['coverImageData'] ?? null), 422, 'Vaelg et cover-billede.');

            return UploadedImage::storeBase64($data['coverImageData'], 'event-covers', $eventId);
        }

        if ($mode === 'template') {
            $templatePath = $this->eventCoverTemplatePath($data['coverImageTemplateId'] ?? null);

            abort_if(! $templatePath, 422, 'Vaelg et cover-billede.');

            return $templatePath;
        }

        if (! blank($data['coverImageData'] ?? null)) {
            return UploadedImage::storeBase64($data['coverImageData'], 'event-covers', $eventId);
        }

        $templatePath = $this->eventCoverTemplatePath($data['coverImageTemplateId'] ?? null);

        return $templatePath ?? $existingPath;
    }

    public function storeEvent(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'eventDate' => ['required', 'date'],
            'eventTime' => ['nullable', 'date_format:H:i'],
            'location' => ['nullable', 'string', 'max:190'],
            'description' => ['nullable', 'string', 'max:1200'],
            'coverImageMode' => ['nullable', Rule::in(['keep', 'none', 'upload', 'template'])],
            'coverImageData' => ['nullable', 'string', 'max:7000000'],
            'coverImageTemplateId' => ['nullable', Rule::in(self::EVENT_COVER_TEMPLATE_IDS)],
            'inviteScope' => ['nullable', Rule::in(['class', 'crew', 'custom'])],
            'invitedMemberIds' => ['nullable', 'array', 'max:250'],
            'invitedMemberIds.*' => ['string', 'max:36'],
        ]);

        $eventId = (string) Str::uuid();
        $rsvpId = (string) Str::uuid();
        $now = now()->format('Y-m-d H:i:s');
        $eventDate = Carbon::parse($data['eventDate'])->format('Y-m-d');
        $eventTime = blank($data['eventTime'] ?? null) ? null : $data['eventTime'];
        $startsAt = $eventTime
            ? Carbon::createFromFormat('Y-m-d H:i', $eventDate.' '.$eventTime)->format('Y-m-d H:i:s')
            : null;
        $coverImagePath = $this->resolveEventCoverPath($data, $eventId);
        $inviteScope = $data['inviteScope'] ?? 'class';
        $inviteMemberIds = $this->resolveEventInviteMemberIds(
            $member,
            $inviteScope,
            $data['invitedMemberIds'] ?? [],
        );
        $moderationContext = [
            'source' => 'event_create',
            'member_id' => $member->id,
            'class_id' => $member->class_id,
            'event_id' => $eventId,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ];
        $title = ContentModeration::cleanText($data['title'], 'title', 'Titlen', $moderationContext);
        $location = ContentModeration::cleanNullableText($data['location'] ?? null, 'location', 'Sted', $moderationContext);
        $description = ContentModeration::cleanNullableText($data['description'] ?? null, 'description', 'Beskrivelsen', $moderationContext);

        DB::transaction(function () use (
            $eventId,
            $rsvpId,
            $member,
            $now,
            $eventDate,
            $startsAt,
            $coverImagePath,
            $inviteScope,
            $inviteMemberIds,
            $title,
            $location,
            $description,
        ): void {
            DB::table('events')->insert([
                'id' => $eventId,
                'class_id' => $member->class_id,
                'title' => $title,
                'event_date' => $eventDate,
                'starts_at' => $startsAt,
                'event_type' => 'studentergilde',
                'location' => $location,
                'description' => $description,
                'cover_image_url' => $coverImagePath,
                'invite_scope' => $inviteScope,
                'created_by_member_id' => $member->id,
                'rsvp_count' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            if (Schema::hasTable('event_invites')) {
                DB::table('event_invites')->insert(array_map(
                    fn (string $memberId): array => [
                        'id' => (string) Str::uuid(),
                        'event_id' => $eventId,
                        'member_id' => $memberId,
                        'invited_by_member_id' => $member->id,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                    $inviteMemberIds,
                ));
            }

            DB::table('event_rsvps')->insert([
                'id' => $rsvpId,
                'event_id' => $eventId,
                'member_id' => $member->id,
                'status' => 'attending',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        });

        return response()->json([
            'class' => $this->loadClassById($member->class_id, $member->id),
        ], 201);
    }

    private function resolveEventInviteMemberIds(object $member, string $inviteScope, array $requestedMemberIds): array
    {
        $activeMemberIds = DB::table('members')
            ->where('class_id', $member->class_id)
            ->where('status', 'active')
            ->pluck('id')
            ->all();

        if ($inviteScope !== 'custom') {
            return array_values(array_unique([...$activeMemberIds, $member->id]));
        }

        $requestedMemberIds = array_values(array_unique(array_filter($requestedMemberIds)));

        if (empty($requestedMemberIds)) {
            abort(422, 'Vaelg mindst een person at invitere.');
        }

        $validMemberIds = DB::table('members')
            ->where('class_id', $member->class_id)
            ->where('status', 'active')
            ->whereIn('id', $requestedMemberIds)
            ->pluck('id')
            ->all();

        abort_if(
            count($validMemberIds) !== count($requestedMemberIds),
            422,
            'En eller flere inviterede findes ikke.',
        );

        return array_values(array_unique([...$validMemberIds, $member->id]));
    }

    private function abortUnlessMemberCanAccessEvent(object $event, object $member): void
    {
        if (! Schema::hasTable('event_invites')) {
            return;
        }

        $hasInvites = DB::table('event_invites')
            ->where('event_id', $event->id)
            ->exists();

        if (! $hasInvites) {
            return;
        }

        $isInvited = DB::table('event_invites')
            ->where('event_id', $event->id)
            ->where('member_id', $member->id)
            ->exists();

        abort_if(! $isInvited, 403, 'Du er ikke inviteret til begivenheden.');
    }

    public function updateEvent(Request $request, string $event): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $schoolEvent = DB::table('events')
            ->where('id', $event)
            ->where('class_id', $member->class_id)
            ->first();

        abort_unless($schoolEvent, 404, 'Begivenheden findes ikke.');
        abort_unless(
            (string) ($schoolEvent->created_by_member_id ?? '') === (string) $member->id,
            403,
            'Du kan kun redigere dine egne begivenheder.'
        );

        $data = $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'eventDate' => ['required', 'date'],
            'eventTime' => ['nullable', 'date_format:H:i'],
            'location' => ['nullable', 'string', 'max:190'],
            'description' => ['nullable', 'string', 'max:1200'],
            'coverImageMode' => ['nullable', Rule::in(['keep', 'none', 'upload', 'template'])],
            'coverImageData' => ['nullable', 'string', 'max:7000000'],
            'coverImageTemplateId' => ['nullable', Rule::in(self::EVENT_COVER_TEMPLATE_IDS)],
            'inviteScope' => ['nullable', Rule::in(['class', 'crew', 'custom'])],
            'invitedMemberIds' => ['nullable', 'array', 'max:250'],
            'invitedMemberIds.*' => ['string', 'max:36'],
        ]);

        $now = now()->format('Y-m-d H:i:s');
        $eventDate = Carbon::parse($data['eventDate'])->format('Y-m-d');
        $eventTime = blank($data['eventTime'] ?? null) ? null : $data['eventTime'];
        $startsAt = $eventTime
            ? Carbon::createFromFormat('Y-m-d H:i', $eventDate.' '.$eventTime)->format('Y-m-d H:i:s')
            : null;
        $coverImagePath = $this->resolveEventCoverPath($data, $event, $schoolEvent->cover_image_url ?? null);
        $inviteScope = $data['inviteScope'] ?? 'class';
        $inviteMemberIds = $this->resolveEventInviteMemberIds(
            $member,
            $inviteScope,
            $data['invitedMemberIds'] ?? [],
        );
        $moderationContext = [
            'source' => 'event_update',
            'member_id' => $member->id,
            'class_id' => $member->class_id,
            'event_id' => $event,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ];
        $title = ContentModeration::cleanText($data['title'], 'title', 'Titlen', $moderationContext);
        $location = ContentModeration::cleanNullableText($data['location'] ?? null, 'location', 'Sted', $moderationContext);
        $description = ContentModeration::cleanNullableText($data['description'] ?? null, 'description', 'Beskrivelsen', $moderationContext);

        DB::transaction(function () use (
            $event,
            $inviteMemberIds,
            $inviteScope,
            $eventDate,
            $startsAt,
            $title,
            $location,
            $description,
            $coverImagePath,
            $member,
            $now,
        ): void {
            DB::table('events')->where('id', $event)->update([
                'title' => $title,
                'event_date' => $eventDate,
                'starts_at' => $startsAt,
                'location' => $location,
                'description' => $description,
                'cover_image_url' => $coverImagePath,
                'invite_scope' => $inviteScope,
                'updated_at' => $now,
            ]);

            if (Schema::hasTable('event_invites')) {
                $currentInviteMemberIds = DB::table('event_invites')
                    ->where('event_id', $event)
                    ->pluck('member_id')
                    ->all();
                $nextInviteMemberIds = array_values(array_unique($inviteMemberIds));
                $removedMemberIds = array_values(array_diff($currentInviteMemberIds, $nextInviteMemberIds));
                $addedMemberIds = array_values(array_diff($nextInviteMemberIds, $currentInviteMemberIds));

                if (! empty($removedMemberIds)) {
                    DB::table('event_invites')
                        ->where('event_id', $event)
                        ->whereIn('member_id', $removedMemberIds)
                        ->delete();
                }

                if (! empty($addedMemberIds)) {
                    DB::table('event_invites')->insert(array_map(
                        fn (string $memberId): array => [
                            'id' => (string) Str::uuid(),
                            'event_id' => $event,
                            'member_id' => $memberId,
                            'invited_by_member_id' => $member->id,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ],
                        $addedMemberIds,
                    ));
                }

                if (Schema::hasTable('event_rsvps')) {
                    DB::table('event_rsvps')
                        ->where('event_id', $event)
                        ->whereNotIn('member_id', $nextInviteMemberIds)
                        ->delete();
                }
            }

            $attendingCount = Schema::hasTable('event_rsvps')
                ? DB::table('event_rsvps')
                    ->where('event_id', $event)
                    ->where('status', 'attending')
                    ->count()
                : 0;

            DB::table('events')->where('id', $event)->update([
                'rsvp_count' => $attendingCount,
                'updated_at' => $now,
            ]);
        });

        return response()->json([
            'class' => $this->loadClassById($member->class_id, $member->id),
        ]);
    }

    public function destroyEvent(Request $request, string $event): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $schoolEvent = DB::table('events')
            ->where('id', $event)
            ->where('class_id', $member->class_id)
            ->first();

        abort_unless($schoolEvent, 404, 'Begivenheden findes ikke.');
        abort_unless(
            (string) ($schoolEvent->created_by_member_id ?? '') === (string) $member->id,
            403,
            'Du kan kun slette dine egne begivenheder.'
        );

        DB::transaction(function () use ($event): void {
            if (Schema::hasTable('event_invites')) {
                DB::table('event_invites')->where('event_id', $event)->delete();
            }

            if (Schema::hasTable('event_rsvps')) {
                DB::table('event_rsvps')->where('event_id', $event)->delete();
            }

            DB::table('events')->where('id', $event)->delete();
        });

        return response()->json([
            'class' => $this->loadClassById($member->class_id, $member->id),
        ]);
    }

    public function reportEvent(Request $request, string $event): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $schoolEvent = DB::table('events')
            ->where('id', $event)
            ->where('class_id', $member->class_id)
            ->first();

        abort_unless($schoolEvent, 404, 'Begivenheden findes ikke.');
        $this->abortUnlessMemberCanAccessEvent($schoolEvent, $member);

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:190'],
            'details' => ['nullable', 'string', 'max:2000'],
        ]);
        $reason = trim($data['reason'] ?? '') ?: 'Begivenhed rapporteret';
        $details = trim($data['details'] ?? '');
        $coverImageTemplateId = $this->eventCoverTemplateIdFromPath($schoolEvent->cover_image_url ?? null);
        $moderationDetails = trim(implode("\n", array_filter([
            $details ?: null,
            'Titel: '.($schoolEvent->title ?? ''),
            'Har cover: '.(blank($schoolEvent->cover_image_url ?? null) ? 'nej' : 'ja'),
            $coverImageTemplateId ? 'Cover-skabelon: '.$coverImageTemplateId : null,
        ])));
        $now = now()->format('Y-m-d H:i:s');

        DB::table('member_reports')->insert([
            'id' => (string) Str::uuid(),
            'reporter_member_id' => $member->id,
            'reported_member_id' => $schoolEvent->created_by_member_id ?? null,
            'target_type' => 'calendar_event',
            'target_id' => $schoolEvent->id,
            'reason' => $reason,
            'details' => $moderationDetails ?: null,
            'status' => 'pending',
            'reviewed_at' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json(['ok' => true]);
    }

    public function blockMember(Request $request, string $member): JsonResponse
    {
        $currentMember = $this->authenticatedMemberFromRequest($request);
        $targetMember = DB::table('members')
            ->where('id', $member)
            ->where('class_id', $currentMember->class_id)
            ->where('status', '!=', 'removed')
            ->first();

        abort_unless($targetMember, 404, 'Personen findes ikke.');
        abort_if((string) $targetMember->id === (string) $currentMember->id, 422, 'Du kan ikke blokere dig selv.');

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:190'],
        ]);
        $reason = trim($data['reason'] ?? '') ?: 'Blokeret fra kalender';
        $now = now()->format('Y-m-d H:i:s');
        $existingBlock = DB::table('member_blocks')
            ->where('blocker_member_id', $currentMember->id)
            ->where('blocked_member_id', $targetMember->id)
            ->first();

        if ($existingBlock) {
            DB::table('member_blocks')
                ->where('id', $existingBlock->id)
                ->update([
                    'reason' => $reason,
                    'updated_at' => $now,
                ]);
        } else {
            DB::table('member_blocks')->insert([
                'id' => (string) Str::uuid(),
                'blocker_member_id' => $currentMember->id,
                'blocked_member_id' => $targetMember->id,
                'reason' => $reason,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        return response()->json([
            'ok' => true,
            'class' => $this->loadClassById($currentMember->class_id, $currentMember->id),
        ]);
    }

    public function respondToEvent(Request $request, string $event): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'status' => ['required', Rule::in(['attending', 'not_attending'])],
        ]);
        $schoolEvent = DB::table('events')
            ->where('id', $event)
            ->where('class_id', $member->class_id)
            ->first();

        abort_unless($schoolEvent, 404, 'Begivenheden findes ikke.');
        $this->abortUnlessMemberCanAccessEvent($schoolEvent, $member);

        $now = now()->format('Y-m-d H:i:s');

        DB::transaction(function () use ($data, $event, $member, $now): void {
            $existing = DB::table('event_rsvps')
                ->where('event_id', $event)
                ->where('member_id', $member->id)
                ->first();

            if ($existing) {
                DB::table('event_rsvps')->where('id', $existing->id)->update([
                    'status' => $data['status'],
                    'updated_at' => $now,
                ]);
            } else {
                DB::table('event_rsvps')->insert([
                    'id' => (string) Str::uuid(),
                    'event_id' => $event,
                    'member_id' => $member->id,
                    'status' => $data['status'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            $attendingCount = DB::table('event_rsvps')
                ->where('event_id', $event)
                ->where('status', 'attending')
                ->count();

            DB::table('events')->where('id', $event)->update([
                'rsvp_count' => $attendingCount,
                'updated_at' => $now,
            ]);
        });

        return response()->json([
            'class' => $this->loadClassById($member->class_id, $member->id),
        ]);
    }

    public function updateMemberAccess(Request $request, string $class, string $member): JsonResponse
    {
        $actor = $this->authenticatedMemberFromRequest($request);

        abort_if($actor->class_id !== $class, 403, 'Du har ikke adgang til denne klasse.');
        abort_unless(
            in_array($this->normalizeRole($actor->role), ['owner', 'moderator'], true),
            403,
            'Du har ikke rettigheder til at aendre adgang.',
        );

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

    private function hydrateClasses($classRows, ?string $currentMemberId = null): array
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
        $eventRows = DB::table('events')
            ->whereIn('class_id', $classIds)
            ->orderBy('event_date')
            ->get();
        $events = $eventRows->groupBy('class_id');
        $eventRsvps = collect();
        $eventInvites = collect();
        $blockedMemberIds = collect();

        if ($currentMemberId && Schema::hasTable('member_blocks')) {
            $blockedMemberIds = DB::table('member_blocks')
                ->where('blocker_member_id', $currentMemberId)
                ->orWhere('blocked_member_id', $currentMemberId)
                ->get()
                ->map(fn (object $block): ?string => (
                    (string) $block->blocker_member_id === (string) $currentMemberId
                        ? $block->blocked_member_id
                        : $block->blocker_member_id
                ))
                ->filter()
                ->unique()
                ->values();
        }

        if (Schema::hasTable('event_rsvps') && $eventRows->isNotEmpty()) {
            $eventRsvps = DB::table('event_rsvps')
                ->join('members', 'members.id', '=', 'event_rsvps.member_id')
                ->whereIn('event_rsvps.event_id', $eventRows->pluck('id'))
                ->select([
                    'event_rsvps.id',
                    'event_rsvps.event_id',
                    'event_rsvps.member_id',
                    'event_rsvps.status',
                    'event_rsvps.created_at',
                    'event_rsvps.updated_at',
                    'members.display_name as memberDisplayName',
                    'members.profile_photo_url as memberProfilePhotoUrl',
                ])
                ->orderBy('event_rsvps.created_at')
                ->get()
                ->groupBy('event_id');
        }

        if (Schema::hasTable('event_invites') && $eventRows->isNotEmpty()) {
            $eventInvites = DB::table('event_invites')
                ->join('members', 'members.id', '=', 'event_invites.member_id')
                ->whereIn('event_invites.event_id', $eventRows->pluck('id'))
                ->select([
                    'event_invites.id',
                    'event_invites.event_id',
                    'event_invites.member_id',
                    'event_invites.invited_by_member_id',
                    'event_invites.created_at',
                    'event_invites.updated_at',
                    'members.display_name as memberDisplayName',
                    'members.profile_photo_url as memberProfilePhotoUrl',
                ])
                ->orderBy('event_invites.created_at')
                ->get()
                ->groupBy('event_id');
        }

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
                $eventRsvps,
                $eventInvites,
                $contentBlocks->get($schoolClass->id, collect()),
                $currentMemberId,
                $blockedMemberIds,
            ))
            ->values()
            ->all();
    }

    private function loadClassById(string $classId, ?string $currentMemberId = null): array
    {
        $schoolClass = $this->classQuery()->where('id', $classId)->first();

        abort_unless($schoolClass, 404);

        return $this->hydrateClasses(collect([$schoolClass]), $currentMemberId)[0];
    }

    private function serializeClass(
        object $schoolClass,
        $members,
        $events,
        $eventRsvps,
        $eventInvites,
        $contentBlocks,
        ?string $currentMemberId = null,
        $blockedMemberIds = null,
    ): array {
        $blockedMemberIds ??= collect();
        $serializedMembers = $members
            ->map(fn ($member) => $this->serializeMember(
                $member,
                $member->id === $currentMemberId,
                $member->id === $currentMemberId,
            ))
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
            'events' => $events
                ->filter(function (object $event) use ($currentMemberId, $eventInvites, $blockedMemberIds): bool {
                    if (! $currentMemberId) {
                        return ($event->invite_scope ?? 'class') !== 'custom';
                    }

                    if (
                        ! blank($event->created_by_member_id ?? null)
                        && $blockedMemberIds->contains($event->created_by_member_id)
                    ) {
                        return false;
                    }

                    if (($event->invite_scope ?? 'class') !== 'custom') {
                        return true;
                    }

                    $invitesForEvent = $eventInvites->get($event->id, collect());

                    return $invitesForEvent->isEmpty()
                        || $invitesForEvent->contains('member_id', $currentMemberId);
                })
                ->map(function (object $event) use ($currentMemberId, $eventRsvps, $eventInvites, $members): array {
                    $eventRsvpsForEvent = $eventRsvps->get($event->id, collect());
                    $eventInvitesForEvent = $eventInvites->get($event->id, collect());
                    $attendees = $eventRsvpsForEvent->where('status', 'attending')->values();
                    $declines = $eventRsvpsForEvent->where('status', 'not_attending')->values();
                    $respondedMemberIds = $eventRsvpsForEvent->pluck('member_id')->unique();
                    $pendingInvites = $eventInvitesForEvent
                        ->reject(fn (object $invite): bool => $respondedMemberIds->contains($invite->member_id))
                        ->values();
                    $creator = blank($event->created_by_member_id ?? null)
                        ? null
                        : $members->firstWhere('id', $event->created_by_member_id);
                    $myRsvp = $currentMemberId
                        ? $eventRsvpsForEvent->firstWhere('member_id', $currentMemberId)?->status
                        : null;
                    $inviteCount = $eventInvitesForEvent->isNotEmpty()
                        ? $eventInvitesForEvent->count()
                        : $members->where('status', 'active')->count();
                    $coverImageTemplateId = $this->eventCoverTemplateIdFromPath($event->cover_image_url ?? null);

                    return [
                        'id' => $event->id,
                        'title' => $event->title,
                        'type' => $event->event_type ?? 'studentergilde',
                        'date' => $this->apiDate($event->event_date),
                        'startsAt' => $this->apiDateTime($event->starts_at ?? null),
                        'location' => $event->location ?? '',
                        'description' => $event->description ?? '',
                        'coverImageUrl' => $coverImageTemplateId
                            ? null
                            : UploadedImage::publicUrl($event->cover_image_url ?? null),
                        'coverImageTemplateId' => $coverImageTemplateId,
                        'inviteScope' => $event->invite_scope ?? 'class',
                        'inviteCount' => $inviteCount,
                        'pendingCount' => $eventInvitesForEvent->isNotEmpty()
                            ? $pendingInvites->count()
                            : max(0, $inviteCount - $attendees->count() - $declines->count()),
                        'myInviteStatus' => $currentMemberId && (
                            $eventInvitesForEvent->isEmpty()
                            || $eventInvitesForEvent->contains('member_id', $currentMemberId)
                        ) ? 'invited' : null,
                        'createdByMemberId' => $event->created_by_member_id ?? null,
                        'creator' => $creator ? [
                            'id' => $creator->id,
                            'displayName' => $creator->display_name,
                            'profilePhotoUrl' => UploadedImage::publicUrl($creator->profile_photo_url ?? null),
                        ] : null,
                        'rsvpCount' => (int) $event->rsvp_count,
                        'attendingCount' => $attendees->isNotEmpty()
                            ? $attendees->count()
                            : (int) $event->rsvp_count,
                        'notAttendingCount' => $declines->count(),
                        'myRsvp' => $myRsvp,
                        'attendees' => $attendees
                            ->map(fn (object $rsvp): array => [
                                'memberId' => $rsvp->member_id,
                                'displayName' => $rsvp->memberDisplayName,
                                'profilePhotoUrl' => UploadedImage::publicUrl($rsvp->memberProfilePhotoUrl),
                            ])
                            ->all(),
                        'declines' => $declines
                            ->map(fn (object $rsvp): array => [
                                'memberId' => $rsvp->member_id,
                                'displayName' => $rsvp->memberDisplayName,
                                'profilePhotoUrl' => UploadedImage::publicUrl($rsvp->memberProfilePhotoUrl),
                            ])
                            ->all(),
                        'invitees' => $eventInvitesForEvent
                            ->map(fn (object $invite): array => [
                                'memberId' => $invite->member_id,
                                'displayName' => $invite->memberDisplayName,
                                'profilePhotoUrl' => UploadedImage::publicUrl($invite->memberProfilePhotoUrl),
                            ])
                            ->all(),
                        'pendingInvitees' => $pendingInvites
                            ->map(fn (object $invite): array => [
                                'memberId' => $invite->member_id,
                                'displayName' => $invite->memberDisplayName,
                                'profilePhotoUrl' => UploadedImage::publicUrl($invite->memberProfilePhotoUrl),
                            ])
                            ->all(),
                    ];
                })
                ->values()
                ->all(),
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

    private function serializeMember(object $member, bool $includePersonalCode = false, bool $includePrivate = false): array
    {
        $firstName = $member->first_name ?? null;
        $lastName = $member->last_name ?? null;

        $serialized = [
            'id' => $member->id,
            'displayName' => $member->display_name,
            'firstName' => $firstName,
            'lastName' => $lastName,
            'profilePhotoUrl' => UploadedImage::publicUrl($member->profile_photo_url ?? null),
            'role' => $this->normalizeRole($member->role),
            'status' => $this->normalizeStatus($member->status ?? 'active'),
            'joinedAt' => $this->apiDateTime($member->joined_at),
            'lastSeenAt' => $this->apiDateTime($member->last_seen_at ?? null),
            'isOnline' => $this->memberIsOnline($member->last_seen_at ?? null),
        ];

        if ($includePrivate) {
            $serialized['schoolId'] = $member->school_id ?? null;
            $serialized['email'] = $member->email;
            $serialized['phone'] = $member->phone ?? null;
            $serialized['birthday'] = $this->apiDate($member->birthday ?? null);
        }

        if ($includePersonalCode) {
            $serialized['personalCode'] = $member->personal_code ?? null;
        }

        return $serialized;
    }

    private function sessionForMember(array $member, ?array $token = null): array
    {
        $session = [
            'tokenType' => 'Bearer',
            'member' => $member,
        ];

        if ($token) {
            $session['token'] = $token['plainTextToken'];
            $session['expiresAt'] = $this->apiDateTime($token['expiresAt']);
        }

        return $session;
    }

    private function issueMemberToken(string $memberId, string $name = 'mobile'): array
    {
        $plainTextToken = 'studos_'.bin2hex(random_bytes(32));
        $expiresAt = now()->addDays(60);

        DB::table('member_auth_tokens')->insert([
            'id' => (string) Str::uuid(),
            'member_id' => $memberId,
            'token_hash' => hash('sha256', $plainTextToken),
            'name' => $name,
            'last_used_at' => null,
            'expires_at' => $expiresAt->format('Y-m-d H:i:s'),
            'revoked_at' => null,
            'created_at' => now()->format('Y-m-d H:i:s'),
        ]);

        return [
            'plainTextToken' => $plainTextToken,
            'expiresAt' => $expiresAt,
        ];
    }

    private function authenticatedMemberFromRequest(Request $request, bool $required = true, bool $mustBeActive = true): ?object
    {
        $plainTextToken = $request->bearerToken();

        if (blank($plainTextToken)) {
            abort_if($required, 401, 'Login mangler.');

            return null;
        }

        $token = DB::table('member_auth_tokens')
            ->where('token_hash', hash('sha256', $plainTextToken))
            ->whereNull('revoked_at')
            ->first();

        abort_unless($token, 401, 'Sessionen er ugyldig. Log ind igen.');

        if (! blank($token->expires_at) && Carbon::parse($token->expires_at)->isPast()) {
            DB::table('member_auth_tokens')->where('id', $token->id)->update([
                'revoked_at' => now()->format('Y-m-d H:i:s'),
            ]);

            abort(401, 'Sessionen er udloebet. Log ind igen.');
        }

        $memberQuery = DB::table('members')->where('id', $token->member_id);

        if ($mustBeActive) {
            $memberQuery->where('status', 'active');
        } else {
            $memberQuery->where('status', '!=', 'removed');
        }

        $member = $memberQuery->first();

        abort_unless($member, 401, 'Medlemmet har ikke adgang laengere.');

        DB::table('member_auth_tokens')->where('id', $token->id)->update([
            'last_used_at' => now()->format('Y-m-d H:i:s'),
        ]);

        $this->touchMemberPresence($member);

        $member->authTokenExpiresAt = $token->expires_at;

        return $member;
    }

    private function memberPreviews($memberIds)
    {
        $ids = collect($memberIds)->filter()->unique()->values();

        if ($ids->isEmpty()) {
            return collect();
        }

        $select = [
            'members.id',
            'members.display_name as displayName',
            'members.first_name as firstName',
            'members.profile_photo_url as profilePhotoUrl',
            'classes.public_id as classId',
            'classes.school_name as schoolName',
            'classes.class_name as className',
            'classes.graduation_year as graduationYear',
        ];

        if (Schema::hasColumn('members', 'last_seen_at')) {
            $select[] = 'members.last_seen_at as lastSeenAt';
        }

        return DB::table('members')
            ->join('classes', 'classes.id', '=', 'members.class_id')
            ->select($select)
            ->whereIn('members.id', $ids)
            ->get()
            ->keyBy('id');
    }

    private function touchMemberPresence(object $member): void
    {
        if (! Schema::hasColumn('members', 'last_seen_at')) {
            return;
        }

        $now = now();
        $lastSeenAt = blank($member->last_seen_at ?? null)
            ? null
            : Carbon::parse($member->last_seen_at);

        if ($lastSeenAt && $lastSeenAt->greaterThan($now->copy()->subSeconds(45))) {
            return;
        }

        $formattedNow = $now->format('Y-m-d H:i:s');

        DB::table('members')->where('id', $member->id)->update([
            'last_seen_at' => $formattedNow,
        ]);

        $member->last_seen_at = $formattedNow;
    }

    private function memberIsOnline(mixed $lastSeenAt): bool
    {
        if (blank($lastSeenAt)) {
            return false;
        }

        return Carbon::parse($lastSeenAt)->greaterThanOrEqualTo(now()->subMinutes(2));
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
                'profilePhotoUrl' => UploadedImage::publicUrl($otherMember->profilePhotoUrl),
                'lastSeenAt' => $this->apiDateTime($otherMember->lastSeenAt ?? null),
                'isOnline' => $this->memberIsOnline($otherMember->lastSeenAt ?? null),
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
