<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Broadcasting\ShouldRescue;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PointDuelUpdated implements ShouldBroadcastNow, ShouldRescue
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public string $duelId,
        public string $classId,
        public array $memberIds,
    ) {}

    public function broadcastOn(): array
    {
        return collect($this->memberIds)
            ->filter()
            ->unique()
            ->map(fn (string $memberId): PrivateChannel => new PrivateChannel('duels.member.'.$memberId))
            ->values()
            ->all();
    }

    public function broadcastAs(): string
    {
        return 'duel.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'duelId' => $this->duelId,
            'classId' => $this->classId,
        ];
    }
}
