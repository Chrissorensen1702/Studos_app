<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SchoolSeeder extends Seeder
{
    /**
     * Seed the school choices used by app-based class creation.
     */
    public function run(): void
    {
        $now = now();

        foreach ($this->schools() as $name) {
            $name = trim($name);
            $key = $this->schoolKey($name);

            if ($key === '') {
                continue;
            }

            $existingSchool = DB::table('schools')->where('name_key', $key)->first();

            if ($existingSchool) {
                DB::table('schools')->where('id', $existingSchool->id)->update([
                    'name' => $name,
                    'updated_at' => $now,
                ]);

                continue;
            }

            DB::table('schools')->insert([
                'id' => (string) Str::uuid(),
                'name' => $name,
                'name_key' => $key,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function schools(): array
    {
        return [
            'Aalborg Katedralskole',
            'Aalborghus Gymnasium',
            'Aarhus Katedralskole',
            'AARHUS GYMNASIUM, Aarhus C',
            'AARHUS GYMNASIUM, Tilst',
            'AARHUS GYMNASIUM, Viby',
            'Christianshavns Gymnasium',
            'Esbjerg Gymnasium',
            'Fredericia Gymnasium',
            'Gefion Gymnasium',
            'Hasseris Gymnasium',
            'Herning Gymnasium',
            'Herningsholm Gymnasium, HHX og HTX Herning',
            'Himmelev Gymnasium',
            'Horsens Gymnasium & HF',
            'Kolding Gymnasium',
            'Københavns åbne Gymnasium',
            'Marselisborg Gymnasium',
            'Mulernes Legatskole',
            'Niels Steensens Gymnasium',
            'Nykøbing Katedralskole',
            'Odense Katedralskole',
            'Øregård Gymnasium',
            'Ribe Katedralskole',
            'Roskilde Gymnasium',
            'Roskilde Katedralskole',
            'Rysensteen Gymnasium',
            'Sct. Knuds Gymnasium',
            'Silkeborg Gymnasium',
            'Svendborg Gymnasium',
        ];
    }

    private function schoolKey(string $name): string
    {
        return preg_replace('/[^a-z0-9]+/', '-', Str::lower(Str::ascii(trim($name)))) ?? '';
    }
}
