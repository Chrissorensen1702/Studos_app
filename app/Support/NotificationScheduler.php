<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class NotificationScheduler
{
    /**
     * Notify duel participants that a duel is about to expire (within ~2 hours).
     * One push per (duel, member) thanks to dedup.
     */
    public static function dispatchDuelExpiring(): int
    {
        if (! Schema::hasTable('point_duels')) {
            return 0;
        }

        $now = Carbon::now('UTC');
        $windowEnd = $now->copy()->addHours(2)->format('Y-m-d H:i:s');
        $windowStart = $now->format('Y-m-d H:i:s');
        $hasJudgeColumn = Schema::hasColumn('point_duels', 'judge_member_id');
        $relevantStatuses = ['awaitingOpponent', 'awaitingCreatorConfirm', 'active', 'awaitingResultConfirm', 'awaitingJudgeApproval'];

        $duels = DB::table('point_duels')
            ->whereIn('status', $relevantStatuses)
            ->whereNotNull('deadline_at')
            ->whereBetween('deadline_at', [$windowStart, $windowEnd])
            ->get();

        $sent = 0;

        foreach ($duels as $duel) {
            $recipients = collect([
                $duel->creator_member_id ?? null,
                $duel->opponent_member_id ?? null,
            ]);

            if ($hasJudgeColumn) {
                $recipients->push($duel->judge_member_id ?? null);
            }

            $recipients = $recipients
                ->filter()
                ->map(fn ($id): string => (string) $id)
                ->unique()
                ->values()
                ->all();

            if (empty($recipients)) {
                continue;
            }

            $deadline = Carbon::parse($duel->deadline_at);
            $hoursLeft = max(1, (int) ceil($now->diffInMinutes($deadline, false) / 60));
            $challenge = Str::limit((string) ($duel->challenge ?? ''), 80);

            $sent += PushNotifier::send(PushNotifier::CAT_DUEL_EXPIRING, $recipients, [
                'title' => 'Dyst udløber snart ⏳',
                'body' => '"'.$challenge.'" udløber om ca. '.$hoursLeft.' '.($hoursLeft === 1 ? 'time' : 'timer').'.',
                'data' => [
                    'duelId' => $duel->id,
                    'deadlineAt' => $duel->deadline_at,
                ],
                'sourceType' => 'point_duel',
                'sourceId' => $duel->id,
                'dedupKey' => 'duel_expiring:'.$duel->id,
            ]);
        }

        return $sent;
    }

    /**
     * Notify invited members the day before and ~2 hours before an event.
     * Two distinct dedup keys per event so each member gets at most one
     * 24h reminder and one 2h reminder.
     */
    public static function dispatchEventReminders(): int
    {
        if (! Schema::hasTable('events') || ! Schema::hasTable('event_invites')) {
            return 0;
        }

        $now = Carbon::now('UTC');
        $sent = 0;

        // 24-hour reminder (event_date in [now+22h, now+26h] OR starts_at if set)
        $sent += self::sendEventReminderWindow(
            $now,
            $now->copy()->addHours(22),
            $now->copy()->addHours(26),
            '24h',
            'Begivenhed i morgen 📅',
        );

        // 2-hour reminder
        $sent += self::sendEventReminderWindow(
            $now,
            $now->copy()->addMinutes(90),
            $now->copy()->addMinutes(150),
            '2h',
            'Begivenhed om kort tid ⏰',
        );

        return $sent;
    }

    private static function sendEventReminderWindow(
        Carbon $now,
        Carbon $windowStart,
        Carbon $windowEnd,
        string $bucket,
        string $title,
    ): int {
        $startsAtStart = $windowStart->format('Y-m-d H:i:s');
        $startsAtEnd = $windowEnd->format('Y-m-d H:i:s');
        $dateStart = $windowStart->format('Y-m-d');
        $dateEnd = $windowEnd->format('Y-m-d');

        $events = DB::table('events')
            ->where(function ($query) use ($startsAtStart, $startsAtEnd, $dateStart, $dateEnd, $bucket): void {
                $query
                    ->whereBetween('starts_at', [$startsAtStart, $startsAtEnd])
                    ->orWhere(function ($subQuery) use ($dateStart, $dateEnd, $bucket): void {
                        // Date-only fallback only relevant for the 24h reminder.
                        if ($bucket === '24h') {
                            $subQuery
                                ->whereNull('starts_at')
                                ->whereBetween('event_date', [$dateStart, $dateEnd]);
                        }
                    });
            })
            ->get();

        $sent = 0;

        foreach ($events as $event) {
            $invitedIds = DB::table('event_invites')
                ->where('event_id', $event->id)
                ->pluck('member_id')
                ->map(fn ($id): string => (string) $id)
                ->all();

            if (empty($invitedIds) && ! blank($event->class_id ?? null)) {
                $invitedIds = DB::table('members')
                    ->where('class_id', $event->class_id)
                    ->where('status', 'active')
                    ->pluck('id')
                    ->map(fn ($id): string => (string) $id)
                    ->all();
            }

            if (empty($invitedIds)) {
                continue;
            }

            $whenLabel = ! blank($event->starts_at ?? null)
                ? Carbon::parse($event->starts_at)->isoFormat('D. MMM, [kl.] H:mm')
                : (! blank($event->event_date ?? null) ? Carbon::parse($event->event_date)->isoFormat('D. MMM') : null);

            $sent += PushNotifier::send(PushNotifier::CAT_EVENT_REMINDER, $invitedIds, [
                'title' => $title,
                'body' => Str::limit((string) ($event->title ?? 'Begivenhed'), 80).($whenLabel ? ' · '.$whenLabel : ''),
                'data' => [
                    'eventId' => $event->id,
                    'reminderBucket' => $bucket,
                ],
                'sourceType' => 'event',
                'sourceId' => $event->id,
                'dedupKey' => 'event_reminder:'.$event->id.':'.$bucket,
            ]);
        }

        return $sent;
    }

    /**
     * Remind invitees who haven't responded RSVP within 3 days of the event.
     */
    public static function dispatchRsvpReminders(): int
    {
        if (
            ! Schema::hasTable('events')
            || ! Schema::hasTable('event_invites')
            || ! Schema::hasTable('event_rsvps')
        ) {
            return 0;
        }

        $now = Carbon::now('UTC');
        $rangeStart = $now->copy()->addHours(48)->format('Y-m-d');
        $rangeEnd = $now->copy()->addDays(4)->format('Y-m-d');

        $events = DB::table('events')
            ->whereBetween('event_date', [$rangeStart, $rangeEnd])
            ->get();
        $sent = 0;

        foreach ($events as $event) {
            $missingMemberIds = DB::table('event_invites')
                ->leftJoin('event_rsvps', function ($join) use ($event): void {
                    $join
                        ->on('event_rsvps.event_id', '=', 'event_invites.event_id')
                        ->on('event_rsvps.member_id', '=', 'event_invites.member_id');
                })
                ->where('event_invites.event_id', $event->id)
                ->whereNull('event_rsvps.id')
                ->pluck('event_invites.member_id')
                ->map(fn ($id): string => (string) $id)
                ->all();

            if (empty($missingMemberIds)) {
                continue;
            }

            $whenLabel = ! blank($event->event_date ?? null)
                ? Carbon::parse($event->event_date)->isoFormat('D. MMM')
                : null;

            $sent += PushNotifier::send(PushNotifier::CAT_RSVP_REMINDER, $missingMemberIds, [
                'title' => 'Du mangler at svare ❓',
                'body' => Str::limit((string) ($event->title ?? 'Begivenhed'), 80).' venter på dit svar'.($whenLabel ? ' (afholdes '.$whenLabel.')' : '').'.',
                'data' => [
                    'eventId' => $event->id,
                ],
                'sourceType' => 'event',
                'sourceId' => $event->id,
                'dedupKey' => 'rsvp_reminder:'.$event->id,
            ]);
        }

        return $sent;
    }

    /**
     * Reminds members who haven't claimed the current week's good deed.
     * Should run weekly (e.g. fredag kl 17:00 lokal tid).
     */
    public static function dispatchGoodDeedReminders(): int
    {
        if (! Schema::hasTable('members') || ! Schema::hasTable('good_deed_claims')) {
            return 0;
        }

        $now = Carbon::now('Europe/Copenhagen');
        $weekKey = $now->isoWeekYear.'-W'.str_pad((string) $now->isoWeek, 2, '0', STR_PAD_LEFT);

        $claimedMemberIds = DB::table('good_deed_claims')
            ->where('week_key', $weekKey)
            ->pluck('member_id')
            ->map(fn ($id): string => (string) $id)
            ->all();

        $unclaimedMemberIds = DB::table('members')
            ->where('status', 'active')
            ->when(! empty($claimedMemberIds), fn ($query) => $query->whereNotIn('id', $claimedMemberIds))
            ->pluck('id')
            ->map(fn ($id): string => (string) $id)
            ->all();

        if (empty($unclaimedMemberIds)) {
            return 0;
        }

        return PushNotifier::send(PushNotifier::CAT_GOOD_DEED_REMINDER, $unclaimedMemberIds, [
            'title' => 'Ugens gode gerning venter 🌟',
            'body' => 'Du har endnu ikke claimet ugens gode gerning — drys lidt godhed og tjen Caps.',
            'data' => [
                'weekKey' => $weekKey,
            ],
            'sourceType' => 'good_deed',
            'sourceId' => $weekKey,
            'dedupKey' => 'good_deed_reminder:'.$weekKey,
        ]);
    }

    /**
     * Reminds members with an active streak who haven't checked in today.
     * Should run daily in early evening lokal tid (fx 19:00).
     */
    public static function dispatchStreakReminders(): int
    {
        if (! Schema::hasTable('weekly_check_ins')) {
            return 0;
        }

        $today = Carbon::now('Europe/Copenhagen')->toDateString();
        $yesterday = Carbon::now('Europe/Copenhagen')->subDay()->toDateString();

        $checkedInToday = DB::table('weekly_check_ins')
            ->where('day_key', $today)
            ->pluck('member_id')
            ->map(fn ($id): string => (string) $id)
            ->all();

        $atRiskMembers = DB::table('weekly_check_ins')
            ->where('day_key', $yesterday)
            ->where('streak_day', '>=', 1)
            ->where('streak_day', '<', 7)
            ->when(! empty($checkedInToday), fn ($query) => $query->whereNotIn('member_id', $checkedInToday))
            ->pluck('member_id')
            ->map(fn ($id): string => (string) $id)
            ->unique()
            ->values()
            ->all();

        if (empty($atRiskMembers)) {
            return 0;
        }

        return PushNotifier::send(PushNotifier::CAT_STREAK_REMINDER, $atRiskMembers, [
            'title' => 'Din streak er på spil 🔥',
            'body' => 'Du har ikke checket ind i dag — bevar din streak inden midnat.',
            'data' => [
                'dayKey' => $today,
            ],
            'sourceType' => 'streak',
            'sourceId' => $today,
            'dedupKey' => 'streak_reminder:'.$today,
        ]);
    }
}
