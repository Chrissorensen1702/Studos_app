<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('member_strikes')) {
            Schema::create('member_strikes', function (Blueprint $table): void {
                $table->string('id', 36)->primary();
                $table->string('class_id', 36)->nullable()->index();
                $table->string('member_id', 36)->nullable()->index();
                $table->string('issued_by_member_id', 36)->nullable()->index();
                $table->string('report_id', 36)->nullable()->index();
                $table->string('reason', 190);
                $table->text('details')->nullable();
                $table->unsignedTinyInteger('strike_number')->default(1);
                $table->string('status', 32)->default('active')->index();
                $table->dateTime('expires_at')->nullable();
                $table->timestamps();

                $table->index(['class_id', 'member_id']);
            });
        }

        if (Schema::hasTable('member_reports')) {
            Schema::table('member_reports', function (Blueprint $table): void {
                if (! Schema::hasColumn('member_reports', 'reviewed_by_member_id')) {
                    $table->string('reviewed_by_member_id', 36)->nullable()->after('reviewed_at')->index();
                }

                if (! Schema::hasColumn('member_reports', 'resolution')) {
                    $table->string('resolution', 32)->nullable()->after('reviewed_by_member_id')->index();
                }

                if (! Schema::hasColumn('member_reports', 'resolution_note')) {
                    $table->text('resolution_note')->nullable()->after('resolution');
                }

                if (! Schema::hasColumn('member_reports', 'strike_id')) {
                    $table->string('strike_id', 36)->nullable()->after('resolution_note')->index();
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('member_reports')) {
            Schema::table('member_reports', function (Blueprint $table): void {
                foreach (['reviewed_by_member_id', 'resolution', 'resolution_note', 'strike_id'] as $column) {
                    if (Schema::hasColumn('member_reports', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        Schema::dropIfExists('member_strikes');
    }
};
