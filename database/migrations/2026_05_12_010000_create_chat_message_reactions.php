<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('chat_message_reactions')) {
            Schema::create('chat_message_reactions', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('message_id', 36)->index();
                $table->string('member_id', 36)->index();
                $table->string('emoji', 32);
                $table->dateTime('created_at')->index();
                $table->dateTime('updated_at')->nullable();
                $table->unique(['message_id', 'member_id']);
                $table->index(['message_id', 'emoji']);
                $table->foreign('message_id')->references('id')->on('chat_messages')->cascadeOnDelete();
                $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_message_reactions');
    }
};
