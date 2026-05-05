<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('point_duels') && ! Schema::hasColumn('point_duels', 'expired_at')) {
            Schema::table('point_duels', function (Blueprint $table): void {
                $table->dateTime('expired_at')->nullable()->after('cancelled_at')->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('point_duels') && Schema::hasColumn('point_duels', 'expired_at')) {
            Schema::table('point_duels', function (Blueprint $table): void {
                $table->dropColumn('expired_at');
            });
        }
    }
};
