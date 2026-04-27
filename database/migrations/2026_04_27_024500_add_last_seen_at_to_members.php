<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('members') || Schema::hasColumn('members', 'last_seen_at')) {
            return;
        }

        Schema::table('members', function (Blueprint $table): void {
            $table->dateTime('last_seen_at')->nullable()->index()->after('joined_at');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('members') || ! Schema::hasColumn('members', 'last_seen_at')) {
            return;
        }

        Schema::table('members', function (Blueprint $table): void {
            $table->dropColumn('last_seen_at');
        });
    }
};
