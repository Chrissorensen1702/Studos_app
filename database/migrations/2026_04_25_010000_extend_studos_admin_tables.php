<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('classes')) {
            Schema::table('classes', function (Blueprint $table): void {
                if (! Schema::hasColumn('classes', 'join_policy')) {
                    $table->string('join_policy', 32)->default('approval');
                }

                if (! Schema::hasColumn('classes', 'updated_at')) {
                    $table->dateTime('updated_at')->nullable();
                }
            });

            DB::table('classes')->whereNull('join_policy')->update(['join_policy' => 'approval']);
            DB::table('classes')->whereNull('updated_at')->update(['updated_at' => DB::raw('created_at')]);
        }

        if (Schema::hasTable('events')) {
            Schema::table('events', function (Blueprint $table): void {
                if (! Schema::hasColumn('events', 'location')) {
                    $table->string('location', 190)->nullable();
                }

                if (! Schema::hasColumn('events', 'description')) {
                    $table->text('description')->nullable();
                }

                if (! Schema::hasColumn('events', 'created_at')) {
                    $table->dateTime('created_at')->nullable();
                }

                if (! Schema::hasColumn('events', 'updated_at')) {
                    $table->dateTime('updated_at')->nullable();
                }
            });

            DB::table('events')->whereNull('created_at')->update(['created_at' => now()]);
            DB::table('events')->whereNull('updated_at')->update(['updated_at' => now()]);
        }

        if (! Schema::hasTable('class_content_blocks')) {
            Schema::create('class_content_blocks', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('class_id', 36)->index();
                $table->string('type', 32)->default('info')->index();
                $table->string('title', 190);
                $table->text('body')->nullable();
                $table->boolean('is_pinned')->default(false);
                $table->unsignedInteger('sort_order')->default(0);
                $table->dateTime('created_at')->nullable();
                $table->dateTime('updated_at')->nullable();
                $table->foreign('class_id')->references('id')->on('classes')->cascadeOnDelete();
            });
        }

        if (Schema::hasTable('class_content_blocks')) {
            DB::table('class_content_blocks')->updateOrInsert(
                ['id' => 'demo-content-info'],
                [
                    'class_id' => 'demo-class',
                    'type' => 'info',
                    'title' => 'Vigtig info',
                    'body' => 'Samlet info til klassen vises her.',
                    'is_pinned' => true,
                    'sort_order' => 10,
                    'created_at' => '2026-04-25 00:00:00',
                    'updated_at' => now(),
                ],
            );

            DB::table('class_content_blocks')->updateOrInsert(
                ['id' => 'demo-content-contact'],
                [
                    'class_id' => 'demo-class',
                    'type' => 'contact',
                    'title' => 'Kontaktpersoner',
                    'body' => 'Klasseadgang kan holde kontaktinfo opdateret.',
                    'is_pinned' => false,
                    'sort_order' => 20,
                    'created_at' => '2026-04-25 00:00:00',
                    'updated_at' => now(),
                ],
            );
        }
    }

    public function down(): void
    {
        // Existing Studos admin data is intentionally preserved on rollback.
    }
};
