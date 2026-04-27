<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('events') && ! Schema::hasColumn('events', 'cover_image_url')) {
            Schema::table('events', function (Blueprint $table): void {
                $table->text('cover_image_url')->nullable();
            });
        }
    }

    public function down(): void
    {
        // Event cover images are intentionally preserved on rollback.
    }
};
