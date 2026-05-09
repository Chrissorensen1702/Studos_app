<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('member_notification_preferences')) {
            Schema::create('member_notification_preferences', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('member_id', 36)->index();
                $table->string('category', 64)->index();
                $table->boolean('enabled')->default(true);
                $table->dateTime('created_at');
                $table->dateTime('updated_at')->nullable();

                $table->unique(['member_id', 'category']);
                $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('notification_dispatch_log')) {
            Schema::create('notification_dispatch_log', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('member_id', 36)->index();
                $table->string('category', 64)->index();
                $table->string('dedup_key', 190)->nullable();
                $table->string('source_type', 64)->nullable();
                $table->string('source_id', 64)->nullable();
                $table->dateTime('sent_at')->index();

                $table->unique(['member_id', 'dedup_key']);
                $table->index(['source_type', 'source_id']);
                $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_dispatch_log');
        Schema::dropIfExists('member_notification_preferences');
    }
};
