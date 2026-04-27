<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('chat_conversations')) {
            Schema::create('chat_conversations', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('class_id', 36)->index();
                $table->string('type', 24)->index();
                $table->string('title', 120)->nullable();
                $table->string('direct_pair_key', 80)->nullable()->unique();
                $table->string('owner_member_id', 36)->nullable()->index();
                $table->string('created_by_member_id', 36)->index();
                $table->string('status', 24)->default('active')->index();
                $table->string('deleted_by_member_id', 36)->nullable();
                $table->dateTime('deleted_at')->nullable()->index();
                $table->dateTime('created_at')->index();
                $table->dateTime('updated_at')->nullable();
                $table->foreign('class_id')->references('id')->on('classes')->cascadeOnDelete();
                $table->foreign('owner_member_id')->references('id')->on('members')->nullOnDelete();
                $table->foreign('created_by_member_id')->references('id')->on('members')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('chat_participants')) {
            Schema::create('chat_participants', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('conversation_id', 36)->index();
                $table->string('member_id', 36)->index();
                $table->string('role', 24)->default('member')->index();
                $table->string('status', 24)->default('active')->index();
                $table->dateTime('joined_at')->index();
                $table->dateTime('left_at')->nullable();
                $table->dateTime('hidden_at')->nullable();
                $table->dateTime('muted_until')->nullable();
                $table->string('last_read_message_id', 36)->nullable();
                $table->dateTime('last_read_at')->nullable();
                $table->dateTime('created_at')->index();
                $table->dateTime('updated_at')->nullable();
                $table->unique(['conversation_id', 'member_id']);
                $table->foreign('conversation_id')->references('id')->on('chat_conversations')->cascadeOnDelete();
                $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('chat_messages')) {
            Schema::create('chat_messages', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('conversation_id', 36)->index();
                $table->string('sender_member_id', 36)->index();
                $table->string('type', 24)->default('text')->index();
                $table->text('body');
                $table->dateTime('edited_at')->nullable();
                $table->string('deleted_by_member_id', 36)->nullable();
                $table->dateTime('deleted_at')->nullable()->index();
                $table->dateTime('created_at')->index();
                $table->dateTime('updated_at')->nullable();
                $table->index(['conversation_id', 'created_at']);
                $table->foreign('conversation_id')->references('id')->on('chat_conversations')->cascadeOnDelete();
                $table->foreign('sender_member_id')->references('id')->on('members')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('chat_moderation_events')) {
            Schema::create('chat_moderation_events', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('conversation_id', 36)->index();
                $table->string('message_id', 36)->nullable()->index();
                $table->string('actor_member_id', 36)->nullable()->index();
                $table->string('target_member_id', 36)->nullable()->index();
                $table->string('action', 80)->index();
                $table->string('reason', 190)->nullable();
                $table->json('metadata')->nullable();
                $table->dateTime('created_at')->index();
                $table->foreign('conversation_id')->references('id')->on('chat_conversations')->cascadeOnDelete();
                $table->foreign('message_id')->references('id')->on('chat_messages')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_moderation_events');
        Schema::dropIfExists('chat_messages');
        Schema::dropIfExists('chat_participants');
        Schema::dropIfExists('chat_conversations');
    }
};
