<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('retention_runs')) {
            return;
        }

        Schema::create('retention_runs', function (Blueprint $table): void {
            $table->string('id', 36)->primary();
            $table->dateTime('executed_at')->index();
            $table->dateTime('completed_at')->nullable();
            $table->string('status', 32)->index();
            $table->boolean('dry_run')->default(false);
            $table->json('summary')->nullable();
            $table->text('error')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('retention_runs');
    }
};
