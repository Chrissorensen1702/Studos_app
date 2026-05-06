<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('point_duels')) {
            return;
        }

        $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

        DB::table('point_duels')
            ->where('status', 'awaitingCreatorConfirm')
            ->update([
                'status' => 'active',
                'confirmed_at' => DB::raw('COALESCE(confirmed_at, accepted_at, updated_at, created_at, '.$this->quoted($now).')'),
                'updated_at' => DB::raw('COALESCE(updated_at, accepted_at, created_at, '.$this->quoted($now).')'),
            ]);
    }

    public function down(): void
    {
        // This is a one-way product-flow cleanup. Reintroducing the old waiting state would be unsafe.
    }

    private function quoted(string $value): string
    {
        return DB::getPdo()->quote($value);
    }
};
