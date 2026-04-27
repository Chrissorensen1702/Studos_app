<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('moderation_violations')) {
            return;
        }

        Schema::create('moderation_violations', function (Blueprint $table): void {
            $table->string('id', 36)->primary();
            $table->string('member_id', 36)->nullable()->index();
            $table->string('class_id', 36)->nullable()->index();
            $table->string('source', 80)->index();
            $table->string('field', 80);
            $table->string('violation_type', 80)->index();
            $table->string('matched_term', 190)->nullable();
            $table->string('action', 32)->default('blocked')->index();
            $table->string('input_hash', 64);
            $table->string('preview', 240)->nullable();
            $table->json('metadata')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moderation_violations');
    }
};
