<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_requests', function (Blueprint $table): void {
            if (! Schema::hasColumn('leave_requests', 'request_unit')) {
                $table->string('request_unit')->default('day')->after('type');
            }

            if (! Schema::hasColumn('leave_requests', 'start_time')) {
                $table->time('start_time')->nullable()->after('start_date');
            }

            if (! Schema::hasColumn('leave_requests', 'end_time')) {
                $table->time('end_time')->nullable()->after('end_date');
            }

            if (! Schema::hasColumn('leave_requests', 'hours')) {
                $table->decimal('hours', 5, 2)->nullable()->after('days');
            }
        });
    }

    public function down(): void
    {
        Schema::table('leave_requests', function (Blueprint $table): void {
            foreach (['hours', 'end_time', 'start_time', 'request_unit'] as $column) {
                if (Schema::hasColumn('leave_requests', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
