<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('gallery_photos')) {
            Schema::create('gallery_photos', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('gallery_id', 36)->index();
                $table->string('member_id', 36)->nullable()->index();
                $table->text('image_url');
                $table->dateTime('deleted_at')->nullable()->index();
                $table->string('deleted_by_member_id', 36)->nullable();
                $table->dateTime('created_at')->nullable()->index();
                $table->index(['gallery_id', 'created_at']);
                $table->foreign('gallery_id')->references('id')->on('galleries')->cascadeOnDelete();
                $table->foreign('member_id')->references('id')->on('members')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        // Data intentionally preserved on rollback.
    }
};
