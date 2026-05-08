<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addIndex('chat_messages', ['sender_member_id', 'created_at'], 'chat_messages_sender_created_idx');
        $this->addIndex('member_push_tokens', ['member_id', 'platform', 'disabled_at'], 'member_push_tokens_member_platform_idx');
        $this->addIndex('event_invites', ['event_id', 'status'], 'event_invites_event_status_idx');
        $this->addIndex('cap_transactions', ['member_id', 'created_at'], 'cap_transactions_member_created_idx');
        $this->addIndex('good_deed_claims', ['class_id', 'member_id', 'week_key'], 'good_deed_claims_class_member_week_idx');
        $this->addIndex('weekly_check_ins', ['class_id', 'reward_awarded', 'created_at'], 'weekly_check_ins_class_reward_idx');
        $this->addIndex('members', ['class_id', 'personal_code'], 'members_class_personal_code_idx');
        $this->addIndex('point_duels', ['status', 'deadline_at'], 'point_duels_status_deadline_idx');
    }

    public function down(): void
    {
        $this->dropIndex('point_duels', 'point_duels_status_deadline_idx');
        $this->dropIndex('members', 'members_class_personal_code_idx');
        $this->dropIndex('weekly_check_ins', 'weekly_check_ins_class_reward_idx');
        $this->dropIndex('good_deed_claims', 'good_deed_claims_class_member_week_idx');
        $this->dropIndex('cap_transactions', 'cap_transactions_member_created_idx');
        $this->dropIndex('event_invites', 'event_invites_event_status_idx');
        $this->dropIndex('member_push_tokens', 'member_push_tokens_member_platform_idx');
        $this->dropIndex('chat_messages', 'chat_messages_sender_created_idx');
    }

    private function addIndex(string $table, array $columns, string $indexName): void
    {
        if (! Schema::hasTable($table) || $this->indexExists($table, $indexName)) {
            return;
        }

        foreach ($columns as $column) {
            if (! Schema::hasColumn($table, $column)) {
                return;
            }
        }

        Schema::table($table, function (Blueprint $table) use ($columns, $indexName): void {
            $table->index($columns, $indexName);
        });
    }

    private function dropIndex(string $table, string $indexName): void
    {
        if (! Schema::hasTable($table) || ! $this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $table) use ($indexName): void {
            $table->dropIndex($indexName);
        });
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            return collect(DB::select('PRAGMA index_list('.$table.')'))
                ->contains(fn (object $index): bool => ($index->name ?? null) === $indexName);
        }

        if ($driver === 'mysql') {
            return ! empty(DB::select('SHOW INDEX FROM `'.$table.'` WHERE Key_name = ?', [$indexName]));
        }

        return false;
    }
};
