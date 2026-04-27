<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('member_auth_tokens')) {
            return;
        }

        Schema::create('member_auth_tokens', function (Blueprint $table): void {
            $table->string('id', 36)->primary();
            $table->string('member_id', 36)->index();
            $table->string('token_hash', 64)->unique();
            $table->string('name', 80)->nullable();
            $table->dateTime('last_used_at')->nullable();
            $table->dateTime('expires_at')->nullable()->index();
            $table->dateTime('revoked_at')->nullable()->index();
            $table->dateTime('created_at')->index();
            $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_auth_tokens');
    }
};
