<?php

namespace App\Http\Controllers;

use App\Events\ChatMessageCreated;
use App\Support\ContentModeration;
use App\Support\UploadedImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ChatController extends Controller
{
    public function conversations(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $participants = DB::table('chat_participants')
            ->join('chat_conversations', 'chat_conversations.id', '=', 'chat_participants.conversation_id')
            ->select([
                'chat_participants.*',
                'chat_conversations.class_id as classId',
                'chat_conversations.type',
                'chat_conversations.title',
                'chat_conversations.group_photo_url as groupPhotoUrl',
                'chat_conversations.owner_member_id as ownerMemberId',
                'chat_conversations.created_by_member_id as createdByMemberId',
                'chat_conversations.status as conversationStatus',
                'chat_conversations.created_at as conversationCreatedAt',
                'chat_conversations.updated_at as conversationUpdatedAt',
            ])
            ->where('chat_participants.member_id', $member->id)
            ->where('chat_participants.status', 'active')
            ->whereNull('chat_participants.hidden_at')
            ->where('chat_conversations.status', 'active')
            ->orderByDesc('chat_conversations.updated_at')
            ->orderByDesc('chat_conversations.created_at')
            ->get();

        $conversationIds = $participants->pluck('conversation_id')->values();

        return response()->json([
            'conversations' => $this->serializeConversations($participants, $member, $conversationIds),
        ]);
    }

    public function createDirectConversation(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'memberId' => ['required', 'string', 'max:36'],
        ]);
        $target = $this->chatTargetForMember($member, $data['memberId']);

        abort_if(
            $this->memberBlockExistsBetween($member->id, $target->id),
            403,
            'I kan ikke starte en chat, fordi en af jer har blokeret den anden.'
        );

        $pairKey = $this->directPairKey($member->id, $target->id);
        $conversation = DB::table('chat_conversations')->where('direct_pair_key', $pairKey)->first();
        $statusCode = 200;

        if (! $conversation) {
            $conversationId = (string) Str::uuid();
            $now = now()->format('Y-m-d H:i:s');

            DB::transaction(function () use ($member, $target, $pairKey, $conversationId, $now): void {
                DB::table('chat_conversations')->insert([
                    'id' => $conversationId,
                    'class_id' => $member->class_id,
                    'type' => 'direct',
                    'title' => null,
                    'direct_pair_key' => $pairKey,
                    'owner_member_id' => null,
                    'created_by_member_id' => $member->id,
                    'status' => 'active',
                    'deleted_by_member_id' => null,
                    'deleted_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $this->insertChatParticipant($conversationId, $member->id, 'member', $now);
                $this->insertChatParticipant($conversationId, $target->id, 'member', $now);
            });

            $conversation = DB::table('chat_conversations')->where('id', $conversationId)->first();
            $statusCode = 201;
        } else {
            abort_if($conversation->status !== 'active', 410, 'Chatten er ikke laengere aktiv.');
            DB::table('chat_participants')
                ->where('conversation_id', $conversation->id)
                ->where('member_id', $member->id)
                ->update([
                    'status' => 'active',
                    'hidden_at' => null,
                    'updated_at' => now()->format('Y-m-d H:i:s'),
                ]);
        }

        return response()->json([
            'conversation' => $this->serializeConversationForMember($conversation->id, $member),
        ], $statusCode);
    }

    public function createGroupConversation(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'memberIds' => ['required', 'array', 'min:2', 'max:49'],
            'memberIds.*' => ['required', 'string', 'max:36'],
            'groupPhotoData' => ['nullable', 'string', 'max:7000000'],
        ]);
        $memberIds = collect($data['memberIds'])
            ->map(fn (string $memberId): string => trim($memberId))
            ->reject(fn (string $memberId): bool => $memberId === '' || $memberId === $member->id)
            ->unique()
            ->values();

        abort_if($memberIds->count() < 2, 422, 'En gruppechat skal have mindst tre deltagere inkl. dig.');

        $targets = DB::table('members')
            ->whereIn('id', $memberIds)
            ->where('class_id', $member->class_id)
            ->where('status', 'active')
            ->get()
            ->keyBy('id');

        abort_if($targets->count() !== $memberIds->count(), 422, 'Alle deltagere skal vaere aktive medlemmer i din klasse.');

        $conversationId = (string) Str::uuid();
        $now = now()->format('Y-m-d H:i:s');
        $title = ContentModeration::cleanText($data['title'], 'title', 'Gruppenavnet', [
            'source' => 'chat_group_title',
            'member_id' => $member->id,
            'class_id' => $member->class_id,
            'conversation_id' => $conversationId,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
        $groupPhotoPath = blank($data['groupPhotoData'] ?? null)
            ? null
            : UploadedImage::storeBase64($data['groupPhotoData'], 'chat-groups', $conversationId, 'Chat image');

        DB::transaction(function () use ($conversationId, $member, $memberIds, $title, $groupPhotoPath, $now): void {
            DB::table('chat_conversations')->insert([
                'id' => $conversationId,
                'class_id' => $member->class_id,
                'type' => 'group',
                'title' => $title,
                'group_photo_url' => $groupPhotoPath,
                'direct_pair_key' => null,
                'owner_member_id' => $member->id,
                'created_by_member_id' => $member->id,
                'status' => 'active',
                'deleted_by_member_id' => null,
                'deleted_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $this->insertChatParticipant($conversationId, $member->id, 'owner', $now);

            foreach ($memberIds as $memberId) {
                $this->insertChatParticipant($conversationId, $memberId, 'member', $now);
            }

            $this->logChatEvent($conversationId, null, $member->id, null, 'group_created', null, [
                'title' => $title,
                'memberIds' => $memberIds->all(),
            ]);
        });

        return response()->json([
            'conversation' => $this->serializeConversationForMember($conversationId, $member),
        ], 201);
    }

    public function messages(Request $request, string $conversation): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $chat = $this->conversationForMember($conversation, $member);
        $limit = min(max((int) $request->integer('limit', 50), 1), 100);
        $before = $request->string('before')->toString();
        $messagesQuery = DB::table('chat_messages')
            ->where('conversation_id', $chat->id)
            ->where('created_at', '>=', $chat->participantJoinedAt)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($limit);

        if (! blank($before)) {
            $messagesQuery->where('created_at', '<', Carbon::parse($before)->format('Y-m-d H:i:s'));
        }

        $messages = $messagesQuery->get()->reverse()->values();
        $participantRows = $this->participantsForConversations(collect([$chat->id]));
        $memberPreviews = $this->memberPreviews(
            $participantRows->pluck('member_id')->merge($messages->pluck('sender_member_id')),
        );

        return response()->json([
            'conversation' => $this->serializeConversation($chat, $member, $participantRows, $memberPreviews),
            'messages' => $messages
                ->map(fn (object $message): array => $this->serializeMessage($message, $chat, $member, $participantRows, $memberPreviews))
                ->values()
                ->all(),
        ]);
    }

    public function sendMessage(Request $request, string $conversation): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $chat = $this->conversationForMember($conversation, $member);
        $data = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);
        $body = ContentModeration::cleanText($data['body'], 'body', 'Beskeden', [
            'source' => 'chat_message',
            'member_id' => $member->id,
            'class_id' => $member->class_id,
            'conversation_id' => $chat->id,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        abort_if($body === '', 422, 'Beskeden maa ikke vaere tom.');

        if ($chat->type === 'direct') {
            $otherParticipantMemberId = $this->otherParticipantMemberId($chat->id, $member->id);

            abort_if(
                $otherParticipantMemberId && $this->memberBlockExistsBetween($member->id, $otherParticipantMemberId),
                403,
                'Beskeden kan ikke sendes, fordi chatten er blokeret.'
            );
        }

        $messageId = (string) Str::uuid();
        $now = now()->format('Y-m-d H:i:s');

        DB::transaction(function () use ($chat, $member, $messageId, $body, $now): void {
            DB::table('chat_messages')->insert([
                'id' => $messageId,
                'conversation_id' => $chat->id,
                'sender_member_id' => $member->id,
                'type' => 'text',
                'body' => $body,
                'edited_at' => null,
                'deleted_by_member_id' => null,
                'deleted_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('chat_conversations')->where('id', $chat->id)->update([
                'updated_at' => $now,
            ]);

            DB::table('chat_participants')
                ->where('conversation_id', $chat->id)
                ->where('status', 'active')
                ->update([
                    'hidden_at' => null,
                    'updated_at' => $now,
                ]);

            DB::table('chat_participants')
                ->where('conversation_id', $chat->id)
                ->where('member_id', $member->id)
                ->update([
                    'last_read_message_id' => $messageId,
                    'last_read_at' => $now,
                    'updated_at' => $now,
                ]);
        });

        broadcast(new ChatMessageCreated($chat->id, $messageId))->toOthers();
        $this->sendChatPushNotifications($chat, $member, $messageId, $body);

        $message = DB::table('chat_messages')->where('id', $messageId)->first();
        $participantRows = $this->participantsForConversations(collect([$chat->id]));
        $memberPreviews = $this->memberPreviews(
            $participantRows->pluck('member_id')->merge([$member->id]),
        );
        $freshChat = $this->conversationForMember($chat->id, $member);

        return response()->json([
            'conversation' => $this->serializeConversation($freshChat, $member, $participantRows, $memberPreviews),
            'message' => $this->serializeMessage($message, $freshChat, $member, $participantRows, $memberPreviews),
        ], 201);
    }

    public function markRead(Request $request, string $conversation): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $chat = $this->conversationForMember($conversation, $member);
        $data = $request->validate([
            'messageId' => ['nullable', 'string', 'max:36'],
        ]);
        $message = null;

        if (! blank($data['messageId'] ?? null)) {
            $message = DB::table('chat_messages')
                ->where('conversation_id', $chat->id)
                ->where('id', $data['messageId'])
                ->first();
        } else {
            $message = DB::table('chat_messages')
                ->where('conversation_id', $chat->id)
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->first();
        }

        abort_unless($message, 404);

        DB::table('chat_participants')
            ->where('conversation_id', $chat->id)
            ->where('member_id', $member->id)
            ->update([
                'last_read_message_id' => $message->id,
                'last_read_at' => now()->format('Y-m-d H:i:s'),
                'updated_at' => now()->format('Y-m-d H:i:s'),
            ]);

        return response()->json([
            'ok' => true,
            'conversation' => $this->serializeConversationForMember($chat->id, $member),
        ]);
    }

    public function hideConversation(Request $request, string $conversation): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $chat = $this->conversationForMember($conversation, $member);

        abort_if($chat->type === 'group', 422, 'Forlad gruppechatten i stedet.');

        DB::table('chat_participants')
            ->where('conversation_id', $chat->id)
            ->where('member_id', $member->id)
            ->update([
                'hidden_at' => now()->format('Y-m-d H:i:s'),
                'updated_at' => now()->format('Y-m-d H:i:s'),
            ]);

        return response()->json(['ok' => true]);
    }

    public function muteConversation(Request $request, string $conversation): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $chat = $this->conversationForMember($conversation, $member);
        $data = $request->validate([
            'muted' => ['required', 'boolean'],
        ]);
        $now = now()->format('Y-m-d H:i:s');
        $mutedUntil = $data['muted'] ? now()->addYears(5)->format('Y-m-d H:i:s') : null;

        DB::table('chat_participants')
            ->where('conversation_id', $chat->id)
            ->where('member_id', $member->id)
            ->update([
                'muted_until' => $mutedUntil,
                'updated_at' => $now,
            ]);

        $this->logChatEvent($chat->id, null, $member->id, null, $data['muted'] ? 'conversation_muted' : 'conversation_unmuted');

        return response()->json([
            'ok' => true,
            'conversation' => $this->serializeConversationForMember($chat->id, $member),
        ]);
    }

    public function reportConversation(Request $request, string $conversation): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $chat = $this->conversationForMember($conversation, $member);
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:190'],
            'details' => ['nullable', 'string', 'max:2000'],
        ]);
        $reportedMemberId = $chat->type === 'direct'
            ? $this->otherParticipantMemberId($chat->id, $member->id)
            : null;
        $reason = trim($data['reason'] ?? '') ?: 'Chat rapporteret';
        $now = now()->format('Y-m-d H:i:s');

        DB::transaction(function () use ($chat, $member, $reportedMemberId, $reason, $data, $now): void {
            DB::table('member_reports')->insert([
                'id' => (string) Str::uuid(),
                'reporter_member_id' => $member->id,
                'reported_member_id' => $reportedMemberId,
                'target_type' => 'chat_conversation',
                'target_id' => $chat->id,
                'reason' => $reason,
                'details' => trim($data['details'] ?? '') ?: null,
                'status' => 'pending',
                'reviewed_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $this->logChatEvent($chat->id, null, $member->id, $reportedMemberId, 'conversation_reported', $reason);
        });

        return response()->json(['ok' => true]);
    }

    public function blockConversationMember(Request $request, string $conversation): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $chat = $this->conversationForMember($conversation, $member);

        abort_unless($chat->type === 'direct', 422, 'Du kan kun blokere personer fra en 1-1 chat.');

        $blockedMemberId = $this->otherParticipantMemberId($chat->id, $member->id);

        abort_unless($blockedMemberId, 404, 'Personen findes ikke.');

        $now = now()->format('Y-m-d H:i:s');

        DB::transaction(function () use ($chat, $member, $blockedMemberId, $now): void {
            $existingBlock = DB::table('member_blocks')
                ->where('blocker_member_id', $member->id)
                ->where('blocked_member_id', $blockedMemberId)
                ->first();

            if ($existingBlock) {
                DB::table('member_blocks')
                    ->where('id', $existingBlock->id)
                    ->update([
                        'reason' => 'Blokeret fra chat',
                        'updated_at' => $now,
                    ]);
            } else {
                DB::table('member_blocks')->insert([
                    'id' => (string) Str::uuid(),
                    'blocker_member_id' => $member->id,
                    'blocked_member_id' => $blockedMemberId,
                    'reason' => 'Blokeret fra chat',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            DB::table('chat_participants')
                ->where('conversation_id', $chat->id)
                ->where('member_id', $member->id)
                ->update([
                    'hidden_at' => $now,
                    'updated_at' => $now,
                ]);

            $this->logChatEvent($chat->id, null, $member->id, $blockedMemberId, 'member_blocked');
        });

        return response()->json(['ok' => true]);
    }

    public function leaveConversation(Request $request, string $conversation): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $chat = $this->conversationForMember($conversation, $member);

        abort_unless($chat->type === 'group', 422, 'Kun gruppechats kan forlades.');
        abort_if($chat->owner_member_id === $member->id, 422, 'Ejeren skal slette gruppen eller overdrage ejerskab foerst.');

        $now = now()->format('Y-m-d H:i:s');

        DB::transaction(function () use ($chat, $member, $now): void {
            DB::table('chat_participants')
                ->where('conversation_id', $chat->id)
                ->where('member_id', $member->id)
                ->update([
                    'status' => 'left',
                    'left_at' => $now,
                    'hidden_at' => $now,
                    'updated_at' => $now,
                ]);

            $this->logChatEvent($chat->id, null, $member->id, $member->id, 'participant_left');
        });

        return response()->json(['ok' => true]);
    }

    public function deleteConversation(Request $request, string $conversation): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $chat = $this->conversationForMember($conversation, $member);

        abort_unless($chat->type === 'group', 422, 'Direkte chats kan kun skjules for dig.');
        abort_if($chat->owner_member_id !== $member->id, 403, 'Kun ejeren kan slette gruppechatten.');

        $now = now()->format('Y-m-d H:i:s');

        DB::transaction(function () use ($chat, $member, $now): void {
            DB::table('chat_conversations')->where('id', $chat->id)->update([
                'status' => 'deleted',
                'deleted_by_member_id' => $member->id,
                'deleted_at' => $now,
                'updated_at' => $now,
            ]);

            $this->logChatEvent($chat->id, null, $member->id, null, 'group_deleted');
        });

        return response()->json(['ok' => true]);
    }

    public function reportMessage(Request $request, string $message): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $chatMessage = DB::table('chat_messages')->where('id', $message)->first();

        abort_unless($chatMessage, 404);
        abort_if(! blank($chatMessage->deleted_at), 410, 'Beskeden er allerede slettet.');

        $chat = $this->conversationForMember($chatMessage->conversation_id, $member);

        abort_if($chatMessage->sender_member_id === $member->id, 422, 'Du kan ikke rapportere din egen besked.');

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:190'],
            'details' => ['nullable', 'string', 'max:2000'],
        ]);
        $reason = trim($data['reason'] ?? '') ?: 'Besked rapporteret';
        $now = now()->format('Y-m-d H:i:s');

        DB::transaction(function () use ($chat, $chatMessage, $member, $reason, $data, $now): void {
            DB::table('member_reports')->insert([
                'id' => (string) Str::uuid(),
                'reporter_member_id' => $member->id,
                'reported_member_id' => $chatMessage->sender_member_id,
                'target_type' => 'chat_message',
                'target_id' => $chatMessage->id,
                'reason' => $reason,
                'details' => trim($data['details'] ?? '') ?: null,
                'status' => 'pending',
                'reviewed_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $this->logChatEvent($chat->id, $chatMessage->id, $member->id, $chatMessage->sender_member_id, 'message_reported', $reason);
        });

        return response()->json(['ok' => true]);
    }

    public function deleteMessage(Request $request, string $message): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $chatMessage = DB::table('chat_messages')->where('id', $message)->first();

        abort_unless($chatMessage, 404);

        $chat = $this->conversationForMember($chatMessage->conversation_id, $member);
        $canDelete = $chatMessage->sender_member_id === $member->id
            || in_array($this->normalizeRole($member->role), ['owner', 'moderator'], true);

        abort_unless($canDelete, 403, 'Du kan ikke slette denne besked.');

        $now = now()->format('Y-m-d H:i:s');

        DB::transaction(function () use ($chat, $chatMessage, $member, $now): void {
            DB::table('chat_messages')->where('id', $chatMessage->id)->update([
                'deleted_by_member_id' => $member->id,
                'deleted_at' => $now,
                'updated_at' => $now,
            ]);

            $this->logChatEvent($chat->id, $chatMessage->id, $member->id, $chatMessage->sender_member_id, 'message_deleted');
        });

        return response()->json(['ok' => true]);
    }

    public function authorizeRealtimeChannel(Request $request): JsonResponse
    {
        $member = $this->authenticatedMemberFromRequest($request);
        $data = $request->validate([
            'socket_id' => ['required', 'string', 'max:80'],
            'channel_name' => ['required', 'string', 'max:120'],
        ]);
        $channelName = $data['channel_name'];

        if (Str::startsWith($channelName, 'private-chat.')) {
            $conversationId = Str::after($channelName, 'private-chat.');
            $this->conversationForMember($conversationId, $member);
        } elseif (Str::startsWith($channelName, 'private-duels.member.')) {
            $memberId = Str::after($channelName, 'private-duels.member.');

            abort_unless((string) $memberId === (string) $member->id, 403, 'Ugyldig realtime-kanal.');
        } else {
            abort(403, 'Ugyldig realtime-kanal.');
        }

        $signature = hash_hmac(
            'sha256',
            $data['socket_id'].':'.$channelName,
            (string) config('broadcasting.connections.reverb.secret'),
        );

        return response()->json([
            'auth' => config('broadcasting.connections.reverb.key').':'.$signature,
        ]);
    }

    private function serializeConversations($participants, object $member, $conversationIds): array
    {
        if ($participants->isEmpty()) {
            return [];
        }

        $participantRows = $this->participantsForConversations($conversationIds);
        $lastMessages = DB::table('chat_messages')
            ->whereIn('conversation_id', $conversationIds)
            ->whereNull('deleted_at')
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('conversation_id')
            ->map(fn ($messages) => $messages->first());
        $memberPreviews = $this->memberPreviews(
            $participantRows->pluck('member_id')->merge($lastMessages->pluck('sender_member_id')),
        );

        return $participants
            ->map(function (object $participant) use ($member, $participantRows, $lastMessages, $memberPreviews): array {
                $conversation = (object) [
                    'id' => $participant->conversation_id,
                    'class_id' => $participant->classId,
                    'type' => $participant->type,
                    'title' => $participant->title,
                    'group_photo_url' => $participant->groupPhotoUrl ?? null,
                    'owner_member_id' => $participant->ownerMemberId,
                    'created_by_member_id' => $participant->createdByMemberId,
                    'status' => $participant->conversationStatus,
                    'created_at' => $participant->conversationCreatedAt,
                    'updated_at' => $participant->conversationUpdatedAt,
                    'participantId' => $participant->id,
                    'participantRole' => $participant->role,
                    'participantStatus' => $participant->status,
                    'participantJoinedAt' => $participant->joined_at,
                    'participantMutedUntil' => $participant->muted_until,
                    'participantLastReadAt' => $participant->last_read_at,
                    'participantLastReadMessageId' => $participant->last_read_message_id,
                ];

                return $this->serializeConversation($conversation, $member, $participantRows, $memberPreviews, $lastMessages->get($participant->conversation_id));
            })
            ->sortByDesc(fn (array $conversation): int => $this->conversationSortTimestamp($conversation))
            ->values()
            ->all();
    }

    private function conversationSortTimestamp(array $conversation): int
    {
        $timestamp = $conversation['lastMessage']['createdAt']
            ?? $conversation['updatedAt']
            ?? $conversation['createdAt']
            ?? null;

        return blank($timestamp) ? 0 : Carbon::parse($timestamp)->getTimestamp();
    }

    private function serializeConversationForMember(string $conversationId, object $member): array
    {
        $chat = $this->conversationForMember($conversationId, $member);
        $participantRows = $this->participantsForConversations(collect([$conversationId]));
        $lastMessage = DB::table('chat_messages')
            ->where('conversation_id', $conversationId)
            ->whereNull('deleted_at')
            ->orderByDesc('created_at')
            ->first();
        $memberPreviews = $this->memberPreviews(
            $participantRows->pluck('member_id')->merge($lastMessage ? [$lastMessage->sender_member_id] : []),
        );

        return $this->serializeConversation($chat, $member, $participantRows, $memberPreviews, $lastMessage);
    }

    private function serializeConversation(object $chat, object $member, $participantRows, $memberPreviews, ?object $lastMessage = null): array
    {
        $participants = $participantRows
            ->where('conversation_id', $chat->id)
            ->values();
        $activeParticipants = $participants
            ->where('status', 'active')
            ->values();
        $unreadCount = DB::table('chat_messages')
            ->where('conversation_id', $chat->id)
            ->where('sender_member_id', '!=', $member->id)
            ->whereNull('deleted_at')
            ->when($chat->participantLastReadAt, fn ($query) => $query->where('created_at', '>', $chat->participantLastReadAt))
            ->when(! $chat->participantLastReadAt, fn ($query) => $query->where('created_at', '>=', $chat->participantJoinedAt))
            ->count();
        $title = $chat->type === 'direct'
            ? $this->directConversationTitle($activeParticipants, $member->id, $memberPreviews)
            : $chat->title;

        return [
            'id' => $chat->id,
            'type' => $chat->type,
            'title' => $title,
            'groupPhotoUrl' => UploadedImage::publicUrl($chat->group_photo_url ?? null),
            'ownerMemberId' => $chat->owner_member_id ?? null,
            'status' => $chat->status,
            'unreadCount' => $unreadCount,
            'mutedUntil' => $this->apiDateTime($chat->participantMutedUntil ?? null),
            'realtimeChannel' => 'private-chat.'.$chat->id,
            'canDeleteForEveryone' => $chat->type === 'group' && ($chat->owner_member_id ?? null) === $member->id,
            'canLeave' => $chat->type === 'group' && ($chat->owner_member_id ?? null) !== $member->id,
            'canHide' => $chat->type === 'direct',
            'createdAt' => $this->apiDateTime($chat->created_at),
            'updatedAt' => $this->apiDateTime($chat->updated_at ?? null),
            'participants' => $participants
                ->map(fn (object $participant): array => $this->serializeParticipant($participant, $memberPreviews))
                ->values()
                ->all(),
            'lastMessage' => $lastMessage ? $this->serializeMessage($lastMessage, $chat, $member, $participantRows, $memberPreviews) : null,
        ];
    }

    private function serializeMessage(object $message, object $chat, object $viewer, $participantRows, $memberPreviews): array
    {
        $sender = $memberPreviews->get($message->sender_member_id);
        $isDeleted = ! blank($message->deleted_at);
        $readByOther = null;

        if ($chat->type === 'direct' && $message->sender_member_id === $viewer->id) {
            $otherParticipant = $participantRows
                ->where('conversation_id', $message->conversation_id)
                ->where('member_id', '!=', $viewer->id)
                ->where('status', 'active')
                ->first();
            $readByOther = $otherParticipant && ! blank($otherParticipant->last_read_at)
                ? Carbon::parse($otherParticipant->last_read_at)->greaterThanOrEqualTo(Carbon::parse($message->created_at))
                : false;
        }

        return [
            'id' => $message->id,
            'conversationId' => $message->conversation_id,
            'type' => $message->type,
            'body' => $isDeleted ? '' : $message->body,
            'isDeleted' => $isDeleted,
            'isMine' => $message->sender_member_id === $viewer->id,
            'readByOther' => $readByOther,
            'createdAt' => $this->apiDateTime($message->created_at),
            'updatedAt' => $this->apiDateTime($message->updated_at ?? null),
            'deletedAt' => $this->apiDateTime($message->deleted_at ?? null),
            'sender' => $sender ? $this->serializeMemberPreview($sender) : null,
        ];
    }

    private function serializeParticipant(object $participant, $memberPreviews): array
    {
        $member = $memberPreviews->get($participant->member_id);

        return [
            'id' => $participant->id,
            'memberId' => $participant->member_id,
            'role' => $participant->role,
            'status' => $participant->status,
            'joinedAt' => $this->apiDateTime($participant->joined_at),
            'leftAt' => $this->apiDateTime($participant->left_at ?? null),
            'member' => $member ? $this->serializeMemberPreview($member) : null,
        ];
    }

    private function conversationForMember(string $conversationId, object $member): object
    {
        $chat = DB::table('chat_conversations')
            ->join('chat_participants', 'chat_participants.conversation_id', '=', 'chat_conversations.id')
            ->select([
                'chat_conversations.*',
                'chat_participants.id as participantId',
                'chat_participants.role as participantRole',
                'chat_participants.status as participantStatus',
                'chat_participants.joined_at as participantJoinedAt',
                'chat_participants.left_at as participantLeftAt',
                'chat_participants.hidden_at as participantHiddenAt',
                'chat_participants.muted_until as participantMutedUntil',
                'chat_participants.last_read_at as participantLastReadAt',
                'chat_participants.last_read_message_id as participantLastReadMessageId',
            ])
            ->where('chat_conversations.id', $conversationId)
            ->where('chat_participants.member_id', $member->id)
            ->first();

        abort_unless($chat, 404);
        abort_if($chat->status !== 'active', 410, 'Chatten er ikke laengere aktiv.');
        abort_if($chat->participantStatus !== 'active', 403, 'Du er ikke aktiv deltager i chatten.');

        return $chat;
    }

    private function participantsForConversations($conversationIds)
    {
        return DB::table('chat_participants')
            ->whereIn('conversation_id', collect($conversationIds)->filter()->unique()->values())
            ->orderByRaw("CASE role WHEN 'owner' THEN 1 ELSE 2 END")
            ->orderBy('joined_at')
            ->get();
    }

    private function insertChatParticipant(string $conversationId, string $memberId, string $role, string $now): void
    {
        DB::table('chat_participants')->insert([
            'id' => (string) Str::uuid(),
            'conversation_id' => $conversationId,
            'member_id' => $memberId,
            'role' => $role,
            'status' => 'active',
            'joined_at' => $now,
            'left_at' => null,
            'hidden_at' => null,
            'muted_until' => null,
            'last_read_message_id' => null,
            'last_read_at' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    private function chatTargetForMember(object $member, string $targetMemberId): object
    {
        abort_if($member->id === $targetMemberId, 422, 'Du kan ikke starte chat med dig selv.');

        $target = DB::table('members')
            ->where('id', $targetMemberId)
            ->where('status', 'active')
            ->first();

        abort_unless($target, 404, 'Medlemmet findes ikke.');

        $sameClass = $target->class_id === $member->class_id;
        $acceptedConnection = DB::table('member_connections')
            ->where('status', 'accepted')
            ->where(function ($query) use ($member, $target): void {
                $query
                    ->where(function ($pair) use ($member, $target): void {
                        $pair
                            ->where('requester_member_id', $member->id)
                            ->where('receiver_member_id', $target->id);
                    })
                    ->orWhere(function ($pair) use ($member, $target): void {
                        $pair
                            ->where('requester_member_id', $target->id)
                            ->where('receiver_member_id', $member->id);
                    });
            })
            ->exists();

        abort_unless($sameClass || $acceptedConnection, 403, 'I skal vaere i samme klasse eller connected for at chatte.');

        return $target;
    }

    private function directConversationTitle($participants, string $viewerMemberId, $memberPreviews): string
    {
        $otherParticipant = $participants
            ->first(fn (object $participant): bool => $participant->member_id !== $viewerMemberId);
        $otherMember = $otherParticipant ? $memberPreviews->get($otherParticipant->member_id) : null;

        return $otherMember?->displayName ?? 'Direkte chat';
    }

    private function otherParticipantMemberId(string $conversationId, string $viewerMemberId): ?string
    {
        return DB::table('chat_participants')
            ->where('conversation_id', $conversationId)
            ->where('member_id', '!=', $viewerMemberId)
            ->where('status', 'active')
            ->value('member_id');
    }

    private function memberBlockExistsBetween(string $firstMemberId, string $secondMemberId): bool
    {
        return DB::table('member_blocks')
            ->where(function ($query) use ($firstMemberId, $secondMemberId): void {
                $query
                    ->where('blocker_member_id', $firstMemberId)
                    ->where('blocked_member_id', $secondMemberId);
            })
            ->orWhere(function ($query) use ($firstMemberId, $secondMemberId): void {
                $query
                    ->where('blocker_member_id', $secondMemberId)
                    ->where('blocked_member_id', $firstMemberId);
            })
            ->exists();
    }

    private function memberPreviews($memberIds)
    {
        $ids = collect($memberIds)->filter()->unique()->values();

        if ($ids->isEmpty()) {
            return collect();
        }

        $select = [
            'id',
            'display_name as displayName',
            'first_name as firstName',
            'profile_photo_url as profilePhotoUrl',
        ];

        if (Schema::hasColumn('members', 'last_seen_at')) {
            $select[] = 'last_seen_at as lastSeenAt';
        }

        return DB::table('members')
            ->select($select)
            ->whereIn('id', $ids)
            ->get()
            ->keyBy('id');
    }

    private function serializeMemberPreview(object $member): array
    {
        $lastSeenAt = $member->lastSeenAt ?? $member->last_seen_at ?? null;

        return [
            'id' => $member->id,
            'displayName' => $member->displayName,
            'firstName' => $member->firstName,
            'profilePhotoUrl' => UploadedImage::publicUrl($member->profilePhotoUrl),
            'lastSeenAt' => $this->apiDateTime($lastSeenAt),
            'isOnline' => $this->memberIsOnline($lastSeenAt),
        ];
    }

    private function logChatEvent(
        string $conversationId,
        ?string $messageId,
        ?string $actorMemberId,
        ?string $targetMemberId,
        string $action,
        ?string $reason = null,
        ?array $metadata = null,
    ): void {
        DB::table('chat_moderation_events')->insert([
            'id' => (string) Str::uuid(),
            'conversation_id' => $conversationId,
            'message_id' => $messageId,
            'actor_member_id' => $actorMemberId,
            'target_member_id' => $targetMemberId,
            'action' => $action,
            'reason' => $reason,
            'metadata' => $metadata ? json_encode($metadata) : null,
            'created_at' => now()->format('Y-m-d H:i:s'),
        ]);
    }

    private function sendChatPushNotifications(object $chat, object $sender, string $messageId, string $body): void
    {
        if (! Schema::hasTable('member_push_tokens')) {
            return;
        }

        $now = now()->format('Y-m-d H:i:s');
        $tokens = DB::table('chat_participants')
            ->join('member_push_tokens', 'member_push_tokens.member_id', '=', 'chat_participants.member_id')
            ->where('chat_participants.conversation_id', $chat->id)
            ->where('chat_participants.status', 'active')
            ->where('chat_participants.member_id', '!=', $sender->id)
            ->where('member_push_tokens.platform', 'android')
            ->whereNull('member_push_tokens.disabled_at')
            ->where(function ($query) use ($now): void {
                $query
                    ->whereNull('chat_participants.muted_until')
                    ->orWhere('chat_participants.muted_until', '<=', $now);
            })
            ->pluck('member_push_tokens.expo_push_token')
            ->filter()
            ->unique()
            ->values();

        if ($tokens->isEmpty()) {
            return;
        }

        $senderName = $sender->display_name ?? 'Studos';
        $preview = Str::limit(trim(preg_replace('/\s+/', ' ', $body)), 120);
        $chatContext = $chat->type === 'group'
            ? (blank($chat->title) ? 'Gruppechat' : $chat->title)
            : null;
        $chatTitle = $senderName;
        $pushBody = $chatContext ? $chatContext.' · '.$preview : $preview;
        $messages = $tokens
            ->map(fn (string $token): array => [
                'to' => $token,
                'sound' => 'default',
                'channelId' => 'studos-default',
                'title' => $chatTitle,
                'body' => $pushBody,
                'data' => [
                    'type' => 'chat_message',
                    'screen' => 'chat',
                    'conversationId' => $chat->id,
                    'messageId' => $messageId,
                    'senderMemberId' => $sender->id,
                ],
            ])
            ->all();

        try {
            $response = Http::timeout(5)
                ->acceptJson()
                ->post('https://exp.host/--/api/v2/push/send', $messages);

            if ($response->failed()) {
                Log::warning('Expo chat push failed.', [
                    'conversation_id' => $chat->id,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return;
            }

            $this->disableInvalidExpoPushTokens($response->json(), $tokens);
        } catch (\Throwable $exception) {
            Log::warning('Expo chat push exception.', [
                'conversation_id' => $chat->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    private function disableInvalidExpoPushTokens(mixed $expoResponse, $tokens): void
    {
        $tickets = collect($expoResponse['data'] ?? []);
        $invalidTokens = $tickets
            ->values()
            ->filter(fn ($ticket, int $index): bool => ($ticket['details']['error'] ?? null) === 'DeviceNotRegistered'
                && filled($tokens->get($index)))
            ->map(fn ($ticket, int $index): string => $tokens->get($index))
            ->values();

        if ($invalidTokens->isEmpty()) {
            return;
        }

        DB::table('member_push_tokens')
            ->whereIn('expo_push_token', $invalidTokens)
            ->update([
                'disabled_at' => now()->format('Y-m-d H:i:s'),
                'updated_at' => now()->format('Y-m-d H:i:s'),
            ]);
    }

    private function directPairKey(string $firstMemberId, string $secondMemberId): string
    {
        return collect([$firstMemberId, $secondMemberId])->sort()->values()->implode(':');
    }

    private function authenticatedMemberFromRequest(Request $request): object
    {
        $plainTextToken = $request->bearerToken();

        abort_if(blank($plainTextToken), 401, 'Login mangler.');

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

        $member = DB::table('members')
            ->where('id', $token->member_id)
            ->where('status', 'active')
            ->first();

        abort_unless($member, 401, 'Medlemmet har ikke adgang laengere.');

        DB::table('member_auth_tokens')->where('id', $token->id)->update([
            'last_used_at' => now()->format('Y-m-d H:i:s'),
        ]);

        $this->touchMemberPresence($member);

        return $member;
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

    private function normalizeRole(?string $role): string
    {
        return match ($role) {
            'owner', 'moderator', 'student' => $role,
            'admin' => 'moderator',
            default => 'student',
        };
    }

    private function apiDateTime(mixed $value): string
    {
        if (blank($value)) {
            return '';
        }

        $text = (string) $value;

        return Str::contains($text, 'T') ? $text : Carbon::parse($text)->toJSON();
    }
}
