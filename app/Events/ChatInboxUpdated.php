<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Broadcasting\ShouldRescue;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChatInboxUpdated implements ShouldBroadcastNow, ShouldRescue
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    /**
     * @param array<int, string> $memberIds
     */
    public function __construct(
        public string $conversationId,
        public string $type,
        public array $memberIds,
        public ?string $actorMemberId = null,
    ) {}

    public function broadcastOn(): array
    {
        return collect($this->memberIds)
            ->filter()
            ->unique()
            ->values()
            ->map(fn (string $memberId): PrivateChannel => new PrivateChannel('chat.member.'.$memberId))
            ->all();
    }

    public function broadcastAs(): string
    {
        return 'chat.inbox.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'conversationId' => $this->conversationId,
            'type' => $this->type,
            'actorMemberId' => $this->actorMemberId,
        ];
    }
}
