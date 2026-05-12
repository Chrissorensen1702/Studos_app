<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class PushNotifier
{
    public const CHANNEL_ID = 'studos-default';

    public const CAT_CHAT_MESSAGE = 'chat_message';
    public const CAT_CHAT_REACTION = 'chat_reaction';
    public const CAT_GROUP_CHAT_INVITE = 'group_chat_invite';
    public const CAT_DUEL_INVITE = 'duel_invite';
    public const CAT_DUEL_RESPONSE = 'duel_response';
    public const CAT_DUEL_ACTION_REQUIRED = 'duel_action_required';
    public const CAT_DUEL_RESULT = 'duel_result';
    public const CAT_DUEL_EXPIRING = 'duel_expiring';
    public const CAT_EVENT_INVITE = 'event_invite';
    public const CAT_EVENT_CHANGE = 'event_change';
    public const CAT_EVENT_REMINDER = 'event_reminder';
    public const CAT_RSVP_REMINDER = 'rsvp_reminder';
    public const CAT_GALLERY_NEW = 'gallery_new';
    public const CAT_GALLERY_PHOTOS = 'gallery_photos';
    public const CAT_CLASS_ANNOUNCEMENT = 'class_announcement';
    public const CAT_CONNECTION_REQUEST = 'connection_request';
    public const CAT_CONNECTION_ACCEPTED = 'connection_accepted';
    public const CAT_GOOD_DEED_REMINDER = 'good_deed_reminder';
    public const CAT_STREAK_REMINDER = 'streak_reminder';

    public const CATEGORIES = [
        self::CAT_CHAT_MESSAGE,
        self::CAT_CHAT_REACTION,
        self::CAT_GROUP_CHAT_INVITE,
        self::CAT_DUEL_INVITE,
        self::CAT_DUEL_RESPONSE,
        self::CAT_DUEL_ACTION_REQUIRED,
        self::CAT_DUEL_RESULT,
        self::CAT_DUEL_EXPIRING,
        self::CAT_EVENT_INVITE,
        self::CAT_EVENT_CHANGE,
        self::CAT_EVENT_REMINDER,
        self::CAT_RSVP_REMINDER,
        self::CAT_GALLERY_NEW,
        self::CAT_GALLERY_PHOTOS,
        self::CAT_CLASS_ANNOUNCEMENT,
        self::CAT_CONNECTION_REQUEST,
        self::CAT_CONNECTION_ACCEPTED,
        self::CAT_GOOD_DEED_REMINDER,
        self::CAT_STREAK_REMINDER,
    ];

    /**
     * Send a push notification to one or more members.
     *
     * @param  string  $category  one of the CAT_* constants
     * @param  array<int,string>  $memberIds  recipient member ids
     * @param  array<string,mixed>  $options  title, body, data, dedupKey, sourceType, sourceId
     * @return int  number of push messages sent
     */
    public static function send(string $category, array $memberIds, array $options): int
    {
        if (! in_array($category, self::CATEGORIES, true)) {
            Log::warning('PushNotifier: ukendt kategori', ['category' => $category]);

            return 0;
        }

        if (! Schema::hasTable('member_push_tokens')) {
            return 0;
        }

        $memberIds = collect($memberIds)
            ->filter(fn ($id): bool => filled($id))
            ->map(fn ($id): string => (string) $id)
            ->unique()
            ->values()
            ->all();

        if (empty($memberIds)) {
            return 0;
        }

        $title = (string) ($options['title'] ?? 'Studos');
        $body = (string) ($options['body'] ?? '');
        $data = array_merge(
            [
                'type' => $category,
                'screen' => $options['screen'] ?? self::defaultScreen($category),
            ],
            (array) ($options['data'] ?? []),
        );
        $dedupKey = $options['dedupKey'] ?? null;
        $sourceType = $options['sourceType'] ?? null;
        $sourceId = $options['sourceId'] ?? null;

        $allowedMemberIds = self::filterByPreferences($memberIds, $category);

        if (empty($allowedMemberIds)) {
            return 0;
        }

        if ($dedupKey !== null) {
            $allowedMemberIds = self::filterUndispatched($allowedMemberIds, $dedupKey);

            if (empty($allowedMemberIds)) {
                return 0;
            }
        }

        $tokens = DB::table('member_push_tokens')
            ->whereIn('member_id', $allowedMemberIds)
            ->whereIn('platform', ['android', 'ios'])
            ->whereNull('disabled_at')
            ->get(['member_id', 'expo_push_token', 'platform']);

        if ($tokens->isEmpty()) {
            self::recordDispatch($allowedMemberIds, $category, $dedupKey, $sourceType, $sourceId);

            return 0;
        }

        $messages = $tokens
            ->map(function (object $token) use ($title, $body, $data): array {
                $message = [
                    'to' => $token->expo_push_token,
                    'sound' => 'default',
                    'title' => Str::limit($title, 80),
                    'body' => Str::limit($body, 240),
                    'data' => $data,
                ];

                if ($token->platform === 'android') {
                    $message['channelId'] = self::CHANNEL_ID;
                }

                return $message;
            })
            ->values()
            ->all();
        $expoTokenColumn = $tokens->pluck('expo_push_token')->values();
        $sentCount = 0;

        try {
            $response = Http::timeout(6)
                ->acceptJson()
                ->post('https://exp.host/--/api/v2/push/send', $messages);

            if ($response->failed()) {
                Log::warning('PushNotifier: Expo afviste pushen.', [
                    'category' => $category,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            } else {
                $sentCount = count($messages);
                self::disableInvalidTokens($response->json(), $expoTokenColumn);
            }
        } catch (\Throwable $exception) {
            Log::warning('PushNotifier: undtagelse ved push.', [
                'category' => $category,
                'error' => $exception->getMessage(),
            ]);
        }

        self::recordDispatch(
            $tokens->pluck('member_id')->unique()->values()->all(),
            $category,
            $dedupKey,
            $sourceType,
            $sourceId,
        );

        return $sentCount;
    }

    /**
     * Default routing screen for a category. The mobile app maps this to navigation.
     */
    public static function defaultScreen(string $category): string
    {
        // Screen names map to mobile app tabs (apps/mobile/App.js setActiveTab values).
        return match ($category) {
            self::CAT_CHAT_MESSAGE, self::CAT_CHAT_REACTION, self::CAT_GROUP_CHAT_INVITE => 'chat',
            self::CAT_DUEL_INVITE,
            self::CAT_DUEL_RESPONSE,
            self::CAT_DUEL_ACTION_REQUIRED,
            self::CAT_DUEL_RESULT,
            self::CAT_DUEL_EXPIRING => 'challenges',
            self::CAT_EVENT_INVITE,
            self::CAT_EVENT_CHANGE,
            self::CAT_EVENT_REMINDER,
            self::CAT_RSVP_REMINDER => 'calendar',
            self::CAT_GALLERY_NEW, self::CAT_GALLERY_PHOTOS => 'walls',
            self::CAT_CLASS_ANNOUNCEMENT => 'overview',
            self::CAT_CONNECTION_REQUEST, self::CAT_CONNECTION_ACCEPTED => 'connections',
            self::CAT_GOOD_DEED_REMINDER => 'earnCaps',
            self::CAT_STREAK_REMINDER => 'overview',
            default => 'overview',
        };
    }

    /**
     * Returns the per-member preference map ([memberId => [category => bool]]) with defaults.
     */
    public static function preferencesFor(string $memberId): array
    {
        $defaults = [];
        foreach (self::CATEGORIES as $category) {
            $defaults[$category] = true;
        }

        if (! Schema::hasTable('member_notification_preferences')) {
            return $defaults;
        }

        $rows = DB::table('member_notification_preferences')
            ->where('member_id', $memberId)
            ->get(['category', 'enabled']);

        foreach ($rows as $row) {
            if (in_array($row->category, self::CATEGORIES, true)) {
                $defaults[$row->category] = (bool) $row->enabled;
            }
        }

        return $defaults;
    }

    public static function setPreference(string $memberId, string $category, bool $enabled): void
    {
        if (! in_array($category, self::CATEGORIES, true)) {
            return;
        }

        if (! Schema::hasTable('member_notification_preferences')) {
            return;
        }

        $now = now()->format('Y-m-d H:i:s');
        $existing = DB::table('member_notification_preferences')
            ->where('member_id', $memberId)
            ->where('category', $category)
            ->first();

        if ($existing) {
            DB::table('member_notification_preferences')
                ->where('id', $existing->id)
                ->update([
                    'enabled' => $enabled,
                    'updated_at' => $now,
                ]);

            return;
        }

        DB::table('member_notification_preferences')->insert([
            'id' => (string) Str::uuid(),
            'member_id' => $memberId,
            'category' => $category,
            'enabled' => $enabled,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    /**
     * Filter member ids down to those that haven't disabled the given category.
     *
     * @param  array<int,string>  $memberIds
     * @return array<int,string>
     */
    private static function filterByPreferences(array $memberIds, string $category): array
    {
        if (! Schema::hasTable('member_notification_preferences')) {
            return $memberIds;
        }

        $disabledMemberIds = DB::table('member_notification_preferences')
            ->whereIn('member_id', $memberIds)
            ->where('category', $category)
            ->where('enabled', false)
            ->pluck('member_id')
            ->map(fn ($id): string => (string) $id)
            ->all();

        if (empty($disabledMemberIds)) {
            return $memberIds;
        }

        return array_values(array_diff($memberIds, $disabledMemberIds));
    }

    /**
     * Drop members for whom we have already dispatched a push with this dedup key.
     *
     * @param  array<int,string>  $memberIds
     * @return array<int,string>
     */
    private static function filterUndispatched(array $memberIds, string $dedupKey): array
    {
        if (! Schema::hasTable('notification_dispatch_log')) {
            return $memberIds;
        }

        $alreadySent = DB::table('notification_dispatch_log')
            ->whereIn('member_id', $memberIds)
            ->where('dedup_key', $dedupKey)
            ->pluck('member_id')
            ->map(fn ($id): string => (string) $id)
            ->all();

        if (empty($alreadySent)) {
            return $memberIds;
        }

        return array_values(array_diff($memberIds, $alreadySent));
    }

    /**
     * @param  array<int,string>  $memberIds
     */
    private static function recordDispatch(
        array $memberIds,
        string $category,
        ?string $dedupKey,
        ?string $sourceType,
        ?string $sourceId,
    ): void {
        if (empty($memberIds) || ! Schema::hasTable('notification_dispatch_log')) {
            return;
        }

        $now = Carbon::now('UTC')->format('Y-m-d H:i:s');
        $rows = collect($memberIds)
            ->unique()
            ->map(fn (string $memberId): array => [
                'id' => (string) Str::uuid(),
                'member_id' => $memberId,
                'category' => $category,
                'dedup_key' => $dedupKey,
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'sent_at' => $now,
            ])
            ->values()
            ->all();

        try {
            DB::table('notification_dispatch_log')->insertOrIgnore($rows);
        } catch (\Throwable $exception) {
            Log::warning('PushNotifier: kunne ikke logge dispatch.', [
                'error' => $exception->getMessage(),
            ]);
        }
    }

    private static function disableInvalidTokens(mixed $expoResponse, Collection $tokens): void
    {
        $tickets = collect($expoResponse['data'] ?? []);
        $invalid = $tickets
            ->values()
            ->filter(fn ($ticket, int $index): bool => ($ticket['details']['error'] ?? null) === 'DeviceNotRegistered'
                && filled($tokens->get($index)))
            ->map(fn ($ticket, int $index): string => $tokens->get($index))
            ->values();

        if ($invalid->isEmpty()) {
            return;
        }

        DB::table('member_push_tokens')
            ->whereIn('expo_push_token', $invalid)
            ->update([
                'disabled_at' => now()->format('Y-m-d H:i:s'),
                'updated_at' => now()->format('Y-m-d H:i:s'),
            ]);
    }
}
