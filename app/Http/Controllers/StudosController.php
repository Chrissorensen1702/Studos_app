<?php

namespace App\Http\Controllers;

use App\Support\ContentModeration;
use App\Support\PointDuelMaintenance;
use App\Support\PushNotifier;
use App\Support\UploadedImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class StudosController extends Controller
{
    private const PRIVACY_VERSION = '2026-05-11';

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
            'description' => 'Kan styre klasseindhold, events og moderation, men ikke ejerskab eller roller.',
            'permissions' => ['manage_content', 'manage_events', 'moderate_content'],
        ],
        [
            'id' => 'student',
            'label' => 'Elev',
            'description' => 'Kan bruge appen, chatte og svare på events.',
            'permissions' => ['view_class', 'chat', 'respond_events'],
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

    private const EMERGENCY_CONTACT_VISIBILITIES = ['class', 'crew', 'specific'];

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

    public function classBattle(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);

        $rows = DB::table('classes')
            ->leftJoin('members', function ($join): void {
                $join->on('members.class_id', '=', 'classes.id')
                    ->where('members.status', '=', 'active');
            })
            ->select([
                'classes.id',
                'classes.public_id as classId',
                'classes.school_name as schoolName',
                'classes.class_name as className',
                DB::raw('COUNT(members.id) as active_members'),
                DB::raw('COALESCE(SUM(COALESCE(members.caps_balance, 1000)), 0) as total_caps'),
            ])
            ->groupBy('classes.id', 'classes.public_id', 'classes.school_name', 'classes.class_name')
            ->havingRaw('COUNT(members.id) > 0')
            ->get()
            ->map(function (object $row) use ($member): array {
                $activeMembers = max(1, (int) $row->active_members);
                $totalCaps = (int) $row->total_caps;

                return [
                    'id' => $row->id,
                    'classId' => $row->classId,
                    'className' => $row->className,
                    'schoolName' => $row->schoolName,
                    'activeMembers' => $activeMembers,
                    'totalCaps' => $totalCaps,
                    'score' => (int) round($totalCaps / $activeMembers),
                    'current' => (string) $row->id === (string) $member->class_id,
                ];
            })
            ->sort(function (array $left, array $right): int {
                return [$right['score'], $right['totalCaps'], $left['className']]
                    <=> [$left['score'], $left['totalCaps'], $right['className']];
            })
            ->values()
            ->map(fn (array $row, int $index): array => [
                ...$row,
                'rank' => $index + 1,
            ]);

        return response()->json([
            'metric' => 'caps_per_active_member',
            'resetDate' => '2026-08-01',
            'currentMember' => [
                'id' => $member->id,
                'classId' => $member->class_id,
                'capsBalance' => (int) ($member->caps_balance ?? 1000),
            ],
            'classes' => $rows->all(),
        ]);
    }

    public function currentGoodDeed(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);

        return response()->json([
            'goodDeed' => $this->goodDeedStateForMember($member, $request),
        ]);
    }

    public function weeklyCheckIn(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);

        return response()->json([
            'weeklyCheckIn' => $this->weeklyCheckInStateForMember($member),
        ]);
    }

    public function storeWeeklyCheckIn(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);

        abort_unless(Schema::hasTable('weekly_check_ins'), 500, 'Ugentlig check-in er ikke klar endnu.');

        $result = DB::transaction(function () use ($member): array {
            $today = now()->toDateString();
            $existing = DB::table('weekly_check_ins')
                ->where('member_id', $member->id)
                ->where('day_key', $today)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return [
                    'state' => $this->weeklyCheckInStateForMember($member),
                    'awardedCaps' => 0,
                ];
            }

            $yesterday = Carbon::parse($today)->subDay()->toDateString();
            $previousCheckIn = DB::table('weekly_check_ins')
                ->where('member_id', $member->id)
                ->where('day_key', $yesterday)
                ->lockForUpdate()
                ->first();
            $previousStreak = $previousCheckIn ? min(7, max(0, (int) $previousCheckIn->streak_day)) : 0;
            $previousRewardAwarded = (bool) ($previousCheckIn->reward_awarded ?? false);
            $rewardReached = $previousStreak === 6 && ! $previousRewardAwarded;
            $streakDay = $rewardReached || $previousStreak >= 7 ? 1 : $previousStreak + 1;
            $capsAwarded = $rewardReached ? 100 : 0;
            $checkInId = (string) Str::uuid();
            $now = now()->format('Y-m-d H:i:s');

            DB::table('weekly_check_ins')->insert([
                'id' => $checkInId,
                'member_id' => $member->id,
                'class_id' => $member->class_id,
                'day_key' => $today,
                'streak_day' => $streakDay,
                'reward_awarded' => $capsAwarded > 0,
                'caps_awarded' => $capsAwarded,
                'created_at' => $now,
            ]);

            if ($capsAwarded > 0) {
                DB::table('members')->where('id', $member->id)->increment('caps_balance', $capsAwarded);
                $this->recordCapTransaction(
                    $member->id,
                    $member->class_id,
                    $capsAwarded,
                    'weekly_check_in',
                    'Ugentlig check-in streak',
                    'weekly_check_in',
                    $checkInId,
                    $member->id,
                    [
                        'dayKey' => $today,
                        'completedStreakDays' => 7,
                        'nextStreakDay' => $streakDay,
                    ],
                );
            }

            return [
                'state' => $this->weeklyCheckInStateForMember($member),
                'awardedCaps' => $capsAwarded,
            ];
        });

        return response()->json([
            'weeklyCheckIn' => [
                ...$result['state'],
                'awardedCaps' => $result['awardedCaps'],
            ],
            'awardedCaps' => $result['awardedCaps'],
        ]);
    }

    public function storeGoodDeedClaim(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        ['week' => $week, 'weekKey' => $weekKey] = $this->currentGoodDeedWeek();

        $this->expireGoodDeedClaims();

        $result = DB::transaction(function () use ($member, $request, $week, $weekKey): array {
            $existingClaim = DB::table('good_deed_claims')
                ->where('week_key', $weekKey)
                ->where('member_id', $member->id)
                ->lockForUpdate()
                ->first();

            abort_if($existingClaim, 422, 'Du har allerede claimet ugens gode gerning.');

            $now = now();
            $claimId = (string) Str::uuid();
            $baseCaps = (int) $week->base_caps;

            DB::table('good_deed_claims')->insert([
                'id' => $claimId,
                'week_key' => $weekKey,
                'good_deed_week_id' => $week->id,
                'class_id' => $member->class_id,
                'member_id' => $member->id,
                'verifier_member_id' => $member->id,
                'photo_url' => null,
                'status' => 'approved',
                'base_caps' => $baseCaps,
                'photo_bonus_caps' => 0,
                'approved_at' => $now->format('Y-m-d H:i:s'),
                'rejected_at' => null,
                'expires_at' => null,
                'created_at' => $now->format('Y-m-d H:i:s'),
                'updated_at' => $now->format('Y-m-d H:i:s'),
            ]);

            DB::table('members')->where('id', $member->id)->increment('caps_balance', $baseCaps);
            $this->recordCapTransaction(
                $member->id,
                $member->class_id,
                $baseCaps,
                'weekly_good_deed',
                'Ugens gode gerning',
                'good_deed_claim',
                $claimId,
                $member->id,
                [
                    'weekKey' => $weekKey,
                ],
            );

            $capsBalance = (int) (DB::table('members')->where('id', $member->id)->value('caps_balance') ?? 1000);

            return [
                'goodDeed' => $this->goodDeedStateForMember($member, $request),
                'awardedCaps' => $baseCaps,
                'capsBalance' => $capsBalance,
            ];
        });

        return response()->json([
            'goodDeed' => $result['goodDeed'],
            'awardedCaps' => $result['awardedCaps'],
            'capsBalance' => $result['capsBalance'],
        ], 201);
    }

    public function duels(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);

        $this->ensurePointDuelsReady();
        PointDuelMaintenance::expireDueForMember($member);

        return response()->json([
            'duels' => $this->duelsForMember($member),
            'currentMember' => $this->serializeMember(
                DB::table('members')->where('id', $member->id)->first(),
                true,
                true,
                $member->id,
            ),
        ]);
    }

    public function storeDuel(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $this->ensurePointDuelsReady();

        $data = $request->validate([
            'toMemberId' => ['required', 'string', 'max:36'],
            'judgeMemberId' => ['nullable', 'string', 'max:36'],
            'mode' => ['nullable', Rule::in(['versus', 'challenge'])],
            'challenge' => ['required', 'string', 'min:2', 'max:500'],
            'stake' => ['required', 'integer', 'min:1', 'max:100000'],
            'deadlineAt' => ['required', 'date'],
        ]);
        $deadlineAt = Carbon::parse($data['deadlineAt'])->utc();
        $duelMode = $data['mode'] ?? 'versus';
        $judgeMemberId = $duelMode === 'versus' ? ($data['judgeMemberId'] ?? null) : null;
        $challenge = ContentModeration::cleanText($data['challenge'], 'challenge', 'Dysten', [
            'member_id' => $member->id,
            'class_id' => $member->class_id,
            'source' => 'duel',
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);

        abort_if($deadlineAt->isPast(), 422, 'Deadline skal være i fremtiden.');
        abort_if($duelMode === 'challenge' && ! blank($data['judgeMemberId'] ?? null), 422, 'Challenge kan ikke have dommer.');
        abort_if(! blank($judgeMemberId) && ! Schema::hasColumn('point_duels', 'judge_member_id'), 500, 'Dommerfunktionen er ikke migreret endnu.');

        $duelId = DB::transaction(function () use ($member, $data, $deadlineAt, $duelMode, $judgeMemberId, $challenge): string {
            $lockedMembers = DB::table('members')
                ->whereIn('id', collect([$member->id, $data['toMemberId']])->sort()->values()->all())
                ->where('class_id', $member->class_id)
                ->where('status', 'active')
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            $creator = $lockedMembers->get($member->id);
            $opponent = $lockedMembers->get($data['toMemberId']);
            $judge = blank($judgeMemberId)
                ? null
                : DB::table('members')
                    ->where('id', $judgeMemberId)
                    ->where('class_id', $member->class_id)
                    ->where('status', 'active')
                    ->first();
            $stake = (int) $data['stake'];

            abort_unless($creator, 401, 'Medlemmet har ikke adgang længere.');
            abort_unless($opponent, 422, 'Modstanderen findes ikke længere.');
            abort_if((string) $opponent->id === (string) $creator->id, 422, 'Du kan ikke oprette en dyst mod dig selv.');
            abort_if(! blank($data['judgeMemberId'] ?? null) && ! $judge, 422, 'Dommeren findes ikke længere.');
            abort_if($judge && (string) $judge->id === (string) $creator->id, 422, 'Du kan ikke vælge dig selv som dommer.');
            abort_if($judge && (string) $judge->id === (string) $opponent->id, 422, 'Modstanderen kan ikke også være dommer.');

            $creatorBalance = (int) ($creator->caps_balance ?? 1000);

            abort_if($creatorBalance < $stake, 422, $duelMode === 'challenge' ? 'Du har ikke nok Caps til den belønning.' : 'Du har ikke nok Caps til den indsats.');

            $now = Carbon::now('UTC')->format('Y-m-d H:i:s');
            $duelId = (string) Str::uuid();

            DB::table('members')->where('id', $creator->id)->update([
                'caps_balance' => $creatorBalance - $stake,
            ]);
            $duelInsert = [
                'id' => $duelId,
                'class_id' => $creator->class_id,
                'creator_member_id' => $creator->id,
                'opponent_member_id' => $opponent->id,
                'challenge' => $challenge,
                'stake_caps' => $stake,
                'creator_escrow_caps' => $stake,
                'opponent_escrow_caps' => 0,
                'status' => 'awaitingOpponent',
                'deadline_at' => $deadlineAt->format('Y-m-d H:i:s'),
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if (\Illuminate\Support\Facades\Schema::hasColumn('point_duels', 'mode')) {
                $duelInsert['mode'] = $duelMode;
            }

            if (Schema::hasColumn('point_duels', 'judge_member_id') && $judge) {
                $duelInsert['judge_member_id'] = $judge->id;
            }

            DB::table('point_duels')->insert($duelInsert);
            $escrowDescription = $duelMode === 'challenge'
                ? 'Challenge-belønning låst i escrow'
                : 'Duel-indsats låst i escrow';
            $this->recordCapTransaction(
                $creator->id,
                $creator->class_id,
                -$stake,
                'duel_escrow_hold',
                $escrowDescription,
                'point_duel',
                $duelId,
                $creator->id,
                ['opponentMemberId' => $opponent->id],
            );

            return $duelId;
        }, 3);

        PointDuelMaintenance::dispatchDuelUpdatedById($duelId);

        $createdDuel = DB::table('point_duels')->where('id', $duelId)->first();

        if ($createdDuel) {
            $this->pushDuelInvite($createdDuel);
        }

        return response()->json($this->duelResponseForMember($member, $duelId), 201);
    }

    public function acceptDuel(Request $request, string $duel): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $this->ensurePointDuelsReady();
        PointDuelMaintenance::expireDueForMember($member);

        DB::transaction(function () use ($member, $duel): void {
            $duelRow = $this->duelForMember($duel, $member, true);
            abort_if($duelRow->status !== 'awaitingOpponent', 422, 'Dysten kan ikke accepteres længere.');
            abort_if((string) $duelRow->opponent_member_id !== (string) $member->id, 403, 'Kun modstanderen kan acceptere dysten.');

            $opponent = DB::table('members')->where('id', $member->id)->lockForUpdate()->first();
            $stake = (int) $duelRow->stake_caps;
            $isChallenge = ($duelRow->mode ?? 'versus') === 'challenge';
            $balance = (int) ($opponent->caps_balance ?? 1000);

            if (! $isChallenge) {
                abort_if($balance < $stake, 422, 'Du har ikke nok Caps til at acceptere den indsats.');

                DB::table('members')->where('id', $opponent->id)->update([
                    'caps_balance' => $balance - $stake,
                ]);
            }
            $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

            DB::table('point_duels')->where('id', $duelRow->id)->update([
                'opponent_escrow_caps' => $isChallenge ? 0 : $stake,
                'status' => 'active',
                'accepted_at' => $now,
                'confirmed_at' => $now,
                'updated_at' => $now,
            ]);
            if (! $isChallenge) {
                $this->recordCapTransaction(
                    $opponent->id,
                    $opponent->class_id,
                    -$stake,
                    'duel_escrow_hold',
                    'Duel-indsats låst i escrow',
                    'point_duel',
                    $duelRow->id,
                    $opponent->id,
                    ['creatorMemberId' => $duelRow->creator_member_id],
                );
            }
        }, 3);

        PointDuelMaintenance::dispatchDuelUpdatedById($duel);

        $updatedDuel = DB::table('point_duels')->where('id', $duel)->first();

        if ($updatedDuel) {
            $this->pushDuelResponse($updatedDuel, 'accepted', $member->id);
        }

        return response()->json($this->duelResponseForMember($member, $duel));
    }

    public function declineDuel(Request $request, string $duel): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $this->ensurePointDuelsReady();

        DB::transaction(function () use ($member, $duel): void {
            $duelRow = $this->duelForMember($duel, $member, true);
            abort_if($duelRow->status !== 'awaitingOpponent', 422, 'Dysten kan ikke afvises længere.');
            abort_if((string) $duelRow->opponent_member_id !== (string) $member->id, 403, 'Kun modstanderen kan afvise dysten.');

            $this->refundDuelEscrow($duelRow->creator_member_id, $duelRow, (int) $duelRow->creator_escrow_caps, 'duel_declined');

            $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

            DB::table('point_duels')->where('id', $duelRow->id)->update([
                'creator_escrow_caps' => 0,
                'status' => 'declined',
                'declined_at' => $now,
                'updated_at' => $now,
            ]);
        }, 3);

        PointDuelMaintenance::dispatchDuelUpdatedById($duel);

        $updatedDuel = DB::table('point_duels')->where('id', $duel)->first();

        if ($updatedDuel) {
            $this->pushDuelResponse($updatedDuel, 'declined', $member->id);
        }

        return response()->json($this->duelResponseForMember($member, $duel));
    }

    public function cancelDuel(Request $request, string $duel): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $this->ensurePointDuelsReady();

        DB::transaction(function () use ($member, $duel): void {
            $duelRow = $this->duelForMember($duel, $member, true);
            abort_if($duelRow->status !== 'awaitingOpponent', 422, 'Dysten kan ikke annulleres længere.');
            abort_if((string) $duelRow->creator_member_id !== (string) $member->id, 403, 'Kun opretteren kan annullere dysten.');

            $this->refundDuelEscrow($duelRow->creator_member_id, $duelRow, (int) $duelRow->creator_escrow_caps, 'duel_cancelled');

            $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

            DB::table('point_duels')->where('id', $duelRow->id)->update([
                'creator_escrow_caps' => 0,
                'status' => 'cancelled',
                'cancelled_at' => $now,
                'updated_at' => $now,
            ]);
        }, 3);

        PointDuelMaintenance::dispatchDuelUpdatedById($duel);

        return response()->json($this->duelResponseForMember($member, $duel));
    }

    public function confirmDuel(Request $request, string $duel): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $this->ensurePointDuelsReady();

        DB::transaction(function () use ($member, $duel): void {
            $duelRow = $this->duelForMember($duel, $member, true);
            abort_if($duelRow->status !== 'awaitingCreatorConfirm', 422, 'Dysten venter ikke på bekræftelse.');
            abort_if((string) $duelRow->creator_member_id !== (string) $member->id, 403, 'Kun opretteren kan bekræfte dysten.');

            $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

            DB::table('point_duels')->where('id', $duelRow->id)->update([
                'status' => 'active',
                'confirmed_at' => $now,
                'updated_at' => $now,
            ]);
        }, 3);

        PointDuelMaintenance::dispatchDuelUpdatedById($duel);

        return response()->json($this->duelResponseForMember($member, $duel));
    }

    public function completeDuel(Request $request, string $duel): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $this->ensurePointDuelsReady();
        PointDuelMaintenance::expireDueForMember($member);
        $data = $request->validate([
            'winnerMemberId' => ['nullable', 'string', 'max:36'],
        ]);

        DB::transaction(function () use ($member, $duel, $data): void {
            $duelRow = $this->duelForMember($duel, $member, true);
            abort_if($duelRow->status !== 'active', 422, 'Dysten er ikke aktiv.');
            abort_unless(
                in_array((string) $member->id, [(string) $duelRow->creator_member_id, (string) $duelRow->opponent_member_id], true),
                403,
                'Du kan ikke afslutte denne dyst.',
            );

            $isChallenge = ($duelRow->mode ?? 'versus') === 'challenge';
            abort_if($isChallenge && (string) $member->id !== (string) $duelRow->opponent_member_id, 403, 'Kun modtageren kan markere challengen gennemført.');

            $winnerMemberId = $data['winnerMemberId'] ?? $member->id;
            abort_unless(
                in_array((string) $winnerMemberId, [(string) $duelRow->creator_member_id, (string) $duelRow->opponent_member_id], true),
                422,
                'Vælg en gyldig vinder.',
            );

            $winnerMemberId = $isChallenge ? $duelRow->opponent_member_id : $winnerMemberId;

            $pool = (int) $duelRow->creator_escrow_caps + (int) $duelRow->opponent_escrow_caps;
            abort_if($pool <= 0, 422, 'Dysten har ingen Caps i escrow.');
            $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

            if (! $isChallenge && ! blank($duelRow->judge_member_id ?? null)) {
                DB::table('point_duels')->where('id', $duelRow->id)->update([
                    'status' => 'awaitingJudgeApproval',
                    'winner_member_id' => $winnerMemberId,
                    'completed_by_member_id' => $member->id,
                    'judge_requested_at' => $now,
                    'judge_rejected_at' => null,
                    'updated_at' => $now,
                ]);

                return;
            }

            DB::table('point_duels')->where('id', $duelRow->id)->update([
                'status' => 'awaitingResultConfirm',
                'winner_member_id' => $winnerMemberId,
                'completed_by_member_id' => $member->id,
                'updated_at' => $now,
            ]);

            return;
        }, 3);

        PointDuelMaintenance::dispatchDuelUpdatedById($duel);

        $updatedDuel = DB::table('point_duels')->where('id', $duel)->first();

        if ($updatedDuel) {
            if ($updatedDuel->status === 'awaitingJudgeApproval' && ! blank($updatedDuel->judge_member_id ?? null)) {
                $this->pushDuelActionRequired($updatedDuel, 'judge_review', [$updatedDuel->judge_member_id]);
            } elseif ($updatedDuel->status === 'awaitingResultConfirm') {
                $opponentId = (string) $member->id === (string) $updatedDuel->creator_member_id
                    ? $updatedDuel->opponent_member_id
                    : $updatedDuel->creator_member_id;
                if (! blank($opponentId)) {
                    $this->pushDuelActionRequired($updatedDuel, 'confirm_result', [$opponentId]);
                }
            }
        }

        return response()->json($this->duelResponseForMember($member, $duel));
    }

    public function forfeitDuel(Request $request, string $duel): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $this->ensurePointDuelsReady();
        PointDuelMaintenance::expireDueForMember($member);

        DB::transaction(function () use ($member, $duel): void {
            $duelRow = $this->duelForMember($duel, $member, true);

            abort_if(($duelRow->mode ?? 'versus') !== 'challenge', 422, 'Kun challenges kan opgives.');
            abort_if($duelRow->status !== 'active', 422, 'Challengen kan ikke opgives længere.');
            abort_if((string) $duelRow->opponent_member_id !== (string) $member->id, 403, 'Kun modtageren kan give op.');

            $this->refundDuelEscrow($duelRow->creator_member_id, $duelRow, (int) $duelRow->creator_escrow_caps, 'duel_forfeited');

            $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

            $updates = [
                'creator_escrow_caps' => 0,
                'opponent_escrow_caps' => 0,
                'winner_member_id' => null,
                'completed_by_member_id' => null,
                'status' => 'expired',
                'updated_at' => $now,
            ];

            if (Schema::hasColumn('point_duels', 'expired_at')) {
                $updates['expired_at'] = $now;
            }

            DB::table('point_duels')->where('id', $duelRow->id)->update($updates);
        }, 3);

        PointDuelMaintenance::dispatchDuelUpdatedById($duel);

        return response()->json($this->duelResponseForMember($member, $duel));
    }

    public function approveDuel(Request $request, string $duel): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $this->ensurePointDuelsReady();
        PointDuelMaintenance::expireDueForMember($member);

        DB::transaction(function () use ($member, $duel): void {
            $duelRow = $this->duelForMember($duel, $member, true);

            if ($duelRow->status === 'awaitingResultConfirm') {
                abort_unless(
                    in_array((string) $member->id, [(string) $duelRow->creator_member_id, (string) $duelRow->opponent_member_id], true),
                    403,
                    'Kun deltagerne kan bekræfte resultatet.',
                );
                abort_if((string) ($duelRow->completed_by_member_id ?? '') === (string) $member->id, 422, 'Modparten skal bekræfte resultatet.');
                abort_unless($duelRow->winner_member_id, 422, 'Dysten mangler en foreslået vinder.');

                $pool = (int) $duelRow->creator_escrow_caps + (int) $duelRow->opponent_escrow_caps;
                abort_if($pool <= 0, 422, 'Dysten har ingen Caps i escrow.');

                $winner = DB::table('members')->where('id', $duelRow->winner_member_id)->lockForUpdate()->first();
                abort_unless($winner, 422, 'Vinderen findes ikke længere.');

                $balance = (int) ($winner->caps_balance ?? 1000);
                $now = Carbon::now('UTC')->format('Y-m-d H:i:s');
                $settlementDescription = ($duelRow->mode ?? 'versus') === 'challenge'
                    ? 'Challenge-belønning udbetalt efter bekræftelse'
                    : 'Dyst-pulje udbetalt efter fælles bekræftelse';

                DB::table('members')->where('id', $winner->id)->update([
                    'caps_balance' => $balance + $pool,
                ]);
                DB::table('point_duels')->where('id', $duelRow->id)->update([
                    'creator_escrow_caps' => 0,
                    'opponent_escrow_caps' => 0,
                    'status' => 'completed',
                    'completed_at' => $now,
                    'updated_at' => $now,
                ]);
                $this->recordCapTransaction(
                    $winner->id,
                    $winner->class_id,
                    $pool,
                    'duel_settlement',
                    $settlementDescription,
                    'point_duel',
                    $duelRow->id,
                    $member->id,
                    [
                        'creatorMemberId' => $duelRow->creator_member_id,
                        'opponentMemberId' => $duelRow->opponent_member_id,
                        'proposedByMemberId' => $duelRow->completed_by_member_id,
                    ],
                );

                return;
            }

            abort_if($duelRow->status !== 'awaitingJudgeApproval', 422, 'Dysten afventer ikke dommer.');
            abort_if((string) ($duelRow->judge_member_id ?? '') !== (string) $member->id, 403, 'Kun dommeren kan godkende dysten.');
            abort_unless($duelRow->winner_member_id, 422, 'Dysten mangler en foreslået vinder.');

            $pool = (int) $duelRow->creator_escrow_caps + (int) $duelRow->opponent_escrow_caps;
            abort_if($pool <= 0, 422, 'Dysten har ingen Caps i escrow.');

            $winner = DB::table('members')->where('id', $duelRow->winner_member_id)->lockForUpdate()->first();
            abort_unless($winner, 422, 'Vinderen findes ikke længere.');

            $balance = (int) ($winner->caps_balance ?? 1000);
            $now = Carbon::now('UTC')->format('Y-m-d H:i:s');
            $settlementDescription = ($duelRow->mode ?? 'versus') === 'challenge'
                ? 'Challenge-belønning udbetalt efter dommergodkendelse'
                : 'Dyst-pulje udbetalt efter dommergodkendelse';

            DB::table('members')->where('id', $winner->id)->update([
                'caps_balance' => $balance + $pool,
            ]);
            DB::table('point_duels')->where('id', $duelRow->id)->update([
                'creator_escrow_caps' => 0,
                'opponent_escrow_caps' => 0,
                'status' => 'completed',
                'judge_approved_at' => $now,
                'completed_at' => $now,
                'updated_at' => $now,
            ]);
            $this->recordCapTransaction(
                $winner->id,
                $winner->class_id,
                $pool,
                'duel_settlement',
                $settlementDescription,
                'point_duel',
                $duelRow->id,
                $member->id,
                [
                    'creatorMemberId' => $duelRow->creator_member_id,
                    'opponentMemberId' => $duelRow->opponent_member_id,
                    'judgeMemberId' => $member->id,
                ],
            );
        }, 3);

        PointDuelMaintenance::dispatchDuelUpdatedById($duel);

        $updatedDuel = DB::table('point_duels')->where('id', $duel)->first();

        if ($updatedDuel && $updatedDuel->status === 'completed') {
            $this->pushDuelResult($updatedDuel);
        }

        return response()->json($this->duelResponseForMember($member, $duel));
    }

    public function rejectDuel(Request $request, string $duel): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $this->ensurePointDuelsReady();

        DB::transaction(function () use ($member, $duel): void {
            $duelRow = $this->duelForMember($duel, $member, true);

            if ($duelRow->status === 'awaitingResultConfirm') {
                abort_unless(
                    in_array((string) $member->id, [(string) $duelRow->creator_member_id, (string) $duelRow->opponent_member_id], true),
                    403,
                    'Kun deltagerne kan afvise resultatet.',
                );
                abort_if((string) ($duelRow->completed_by_member_id ?? '') === (string) $member->id, 422, 'Modparten skal afvise resultatet.');
                $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

                DB::table('point_duels')->where('id', $duelRow->id)->update([
                    'status' => 'active',
                    'winner_member_id' => null,
                    'completed_by_member_id' => null,
                    'updated_at' => $now,
                ]);

                return;
            }

            abort_if($duelRow->status !== 'awaitingJudgeApproval', 422, 'Dysten afventer ikke dommer.');
            abort_if((string) ($duelRow->judge_member_id ?? '') !== (string) $member->id, 403, 'Kun dommeren kan afvise dysten.');
            $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

            DB::table('point_duels')->where('id', $duelRow->id)->update([
                'status' => 'active',
                'winner_member_id' => null,
                'completed_by_member_id' => null,
                'judge_rejected_at' => $now,
                'updated_at' => $now,
            ]);
        }, 3);

        PointDuelMaintenance::dispatchDuelUpdatedById($duel);

        $updatedDuel = DB::table('point_duels')->where('id', $duel)->first();

        if ($updatedDuel && $updatedDuel->status === 'active') {
            $recipients = collect([$updatedDuel->creator_member_id, $updatedDuel->opponent_member_id])
                ->reject(fn ($id): bool => (string) $id === (string) $member->id)
                ->all();
            $this->pushDuelActionRequired($updatedDuel, 'confirm_result', $recipients);
        }

        return response()->json($this->duelResponseForMember($member, $duel));
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

        try {
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
        } catch (QueryException $exception) {
            if ($this->isDuplicateEmailConstraintError($exception)) {
                abort(422, 'Denne email er allerede knyttet til en anden klasse.');
            }

            throw $exception;
        }

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

        $blockedMemberIds = $this->blockedMemberIdsForMember($viewer);
        $connections = DB::table('member_connections')
            ->where('requester_member_id', $member)
            ->orWhere('receiver_member_id', $member)
            ->orderByRaw("CASE status WHEN 'pending' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END")
            ->orderByDesc('created_at')
            ->get()
            ->reject(function (object $connection) use ($member, $blockedMemberIds): bool {
                $otherMemberId = (string) $connection->requester_member_id === (string) $member
                    ? $connection->receiver_member_id
                    : $connection->requester_member_id;

                return $blockedMemberIds->contains((string) $otherMemberId);
            })
            ->values();

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

        if ($connection->status === 'pending') {
            $this->pushConnectionRequest($connection->id, $requester, $receiver->id);
        } elseif ($connection->status === 'accepted') {
            // The mutual-pending shortcut auto-accepted: notify the original requester.
            $originalRequesterId = $connection->requester_member_id === $requester->id
                ? $connection->receiver_member_id
                : $connection->requester_member_id;
            $this->pushConnectionAccepted($connection->id, $requester, $originalRequesterId);
        }

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

        if ($updatedConnection->status === 'accepted') {
            $this->pushConnectionAccepted($updatedConnection->id, $member, $updatedConnection->requester_member_id);
        }

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
            'emergencyContactName' => ['nullable', 'string', 'max:190'],
            'emergencyContactPhone' => ['nullable', 'string', 'max:40'],
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
        $emergencyContactName = blank($data['emergencyContactName'] ?? null) ? null : trim($data['emergencyContactName']);
        $emergencyContactPhone = blank($data['emergencyContactPhone'] ?? null) ? null : trim($data['emergencyContactPhone']);
        $displayName = trim($firstName.' '.$lastName);
        $email = Str::lower(trim($data['email']));
        $classId = null;
        $member = null;

        try {
            DB::transaction(function () use (
            $request,
            $data,
            $inviteCode,
            $schoolId,
            $firstName,
            $lastName,
            $displayName,
            $email,
            $emergencyContactName,
            $emergencyContactPhone,
            &$classId,
            &$member
        ): void {
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
            $emailUsedInOtherClass = DB::table('members')
                ->whereRaw('LOWER(email) = ?', [$email])
                ->where('class_id', '!=', $classId)
                ->exists();

            abort_if(
                $emailUsedInOtherClass,
                422,
                'Denne email er allerede knyttet til en anden klasse.',
            );

            $status = ($schoolClass->join_policy ?? 'approval') === 'open' ? 'active' : 'pending';
            $phone = blank($data['phone'] ?? null) ? null : trim($data['phone']);
            $acceptedAt = now()->format('Y-m-d H:i:s');
            $existingMember = DB::table('members')
                ->where('class_id', $classId)
                ->whereRaw('LOWER(email) = ?', [$email])
                ->where('status', '!=', 'removed')
                ->first();

            if ($existingMember) {
                $isPendingPlaceholder = ($existingMember->status ?? 'active') !== 'removed'
                    && blank($existingMember->password_hash ?? null);

                if (($existingMember->status ?? 'active') !== 'removed' && ! $isPendingPlaceholder) {
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
                    'role' => $isPendingPlaceholder ? $existingMember->role : 'student',
                    'status' => $isPendingPlaceholder ? 'active' : $status,
                ];

                if (Schema::hasColumn('members', 'emergency_contact_name')) {
                    $updates['emergency_contact_name'] = $emergencyContactName;
                }

                if (Schema::hasColumn('members', 'emergency_contact_phone')) {
                    $updates['emergency_contact_phone'] = $emergencyContactPhone;
                }

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
            $memberData = [
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
            ];

            if (Schema::hasColumn('members', 'emergency_contact_name')) {
                $memberData['emergency_contact_name'] = $emergencyContactName;
            }

            if (Schema::hasColumn('members', 'emergency_contact_phone')) {
                $memberData['emergency_contact_phone'] = $emergencyContactPhone;
            }

            DB::table('members')->insert($memberData);
            $member = $this->serializeMember(DB::table('members')->where('id', $memberId)->first(), true, true);
        });
        } catch (QueryException $exception) {
            if ($this->isDuplicateEmailConstraintError($exception)) {
                abort(422, 'Denne email er allerede knyttet til en anden klasse.');
            }

            throw $exception;
        }

        return response()->json([
            'session' => $this->sessionForMember($member, $this->issueMemberToken($member['id'])),
            'class' => $this->loadClassById($classId, $member['id']),
        ]);
    }

    public function loginWithPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
            'password' => ['required', 'string'],
        ]);

        $email = Str::lower(trim($data['email']));
        $password = $data['password'];
        $members = DB::table('members')
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('status', '!=', 'removed')
            ->whereNotNull('password_hash')
            ->get();

        $memberCandidates = $members
            ->filter(fn (object $member) => Hash::check($password, $member->password_hash))
            ->values();

        abort_if(
            $memberCandidates->count() > 1,
            422,
            'Emailen er koblet til flere klasser. Kontakt support for hjælp.',
        );

        $member = $memberCandidates->first();
        abort_if(! $member, 422, 'Email eller adgangskode er forkert.');

        $schoolClass = DB::table('classes')->where('id', $member->class_id)->first();
        abort_if(! $schoolClass, 404, 'Klassen kunne ikke findes.');

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

    public function overviewStats(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);

        if (Schema::hasTable('point_duels')) {
            PointDuelMaintenance::expireDueForMember($member);
        }

        return response()->json([
            'stats' => $this->overviewStatsForMember($member),
        ]);
    }

    public function activities(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $limit = min(80, max(1, (int) $request->integer('limit', 40)));
        $now = now();
        $blockedMemberIds = $this->blockedMemberIdsForMember($member);
        $memberQuery = DB::table('members')
            ->where('class_id', $member->class_id)
            ->where('status', 'active')
            ->select([
                'id',
                'display_name',
                'first_name',
                'last_name',
                'profile_photo_url',
                'birthday',
                'joined_at',
            ]);

        if (Schema::hasColumn('members', 'deleted_at')) {
            $memberQuery->whereNull('deleted_at');
        }

        if ($blockedMemberIds->isNotEmpty()) {
            $memberQuery->whereNotIn('id', $blockedMemberIds->all());
        }

        $members = $memberQuery
            ->get()
            ->keyBy(fn (object $row): string => (string) $row->id);
        $activities = collect();

        $members->each(function (object $classMember) use ($activities): void {
            if (blank($classMember->joined_at ?? null)) {
                return;
            }

            $name = $this->activityMemberName($classMember);

            $activities->push([
                'id'         => 'member-joined:'.$classMember->id,
                'type'       => 'member_joined',
                'sourceId'   => $classMember->id,
                'occurredAt' => $this->apiDateTime($classMember->joined_at ?? null),
                'actor'      => $this->activityMemberShape($classMember),
                'text'       => $name.' blev medlem af klassen',
                'meta'       => null,
                'preview'    => [
                    'kind' => 'member',
                    'icon' => 'person-add',
                ],
            ]);
        });

        $members->each(function (object $classMember) use ($activities, $now): void {
            if (blank($classMember->birthday ?? null)) {
                return;
            }

            try {
                $birthday = Carbon::parse($classMember->birthday);
            } catch (\Throwable) {
                return;
            }

            if ($birthday->format('m-d') !== $now->format('m-d')) {
                return;
            }

            $name = $this->activityMemberName($classMember);

            $activities->push([
                'id'         => 'birthday:'.$now->toDateString().':'.$classMember->id,
                'type'       => 'birthday',
                'occurredAt' => $this->apiDateTime($now),
                'actor'      => $this->activityMemberShape($classMember),
                'text'       => $name.' har fødselsdag i dag!',
                'meta'       => 'Fødselsdag',
                'preview'    => [
                    'kind' => 'birthday',
                    'icon' => 'gift',
                ],
            ]);
        });

        if (Schema::hasTable('events')) {
            $events = DB::table('events')
                ->where('class_id', $member->class_id)
                ->orderByDesc('created_at')
                ->limit(80)
                ->get();
            $eventInvites = collect();

            if (Schema::hasTable('event_invites') && $events->isNotEmpty()) {
                $eventInvites = DB::table('event_invites')
                    ->whereIn('event_id', $events->pluck('id')->all())
                    ->get()
                    ->groupBy('event_id');
            }

            $events->each(function (object $event) use ($activities, $blockedMemberIds, $eventInvites, $member, $members): void {
                if ($this->activityInvolvesBlockedMember($blockedMemberIds, $event->created_by_member_id ?? null)) {
                    return;
                }

                if (! $this->activityEventIsVisibleToMember($event, $member, $eventInvites)) {
                    return;
                }

                $creator = $members->get((string) ($event->created_by_member_id ?? ''));
                $creatorName = $this->activityMemberName($creator);

                $activities->push([
                    'id'         => 'event:'.$event->id,
                    'type'       => 'event_created',
                    'sourceId'   => $event->id,
                    'occurredAt' => $this->apiDateTime($event->created_at ?? $event->starts_at ?? $event->event_date ?? null),
                    'actor'      => $this->activityMemberShape($creator),
                    'text'       => $creatorName.' har oprettet et event',
                    'meta'       => $event->title ?? null,
                    'preview'    => [
                        'kind'  => 'event',
                        'title' => $event->title ?? null,
                        'icon'  => 'calendar',
                    ],
                ]);
            });
        }

        if (Schema::hasTable('galleries')) {
            $galleryQuery = DB::table('galleries')
                ->where('class_id', $member->class_id)
                ->where('visibility', 'public')
                ->where(function ($query): void {
                    $query->whereNull('audience')->orWhere('audience', '!=', 'crew');
                })
                ->whereNull('deleted_at');

            $this->applyGalleryVisibilityQuery($galleryQuery, $member, 'galleries');

            $galleryQuery
                ->orderByDesc('created_at')
                ->limit(80)
                ->get()
                ->each(function (object $gallery) use ($activities, $blockedMemberIds, $members): void {
                    if ($this->activityInvolvesBlockedMember($blockedMemberIds, $gallery->created_by_member_id ?? null)) {
                        return;
                    }

                    $creator = $members->get((string) ($gallery->created_by_member_id ?? ''));
                    $creatorName = $this->activityMemberName($creator);

                    $activities->push([
                        'id'         => 'gallery:'.$gallery->id,
                        'type'       => 'gallery_created',
                        'sourceId'   => $gallery->id,
                        'occurredAt' => $this->apiDateTime($gallery->created_at ?? null),
                        'actor'      => $this->activityMemberShape($creator),
                        'text'       => $creatorName.' har oprettet et fælles album',
                        'meta'       => $gallery->name ?? null,
                        'preview'    => [
                            'kind'     => 'gallery',
                            'title'    => $gallery->name ?? null,
                            'imageUri' => UploadedImage::publicUrl($gallery->cover_image_url ?? null, request()),
                            'icon'     => 'images',
                        ],
                    ]);
                });
        }

        if (Schema::hasTable('gallery_photos') && Schema::hasTable('galleries')) {
            $photoQuery = DB::table('gallery_photos')
                ->join('galleries', 'galleries.id', '=', 'gallery_photos.gallery_id')
                ->where('galleries.class_id', $member->class_id)
                ->where('galleries.visibility', 'public')
                ->where(function ($query): void {
                    $query->whereNull('galleries.audience')->orWhere('galleries.audience', '!=', 'crew');
                })
                ->whereNull('gallery_photos.deleted_at')
                ->whereNull('galleries.deleted_at');

            $this->applyGalleryVisibilityQuery($photoQuery, $member, 'galleries');

            $photoGroups = [];
            $photoQuery
                ->orderByDesc('gallery_photos.created_at')
                ->limit(100)
                ->get([
                    'gallery_photos.id as photoId',
                    'gallery_photos.gallery_id as galleryId',
                    'gallery_photos.member_id as memberId',
                    'gallery_photos.image_url as imageUrl',
                    'gallery_photos.created_at as photoCreatedAt',
                    'galleries.name as galleryName',
                    'galleries.created_by_member_id as galleryCreatorId',
                ])
                ->each(function (object $photo) use (&$photoGroups): void {
                    $bucketTime = 'unknown';

                    if (! blank($photo->photoCreatedAt ?? null)) {
                        try {
                            $bucketTime = Carbon::parse($photo->photoCreatedAt)->format('Y-m-d H:i');
                        } catch (\Throwable) {
                            $bucketTime = (string) $photo->photoId;
                        }
                    }

                    $key = implode('|', [
                        (string) $photo->galleryId,
                        (string) ($photo->memberId ?? ''),
                        $bucketTime,
                    ]);

                    $photoGroups[$key] ??= [
                        'galleryId'        => $photo->galleryId,
                        'memberId'         => $photo->memberId,
                        'galleryCreatorId' => $photo->galleryCreatorId,
                        'galleryName'      => $photo->galleryName,
                        'imageUrl'         => $photo->imageUrl,
                        'createdAt'        => $photo->photoCreatedAt,
                        'count'            => 0,
                    ];
                    $photoGroups[$key]['count']++;
                });

            foreach ($photoGroups as $group) {
                if ($this->activityInvolvesBlockedMember(
                    $blockedMemberIds,
                    $group['memberId'] ?? null,
                    $group['galleryCreatorId'] ?? null,
                )) {
                    continue;
                }

                $uploader = $members->get((string) ($group['memberId'] ?? ''));
                $uploaderName = $this->activityMemberName($uploader);
                $count = (int) $group['count'];

                $activities->push([
                    'id'         => 'gallery-photos:'.$group['galleryId'].':'.$group['memberId'].':'.md5((string) $group['createdAt']),
                    'type'       => 'gallery_photos_uploaded',
                    'sourceId'   => $group['galleryId'],
                    'occurredAt' => $this->apiDateTime($group['createdAt'] ?? null),
                    'actor'      => $this->activityMemberShape($uploader),
                    'text'       => $uploaderName.' har uploadet '.($count === 1 ? 'et billede' : $count.' billeder'),
                    'meta'       => $group['galleryName'] ?? null,
                    'preview'    => [
                        'kind'     => 'photo',
                        'title'    => $group['galleryName'] ?? null,
                        'imageUri' => UploadedImage::publicUrl($group['imageUrl'] ?? null, request()),
                        'icon'     => 'image',
                    ],
                ]);
            }
        }

        if (Schema::hasTable('point_duels')) {
            DB::table('point_duels')
                ->where('class_id', $member->class_id)
                ->where('status', 'completed')
                ->whereNotNull('winner_member_id')
                ->orderByDesc('completed_at')
                ->orderByDesc('updated_at')
                ->limit(80)
                ->get()
                ->each(function (object $duel) use ($activities, $blockedMemberIds, $members): void {
                    if ($this->activityInvolvesBlockedMember(
                        $blockedMemberIds,
                        $duel->creator_member_id ?? null,
                        $duel->opponent_member_id ?? null,
                        $duel->winner_member_id ?? null,
                    )) {
                        return;
                    }

                    $mode = $duel->mode ?? 'versus';
                    $creator = $members->get((string) ($duel->creator_member_id ?? ''));
                    $winner = $members->get((string) ($duel->winner_member_id ?? ''));

                    if (! $winner) {
                        return;
                    }

                    if ($mode === 'challenge') {
                        $activities->push([
                            'id'         => 'duel:challenge:'.$duel->id,
                            'type'       => 'challenge_completed',
                            'sourceId'   => $duel->id,
                            'occurredAt' => $this->apiDateTime($duel->completed_at ?? $duel->updated_at ?? null),
                            'actor'      => $this->activityMemberShape($winner),
                            'target'     => $this->activityMemberShape($creator),
                            'text'       => $this->activityMemberName($winner).' har gennemført en challenge fra '.$this->activityMemberName($creator),
                            'meta'       => null,
                            'preview'    => [
                                'kind' => 'challenge',
                                'icon' => 'sparkles',
                            ],
                        ]);

                        return;
                    }

                    $loserId = (string) $duel->winner_member_id === (string) $duel->creator_member_id
                        ? (string) ($duel->opponent_member_id ?? '')
                        : (string) ($duel->creator_member_id ?? '');
                    $loser = $members->get($loserId);

                    if (! $loser) {
                        return;
                    }

                    $activities->push([
                        'id'         => 'duel:versus:'.$duel->id,
                        'type'       => 'versus_won',
                        'sourceId'   => $duel->id,
                        'occurredAt' => $this->apiDateTime($duel->completed_at ?? $duel->updated_at ?? null),
                        'actor'      => $this->activityMemberShape($winner),
                        'target'     => $this->activityMemberShape($loser),
                        'text'       => $this->activityMemberName($winner).' har vundet over '.$this->activityMemberName($loser),
                        'meta'       => 'Mod hinanden',
                        'preview'    => [
                            'kind' => 'duel',
                            'icon' => 'flash',
                        ],
                    ]);
                });
        }

        $sortedActivities = $activities
            ->filter(fn (array $activity): bool => filled($activity['occurredAt'] ?? null))
            ->sortByDesc(fn (array $activity): int => strtotime((string) ($activity['occurredAt'] ?? '')) ?: 0)
            ->values()
            ->take($limit)
            ->values();

        return response()
            ->json([
                'activities' => $sortedActivities->all(),
            ])
            ->header('Cache-Control', 'private, no-store, max-age=0')
            ->header('Pragma', 'no-cache');
    }

    private function activityEventIsVisibleToMember(object $event, object $member, $eventInvites): bool
    {
        if (($event->invite_scope ?? 'class') !== 'custom') {
            return true;
        }

        if ((string) ($event->created_by_member_id ?? '') === (string) $member->id) {
            return true;
        }

        $invitesForEvent = $eventInvites->get($event->id, collect());

        return $invitesForEvent->contains(fn (object $invite): bool =>
            (string) $invite->member_id === (string) $member->id
        );
    }

    private function blockedMemberIdsForMember(object $member)
    {
        if (! Schema::hasTable('member_blocks')) {
            return collect();
        }

        return DB::table('member_blocks')
            ->where('blocker_member_id', $member->id)
            ->orWhere('blocked_member_id', $member->id)
            ->get(['blocker_member_id', 'blocked_member_id'])
            ->map(fn (object $block): ?string => (
                (string) $block->blocker_member_id === (string) $member->id
                    ? $block->blocked_member_id
                    : $block->blocker_member_id
            ))
            ->filter()
            ->unique()
            ->values();
    }

    private function activityInvolvesBlockedMember($blockedMemberIds, ...$memberIds): bool
    {
        if (! $blockedMemberIds || $blockedMemberIds->isEmpty()) {
            return false;
        }

        foreach ($memberIds as $memberId) {
            if (! blank($memberId) && $blockedMemberIds->contains((string) $memberId)) {
                return true;
            }
        }

        return false;
    }

    private function activityMemberShape(?object $member): ?array
    {
        if (! $member) {
            return null;
        }

        return [
            'id'              => $member->id,
            'displayName'     => $this->activityMemberName($member),
            'profilePhotoUrl' => UploadedImage::publicUrl($member->profile_photo_url ?? $member->profilePhotoUrl ?? null, request()),
        ];
    }

    private function activityMemberName(?object $member): string
    {
        if (! $member) {
            return 'En bruger';
        }

        $name = trim((string) ($member->display_name ?? $member->displayName ?? ''));

        if ($name !== '') {
            return $name;
        }

        $fullName = trim(implode(' ', array_filter([
            $member->first_name ?? $member->firstName ?? '',
            $member->last_name ?? $member->lastName ?? '',
        ])));

        return $fullName !== '' ? $fullName : 'En bruger';
    }

    private function overviewStatsForMember(object $member): array
    {
        $completedDuels = 0;
        $pendingDuels = 0;
        $activeDuels = 0;
        $wonDuels = 0;
        $lostDuels = 0;
        $attendedEvents = 0;
        $accessiblePhotos = 0;

        if (Schema::hasTable('point_duels')) {
            $memberDuelQuery = fn () => DB::table('point_duels')
                ->where('class_id', $member->class_id)
                ->where(function ($query) use ($member): void {
                    $query
                        ->where('creator_member_id', $member->id)
                        ->orWhere('opponent_member_id', $member->id);
                });

            $completedDuels = $memberDuelQuery()
                ->where('status', 'completed')
                ->whereNotNull('winner_member_id')
                ->count();
            $pendingDuels = $memberDuelQuery()
                ->whereIn('status', [
                    'awaitingOpponent',
                    'awaitingCreatorConfirm',
                    'awaitingResultConfirm',
                    'awaitingJudgeApproval',
                ])
                ->count();
            $activeDuels = $memberDuelQuery()
                ->where('status', 'active')
                ->count();
            $wonDuels = $memberDuelQuery()
                ->where('status', 'completed')
                ->where('winner_member_id', $member->id)
                ->count();
            $lostDuels = $memberDuelQuery()
                ->where('status', 'completed')
                ->whereNotNull('winner_member_id')
                ->where('winner_member_id', '!=', $member->id)
                ->count();
        }

        if (Schema::hasTable('event_rsvps')) {
            $attendedEvents = DB::table('event_rsvps')
                ->join('events', 'events.id', '=', 'event_rsvps.event_id')
                ->where('events.class_id', $member->class_id)
                ->where('event_rsvps.member_id', $member->id)
                ->where('event_rsvps.status', 'attending')
                ->count();
        }

        if (Schema::hasTable('galleries') && Schema::hasTable('gallery_photos')) {
            $visibleGalleryIds = DB::table('galleries')
                ->select('id')
                ->where('class_id', $member->class_id)
                ->whereNull('deleted_at');

            $this->applyGalleryVisibilityQuery($visibleGalleryIds, $member);

            $accessiblePhotos = DB::table('gallery_photos')
                ->whereNull('deleted_at')
                ->whereIn('gallery_id', $visibleGalleryIds)
                ->count();
        }

        return [
            'completedDuels' => (int) $completedDuels,
            'pendingDuels' => (int) $pendingDuels,
            'activeDuels' => (int) $activeDuels,
            'wonDuels' => (int) $wonDuels,
            'lostDuels' => (int) $lostDuels,
            'attendedEvents' => (int) $attendedEvents,
            'accessiblePhotos' => (int) $accessiblePhotos,
        ];
    }

    public function registerPushToken(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'expoPushToken' => ['required', 'string', 'max:255'],
            'platform' => ['required', Rule::in(['android', 'ios'])],
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
            ->whereIn('platform', ['android', 'ios'])
            ->whereNull('disabled_at')
            ->get(['expo_push_token', 'platform']);

        abort_if($tokens->isEmpty(), 422, 'Der er ikke gemt en push-token endnu.');

        $messages = $tokens
            ->map(function (object $token) use ($data): array {
                $message = [
                    'to' => $token->expo_push_token,
                    'sound' => 'default',
                    'title' => $data['title'] ?? 'Studos test',
                    'body' => $data['body'] ?? 'Hvis du ser den her, virker push.',
                    'data' => [
                        'type' => 'test',
                        'screen' => 'overview',
                    ],
                ];

                if ($token->platform === 'android') {
                    $message['channelId'] = 'studos-default';
                }

                return $message;
            })
            ->values()
            ->all();

        $response = Http::timeout(8)
            ->acceptJson()
            ->post('https://exp.host/--/api/v2/push/send', $messages);

        abort_if($response->failed(), 502, 'Expo Push Service kunne ikke sende testen.');

        return response()->json([
            'ok' => true,
            'sent' => count($messages),
            'message' => 'Testnotifikation sendt.',
            'expoResponse' => $response->json(),
        ]);
    }

    public function updateProfilePhoto(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'profilePhotoData' => ['nullable', 'string', 'max:7000000'],
        ]);

        $currentProfilePhoto = DB::table('members')
            ->where('id', $member->id)
            ->value('profile_photo_url');
        $newPhotoData = $data['profilePhotoData'] ?? null;

        if (filled($newPhotoData)) {
            $profilePhotoPath = UploadedImage::storeBase64(
                $newPhotoData,
                'profile-photos',
                $member->id,
            );
        } else {
            $profilePhotoPath = null;

            if (! blank($currentProfilePhoto)) {
                $oldPath = UploadedImage::storagePathFromValue($currentProfilePhoto);

                if (! blank($oldPath)) {
                    Storage::disk(UploadedImage::uploadDiskName())->delete($oldPath);
                }
            }
        }

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

    public function updateProfile(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'phone' => ['nullable', 'string', 'max:40'],
            'birthday' => ['nullable', 'string', 'max:10'],
        ]);

        $phone = blank($data['phone'] ?? null) ? null : trim($data['phone']);
        $birthday = blank($data['birthday'] ?? null) ? null : trim($data['birthday']);

        if ($birthday !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthday)) {
            abort(422, 'Fødselsdag skal være i format YYYY-MM-DD.');
        }

        if ($birthday !== null) {
            $parsedBirthday = Carbon::createFromFormat('Y-m-d', $birthday);

            if (! $parsedBirthday || $parsedBirthday->format('Y-m-d') !== $birthday) {
                abort(422, 'Fødselsdag skal være en gyldig dato i format YYYY-MM-DD.');
            }
        }

        $updates = [];

        if (Schema::hasColumn('members', 'phone')) {
            $updates['phone'] = $phone;
        }

        if (Schema::hasColumn('members', 'birthday')) {
            $updates['birthday'] = $birthday;
        }

        if ($updates) {
            DB::table('members')->where('id', $member->id)->update($updates);
        }

        $updatedMember = DB::table('members')->where('id', $member->id)->first();
        $serializedMember = $this->serializeMember($updatedMember, true, true, $member->id);

        return response()->json([
            'member' => $serializedMember,
            'class' => $this->loadClassById($member->class_id, $member->id),
        ]);
    }

    public function updateEmergencyContactVisibility(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'visibility' => ['required', 'string', Rule::in(self::EMERGENCY_CONTACT_VISIBILITIES)],
            'visibleMemberIds' => ['nullable', 'array', 'max:250'],
            'visibleMemberIds.*' => ['string', 'max:36'],
        ]);

        $visibility = $this->normalizeEmergencyContactVisibility($data['visibility']);
        $visibleMemberIds = $visibility === 'specific'
            ? $this->normalizeEmergencyContactMemberIds($data['visibleMemberIds'] ?? [])
            : [];
        $visibleMemberIds = array_values(array_unique(array_filter(
            $visibleMemberIds,
            fn (string $visibleMemberId): bool => (string) $visibleMemberId !== (string) $member->id,
        )));

        if ($visibility === 'specific') {
            $classMembers = DB::table('members')
                ->where('class_id', $member->class_id)
                ->where('status', 'active')
                ->whereIn('id', $visibleMemberIds)
                ->pluck('id')
                ->all();

            abort_if(
                count($classMembers) !== count($visibleMemberIds),
                422,
                'Et eller flere valgte personer findes ikke længere.',
            );
        }

        DB::table('members')->where('id', $member->id)->update([
            'emergency_contact_visibility' => $visibility,
            'emergency_contact_visible_member_ids' => $visibility === 'specific'
                ? json_encode($visibleMemberIds, JSON_UNESCAPED_UNICODE)
                : null,
        ]);

        $updatedMember = DB::table('members')->where('id', $member->id)->first();
        $serializedMember = $this->serializeMember($updatedMember, true, true, $member->id);

        return response()->json([
            'member' => $serializedMember,
            'class' => $this->loadClassById($member->class_id, $member->id),
        ]);
    }

    public function updateEmergencyContact(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'emergencyContactName' => ['nullable', 'string', 'max:190'],
            'emergencyContactPhone' => ['nullable', 'string', 'max:40'],
        ]);

        $emergencyContactName = blank($data['emergencyContactName'] ?? null) ? null : trim($data['emergencyContactName']);
        $emergencyContactPhone = blank($data['emergencyContactPhone'] ?? null)
            ? null
            : trim($data['emergencyContactPhone']);

        $updates = [];
        if (Schema::hasColumn('members', 'emergency_contact_name')) {
            $updates['emergency_contact_name'] = $emergencyContactName;
        }

        if (Schema::hasColumn('members', 'emergency_contact_phone')) {
            $updates['emergency_contact_phone'] = $emergencyContactPhone;
        }

        if ($updates) {
            DB::table('members')->where('id', $member->id)->update($updates);
        }

        $updatedMember = DB::table('members')->where('id', $member->id)->first();
        $serializedMember = $this->serializeMember($updatedMember, true, true, $member->id);

        return response()->json([
            'member' => $serializedMember,
            'class' => $this->loadClassById($member->class_id, $member->id),
        ]);
    }

    public function deleteCurrentAccount(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);

        if (
            $member->role === 'owner'
            && ! $this->hasOtherActiveOwner($member->class_id, $member->id)
        ) {
            abort(409, 'Klassen skal have mindst en aktiv owner.');
        }

        $currentProfilePhoto = DB::table('members')
            ->where('id', $member->id)
            ->value('profile_photo_url');
        $deletedAt = now()->format('Y-m-d H:i:s');

        DB::transaction(function () use ($member, $currentProfilePhoto, $deletedAt): void {
            if (! blank($currentProfilePhoto)) {
                $oldPath = UploadedImage::storagePathFromValue($currentProfilePhoto);

                if (! blank($oldPath)) {
                    Storage::disk(UploadedImage::uploadDiskName())->delete($oldPath);
                }
            }

            DB::table('events')
                ->where('created_by_member_id', $member->id)
                ->update([
                    'created_by_member_id' => null,
                ]);

            DB::table('event_invites')
                ->where('invited_by_member_id', $member->id)
                ->update([
                    'invited_by_member_id' => null,
                ]);

            DB::table('member_reports')
                ->where('reporter_member_id', $member->id)
                ->orWhere('reported_member_id', $member->id)
                ->update([
                    'reporter_member_id' => null,
                    'reported_member_id' => null,
                ]);

            DB::table('moderation_violations')
                ->where('member_id', $member->id)
                ->update([
                    'member_id' => null,
                ]);

            DB::table('chat_moderation_events')
                ->where('actor_member_id', $member->id)
                ->orWhere('target_member_id', $member->id)
                ->update([
                    'actor_member_id' => null,
                    'target_member_id' => null,
                ]);

            DB::table('member_auth_tokens')->where('member_id', $member->id)->delete();
            DB::table('member_push_tokens')->where('member_id', $member->id)->delete();
            DB::table('members')->where('id', $member->id)->update([
                'status' => 'removed',
                'deletion_requested_at' => $deletedAt,
                'deleted_at' => $deletedAt,
                'display_name' => 'Slettet bruger '.$member->id,
                'first_name' => null,
                'last_name' => null,
                'email' => null,
                'phone' => null,
                'birthday' => null,
                'personal_code' => null,
                'profile_photo_url' => null,
                'password_hash' => null,
                'terms_accepted_at' => null,
                'privacy_accepted_at' => null,
                'privacy_version' => null,
            ]);
        });

        return response()->json([
            'ok' => true,
            'message' => 'Kontoen er slettet permanent og personoplysninger er anonymiseret.',
        ]);
    }

    private function goodDeedStateForMember(object $member, Request $request): array
    {
        ['week' => $week, 'weekKey' => $weekKey] = $this->currentGoodDeedWeek();

        $this->expireGoodDeedClaims();

        $myClaim = $this->goodDeedClaimQuery()
            ->where('good_deed_claims.week_key', $weekKey)
            ->where('good_deed_claims.member_id', $member->id)
            ->orderByDesc('good_deed_claims.created_at')
            ->first();

        return [
            'week' => [
                'id' => $week->id,
                'weekKey' => $weekKey,
                'weekNumber' => (int) $week->week_number,
                'title' => $week->title,
                'description' => $week->description,
                'verificationHint' => $week->verification_hint,
                'baseCaps' => (int) $week->base_caps,
                'photoBonusCaps' => 0,
            ],
            'myClaim' => $myClaim ? $this->serializeGoodDeedClaim($myClaim, $request) : null,
            'pendingVerifications' => [],
            'buddyOptions' => [],
        ];
    }

    private function weeklyCheckInStateForMember(object $member): array
    {
        if (! Schema::hasTable('weekly_check_ins')) {
            return [
                'checkedInToday' => false,
                'completedWeeks' => 0,
                'lastDayKey' => null,
                'streak' => 0,
                'rewardCaps' => 100,
                'capsBalance' => (int) ($member->caps_balance ?? 1000),
            ];
        }

        $today = now()->toDateString();
        $yesterday = Carbon::parse($today)->subDay()->toDateString();
        $latestCheckIn = DB::table('weekly_check_ins')
            ->where('member_id', $member->id)
            ->orderByDesc('day_key')
            ->first();
        $latestDayKey = $latestCheckIn?->day_key ? Carbon::parse($latestCheckIn->day_key)->toDateString() : null;
        $streak = in_array($latestDayKey, [$today, $yesterday], true)
            ? min(7, max(0, (int) ($latestCheckIn->streak_day ?? 0)))
            : 0;

        if ($latestDayKey === $yesterday && $streak >= 7) {
            $streak = 0;
        }

        $completedWeeks = (int) DB::table('weekly_check_ins')
            ->where('member_id', $member->id)
            ->where('reward_awarded', true)
            ->count();
        $capsBalance = (int) (DB::table('members')->where('id', $member->id)->value('caps_balance') ?? 1000);

        return [
            'checkedInToday' => $latestDayKey === $today,
            'completedWeeks' => $completedWeeks,
            'lastDayKey' => $latestDayKey,
            'streak' => $streak,
            'rewardCaps' => 100,
            'capsBalance' => $capsBalance,
        ];
    }

    private function currentGoodDeedWeek(): array
    {
        $now = now();
        $isoWeek = (int) $now->isoWeek();
        $weekNumber = (($isoWeek - 1) % 52) + 1;
        $week = DB::table('good_deed_weeks')
            ->where('week_number', $weekNumber)
            ->first();

        abort_unless($week, 500, 'Ugens gode gerning mangler.');

        return [
            'week' => $week,
            'weekKey' => sprintf('%d-W%02d', (int) $now->isoWeekYear(), $isoWeek),
        ];
    }

    private function expireGoodDeedClaims(): void
    {
        DB::table('good_deed_claims')
            ->where('status', 'pending')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now()->format('Y-m-d H:i:s'))
            ->update([
                'status' => 'expired',
                'updated_at' => now()->format('Y-m-d H:i:s'),
            ]);
    }

    private function goodDeedClaimQuery()
    {
        return DB::table('good_deed_claims')
            ->join('good_deed_weeks', 'good_deed_weeks.id', '=', 'good_deed_claims.good_deed_week_id')
            ->join('members as claimants', 'claimants.id', '=', 'good_deed_claims.member_id')
            ->join('members as verifiers', 'verifiers.id', '=', 'good_deed_claims.verifier_member_id')
            ->select([
                'good_deed_claims.*',
                'good_deed_weeks.title as weekTitle',
                'claimants.display_name as memberDisplayName',
                'claimants.first_name as memberFirstName',
                'claimants.profile_photo_url as memberProfilePhotoUrl',
                'verifiers.display_name as verifierDisplayName',
                'verifiers.first_name as verifierFirstName',
                'verifiers.profile_photo_url as verifierProfilePhotoUrl',
            ]);
    }

    private function serializeGoodDeedClaim(object $claim, Request $request): array
    {
        $photoBonusCaps = filled($claim->photo_url ?? null) ? (int) $claim->photo_bonus_caps : 0;
        $baseCaps = (int) $claim->base_caps;

        return [
            'id' => $claim->id,
            'weekKey' => $claim->week_key,
            'weekTitle' => $claim->weekTitle ?? null,
            'status' => $claim->status,
            'member' => [
                'id' => $claim->member_id,
                'displayName' => $claim->memberDisplayName ?? null,
                'firstName' => $claim->memberFirstName ?? null,
                'profilePhotoUrl' => UploadedImage::publicUrl($claim->memberProfilePhotoUrl ?? null, $request),
            ],
            'verifier' => [
                'id' => $claim->verifier_member_id,
                'displayName' => $claim->verifierDisplayName ?? null,
                'firstName' => $claim->verifierFirstName ?? null,
                'profilePhotoUrl' => UploadedImage::publicUrl($claim->verifierProfilePhotoUrl ?? null, $request),
            ],
            'photoUrl' => UploadedImage::publicUrl($claim->photo_url ?? null, $request),
            'baseCaps' => $baseCaps,
            'photoBonusCaps' => $photoBonusCaps,
            'totalCaps' => $baseCaps + $photoBonusCaps,
            'expiresAt' => $this->apiDateTime($claim->expires_at ?? null),
            'approvedAt' => $this->apiDateTime($claim->approved_at ?? null),
            'rejectedAt' => $this->apiDateTime($claim->rejected_at ?? null),
            'createdAt' => $this->apiDateTime($claim->created_at ?? null),
            'updatedAt' => $this->apiDateTime($claim->updated_at ?? null),
        ];
    }

    private function memberDisplayNamesFor(array $memberIds): array
    {
        $memberIds = collect($memberIds)
            ->filter()
            ->map(fn ($id): string => (string) $id)
            ->unique()
            ->values()
            ->all();

        if (empty($memberIds)) {
            return [];
        }

        return DB::table('members')
            ->whereIn('id', $memberIds)
            ->pluck('display_name', 'id')
            ->all();
    }

    private function pushDuelInvite(object $duel): void
    {
        if (blank($duel->opponent_member_id ?? null)) {
            return;
        }

        $names = $this->memberDisplayNamesFor([$duel->creator_member_id, $duel->opponent_member_id]);
        $creatorName = $names[$duel->creator_member_id] ?? 'Et klassemedlem';
        $isChallenge = ($duel->mode ?? 'versus') === 'challenge';
        $challenge = Str::limit((string) ($duel->challenge ?? ''), 100);

        PushNotifier::send(PushNotifier::CAT_DUEL_INVITE, [$duel->opponent_member_id], [
            'title' => ($isChallenge ? 'Ny challenge til dig' : 'Du er udfordret til en dyst').' ⚔️',
            'body' => $creatorName.': '.$challenge,
            'data' => [
                'duelId' => $duel->id,
                'creatorMemberId' => $duel->creator_member_id,
                'mode' => $duel->mode ?? 'versus',
            ],
            'sourceType' => 'point_duel',
            'sourceId' => $duel->id,
            'dedupKey' => 'duel_invite:'.$duel->id,
        ]);
    }

    private function pushDuelResponse(object $duel, string $action, ?string $responderMemberId = null): void
    {
        if (blank($duel->creator_member_id ?? null)) {
            return;
        }

        $responderId = $responderMemberId ?? $duel->opponent_member_id ?? null;
        $names = $this->memberDisplayNamesFor([$duel->creator_member_id, $responderId]);
        $responderName = $responderId ? ($names[$responderId] ?? 'Modparten') : 'Modparten';
        $isChallenge = ($duel->mode ?? 'versus') === 'challenge';

        $title = match ($action) {
            'accepted' => ($isChallenge ? 'Din challenge er accepteret' : 'Din dyst er accepteret').' ✅',
            'declined' => ($isChallenge ? 'Din challenge er afvist' : 'Din dyst er afvist').' ❌',
            default => 'Status på din dyst',
        };
        $body = $action === 'accepted'
            ? $responderName.' tog udfordringen op!'
            : $responderName.' takkede nej.';

        PushNotifier::send(PushNotifier::CAT_DUEL_RESPONSE, [$duel->creator_member_id], [
            'title' => $title,
            'body' => $body,
            'data' => [
                'duelId' => $duel->id,
                'action' => $action,
                'responderMemberId' => $responderId,
            ],
            'sourceType' => 'point_duel',
            'sourceId' => $duel->id,
            'dedupKey' => 'duel_response:'.$duel->id.':'.$action,
        ]);
    }

    private function pushDuelActionRequired(object $duel, string $action, array $recipientIds): void
    {
        $recipients = collect($recipientIds)
            ->filter()
            ->map(fn ($id): string => (string) $id)
            ->unique()
            ->values()
            ->all();

        if (empty($recipients)) {
            return;
        }

        $title = match ($action) {
            'confirm_result' => 'Bekræft dystens resultat ⚖️',
            'judge_review' => 'Du skal afgøre en dyst ⚖️',
            default => 'Dyst afventer din handling ⚖️',
        };
        $body = match ($action) {
            'confirm_result' => 'Modparten har foreslået et resultat — bekræft eller afvis.',
            'judge_review' => 'Du er valgt som dommer. Godkend eller afvis det foreslåede resultat.',
            default => 'Åbn dysten for at se hvad der mangler.',
        };

        PushNotifier::send(PushNotifier::CAT_DUEL_ACTION_REQUIRED, $recipients, [
            'title' => $title,
            'body' => $body,
            'data' => [
                'duelId' => $duel->id,
                'action' => $action,
            ],
            'sourceType' => 'point_duel',
            'sourceId' => $duel->id,
            'dedupKey' => 'duel_action:'.$duel->id.':'.$action.':'.($duel->updated_at ?? $duel->id),
        ]);
    }

    private function pushEventInvite(string $eventId, string $title, ?string $eventDate, object $invitedBy, array $invitedMemberIds): void
    {
        $recipients = collect($invitedMemberIds)
            ->filter()
            ->map(fn ($id): string => (string) $id)
            ->reject(fn (string $id): bool => $id === (string) $invitedBy->id)
            ->unique()
            ->values()
            ->all();

        if (empty($recipients)) {
            return;
        }

        $inviterName = $invitedBy->display_name ?? 'Et klassemedlem';
        $when = $eventDate ? Carbon::parse($eventDate)->isoFormat('D. MMM') : null;

        PushNotifier::send(PushNotifier::CAT_EVENT_INVITE, $recipients, [
            'title' => 'Ny invitation: '.Str::limit($title, 60).' 🎉',
            'body' => $inviterName.' har inviteret dig'.($when ? ' ('.$when.')' : '').'.',
            'data' => [
                'eventId' => $eventId,
                'invitedByMemberId' => $invitedBy->id,
            ],
            'sourceType' => 'event',
            'sourceId' => $eventId,
            'dedupKey' => 'event_invite:'.$eventId,
        ]);
    }

    private function pushEventChange(string $eventId, string $title, ?string $eventDate, object $editedBy, array $invitedMemberIds, array $changeNotes): void
    {
        $recipients = collect($invitedMemberIds)
            ->filter()
            ->map(fn ($id): string => (string) $id)
            ->reject(fn (string $id): bool => $id === (string) $editedBy->id)
            ->unique()
            ->values()
            ->all();

        if (empty($recipients) || empty($changeNotes)) {
            return;
        }

        $when = $eventDate ? Carbon::parse($eventDate)->isoFormat('D. MMM') : null;
        $body = implode(', ', $changeNotes);

        PushNotifier::send(PushNotifier::CAT_EVENT_CHANGE, $recipients, [
            'title' => 'Ændring i: '.Str::limit($title, 60).' ✏️',
            'body' => $body.($when ? ' · '.$when : ''),
            'data' => [
                'eventId' => $eventId,
                'changes' => $changeNotes,
            ],
            'sourceType' => 'event',
            'sourceId' => $eventId,
        ]);
    }

    private function pushConnectionRequest(string $connectionId, object $requester, string $receiverMemberId): void
    {
        if (blank($receiverMemberId) || (string) $receiverMemberId === (string) $requester->id) {
            return;
        }

        $name = $requester->display_name ?? 'Et klassemedlem';

        PushNotifier::send(PushNotifier::CAT_CONNECTION_REQUEST, [$receiverMemberId], [
            'title' => 'Ny connection request 🤝',
            'body' => $name.' vil gerne connecte med dig.',
            'data' => [
                'connectionId' => $connectionId,
                'requesterMemberId' => $requester->id,
            ],
            'sourceType' => 'connection',
            'sourceId' => $connectionId,
            'dedupKey' => 'connection_request:'.$connectionId,
        ]);
    }

    private function pushConnectionAccepted(string $connectionId, object $accepter, string $requesterMemberId): void
    {
        if (blank($requesterMemberId) || (string) $requesterMemberId === (string) $accepter->id) {
            return;
        }

        $name = $accepter->display_name ?? 'Et klassemedlem';

        PushNotifier::send(PushNotifier::CAT_CONNECTION_ACCEPTED, [$requesterMemberId], [
            'title' => 'Connection accepteret ✅',
            'body' => $name.' accepterede din request.',
            'data' => [
                'connectionId' => $connectionId,
                'accepterMemberId' => $accepter->id,
            ],
            'sourceType' => 'connection',
            'sourceId' => $connectionId,
            'dedupKey' => 'connection_accepted:'.$connectionId,
        ]);
    }

    private function pushGalleryNew(object $gallery, object $createdBy): void
    {
        if ($gallery->visibility !== 'public') {
            return;
        }

        $audience = $gallery->audience ?? null;
        $recipients = [];

        if ($audience === 'everyone') {
            $recipients = DB::table('members')
                ->where('class_id', $gallery->class_id)
                ->where('status', 'active')
                ->where('id', '!=', $createdBy->id)
                ->pluck('id')
                ->all();
        } elseif ($audience === 'specific' && ! blank($gallery->member_ids ?? null)) {
            $decoded = json_decode((string) $gallery->member_ids, true);
            if (is_array($decoded)) {
                $recipients = collect($decoded)
                    ->filter()
                    ->map(fn ($id): string => (string) $id)
                    ->reject(fn (string $id): bool => $id === (string) $createdBy->id)
                    ->unique()
                    ->values()
                    ->all();
            }
        }

        if (empty($recipients)) {
            return;
        }

        $creatorName = $createdBy->display_name ?? 'Et klassemedlem';

        PushNotifier::send(PushNotifier::CAT_GALLERY_NEW, $recipients, [
            'title' => 'Nyt album: '.Str::limit((string) ($gallery->name ?? 'Album'), 60).' 📸',
            'body' => $creatorName.' har oprettet et nyt fælles album.',
            'data' => [
                'galleryId' => $gallery->id,
            ],
            'sourceType' => 'gallery',
            'sourceId' => $gallery->id,
            'dedupKey' => 'gallery_new:'.$gallery->id,
        ]);
    }

    private function pushGalleryPhotos(object $gallery, object $uploader): void
    {
        if ($gallery->visibility !== 'public') {
            return;
        }

        $audience = $gallery->audience ?? null;
        $recipients = [];

        if ($audience === 'everyone') {
            $recipients = DB::table('members')
                ->where('class_id', $gallery->class_id)
                ->where('status', 'active')
                ->where('id', '!=', $uploader->id)
                ->pluck('id')
                ->all();
        } elseif ($audience === 'specific' && ! blank($gallery->member_ids ?? null)) {
            $decoded = json_decode((string) $gallery->member_ids, true);
            if (is_array($decoded)) {
                $recipients = collect($decoded)
                    ->filter()
                    ->map(fn ($id): string => (string) $id)
                    ->reject(fn (string $id): bool => $id === (string) $uploader->id)
                    ->unique()
                    ->values()
                    ->all();
            }
        }

        if (empty($recipients)) {
            return;
        }

        $uploaderName = $uploader->display_name ?? 'Et klassemedlem';

        // Collapse to one push per uploader/gallery within a 30-min window via dedup.
        $now = Carbon::now('UTC');
        $bucket = $now->copy()
            ->minute((int) (floor($now->minute / 30) * 30))
            ->second(0)
            ->format('YmdHi');

        PushNotifier::send(PushNotifier::CAT_GALLERY_PHOTOS, $recipients, [
            'title' => 'Nye billeder i '.Str::limit((string) ($gallery->name ?? 'album'), 60).' 🖼️',
            'body' => $uploaderName.' har lagt nye billeder op.',
            'data' => [
                'galleryId' => $gallery->id,
                'uploaderMemberId' => $uploader->id,
            ],
            'sourceType' => 'gallery',
            'sourceId' => $gallery->id,
            'dedupKey' => 'gallery_photos:'.$gallery->id.':'.$uploader->id.':'.$bucket,
        ]);
    }

    private function pushDuelResult(object $duel): void
    {
        $participants = collect([$duel->creator_member_id ?? null, $duel->opponent_member_id ?? null])
            ->filter()
            ->map(fn ($id): string => (string) $id)
            ->unique()
            ->values()
            ->all();

        if (empty($participants)) {
            return;
        }

        $winnerId = $duel->winner_member_id ?? null;
        $names = $this->memberDisplayNamesFor($participants);
        $isChallenge = ($duel->mode ?? 'versus') === 'challenge';

        foreach ($participants as $memberId) {
            $isWinner = $winnerId && (string) $winnerId === $memberId;
            $opponentId = collect($participants)->first(fn (string $id): bool => $id !== $memberId);
            $opponentName = $opponentId ? ($names[$opponentId] ?? 'Modparten') : 'Modparten';

            $title = $isWinner
                ? (($isChallenge ? 'Du klarede din challenge!' : 'Du vandt dysten!').' 🏆')
                : 'Dysten er afsluttet ⏰';
            $body = $isWinner
                ? 'Caps er udbetalt — godt klaret!'
                : 'Resultatet er bekræftet. '.$opponentName.' tog sejren.';

            PushNotifier::send(PushNotifier::CAT_DUEL_RESULT, [$memberId], [
                'title' => $title,
                'body' => $body,
                'data' => [
                    'duelId' => $duel->id,
                    'winnerMemberId' => $winnerId,
                ],
                'sourceType' => 'point_duel',
                'sourceId' => $duel->id,
                'dedupKey' => 'duel_result:'.$duel->id.':'.$memberId,
            ]);
        }
    }

    private function recordCapTransaction(
        string $memberId,
        string $classId,
        int $amount,
        string $type,
        string $description,
        ?string $sourceType = null,
        ?string $sourceId = null,
        ?string $createdByMemberId = null,
        array $metadata = [],
    ): void {
        DB::table('cap_transactions')->insert([
            'id' => (string) Str::uuid(),
            'member_id' => $memberId,
            'class_id' => $classId,
            'amount' => $amount,
            'type' => $type,
            'description' => $description,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'created_by_member_id' => $createdByMemberId,
            'metadata' => empty($metadata) ? null : json_encode($metadata),
            'created_at' => now()->format('Y-m-d H:i:s'),
        ]);
    }

    private function ensurePointDuelsReady(): void
    {
        abort_unless(Schema::hasTable('point_duels'), 500, 'Duel-backend er ikke migreret endnu.');
        abort_unless(Schema::hasTable('cap_transactions'), 500, 'Caps-transaktioner er ikke klar endnu.');
    }

    private function duelForMember(string $duelId, object $member, bool $lock = false): object
    {
        if ($lock) {
            PointDuelMaintenance::expireDueForMember($member);
        }

        $hasJudgeColumn = Schema::hasColumn('point_duels', 'judge_member_id');
        $query = DB::table('point_duels')
            ->where('id', $duelId)
            ->where('class_id', $member->class_id)
            ->where(function ($query) use ($member, $hasJudgeColumn): void {
                $query
                    ->where('creator_member_id', $member->id)
                    ->orWhere('opponent_member_id', $member->id);

                if ($hasJudgeColumn) {
                    $query->orWhere('judge_member_id', $member->id);
                }
            });

        if ($lock) {
            $query->lockForUpdate();
        }

        $duel = $query->first();

        abort_unless($duel, 404, 'Dysten findes ikke.');

        return $duel;
    }

    private function duelsForMember(object $member): array
    {
        $hasJudgeColumn = Schema::hasColumn('point_duels', 'judge_member_id');

        return DB::table('point_duels')
            ->where('class_id', $member->class_id)
            ->where(function ($query) use ($member, $hasJudgeColumn): void {
                $query
                    ->where('creator_member_id', $member->id)
                    ->orWhere('opponent_member_id', $member->id);

                if ($hasJudgeColumn) {
                    $query->orWhere('judge_member_id', $member->id);
                }
            })
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (object $duel): array => $this->serializeDuel($duel))
            ->all();
    }

    private function duelResponseForMember(object $member, string $duelId): array
    {
        $freshMember = DB::table('members')->where('id', $member->id)->first();

        return [
            'duel' => $this->serializeDuel($this->duelForMember($duelId, $member)),
            'duels' => $this->duelsForMember($member),
            'currentMember' => $this->serializeMember($freshMember, true, true, $member->id),
        ];
    }

    private function expireDueDuelsForMember(object $member): void
    {
        if (! Schema::hasTable('point_duels')) {
            return;
        }

        $hasJudgeColumn = Schema::hasColumn('point_duels', 'judge_member_id');
        $now = now();
        $nowString = $now->format('Y-m-d H:i:s');
        $acceptCutoff = $now->copy()->subDay()->format('Y-m-d H:i:s');
        $expirableStatuses = [
            'awaitingOpponent',
            'awaitingCreatorConfirm',
            'active',
            'awaitingResultConfirm',
            'awaitingJudgeApproval',
        ];

        DB::transaction(function () use ($member, $hasJudgeColumn, $nowString, $acceptCutoff, $expirableStatuses): void {
            $query = DB::table('point_duels')
                ->where('class_id', $member->class_id)
                ->whereIn('status', $expirableStatuses)
                ->where(function ($query) use ($member, $hasJudgeColumn): void {
                    $query
                        ->where('creator_member_id', $member->id)
                        ->orWhere('opponent_member_id', $member->id);

                    if ($hasJudgeColumn) {
                        $query->orWhere('judge_member_id', $member->id);
                    }
                })
                ->where(function ($query) use ($nowString, $acceptCutoff): void {
                    $query
                        ->where(function ($query) use ($acceptCutoff): void {
                            $query
                                ->where('status', 'awaitingOpponent')
                                ->whereNotNull('created_at')
                                ->where('created_at', '<=', $acceptCutoff);
                        })
                        ->orWhere(function ($query) use ($nowString): void {
                            $query
                                ->whereIn('status', [
                                    'awaitingCreatorConfirm',
                                    'active',
                                    'awaitingResultConfirm',
                                    'awaitingJudgeApproval',
                                ])
                                ->whereNotNull('deadline_at')
                                ->where('deadline_at', '<', $nowString);
                        });
                })
                ->lockForUpdate();

            $query->get()->each(fn (object $duel): mixed => $this->expireDuelRow($duel, $nowString));
        });
    }

    private function expireDuelRow(object $duel, string $expiredAt): void
    {
        $this->refundDuelEscrow($duel->creator_member_id, $duel, (int) ($duel->creator_escrow_caps ?? 0), 'duel_expired');
        $this->refundDuelEscrow($duel->opponent_member_id, $duel, (int) ($duel->opponent_escrow_caps ?? 0), 'duel_expired');

        $updates = [
            'creator_escrow_caps' => 0,
            'opponent_escrow_caps' => 0,
            'status' => 'expired',
            'updated_at' => $expiredAt,
        ];

        if (Schema::hasColumn('point_duels', 'expired_at')) {
            $updates['expired_at'] = $expiredAt;
        }

        DB::table('point_duels')->where('id', $duel->id)->update($updates);
    }

    private function serializeDuel(object $duel): array
    {
        $confirmedBy = [];

        if (in_array($duel->status, ['awaitingCreatorConfirm', 'active', 'completed'], true)) {
            $confirmedBy[] = 'target';
        }

        if (in_array($duel->status, ['active', 'completed'], true)) {
            $confirmedBy[] = 'creator';
        }

        $mode = $duel->mode ?? 'versus';

        return [
            'id' => $duel->id,
            'classId' => $duel->class_id,
            'fromMemberId' => $duel->creator_member_id,
            'toMemberId' => $duel->opponent_member_id,
            'judgeMemberId' => $mode === 'challenge' ? null : ($duel->judge_member_id ?? null),
            'mode' => $mode,
            'challenge' => $duel->challenge,
            'stake' => (int) $duel->stake_caps,
            'creatorEscrowCaps' => (int) ($duel->creator_escrow_caps ?? 0),
            'opponentEscrowCaps' => (int) ($duel->opponent_escrow_caps ?? 0),
            'status' => $duel->status,
            'confirmedBy' => $confirmedBy,
            'winnerMemberId' => $duel->winner_member_id ?? null,
            'completedByMemberId' => $duel->completed_by_member_id ?? null,
            'judgeRequestedAt' => $this->apiDateTime($duel->judge_requested_at ?? null),
            'judgeApprovedAt' => $this->apiDateTime($duel->judge_approved_at ?? null),
            'judgeRejectedAt' => $this->apiDateTime($duel->judge_rejected_at ?? null),
            'deadlineAt' => $this->apiDateTime($duel->deadline_at ?? null),
            'acceptedAt' => $this->apiDateTime($duel->accepted_at ?? null),
            'confirmedAt' => $this->apiDateTime($duel->confirmed_at ?? null),
            'declinedAt' => $this->apiDateTime($duel->declined_at ?? null),
            'cancelledAt' => $this->apiDateTime($duel->cancelled_at ?? null),
            'expiredAt' => $this->apiDateTime($duel->expired_at ?? null),
            'completedAt' => $this->apiDateTime($duel->completed_at ?? null),
            'createdAt' => $this->apiDateTime($duel->created_at ?? null),
            'updatedAt' => $this->apiDateTime($duel->updated_at ?? null),
        ];
    }

    private function refundDuelEscrow(string $memberId, object $duel, int $amount, string $type): void
    {
        if ($amount <= 0) {
            return;
        }

        $member = DB::table('members')->where('id', $memberId)->lockForUpdate()->first();

        if (! $member) {
            return;
        }

        DB::table('members')->where('id', $member->id)->update([
            'caps_balance' => (int) ($member->caps_balance ?? 1000) + $amount,
        ]);
        $this->recordCapTransaction(
            $member->id,
            $member->class_id,
            $amount,
            $type,
            ($duel->mode ?? 'versus') === 'challenge'
                ? 'Challenge-belønning returneret fra escrow'
                : 'Dyst-indsats returneret fra escrow',
            'point_duel',
            $duel->id,
            $memberId,
            [
                'status' => $duel->status,
                'creatorMemberId' => $duel->creator_member_id,
                'opponentMemberId' => $duel->opponent_member_id,
            ],
        );
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

        $this->pushEventInvite($eventId, $title, $eventDate, $member, $inviteMemberIds);

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

        $changeNotes = [];
        $previousDate = (string) ($schoolEvent->event_date ?? '');
        $previousStarts = (string) ($schoolEvent->starts_at ?? '');
        $previousLocation = (string) ($schoolEvent->location ?? '');

        if ($previousDate !== '' && $previousDate !== $eventDate) {
            $changeNotes[] = 'ny dato';
        }

        if ($previousStarts !== ($startsAt ?? '')) {
            $changeNotes[] = 'nyt tidspunkt';
        }

        if (trim($previousLocation) !== trim((string) ($location ?? ''))) {
            $changeNotes[] = 'nyt sted';
        }

        $newlyInvitedMemberIds = [];

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
            &$newlyInvitedMemberIds,
            &$changeNotes,
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

                if (! empty($addedMemberIds)) {
                    $changeNotes[] = 'ny invitation';
                    $newlyInvitedMemberIds = $addedMemberIds;
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

        if (! empty($newlyInvitedMemberIds)) {
            $this->pushEventInvite($event, $title, $eventDate, $member, $newlyInvitedMemberIds);
        }

        $existingInvitedMemberIds = Schema::hasTable('event_invites')
            ? DB::table('event_invites')
                ->where('event_id', $event)
                ->whereNotIn('member_id', $newlyInvitedMemberIds ?: ['__none__'])
                ->pluck('member_id')
                ->all()
            : [];

        $existingChangeNotes = array_values(array_filter(
            $changeNotes,
            fn (string $note): bool => $note !== 'ny invitation',
        ));

        if (! empty($existingChangeNotes) && ! empty($existingInvitedMemberIds)) {
            $this->pushEventChange($event, $title, $eventDate, $member, $existingInvitedMemberIds, $existingChangeNotes);
        }

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
            ->where('status', '!=', 'removed')
            ->first();

        abort_unless($targetMember, 404, 'Personen findes ikke.');
        abort_if((string) $targetMember->id === (string) $currentMember->id, 422, 'Du kan ikke blokere dig selv.');
        $sameClass = (string) $targetMember->class_id === (string) $currentMember->class_id;
        $acceptedConnection = $sameClass ? true : (
            Schema::hasTable('member_connections')
            && DB::table('member_connections')
                ->where('status', 'accepted')
                ->where(function ($query) use ($currentMember, $targetMember): void {
                    $query
                        ->where(function ($subQuery) use ($currentMember, $targetMember): void {
                            $subQuery
                                ->where('requester_member_id', $currentMember->id)
                                ->where('receiver_member_id', $targetMember->id);
                        })
                        ->orWhere(function ($subQuery) use ($currentMember, $targetMember): void {
                            $subQuery
                                ->where('requester_member_id', $targetMember->id)
                                ->where('receiver_member_id', $currentMember->id);
                        });
                })
                ->exists()
        );

        abort_unless($sameClass || $acceptedConnection, 404, 'Personen findes ikke.');

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:190'],
        ]);
        $reason = trim($data['reason'] ?? '') ?: 'Blokeret fra kalender';
        $now = now()->format('Y-m-d H:i:s');
        DB::transaction(function () use ($currentMember, $targetMember, $reason, $now): void {
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

            if (Schema::hasTable('chat_conversations') && Schema::hasTable('chat_participants')) {
                $directPairKey = collect([$currentMember->id, $targetMember->id])->sort()->values()->implode(':');
                $directConversationId = DB::table('chat_conversations')
                    ->where('type', 'direct')
                    ->where('direct_pair_key', $directPairKey)
                    ->value('id');

                if ($directConversationId) {
                    DB::table('chat_participants')
                        ->where('conversation_id', $directConversationId)
                        ->where('member_id', $currentMember->id)
                        ->update([
                            'hidden_at' => $now,
                            'updated_at' => $now,
                        ]);
                }
            }
        });

        return response()->json([
            'ok' => true,
            'class' => $this->loadClassById($currentMember->class_id, $currentMember->id),
        ]);
    }

    public function listBlockedMembers(Request $request): JsonResponse
    {
        $currentMember = $this->authenticatedMemberFromRequest($request);

        if (! Schema::hasTable('member_blocks')) {
            return response()->json([
                'blocked' => [],
            ]);
        }

        $blocks = DB::table('member_blocks')
            ->where('blocker_member_id', $currentMember->id)
            ->orderByDesc('created_at')
            ->get();

        $memberPreviews = $this->memberPreviews($blocks->pluck('blocked_member_id'));

        $blocked = $blocks
            ->map(function (object $block) use ($memberPreviews): array {
                $other = $memberPreviews->get($block->blocked_member_id);

                return [
                    'id' => $block->id,
                    'reason' => $block->reason,
                    'blockedAt' => $this->apiDateTime($block->created_at),
                    'blockedMember' => $other ? [
                        'id' => $other->id,
                        'displayName' => $other->displayName,
                        'firstName' => $other->firstName,
                        'profilePhotoUrl' => UploadedImage::publicUrl($other->profilePhotoUrl),
                        'class' => [
                            'classId' => $other->classId,
                            'schoolName' => $other->schoolName,
                            'className' => $other->className,
                            'graduationYear' => $other->graduationYear,
                        ],
                    ] : [
                        'id' => $block->blocked_member_id,
                        'displayName' => 'Slettet bruger',
                        'firstName' => null,
                        'profilePhotoUrl' => null,
                        'class' => null,
                    ],
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'blocked' => $blocked,
        ]);
    }

    public function unblockMember(Request $request, string $member): JsonResponse
    {
        $currentMember = $this->authenticatedMemberFromRequest($request);

        if (! Schema::hasTable('member_blocks')) {
            return response()->json(['ok' => true]);
        }

        $deleted = DB::table('member_blocks')
            ->where('blocker_member_id', $currentMember->id)
            ->where('blocked_member_id', $member)
            ->delete();

        abort_if($deleted === 0, 404, 'Blokeringen findes ikke.');

        return response()->json([
            'ok' => true,
            'class' => $this->loadClassById($currentMember->class_id, $currentMember->id),
        ]);
    }

    public function disablePushToken(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'expoPushToken' => ['nullable', 'string', 'max:255'],
        ]);

        if (! Schema::hasTable('member_push_tokens')) {
            return response()->json(['ok' => true, 'disabled' => 0]);
        }

        $now = now()->format('Y-m-d H:i:s');
        $query = DB::table('member_push_tokens')
            ->where('member_id', $member->id);

        if (! blank($data['expoPushToken'] ?? null)) {
            $query->where('expo_push_token', $data['expoPushToken']);
        }

        $disabled = $query->update([
            'disabled_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json([
            'ok' => true,
            'disabled' => $disabled,
        ]);
    }

    public function getNotificationPreferences(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);

        return response()->json([
            'preferences' => PushNotifier::preferencesFor($member->id),
            'categories' => PushNotifier::CATEGORIES,
        ]);
    }

    public function updateNotificationPreferences(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'preferences' => ['required', 'array'],
            'preferences.*' => ['required', 'boolean'],
        ]);

        foreach ($data['preferences'] as $category => $enabled) {
            if (! is_string($category) || ! in_array($category, PushNotifier::CATEGORIES, true)) {
                continue;
            }

            // chat_message follows existing per-conversation mute UX, but we still let
            // users disable the entire category as a defensive opt-out (GDPR/Apple rules).
            PushNotifier::setPreference($member->id, $category, (bool) $enabled);
        }

        return response()->json([
            'ok' => true,
            'preferences' => PushNotifier::preferencesFor($member->id),
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
        abort_unless($this->normalizeRole($actor->role) === 'owner', 403, 'Kun ejere kan aendre adgang.');

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
            ->filter(fn ($member): bool => (
                ! $currentMemberId
                || (string) $member->id === (string) $currentMemberId
                || ! $blockedMemberIds->contains((string) $member->id)
            ))
            ->map(fn ($member) => $this->serializeMember(
                $member,
                $member->id === $currentMemberId,
                $member->id === $currentMemberId,
                $currentMemberId,
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

    private function serializeMember(
        object $member,
        bool $includePersonalCode = false,
        bool $includePrivate = false,
        ?string $viewerMemberId = null,
    ): array {
        $firstName = $member->first_name ?? null;
        $lastName = $member->last_name ?? null;
        $isOwnProfile = (string) $member->id === (string) $viewerMemberId;
        $canSeeEmergencyContact = $includePrivate || $isOwnProfile
            || $this->canViewerSeeEmergencyContact($member, $viewerMemberId);

        $serialized = [
            'id' => $member->id,
            'displayName' => $member->display_name,
            'firstName' => $firstName,
            'lastName' => $lastName,
            'profilePhotoUrl' => UploadedImage::publicUrl($member->profile_photo_url ?? null),
            'capsBalance' => (int) ($member->caps_balance ?? 1000),
            'role' => $this->normalizeRole($member->role),
            'status' => $this->normalizeStatus($member->status ?? 'active'),
            'joinedAt' => $this->apiDateTime($member->joined_at),
            'lastSeenAt' => $this->apiDateTime($member->last_seen_at ?? null),
            'isOnline' => $this->memberIsOnline($member->last_seen_at ?? null),
            'emergencyContactVisibility' => $this->normalizeEmergencyContactVisibility(
                $member->emergency_contact_visibility ?? null,
            ),
            'emergencyContactVisibleMemberIds' => $this->normalizeEmergencyContactMemberIdsFromColumn(
                $member->emergency_contact_visible_member_ids ?? null,
            ),
        ];

        if ($canSeeEmergencyContact) {
            $serialized['emergencyContactName'] = $member->emergency_contact_name ?? null;
            $serialized['emergencyContactPhone'] = $member->emergency_contact_phone ?? null;
        }

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

    private function normalizeEmergencyContactVisibility(?string $visibility): string
    {
        $normalized = is_string($visibility) ? strtolower(trim($visibility)) : '';

        return in_array($normalized, self::EMERGENCY_CONTACT_VISIBILITIES, true)
            ? $normalized
            : 'class';
    }

    private function normalizeEmergencyContactMemberIdsFromColumn($rawMemberIds): array
    {
        if ($rawMemberIds === null || $rawMemberIds === '') {
            return [];
        }

        if (! is_array($rawMemberIds)) {
            $decoded = is_string($rawMemberIds)
                ? json_decode($rawMemberIds, true)
                : null;

            if (! is_array($decoded)) {
                return [];
            }

            $rawMemberIds = $decoded;
        }

        return $this->normalizeEmergencyContactMemberIds($rawMemberIds);
    }

    private function normalizeEmergencyContactMemberIds(array $memberIds): array
    {
        $normalized = array_map(
            static fn ($memberId): string => trim((string) $memberId),
            $memberIds,
        );
        $filtered = array_filter($normalized, static fn ($memberId): bool => $memberId !== '');

        return array_values(array_unique($filtered));
    }

    private function canViewerSeeEmergencyContact(object $member, ?string $viewerMemberId = null): bool
    {
        if (! $viewerMemberId) {
            return false;
        }

        if ((string) $member->id === (string) $viewerMemberId) {
            return true;
        }

        $visibility = $this->normalizeEmergencyContactVisibility(
            $member->emergency_contact_visibility ?? null,
        );

        if ($visibility === 'specific') {
            $allowedMemberIds = $this->normalizeEmergencyContactMemberIdsFromColumn(
                $member->emergency_contact_visible_member_ids ?? null,
            );

            return in_array((string) $viewerMemberId, $allowedMemberIds, true);
        }

        return true;
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

    // -------------------------------------------------------------------------
    // Galleries
    // -------------------------------------------------------------------------

    private const GALLERY_VISIBILITY_VALUES = ['private', 'public'];
    private const GALLERY_AUDIENCE_VALUES   = ['class', 'crew', 'specific'];
    private const GALLERY_PERMISSION_VALUES = ['view', 'add', 'add_delete'];
    private const GALLERY_SORT_VALUES       = ['recent', 'photos', 'az'];
    private const GALLERY_PAGE_SIZE_DEFAULT = 24;
    private const GALLERY_PAGE_SIZE_MAX     = 50;

    private function galleryApiShape(object $gallery, array $previewPhotos = []): array
    {
        $memberIds = [];

        if (! blank($gallery->member_ids)) {
            $decoded = json_decode($gallery->member_ids, true);
            $memberIds = is_array($decoded) ? $decoded : [];
        }

        return [
            'id'                  => $gallery->id,
            'name'                => $gallery->name,
            'visibility'          => $gallery->visibility,
            'audience'            => $gallery->audience,
            'permission'          => $gallery->permission,
            'memberIds'           => $memberIds,
            'photoCount'          => (int) ($gallery->photo_count ?? 0),
            'coverUri'            => UploadedImage::publicUrl($gallery->cover_image_url ?? null, request()),
            'previewPhotos'       => $previewPhotos,
            'creatorId'           => $gallery->created_by_member_id ?? null,
            'createdAt'           => $this->apiDateTime($gallery->created_at),
            'updatedAt'           => $this->apiDateTime($gallery->updated_at),
        ];
    }

    private function galleryPreviewPhotosByGalleryIds(array $galleryIds): array
    {
        $ids = array_values(array_filter(array_map(fn ($id) => (string) $id, $galleryIds)));

        if (empty($ids)) {
            return [];
        }

        $rankedPhotos = DB::table('gallery_photos')
            ->whereIn('gallery_id', $ids)
            ->whereNull('deleted_at')
            ->select('gallery_photos.*')
            ->selectRaw('ROW_NUMBER() OVER (PARTITION BY gallery_id ORDER BY created_at DESC, id DESC) as preview_rank');

        $photos = DB::query()
            ->fromSub($rankedPhotos, 'ranked_gallery_photos')
            ->where('preview_rank', '<=', 4)
            ->orderBy('gallery_id')
            ->orderBy('preview_rank')
            ->get();

        $previewPhotos = [];

        foreach ($photos as $photo) {
            $galleryId = (string) $photo->gallery_id;

            $previewPhotos[$galleryId][] = $this->galleryPhotoApiShape($photo);
        }

        return $previewPhotos;
    }

    private function galleryIsVisibleToMember(object $gallery, object $member): bool
    {
        if ($gallery->visibility === 'private') {
            return (string) $gallery->created_by_member_id === (string) $member->id;
        }

        return match ($gallery->audience) {
            'class'    => true,
            'crew'     => true,
            'specific' => in_array((string) $member->id, json_decode($gallery->member_ids ?? '[]', true) ?? [], true)
                || (string) $gallery->created_by_member_id === (string) $member->id,
            default    => false,
        };
    }

    private function applyGalleryVisibilityQuery($query, object $member, string $tablePrefix = ''): void
    {
        $memberId = (string) $member->id;
        $memberNeedle = '%'.json_encode($memberId).'%';
        $column = fn (string $name): string => $tablePrefix !== '' ? $tablePrefix.'.'.$name : $name;

        $query->where(function ($visible) use ($column, $memberId, $memberNeedle) {
            $visible
                ->where(function ($private) use ($column, $memberId) {
                    $private
                        ->where($column('visibility'), 'private')
                        ->where($column('created_by_member_id'), $memberId);
                })
                ->orWhere(function ($public) use ($column, $memberId, $memberNeedle) {
                    $public
                        ->where($column('visibility'), 'public')
                        ->where(function ($publicScope) use ($column, $memberId, $memberNeedle) {
                            $publicScope
                                ->whereIn($column('audience'), ['class', 'crew'])
                                ->orWhere(function ($specific) use ($column, $memberId, $memberNeedle) {
                                    $specific
                                        ->where($column('audience'), 'specific')
                                        ->where(function ($specificScope) use ($column, $memberId, $memberNeedle) {
                                            $specificScope
                                                ->where($column('created_by_member_id'), $memberId)
                                                ->orWhere($column('member_ids'), 'like', $memberNeedle);
                                        });
                                });
                        });
                });
        });
    }

    public function getGalleries(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);

        $data = $request->validate([
            'page'       => ['nullable', 'integer', 'min:1'],
            'perPage'    => ['nullable', 'integer', 'min:1', 'max:'.self::GALLERY_PAGE_SIZE_MAX],
            'sort'       => ['nullable', 'string', Rule::in(self::GALLERY_SORT_VALUES)],
            'visibility' => ['nullable', 'string', Rule::in(['all', ...self::GALLERY_VISIBILITY_VALUES])],
            'q'          => ['nullable', 'string', 'max:80'],
        ]);

        $page = max(1, (int) ($data['page'] ?? 1));
        $perPage = min(
            self::GALLERY_PAGE_SIZE_MAX,
            max(1, (int) ($data['perPage'] ?? self::GALLERY_PAGE_SIZE_DEFAULT))
        );
        $sort = $data['sort'] ?? 'recent';
        $visibility = $data['visibility'] ?? 'all';
        $search = trim((string) ($data['q'] ?? ''));

        $query = DB::table('galleries')
            ->where('class_id', $member->class_id)
            ->whereNull('deleted_at');

        $this->applyGalleryVisibilityQuery($query, $member);

        if ($visibility !== 'all') {
            $query->where('visibility', $visibility);
        }

        if ($search !== '') {
            $query->where('name', 'like', '%'.$search.'%');
        }

        $total = (clone $query)->count();

        match ($sort) {
            'photos' => $query
                ->orderByDesc('photo_count')
                ->orderByDesc('updated_at')
                ->orderByDesc('created_at')
                ->orderByDesc('id'),
            'az' => $query
                ->orderByRaw('LOWER(name) ASC')
                ->orderByDesc('updated_at')
                ->orderByDesc('created_at')
                ->orderByDesc('id'),
            default => $query
                ->orderByDesc('updated_at')
                ->orderByDesc('created_at')
                ->orderByDesc('id'),
        };

        $galleries = $query
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();
        $previewPhotosByGalleryId = $this->galleryPreviewPhotosByGalleryIds($galleries->pluck('id')->all());

        return response()->json([
            'galleries' => $galleries->map(fn ($g) =>
                $this->galleryApiShape($g, $previewPhotosByGalleryId[(string) $g->id] ?? [])
            )->all(),
            'pagination' => [
                'page'    => $page,
                'perPage' => $perPage,
                'total'   => $total,
                'hasMore' => ($page * $perPage) < $total,
            ],
        ]);
    }

    public function storeGallery(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);

        $data = $request->validate([
            'name'            => ['required', 'string', 'max:190'],
            'visibility'      => ['required', 'string', Rule::in(self::GALLERY_VISIBILITY_VALUES)],
            'audience'        => ['nullable', 'string', Rule::in(self::GALLERY_AUDIENCE_VALUES)],
            'permission'      => ['nullable', 'string', Rule::in(self::GALLERY_PERMISSION_VALUES)],
            'memberIds'       => ['nullable', 'array', 'max:250'],
            'memberIds.*'     => ['string', 'max:36'],
            'coverImageData'  => ['nullable', 'string', 'max:7000000'],
        ]);

        $isPublic = $data['visibility'] === 'public';

        abort_if($isPublic && blank($data['audience'] ?? null), 422, 'Audience er påkrævet for offentlige gallerier.');
        abort_if($isPublic && blank($data['permission'] ?? null), 422, 'Permission er påkrævet for offentlige gallerier.');
        abort_if(
            $isPublic && ($data['audience'] ?? null) === 'specific' && empty($data['memberIds'] ?? []),
            422,
            'Vælg mindst ét klassemedlem.'
        );

        $name = ContentModeration::cleanText(
            trim($data['name']),
            'title',
            'Galleri navn',
            ['source' => 'gallery', 'member_id' => $member->id, 'class_id' => $member->class_id]
        );

        abort_if(blank($name), 422, 'Galleriets navn indeholder ugyldigt indhold.');

        $memberIds = [];

        if ($isPublic && ($data['audience'] ?? null) === 'specific') {
            $validIds = DB::table('members')
                ->where('class_id', $member->class_id)
                ->where('status', 'active')
                ->whereIn('id', $data['memberIds'] ?? [])
                ->pluck('id')
                ->map(fn ($id) => (string) $id)
                ->all();

            abort_if(empty($validIds), 422, 'Ingen gyldige klassemedlemmer valgt.');
            $memberIds = $validIds;
        }

        $now = now()->format('Y-m-d H:i:s');
        $id  = (string) Str::uuid();

        $coverImagePath = null;
        if (! blank($data['coverImageData'] ?? null)) {
            $coverImagePath = UploadedImage::storeBase64(
                $data['coverImageData'],
                'gallery-covers',
                $id,
                'Gallery cover',
            );
        }

        DB::table('galleries')->insert([
            'id'                   => $id,
            'class_id'             => $member->class_id,
            'name'                 => $name,
            'visibility'           => $data['visibility'],
            'audience'             => $isPublic ? $data['audience'] : null,
            'permission'           => $isPublic ? $data['permission'] : null,
            'member_ids'           => $isPublic && $memberIds ? json_encode($memberIds) : null,
            'photo_count'          => 0,
            'cover_image_url'      => $coverImagePath,
            'created_by_member_id' => $member->id,
            'deleted_at'           => null,
            'deleted_by_member_id' => null,
            'created_at'           => $now,
            'updated_at'           => $now,
        ]);

        $gallery = DB::table('galleries')->where('id', $id)->first();

        if ($gallery) {
            $this->pushGalleryNew($gallery, $member);
        }

        return response()->json(['gallery' => $this->galleryApiShape($gallery)], 201);
    }

    public function updateGallery(Request $request, string $gallery): JsonResponse
    {
        $member      = $this->authenticatedMemberFromRequest($request);
        $memberRole  = $this->normalizeRole($member->role ?? null);
        $canModerate = in_array($memberRole, ['owner', 'moderator'], true);

        $existing = DB::table('galleries')
            ->where('id', $gallery)
            ->where('class_id', $member->class_id)
            ->whereNull('deleted_at')
            ->first();

        abort_unless($existing, 404, 'Galleriet findes ikke.');
        abort_unless(
            (string) $existing->created_by_member_id === (string) $member->id || $canModerate,
            403,
            'Du har ikke adgang til at redigere dette galleri.'
        );

        $data = $request->validate([
            'name'            => ['required', 'string', 'max:190'],
            'visibility'      => ['required', 'string', Rule::in(self::GALLERY_VISIBILITY_VALUES)],
            'audience'        => ['nullable', 'string', Rule::in(self::GALLERY_AUDIENCE_VALUES)],
            'permission'      => ['nullable', 'string', Rule::in(self::GALLERY_PERMISSION_VALUES)],
            'memberIds'       => ['nullable', 'array', 'max:250'],
            'memberIds.*'     => ['string', 'max:36'],
            'coverImageData'  => ['nullable', 'string', 'max:7000000'],
        ]);

        $isPublic = $data['visibility'] === 'public';

        abort_if($isPublic && blank($data['audience'] ?? null), 422, 'Audience er påkrævet for offentlige gallerier.');
        abort_if($isPublic && blank($data['permission'] ?? null), 422, 'Permission er påkrævet for offentlige gallerier.');
        abort_if(
            $isPublic && ($data['audience'] ?? null) === 'specific' && empty($data['memberIds'] ?? []),
            422,
            'Vælg mindst ét klassemedlem.'
        );

        $name = ContentModeration::cleanText(
            trim($data['name']),
            'title',
            'Galleri navn',
            ['source' => 'gallery_update', 'member_id' => $member->id, 'class_id' => $member->class_id]
        );

        abort_if(blank($name), 422, 'Galleriets navn indeholder ugyldigt indhold.');

        $memberIds = [];

        if ($isPublic && ($data['audience'] ?? null) === 'specific') {
            $validIds = DB::table('members')
                ->where('class_id', $member->class_id)
                ->where('status', 'active')
                ->whereIn('id', $data['memberIds'] ?? [])
                ->pluck('id')
                ->map(fn ($id) => (string) $id)
                ->all();

            abort_if(empty($validIds), 422, 'Ingen gyldige klassemedlemmer valgt.');
            $memberIds = $validIds;
        }

        $updatePayload = [
            'name'       => $name,
            'visibility' => $data['visibility'],
            'audience'   => $isPublic ? $data['audience'] : null,
            'permission' => $isPublic ? $data['permission'] : null,
            'member_ids' => $isPublic && $memberIds ? json_encode($memberIds) : null,
            'updated_at' => now()->format('Y-m-d H:i:s'),
        ];

        if (! blank($data['coverImageData'] ?? null)) {
            $updatePayload['cover_image_url'] = UploadedImage::storeBase64(
                $data['coverImageData'],
                'gallery-covers',
                $existing->id,
                'Gallery cover update',
            );
        }

        DB::table('galleries')->where('id', $existing->id)->update($updatePayload);

        $updated = DB::table('galleries')->where('id', $existing->id)->first();

        return response()->json(['gallery' => $this->galleryApiShape($updated)]);
    }

    public function destroyGallery(Request $request, string $gallery): JsonResponse
    {
        $member      = $this->authenticatedMemberFromRequest($request);
        $memberRole  = $this->normalizeRole($member->role ?? null);
        $canModerate = in_array($memberRole, ['owner', 'moderator'], true);

        $existing = DB::table('galleries')
            ->where('id', $gallery)
            ->where('class_id', $member->class_id)
            ->whereNull('deleted_at')
            ->first();

        abort_unless($existing, 404, 'Galleriet findes ikke.');
        abort_unless(
            (string) $existing->created_by_member_id === (string) $member->id || $canModerate,
            403,
            'Du har ikke adgang til at slette dette galleri.'
        );

        DB::table('galleries')->where('id', $existing->id)->update([
            'deleted_at'           => now()->format('Y-m-d H:i:s'),
            'deleted_by_member_id' => $member->id,
            'updated_at'           => now()->format('Y-m-d H:i:s'),
        ]);

        return response()->json(['ok' => true]);
    }

    public function reportGallery(Request $request, string $gallery): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);

        $existing = DB::table('galleries')
            ->where('id', $gallery)
            ->where('class_id', $member->class_id)
            ->whereNull('deleted_at')
            ->first();

        abort_unless($existing, 404, 'Galleriet findes ikke.');
        abort_if(
            (string) ($existing->created_by_member_id ?? '') === (string) $member->id,
            422,
            'Du kan ikke rapportere dit eget galleri.'
        );

        $data = $request->validate([
            'reason'  => ['nullable', 'string', 'max:190'],
            'details' => ['nullable', 'string', 'max:2000'],
        ]);

        $reason  = trim($data['reason'] ?? '') ?: 'Galleri rapporteret';
        $details = trim($data['details'] ?? '') ?: null;
        $now     = now()->format('Y-m-d H:i:s');

        DB::table('member_reports')->insert([
            'id'                 => (string) Str::uuid(),
            'reporter_member_id' => $member->id,
            'reported_member_id' => $existing->created_by_member_id ?? null,
            'target_type'        => 'gallery',
            'target_id'          => $existing->id,
            'reason'             => $reason,
            'details'            => $details,
            'status'             => 'pending',
            'reviewed_at'        => null,
            'created_at'         => $now,
            'updated_at'         => $now,
        ]);

        return response()->json(['ok' => true]);
    }

    // ─── Gallery photos ───────────────────────────────────────────────────────

    private function galleryPhotoApiShape(object $photo): array
    {
        return [
            'id'        => $photo->id,
            'galleryId' => $photo->gallery_id,
            'memberId'  => $photo->member_id ?? null,
            'imageUri'  => UploadedImage::publicUrl($photo->image_url, request()),
            'createdAt' => $this->apiDateTime($photo->created_at),
        ];
    }

    private function resolveGalleryForMember(string $galleryId, object $member): object
    {
        $gallery = DB::table('galleries')
            ->where('id', $galleryId)
            ->where('class_id', $member->class_id)
            ->whereNull('deleted_at')
            ->first();

        abort_unless($gallery, 404, 'Galleriet findes ikke.');
        abort_unless($this->galleryIsVisibleToMember($gallery, $member), 403, 'Du har ikke adgang til dette galleri.');

        return $gallery;
    }

    private function memberCanAddPhoto(object $gallery, object $member): bool
    {
        if ((string) $gallery->created_by_member_id === (string) $member->id) {
            return true;
        }

        if ($gallery->visibility !== 'public') {
            return false;
        }

        return in_array($gallery->permission ?? '', ['add', 'add_delete'], true);
    }

    private function memberCanDeletePhoto(object $photo, object $gallery, object $member): bool
    {
        if ((string) ($photo->member_id ?? '') === (string) $member->id) {
            return true;
        }

        if ((string) $gallery->created_by_member_id === (string) $member->id) {
            return true;
        }

        $memberRole  = $this->normalizeRole($member->role ?? null);
        $canModerate = in_array($memberRole, ['owner', 'moderator'], true);

        if ($canModerate) {
            return true;
        }

        return $gallery->visibility === 'public' && $gallery->permission === 'add_delete';
    }

    public function getGalleryPhotos(Request $request, string $gallery): JsonResponse
    {
        $member  = $this->authenticatedMemberFromRequest($request);
        $gallery = $this->resolveGalleryForMember($gallery, $member);

        $photos = DB::table('gallery_photos')
            ->where('gallery_id', $gallery->id)
            ->whereNull('deleted_at')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'photos' => $photos->map(fn ($p) => $this->galleryPhotoApiShape($p))->all(),
        ]);
    }

    public function storeGalleryPhoto(Request $request, string $gallery): JsonResponse
    {
        $member  = $this->authenticatedMemberFromRequest($request);
        $gallery = $this->resolveGalleryForMember($gallery, $member);

        abort_unless($this->memberCanAddPhoto($gallery, $member), 403, 'Du har ikke tilladelse til at tilføje billeder til dette galleri.');

        $data = $request->validate([
            'imageData' => ['required', 'string', 'max:8000000'],
        ]);

        $id        = (string) Str::uuid();
        $imagePath = UploadedImage::storeBase64($data['imageData'], 'gallery-photos', $id, 'Gallery photo');
        $now       = now()->format('Y-m-d H:i:s');

        DB::table('gallery_photos')->insert([
            'id'         => $id,
            'gallery_id' => $gallery->id,
            'member_id'  => $member->id,
            'image_url'  => $imagePath,
            'created_at' => $now,
        ]);

        DB::table('galleries')
            ->where('id', $gallery->id)
            ->increment('photo_count', 1, ['updated_at' => $now]);

        $photo = DB::table('gallery_photos')->where('id', $id)->first();

        $this->pushGalleryPhotos($gallery, $member);

        return response()->json(['photo' => $this->galleryPhotoApiShape($photo)], 201);
    }

    public function destroyGalleryPhoto(Request $request, string $photo): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);

        $existing = DB::table('gallery_photos')
            ->where('id', $photo)
            ->whereNull('deleted_at')
            ->first();

        abort_unless($existing, 404, 'Billedet findes ikke.');

        $gallery = DB::table('galleries')
            ->where('id', $existing->gallery_id)
            ->where('class_id', $member->class_id)
            ->whereNull('deleted_at')
            ->first();

        abort_unless($gallery, 404, 'Galleriet findes ikke.');
        abort_unless($this->memberCanDeletePhoto($existing, $gallery, $member), 403, 'Du har ikke tilladelse til at slette dette billede.');

        $now = now()->format('Y-m-d H:i:s');

        DB::table('gallery_photos')->where('id', $existing->id)->update([
            'deleted_at'           => $now,
            'deleted_by_member_id' => $member->id,
        ]);

        DB::table('galleries')
            ->where('id', $gallery->id)
            ->where('photo_count', '>', 0)
            ->decrement('photo_count', 1, ['updated_at' => $now]);

        return response()->json(['ok' => true]);
    }

    public function reportGalleryPhoto(Request $request, string $photo): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);

        $existing = DB::table('gallery_photos')
            ->where('id', $photo)
            ->whereNull('deleted_at')
            ->first();

        abort_unless($existing, 404, 'Billedet findes ikke.');

        $gallery = DB::table('galleries')
            ->where('id', $existing->gallery_id)
            ->where('class_id', $member->class_id)
            ->whereNull('deleted_at')
            ->first();

        abort_unless($gallery, 404, 'Galleriet findes ikke.');
        abort_if(
            (string) ($existing->member_id ?? '') === (string) $member->id,
            422,
            'Du kan ikke rapportere dit eget billede.'
        );

        $data = $request->validate([
            'reason'  => ['nullable', 'string', 'max:190'],
            'details' => ['nullable', 'string', 'max:2000'],
        ]);

        $reason  = trim($data['reason'] ?? '') ?: 'Foto rapporteret';
        $details = trim($data['details'] ?? '') ?: null;
        $now     = now()->format('Y-m-d H:i:s');

        DB::table('member_reports')->insert([
            'id'                 => (string) Str::uuid(),
            'reporter_member_id' => $member->id,
            'reported_member_id' => $existing->member_id ?? null,
            'target_type'        => 'gallery_photo',
            'target_id'          => $existing->id,
            'reason'             => $reason,
            'details'            => $details,
            'status'             => 'pending',
            'reviewed_at'        => null,
            'created_at'         => $now,
            'updated_at'         => $now,
        ]);

        return response()->json(['ok' => true]);
    }

    private function isDuplicateEmailConstraintError(QueryException $exception): bool
    {
        $message = strtolower((string) $exception->getMessage());
        $sqlState = $exception->errorInfo[0] ?? null;
        $driverCode = (string) ($exception->errorInfo[1] ?? '');

        if (str_contains($message, 'members_email_unique') || str_contains($message, 'members.email')) {
            return true;
        }

        if ($sqlState === '23000' && in_array($driverCode, ['1062', '2627', '2601', '19'], true)) {
            return str_contains($message, 'members') && str_contains($message, 'email');
        }

        return false;
    }
}
