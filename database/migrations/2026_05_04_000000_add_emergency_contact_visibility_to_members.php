<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('members')) {
            return;
        }

        Schema::table('members', function (Blueprint $table): void {
            if (! Schema::hasColumn('members', 'emergency_contact_visibility')) {
                $table->string('emergency_contact_visibility', 20)
                    ->default('class')
                    ->after('emergency_contact_phone');
            }

            if (! Schema::hasColumn('members', 'emergency_contact_visible_member_ids')) {
                $table->json('emergency_contact_visible_member_ids')
                    ->nullable()
                    ->after('emergency_contact_visibility');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('members')) {
            return;
        }

        Schema::table('members', function (Blueprint $table): void {
            if (Schema::hasColumn('members', 'emergency_contact_visible_member_ids')) {
                $table->dropColumn('emergency_contact_visible_member_ids');
            }

            if (Schema::hasColumn('members', 'emergency_contact_visibility')) {
                $table->dropColumn('emergency_contact_visibility');
            }
        });
    }
};
