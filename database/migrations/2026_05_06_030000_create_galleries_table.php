<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('galleries')) {
            Schema::create('galleries', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('class_id', 36)->index();
                $table->string('name', 190);
                $table->string('visibility', 32)->default('private')->index();
                $table->string('audience', 32)->nullable();
                $table->string('permission', 32)->nullable();
                $table->json('member_ids')->nullable();
                $table->unsignedInteger('photo_count')->default(0);
                $table->text('cover_image_url')->nullable();
                $table->string('created_by_member_id', 36)->nullable()->index();
                $table->dateTime('deleted_at')->nullable()->index();
                $table->string('deleted_by_member_id', 36)->nullable();
                $table->dateTime('created_at')->nullable()->index();
                $table->dateTime('updated_at')->nullable();
                $table->index(['class_id', 'visibility']);
                $table->index(['class_id', 'created_at']);
                $table->foreign('class_id')->references('id')->on('classes')->cascadeOnDelete();
                $table->foreign('created_by_member_id')->references('id')->on('members')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        // Data intentionally preserved on rollback.
    }
};
