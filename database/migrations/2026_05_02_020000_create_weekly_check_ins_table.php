<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('weekly_check_ins')) {
            return;
        }

        Schema::create('weekly_check_ins', function (Blueprint $table): void {
            $table->string('id', 36)->primary();
            $table->string('member_id', 36)->index();
            $table->string('class_id', 36)->index();
            $table->date('day_key');
            $table->unsignedTinyInteger('streak_day')->default(1);
            $table->boolean('reward_awarded')->default(false)->index();
            $table->unsignedInteger('caps_awarded')->default(0);
            $table->dateTime('created_at')->index();
            $table->unique(['member_id', 'day_key']);
            $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
            $table->foreign('class_id')->references('id')->on('classes')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weekly_check_ins');
    }
};
