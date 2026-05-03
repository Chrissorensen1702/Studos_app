<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const MEMBERS_EMAIL_UNIQUE_INDEX = 'members_email_unique';

    public function up(): void
    {
        if (! Schema::hasTable('members') || ! Schema::hasColumn('members', 'email')) {
            return;
        }

        if ($this->hasUniqueEmailIndex()) {
            return;
        }

        Schema::table('members', function (Blueprint $table): void {
            $table->unique('email', self::MEMBERS_EMAIL_UNIQUE_INDEX);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('members') || ! Schema::hasColumn('members', 'email')) {
            return;
        }

        if (! $this->hasNamedMembersEmailIndex()) {
            return;
        }

        Schema::table('members', function (Blueprint $table): void {
            $table->dropUnique(self::MEMBERS_EMAIL_UNIQUE_INDEX);
        });
    }

    private function hasUniqueEmailIndex(): bool
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            return $this->sqliteHasUniqueEmailIndex();
        }

        if ($driver !== 'mysql' && $driver !== 'mariadb') {
            return false;
        }

        return DB::table('information_schema.statistics')
            ->where('table_schema', DB::getDatabaseName())
            ->where('table_name', 'members')
            ->where('column_name', 'email')
            ->where('non_unique', 0)
            ->exists();
    }

    private function hasNamedMembersEmailIndex(): bool
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            return collect(DB::select('PRAGMA index_list(members)'))
                ->contains(fn (object $index): bool => $index->name === self::MEMBERS_EMAIL_UNIQUE_INDEX);
        }

        if ($driver !== 'mysql' && $driver !== 'mariadb') {
            return false;
        }

        return DB::table('information_schema.statistics')
            ->where('table_schema', DB::getDatabaseName())
            ->where('table_name', 'members')
            ->where('index_name', self::MEMBERS_EMAIL_UNIQUE_INDEX)
            ->exists();
    }

    private function sqliteHasUniqueEmailIndex(): bool
    {
        $indexes = DB::select('PRAGMA index_list(members)');

        foreach ($indexes as $index) {
            if ((int) $index->unique !== 1) {
                continue;
            }

            $columns = DB::select(sprintf('PRAGMA index_info("%s")', $index->name));

            foreach ($columns as $column) {
                if ((string) ($column->name ?? '') === 'email') {
                    return true;
                }
            }
        }

        return false;
    }
};
