<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('point_duels')) {
            Schema::create('point_duels', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('class_id', 36)->index();
                $table->string('creator_member_id', 36)->index();
                $table->string('opponent_member_id', 36)->index();
                $table->string('judge_member_id', 36)->nullable()->index();
                $table->text('challenge');
                $table->string('mode', 24)->default('versus')->index();
                $table->unsignedInteger('stake_caps');
                $table->unsignedInteger('creator_escrow_caps')->default(0);
                $table->unsignedInteger('opponent_escrow_caps')->default(0);
                $table->string('status', 32)->default('awaitingOpponent')->index();
                $table->string('winner_member_id', 36)->nullable()->index();
                $table->string('completed_by_member_id', 36)->nullable()->index();
                $table->dateTime('judge_requested_at')->nullable();
                $table->dateTime('judge_approved_at')->nullable();
                $table->dateTime('judge_rejected_at')->nullable();
                $table->dateTime('deadline_at')->nullable()->index();
                $table->dateTime('accepted_at')->nullable();
                $table->dateTime('confirmed_at')->nullable();
                $table->dateTime('declined_at')->nullable();
                $table->dateTime('cancelled_at')->nullable();
                $table->dateTime('expired_at')->nullable()->index();
                $table->dateTime('completed_at')->nullable();
                $table->dateTime('created_at')->nullable()->index();
                $table->dateTime('updated_at')->nullable();
                $table->index(['class_id', 'status']);
                $table->index(['creator_member_id', 'opponent_member_id']);
                $table->foreign('class_id')->references('id')->on('classes')->cascadeOnDelete();
                $table->foreign('creator_member_id')->references('id')->on('members')->cascadeOnDelete();
                $table->foreign('opponent_member_id')->references('id')->on('members')->cascadeOnDelete();
                $table->foreign('judge_member_id')->references('id')->on('members')->nullOnDelete();
                $table->foreign('winner_member_id')->references('id')->on('members')->nullOnDelete();
                $table->foreign('completed_by_member_id')->references('id')->on('members')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('point_duels');
    }
};
