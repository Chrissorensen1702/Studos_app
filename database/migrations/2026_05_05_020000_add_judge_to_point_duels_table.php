<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('point_duels') && ! Schema::hasColumn('point_duels', 'judge_member_id')) {
            Schema::table('point_duels', function (Blueprint $table): void {
                $table->string('judge_member_id', 36)->nullable()->after('opponent_member_id')->index();
                $table->dateTime('judge_requested_at')->nullable()->after('completed_by_member_id');
                $table->dateTime('judge_approved_at')->nullable()->after('judge_requested_at');
                $table->dateTime('judge_rejected_at')->nullable()->after('judge_approved_at');
                $table->foreign('judge_member_id')->references('id')->on('members')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('point_duels') && Schema::hasColumn('point_duels', 'judge_member_id')) {
            Schema::table('point_duels', function (Blueprint $table): void {
                $table->dropForeign(['judge_member_id']);
                $table->dropColumn([
                    'judge_member_id',
                    'judge_requested_at',
                    'judge_approved_at',
                    'judge_rejected_at',
                ]);
            });
        }
    }
};
