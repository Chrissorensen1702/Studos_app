<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('good_deed_weeks')) {
            return;
        }

        DB::table('good_deed_weeks')->update([
            'base_caps' => 25,
            'description' => 'Lav ugens gode gerning og claim dine Caps.',
            'photo_bonus_caps' => 0,
            'verification_hint' => 'Kan kun claimes én gang pr. uge.',
            'updated_at' => now()->format('Y-m-d H:i:s'),
        ]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('good_deed_weeks')) {
            return;
        }

        DB::table('good_deed_weeks')->update([
            'base_caps' => 100,
            'description' => 'Gør den lille ting, vælg en buddy som kan bekræfte, og få Caps når den er godkendt.',
            'photo_bonus_caps' => 10,
            'verification_hint' => 'Buddy-bekræftelse kræves. Foto er valgfrit og giver +10 Caps.',
            'updated_at' => now()->format('Y-m-d H:i:s'),
        ]);
    }
};
