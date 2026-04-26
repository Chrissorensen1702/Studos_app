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
        if (! Schema::hasTable('schools')) {
            Schema::create('schools', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('name', 190);
                $table->string('name_key', 190)->unique();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('classes') && ! Schema::hasColumn('classes', 'school_id')) {
            Schema::table('classes', function (Blueprint $table): void {
                $table->string('school_id', 36)->nullable()->after('public_id')->index();
            });
        }

        if (Schema::hasTable('classes')) {
            DB::table('classes')
                ->select('school_name')
                ->whereNotNull('school_name')
                ->distinct()
                ->orderBy('school_name')
                ->get()
                ->each(fn (object $row): string => $this->ensureSchool(trim($row->school_name)));

            DB::table('classes')
                ->whereNull('school_id')
                ->orderBy('id')
                ->each(function (object $schoolClass): void {
                    DB::table('classes')->where('id', $schoolClass->id)->update([
                        'school_id' => $this->ensureSchool(trim($schoolClass->school_name)),
                    ]);
                });
        }

        if (Schema::hasTable('members')) {
            Schema::table('members', function (Blueprint $table): void {
                if (! Schema::hasColumn('members', 'school_id')) {
                    $table->string('school_id', 36)->nullable()->after('class_id')->index();
                }

                if (! Schema::hasColumn('members', 'terms_accepted_at')) {
                    $table->dateTime('terms_accepted_at')->nullable()->after('password_hash');
                }

                if (! Schema::hasColumn('members', 'privacy_accepted_at')) {
                    $table->dateTime('privacy_accepted_at')->nullable()->after('terms_accepted_at');
                }

                if (! Schema::hasColumn('members', 'privacy_version')) {
                    $table->string('privacy_version', 32)->nullable()->after('privacy_accepted_at');
                }

                if (! Schema::hasColumn('members', 'deletion_requested_at')) {
                    $table->dateTime('deletion_requested_at')->nullable()->after('privacy_version');
                }

                if (! Schema::hasColumn('members', 'deleted_at')) {
                    $table->dateTime('deleted_at')->nullable()->after('deletion_requested_at');
                }
            });

            DB::table('members')->where('role', 'admin')->update(['role' => 'moderator']);
            DB::table('members')->where('role', 'member')->update(['role' => 'student']);
            DB::table('members')
                ->whereNotIn('role', ['owner', 'moderator', 'student'])
                ->update(['role' => 'student']);

            DB::table('members')
                ->whereNull('school_id')
                ->orderBy('id')
                ->each(function (object $member): void {
                    $schoolId = DB::table('classes')
                        ->where('id', $member->class_id)
                        ->value('school_id');

                    if ($schoolId) {
                        DB::table('members')->where('id', $member->id)->update([
                            'school_id' => $schoolId,
                        ]);
                    }
                });
        }

        if (! Schema::hasTable('member_blocks')) {
            Schema::create('member_blocks', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('blocker_member_id', 36)->index();
                $table->string('blocked_member_id', 36)->index();
                $table->string('reason', 190)->nullable();
                $table->timestamps();
                $table->unique(['blocker_member_id', 'blocked_member_id']);
            });
        }

        if (! Schema::hasTable('member_reports')) {
            Schema::create('member_reports', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('reporter_member_id', 36)->nullable()->index();
                $table->string('reported_member_id', 36)->nullable()->index();
                $table->string('target_type', 80);
                $table->string('target_id', 80)->nullable();
                $table->string('reason', 190);
                $table->text('details')->nullable();
                $table->string('status', 32)->default('pending')->index();
                $table->dateTime('reviewed_at')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        // Existing Studos safety and school data is intentionally preserved on rollback.
    }

    private function ensureSchool(string $name): string
    {
        $name = trim($name);
        $key = $this->schoolKey($name);

        if ($key === '') {
            $name = 'Ukendt skole';
            $key = $this->schoolKey($name);
        }

        $existingSchool = DB::table('schools')->where('name_key', $key)->first();

        if ($existingSchool) {
            if ($existingSchool->name !== $name) {
                DB::table('schools')->where('id', $existingSchool->id)->update([
                    'name' => $name,
                    'updated_at' => now(),
                ]);
            }

            return $existingSchool->id;
        }

        $schoolId = (string) Str::uuid();

        DB::table('schools')->insert([
            'id' => $schoolId,
            'name' => $name,
            'name_key' => $key,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $schoolId;
    }

    private function schoolKey(string $name): string
    {
        return preg_replace('/[^a-z0-9]+/', '-', Str::lower(Str::ascii(trim($name)))) ?? '';
    }
};
