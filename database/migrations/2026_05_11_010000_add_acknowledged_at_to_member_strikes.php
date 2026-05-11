<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('member_strikes') || Schema::hasColumn('member_strikes', 'acknowledged_at')) {
            return;
        }

        Schema::table('member_strikes', function (Blueprint $table): void {
            $table->dateTime('acknowledged_at')->nullable()->after('expires_at')->index();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('member_strikes') || ! Schema::hasColumn('member_strikes', 'acknowledged_at')) {
            return;
        }

        Schema::table('member_strikes', function (Blueprint $table): void {
            $table->dropColumn('acknowledged_at');
        });
    }
};
