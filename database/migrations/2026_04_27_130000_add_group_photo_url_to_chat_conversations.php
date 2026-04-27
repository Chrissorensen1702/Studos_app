<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('chat_conversations') && ! Schema::hasColumn('chat_conversations', 'group_photo_url')) {
            Schema::table('chat_conversations', function (Blueprint $table): void {
                $table->string('group_photo_url', 2000)->nullable()->after('title');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('chat_conversations') && Schema::hasColumn('chat_conversations', 'group_photo_url')) {
            Schema::table('chat_conversations', function (Blueprint $table): void {
                $table->dropColumn('group_photo_url');
            });
        }
    }
};
