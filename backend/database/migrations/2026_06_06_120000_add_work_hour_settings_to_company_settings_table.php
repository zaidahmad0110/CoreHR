<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table): void {
            if (! Schema::hasColumn('company_settings', 'work_start_time')) {
                $table->time('work_start_time')->default('09:00:00')->after('biotime_last_sync_at');
            }

            if (! Schema::hasColumn('company_settings', 'work_end_time')) {
                $table->time('work_end_time')->default('18:00:00')->after('work_start_time');
            }

            if (! Schema::hasColumn('company_settings', 'work_full_day_minutes')) {
                $table->unsignedSmallInteger('work_full_day_minutes')->default(540)->after('work_end_time');
            }
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table): void {
            if (Schema::hasColumn('company_settings', 'work_full_day_minutes')) {
                $table->dropColumn('work_full_day_minutes');
            }

            if (Schema::hasColumn('company_settings', 'work_end_time')) {
                $table->dropColumn('work_end_time');
            }

            if (Schema::hasColumn('company_settings', 'work_start_time')) {
                $table->dropColumn('work_start_time');
            }
        });
    }
};
