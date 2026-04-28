<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('member_push_tokens')) {
            return;
        }

        Schema::create('member_push_tokens', function (Blueprint $table): void {
            $table->string('id', 36)->primary();
            $table->string('member_id', 36)->index();
            $table->string('expo_push_token', 255)->unique();
            $table->string('platform', 32)->index();
            $table->string('device_name', 190)->nullable();
            $table->string('project_id', 190)->nullable();
            $table->string('app_variant', 64)->nullable()->index();
            $table->string('native_application_version', 64)->nullable();
            $table->string('native_build_version', 64)->nullable();
            $table->dateTime('last_registered_at')->index();
            $table->dateTime('disabled_at')->nullable()->index();
            $table->dateTime('created_at')->index();
            $table->dateTime('updated_at')->nullable();
            $table->foreign('member_id')->references('id')->on('members')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_push_tokens');
    }
};
