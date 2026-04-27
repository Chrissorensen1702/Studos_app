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
        if (Schema::hasTable('events')) {
            Schema::table('events', function (Blueprint $table): void {
                if (! Schema::hasColumn('events', 'event_type')) {
                    $table->string('event_type', 32)->default('studentergilde');
                }

                if (! Schema::hasColumn('events', 'starts_at')) {
                    $table->dateTime('starts_at')->nullable()->index();
                }

                if (! Schema::hasColumn('events', 'created_by_member_id')) {
                    $table->string('created_by_member_id', 36)->nullable()->index();
                }
            });
        }

        if (! Schema::hasTable('event_rsvps')) {
            Schema::create('event_rsvps', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('event_id', 36)->index();
                $table->string('member_id', 36)->index();
                $table->string('status', 32)->default('attending')->index();
                $table->dateTime('created_at')->nullable();
                $table->dateTime('updated_at')->nullable();
                $table->unique(['event_id', 'member_id']);
                $table->foreign('event_id')->references('id')->on('events')->cascadeOnDelete();
                $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
            });
        }

        if (Schema::hasTable('event_rsvps')) {
            $demoOwnerExists = DB::table('members')->where('id', 'demo-owner')->exists();

            if ($demoOwnerExists) {
                DB::table('events')
                    ->where('class_id', 'demo-class')
                    ->whereIn('id', ['event-dimission', 'event-vogntur'])
                    ->get(['id'])
                    ->each(function (object $event): void {
                        $exists = DB::table('event_rsvps')
                            ->where('event_id', $event->id)
                            ->where('member_id', 'demo-owner')
                            ->exists();

                        if (! $exists) {
                            DB::table('event_rsvps')->insert([
                                'id' => (string) Str::uuid(),
                                'event_id' => $event->id,
                                'member_id' => 'demo-owner',
                                'status' => 'attending',
                                'created_at' => now()->format('Y-m-d H:i:s'),
                                'updated_at' => now()->format('Y-m-d H:i:s'),
                            ]);
                        }
                    });
            }
        }
    }

    public function down(): void
    {
        // Calendar data is intentionally preserved on rollback.
    }
};
