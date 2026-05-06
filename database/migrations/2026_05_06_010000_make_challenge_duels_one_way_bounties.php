<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (
            ! Schema::hasTable('point_duels')
            || ! Schema::hasTable('members')
            || ! Schema::hasColumn('point_duels', 'mode')
            || ! Schema::hasColumn('point_duels', 'opponent_escrow_caps')
        ) {
            return;
        }

        DB::transaction(function (): void {
            $duels = DB::table('point_duels')
                ->where('mode', 'challenge')
                ->where('opponent_escrow_caps', '>', 0)
                ->whereNotIn('status', ['completed', 'declined', 'cancelled', 'expired'])
                ->lockForUpdate()
                ->get();

            foreach ($duels as $duel) {
                $amount = (int) $duel->opponent_escrow_caps;

                if ($amount > 0) {
                    $opponent = DB::table('members')
                        ->where('id', $duel->opponent_member_id)
                        ->lockForUpdate()
                        ->first();

                    if ($opponent) {
                        $balance = (int) ($opponent->caps_balance ?? 1000);
                        $now = Carbon::now('UTC')->format('Y-m-d H:i:s');

                        DB::table('members')->where('id', $opponent->id)->update([
                            'caps_balance' => $balance + $amount,
                        ]);

                        if (Schema::hasTable('cap_transactions')) {
                            DB::table('cap_transactions')->insert([
                                'id' => (string) Str::uuid(),
                                'member_id' => $opponent->id,
                                'class_id' => $opponent->class_id,
                                'amount' => $amount,
                                'type' => 'challenge_bounty_rule_refund',
                                'description' => 'Challenge-indsats returneret: modtager betaler ikke bounty',
                                'source_type' => 'point_duel',
                                'source_id' => $duel->id,
                                'created_by_member_id' => null,
                                'metadata' => json_encode([
                                    'oldOpponentEscrowCaps' => $amount,
                                    'newRule' => 'challenge_receiver_does_not_stake',
                                ], JSON_THROW_ON_ERROR),
                                'created_at' => $now,
                            ]);
                        }
                    }
                }

                DB::table('point_duels')->where('id', $duel->id)->update([
                    'opponent_escrow_caps' => 0,
                    'updated_at' => Carbon::now('UTC')->format('Y-m-d H:i:s'),
                ]);
            }
        }, 3);
    }

    public function down(): void
    {
        // One-way product-rule cleanup. Recharging receivers would be unsafe.
    }
};
