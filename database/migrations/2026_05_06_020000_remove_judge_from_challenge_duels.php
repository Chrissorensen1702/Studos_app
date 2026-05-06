<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            ! Schema::hasTable('point_duels')
            || ! Schema::hasColumn('point_duels', 'mode')
            || ! Schema::hasColumn('point_duels', 'judge_member_id')
        ) {
            return;
        }

        $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

        DB::table('point_duels')
            ->where('mode', 'challenge')
            ->where('status', 'awaitingJudgeApproval')
            ->update([
                'status' => 'awaitingResultConfirm',
                'judge_member_id' => null,
                'judge_requested_at' => null,
                'judge_rejected_at' => null,
                'updated_at' => $now,
            ]);

        DB::table('point_duels')
            ->where('mode', 'challenge')
            ->whereNotNull('judge_member_id')
            ->update([
                'judge_member_id' => null,
                'judge_requested_at' => null,
                'judge_rejected_at' => null,
                'updated_at' => $now,
            ]);
    }

    public function down(): void
    {
        // One-way product cleanup: challenges no longer support judges.
    }
};
