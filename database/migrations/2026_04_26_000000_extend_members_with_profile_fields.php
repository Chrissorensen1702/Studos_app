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
        if (! Schema::hasTable('members')) {
            return;
        }

        Schema::table('members', function (Blueprint $table): void {
            if (! Schema::hasColumn('members', 'first_name')) {
                $table->string('first_name', 100)->nullable()->after('display_name');
            }

            if (! Schema::hasColumn('members', 'last_name')) {
                $table->string('last_name', 100)->nullable()->after('first_name');
            }

            if (! Schema::hasColumn('members', 'phone')) {
                $table->string('phone', 40)->nullable()->after('email');
            }

            if (! Schema::hasColumn('members', 'birthday')) {
                $table->date('birthday')->nullable()->after('phone');
            }

            if (! Schema::hasColumn('members', 'profile_photo_url')) {
                $table->text('profile_photo_url')->nullable()->after('birthday');
            }
        });

        DB::table('members')
            ->whereNull('first_name')
            ->orderBy('id')
            ->each(function (object $member): void {
                $parts = preg_split('/\s+/', trim($member->display_name), 2) ?: [];

                DB::table('members')->where('id', $member->id)->update([
                    'first_name' => $parts[0] ?? null,
                    'last_name' => $parts[1] ?? null,
                    'email' => blank($member->email ?? null) ? null : Str::lower(trim($member->email)),
                ]);
            });
    }

    public function down(): void
    {
        // Existing profile data is intentionally preserved on rollback.
    }
};
