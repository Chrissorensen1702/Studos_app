<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('member_connections')) {
            return;
        }

        Schema::create('member_connections', function (Blueprint $table): void {
            $table->string('id', 36)->primary();
            $table->string('pair_key', 80)->unique();
            $table->string('requester_member_id', 36)->index();
            $table->string('receiver_member_id', 36)->index();
            $table->string('status', 24)->default('pending')->index();
            $table->dateTime('created_at')->index();
            $table->dateTime('updated_at')->nullable();
            $table->dateTime('responded_at')->nullable();
            $table->foreign('requester_member_id')->references('id')->on('members')->cascadeOnDelete();
            $table->foreign('receiver_member_id')->references('id')->on('members')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_connections');
    }
};
