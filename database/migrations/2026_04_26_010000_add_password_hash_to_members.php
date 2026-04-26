<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('members')) {
            return;
        }

        Schema::table('members', function (Blueprint $table): void {
            if (! Schema::hasColumn('members', 'password_hash')) {
                $table->string('password_hash')->nullable()->after('profile_photo_url');
            }
        });

        DB::table('members')
            ->where('id', 'demo-owner')
            ->update(['password_hash' => Hash::make('studos123')]);
    }

    public function down(): void
    {
        // Existing login data is intentionally preserved on rollback.
    }
};
