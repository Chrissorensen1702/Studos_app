<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addIndexIfPossible('members', ['class_id', 'status'], 'members_activity_feed_class_status_idx');
        $this->addIndexIfPossible('events', ['class_id', 'created_at'], 'events_activity_feed_class_created_idx');
        $this->addIndexIfPossible('galleries', ['class_id', 'visibility', 'created_at'], 'galleries_activity_feed_class_visibility_created_idx');
        $this->addIndexIfPossible('point_duels', ['class_id', 'status', 'completed_at'], 'point_duels_activity_feed_class_status_completed_idx');
    }

    public function down(): void
    {
        $this->dropIndexIfExists('point_duels', 'point_duels_activity_feed_class_status_completed_idx');
        $this->dropIndexIfExists('galleries', 'galleries_activity_feed_class_visibility_created_idx');
        $this->dropIndexIfExists('events', 'events_activity_feed_class_created_idx');
        $this->dropIndexIfExists('members', 'members_activity_feed_class_status_idx');
    }

    private function addIndexIfPossible(string $table, array $columns, string $indexName): void
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

    private function dropIndexIfExists(string $table, string $indexName): void
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
