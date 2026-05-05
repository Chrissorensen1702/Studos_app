<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('point_duels') && ! Schema::hasColumn('point_duels', 'mode')) {
            Schema::table('point_duels', function (Blueprint $table): void {
                $table->string('mode', 24)->default('versus')->after('challenge')->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('point_duels') && Schema::hasColumn('point_duels', 'mode')) {
            Schema::table('point_duels', function (Blueprint $table): void {
                $table->dropIndex(['mode']);
                $table->dropColumn('mode');
            });
        }
    }
};
