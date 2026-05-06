<?php

namespace App\Support;

use App\Events\PointDuelUpdated;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class PointDuelMaintenance
{
    public static function expireDueForMember(object $member): int
    {
        return self::expireDue($member);
    }

    public static function expireAllDue(): int
    {
        return self::expireDue();
    }

    public static function dispatchDuelUpdatedById(string $duelId): void
    {
        $duel = DB::table('point_duels')->where('id', $duelId)->first();

        if ($duel) {
            self::dispatchDuelUpdated($duel);
        }
    }

    public static function dispatchDuelUpdated(object $duel): void
    {
        DB::afterCommit(function () use ($duel): void {
            event(new PointDuelUpdated(
                (string) $duel->id,
                (string) $duel->class_id,
                self::duelMemberIds($duel),
            ));
        });
    }

    private static function expireDue(?object $member = null): int
    {
        if (! Schema::hasTable('point_duels') || ! Schema::hasTable('cap_transactions')) {
            return 0;
        }

        $expiredDuels = [];
        $now = Carbon::now('UTC');
        $nowString = $now->format('Y-m-d H:i:s');
        $acceptCutoff = $now->copy()->subDay()->format('Y-m-d H:i:s');
        $hasJudgeColumn = Schema::hasColumn('point_duels', 'judge_member_id');
        $expirableStatuses = [
            'awaitingOpponent',
            'awaitingCreatorConfirm',
            'active',
            'awaitingResultConfirm',
            'awaitingJudgeApproval',
        ];

        DB::transaction(function () use ($member, $hasJudgeColumn, $nowString, $acceptCutoff, $expirableStatuses, &$expiredDuels): void {
            $query = DB::table('point_duels')
                ->whereIn('status', $expirableStatuses)
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
                });

            if ($member) {
                $query
                    ->where('class_id', $member->class_id)
                    ->where(function ($query) use ($member, $hasJudgeColumn): void {
                        $query
                            ->where('creator_member_id', $member->id)
                            ->orWhere('opponent_member_id', $member->id);

                        if ($hasJudgeColumn) {
                            $query->orWhere('judge_member_id', $member->id);
                        }
                    });
            }

            $query
                ->orderBy('created_at')
                ->lockForUpdate()
                ->get()
                ->each(function (object $duel) use ($nowString, &$expiredDuels): void {
                    self::expireDuelRow($duel, $nowString);
                    $expiredDuels[] = $duel;
                });
        }, 3);

        foreach ($expiredDuels as $duel) {
            self::dispatchDuelUpdated($duel);
        }

        return count($expiredDuels);
    }

    private static function expireDuelRow(object $duel, string $expiredAt): void
    {
        self::refundDuelEscrow($duel->creator_member_id, $duel, (int) ($duel->creator_escrow_caps ?? 0), 'duel_expired');
        self::refundDuelEscrow($duel->opponent_member_id, $duel, (int) ($duel->opponent_escrow_caps ?? 0), 'duel_expired');

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

    private static function refundDuelEscrow(string $memberId, object $duel, int $amount, string $type): void
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
        self::recordCapTransaction(
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

    private static function recordCapTransaction(
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
            'created_at' => Carbon::now('UTC')->format('Y-m-d H:i:s'),
        ]);
    }

    private static function duelMemberIds(object $duel): array
    {
        return collect([
            $duel->creator_member_id ?? null,
            $duel->opponent_member_id ?? null,
            $duel->judge_member_id ?? null,
        ])
            ->filter()
            ->map(fn ($memberId): string => (string) $memberId)
            ->unique()
            ->values()
            ->all();
    }
}
