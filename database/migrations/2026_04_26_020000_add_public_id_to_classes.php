<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('classes')) {
            return;
        }

        if (! Schema::hasColumn('classes', 'public_id')) {
            Schema::table('classes', function (Blueprint $table): void {
                $table->string('public_id', 32)->nullable()->unique()->after('id');
            });
        }

        DB::table('classes')
            ->select(['id', 'school_name', 'class_name', 'graduation_year', 'public_id'])
            ->orderBy('created_at')
            ->get()
            ->each(function (object $schoolClass): void {
                if (! blank($schoolClass->public_id)) {
                    return;
                }

                DB::table('classes')
                    ->where('id', $schoolClass->id)
                    ->update([
                        'public_id' => $this->generatePublicId(
                            $schoolClass->school_name,
                            $schoolClass->class_name,
                            $schoolClass->graduation_year,
                        ),
                    ]);
            });
    }

    public function down(): void
    {
        if (Schema::hasTable('classes') && Schema::hasColumn('classes', 'public_id')) {
            Schema::table('classes', function (Blueprint $table): void {
                $table->dropUnique(['public_id']);
                $table->dropColumn('public_id');
            });
        }
    }

    private function generatePublicId(string $schoolName, string $className, string $graduationYear): string
    {
        $base = $this->basePublicId($schoolName, $className, $graduationYear);

        for ($attempt = 0; $attempt < 20; $attempt++) {
            $suffix = $attempt === 0 ? '' : '-'.($attempt + 1);
            $candidate = Str::limit($base, 32 - strlen($suffix), '').$suffix;

            if (! DB::table('classes')->where('public_id', $candidate)->exists()) {
                return $candidate;
            }
        }

        return 'STU-'.Str::upper(Str::random(8));
    }

    private function basePublicId(string $schoolName, string $className, string $graduationYear): string
    {
        $school = $this->schoolInitials($schoolName);
        $class = $this->codePart($className) ?: 'KLASSE';
        $year = Str::substr($this->codePart($graduationYear), -2) ?: now()->format('y');

        return Str::limit($school.'-'.$class.'-'.$year, 32, '');
    }

    private function schoolInitials(string $schoolName): string
    {
        $words = preg_split('/\s+/', trim($schoolName)) ?: [];
        $initials = collect($words)
            ->map(fn (string $word): string => Str::substr($this->codePart($word), 0, 1))
            ->filter()
            ->take(3)
            ->implode('');

        return $initials ?: Str::substr($this->codePart($schoolName), 0, 3) ?: 'STU';
    }

    private function codePart(string $value): string
    {
        return preg_replace('/[^A-Z0-9]/', '', Str::upper(Str::ascii($value))) ?? '';
    }
};
