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
            if (! Schema::hasColumn('members', 'emergency_contact_name')) {
                $table->string('emergency_contact_name', 190)->nullable()->after('last_name');
            }

            if (! Schema::hasColumn('members', 'emergency_contact_phone')) {
                $table->string('emergency_contact_phone', 40)->nullable()->after('emergency_contact_name');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('members')) {
            return;
        }

        Schema::table('members', function (Blueprint $table): void {
            if (Schema::hasColumn('members', 'emergency_contact_phone')) {
                $table->dropColumn('emergency_contact_phone');
            }

            if (Schema::hasColumn('members', 'emergency_contact_name')) {
                $table->dropColumn('emergency_contact_name');
            }
        });
    }
};
