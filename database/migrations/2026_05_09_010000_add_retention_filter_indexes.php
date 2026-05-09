<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('member_auth_tokens') && ! $this->hasIndex('member_auth_tokens', 'member_auth_tokens_last_used_at_index')) {
            Schema::table('member_auth_tokens', function (Blueprint $table): void {
                $table->index('last_used_at');
            });
        }

        if (Schema::hasTable('moderation_violations') && ! $this->hasIndex('moderation_violations', 'moderation_violations_created_at_index')) {
            Schema::table('moderation_violations', function (Blueprint $table): void {
                $table->index('created_at');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('member_auth_tokens') && $this->hasIndex('member_auth_tokens', 'member_auth_tokens_last_used_at_index')) {
            Schema::table('member_auth_tokens', function (Blueprint $table): void {
                $table->dropIndex(['last_used_at']);
            });
        }

        if (Schema::hasTable('moderation_violations') && $this->hasIndex('moderation_violations', 'moderation_violations_created_at_index')) {
            Schema::table('moderation_violations', function (Blueprint $table): void {
                $table->dropIndex(['created_at']);
            });
        }
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        $indexes = Schema::getIndexes($table);

        foreach ($indexes as $index) {
            if (($index['name'] ?? null) === $indexName) {
                return true;
            }
        }

        return false;
    }
};
