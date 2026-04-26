<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('classes')) {
            Schema::create('classes', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('public_id', 32)->unique();
                $table->string('school_name', 190);
                $table->string('class_name', 100);
                $table->string('graduation_year', 4);
                $table->date('graduation_date')->nullable();
                $table->string('owner_name', 190);
                $table->string('owner_email', 190);
                $table->string('invite_code', 32)->unique();
                $table->boolean('allow_member_posts')->default(true);
                $table->boolean('require_approval_for_photos')->default(false);
                $table->dateTime('created_at')->index();
            });
        }

        if (! Schema::hasTable('members')) {
            Schema::create('members', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('class_id', 36)->index();
                $table->string('display_name', 190);
                $table->string('email', 190)->nullable();
                $table->string('role', 32)->default('student');
                $table->string('status', 32)->default('active');
                $table->dateTime('joined_at');
                $table->unique(['class_id', 'display_name']);
                $table->foreign('class_id')->references('id')->on('classes')->cascadeOnDelete();
            });
        } elseif (! Schema::hasColumn('members', 'status')) {
            Schema::table('members', function (Blueprint $table): void {
                $table->string('status', 32)->default('active')->after('role');
            });
        }

        if (! Schema::hasTable('events')) {
            Schema::create('events', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('class_id', 36)->index();
                $table->string('title', 190);
                $table->date('event_date')->index();
                $table->unsignedInteger('rsvp_count')->default(0);
                $table->foreign('class_id')->references('id')->on('classes')->cascadeOnDelete();
            });
        }

        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE members MODIFY role VARCHAR(32) NOT NULL DEFAULT 'student'");
            DB::statement("ALTER TABLE members MODIFY status VARCHAR(32) NOT NULL DEFAULT 'active'");
        }
        DB::table('members')->where('role', 'member')->update(['role' => 'student']);
        DB::table('members')
            ->whereNotIn('status', ['pending', 'active', 'removed'])
            ->update(['status' => 'active']);

        DB::table('classes')->updateOrInsert(
            ['id' => 'demo-class'],
            [
                'public_id' => 'MG-3B-26',
                'school_name' => 'Midtby Gymnasium',
                'class_name' => '3.B',
                'graduation_year' => '2026',
                'graduation_date' => '2026-06-26',
                'owner_name' => 'Chris',
                'owner_email' => 'chris@skole.dk',
                'invite_code' => 'STU-DEMO26',
                'allow_member_posts' => true,
                'require_approval_for_photos' => false,
                'created_at' => '2026-04-25 00:00:00',
            ],
        );

        DB::table('members')->updateOrInsert(
            ['id' => 'demo-owner'],
            [
                'class_id' => 'demo-class',
                'display_name' => 'Chris',
                'email' => 'chris@skole.dk',
                'role' => 'owner',
                'status' => 'active',
                'joined_at' => '2026-04-25 00:00:00',
            ],
        );

        DB::table('events')->updateOrInsert(
            ['id' => 'event-dimission'],
            [
                'class_id' => 'demo-class',
                'title' => 'Dimission',
                'event_date' => '2026-06-26',
                'rsvp_count' => 1,
            ],
        );

        DB::table('events')->updateOrInsert(
            ['id' => 'event-vogntur'],
            [
                'class_id' => 'demo-class',
                'title' => 'Vogntur',
                'event_date' => '2026-06-27',
                'rsvp_count' => 1,
            ],
        );
    }

    public function down(): void
    {
        // Existing Studos data is intentionally preserved on rollback.
    }
};
