<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('events') && ! Schema::hasColumn('events', 'invite_scope')) {
            Schema::table('events', function (Blueprint $table): void {
                $table->string('invite_scope', 32)->default('class');
            });
        }

        if (! Schema::hasTable('event_invites')) {
            Schema::create('event_invites', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('event_id', 36)->index();
                $table->string('member_id', 36)->index();
                $table->string('invited_by_member_id', 36)->nullable()->index();
                $table->dateTime('created_at')->nullable();
                $table->dateTime('updated_at')->nullable();
                $table->unique(['event_id', 'member_id']);
                $table->foreign('event_id')->references('id')->on('events')->cascadeOnDelete();
                $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
                $table->foreign('invited_by_member_id')->references('id')->on('members')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('events') || ! Schema::hasTable('event_invites')) {
            return;
        }

        DB::table('events')
            ->whereNull('invite_scope')
            ->update(['invite_scope' => 'class']);

        DB::table('events')
            ->get(['id', 'class_id', 'created_by_member_id', 'created_at'])
            ->each(function (object $event): void {
                $alreadyBackfilled = DB::table('event_invites')
                    ->where('event_id', $event->id)
                    ->exists();

                if ($alreadyBackfilled) {
                    return;
                }

                $memberIds = DB::table('members')
                    ->where('class_id', $event->class_id)
                    ->where('status', 'active')
                    ->pluck('id')
                    ->all();

                if ($event->created_by_member_id) {
                    $memberIds[] = $event->created_by_member_id;
                }

                $memberIds = array_values(array_unique(array_filter($memberIds)));

                if (empty($memberIds)) {
                    return;
                }

                $now = now()->format('Y-m-d H:i:s');

                DB::table('event_invites')->insert(array_map(
                    fn (string $memberId): array => [
                        'id' => (string) Str::uuid(),
                        'event_id' => $event->id,
                        'member_id' => $memberId,
                        'invited_by_member_id' => $event->created_by_member_id,
                        'created_at' => $event->created_at ?? $now,
                        'updated_at' => $now,
                    ],
                    $memberIds,
                ));
            });
    }

    public function down(): void
    {
        // Event invitations are intentionally preserved on rollback.
    }
};
