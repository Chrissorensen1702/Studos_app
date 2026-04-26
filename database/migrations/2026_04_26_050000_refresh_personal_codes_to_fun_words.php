<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('members') || ! Schema::hasColumn('members', 'personal_code')) {
            return;
        }

        DB::table('members')
            ->select(['id', 'display_name', 'first_name'])
            ->orderBy('joined_at')
            ->get()
            ->each(function (object $member): void {
                DB::table('members')
                    ->where('id', $member->id)
                    ->update([
                        'personal_code' => $this->generatePersonalCode($member->first_name ?? $member->display_name),
                    ]);
            });
    }

    public function down(): void
    {
        // Personal codes remain valid after rollback.
    }

    private function generatePersonalCode(?string $name): string
    {
        $prefix = Str::limit($this->codePart((string) $name), 8, '') ?: 'STUDOS';

        foreach ($this->shuffledPersonalCodeWords($prefix) as $word) {
            $candidate = $prefix.'-'.$word;

            if (! DB::table('members')->where('personal_code', $candidate)->exists()) {
                return $candidate;
            }
        }

        for ($attempt = 2; $attempt < 100; $attempt++) {
            $candidate = $prefix.'-KAOS'.$attempt;

            if (! DB::table('members')->where('personal_code', $candidate)->exists()) {
                return $candidate;
            }
        }

        return $prefix.'-'.Str::upper(Str::random(4));
    }

    private function shuffledPersonalCodeWords(string $seed): array
    {
        $words = [
            'KAOS',
            'DISCO',
            'GLIMT',
            'FEST',
            'KONFETTI',
            'SOL',
            'VIBE',
            'SNACKS',
            'HYPE',
            'DANS',
            'GULD',
            'NAT',
            'BOOM',
            'LYN',
            'STJERNE',
            'MAGI',
            'BANGER',
            'SKÅL',
            'POP',
            'WOW',
        ];
        $count = count($words);
        $offset = $count ? hexdec(Str::substr(sha1($seed), 0, 2)) % $count : 0;

        return array_merge(array_slice($words, $offset), array_slice($words, 0, $offset));
    }

    private function codePart(string $value): string
    {
        return preg_replace('/[^A-Z0-9]/', '', Str::upper(Str::ascii($value))) ?? '';
    }
};
