<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance_records', function (Blueprint $table): void {
            try {
                $table->dropUnique('attendance_records_employee_id_date_unique');
            } catch (\Throwable) {
                // Older databases may already have this index removed.
            }

            if (! Schema::hasColumn('attendance_records', 'break_in')) {
                $table->time('break_in')->nullable()->after('check_out');
            }

            if (! Schema::hasColumn('attendance_records', 'break_out')) {
                $table->time('break_out')->nullable()->after('break_in');
            }

            if (! Schema::hasColumn('attendance_records', 'break_minutes')) {
                $table->unsignedInteger('break_minutes')->nullable()->after('break_out');
            }

            $table->index(['employee_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::table('attendance_records', function (Blueprint $table): void {
            try {
                $table->dropIndex('attendance_records_employee_id_date_index');
            } catch (\Throwable) {
                // Index may not exist on every local database.
            }

            $columns = array_values(array_filter(
                ['break_in', 'break_out', 'break_minutes'],
                fn (string $column): bool => Schema::hasColumn('attendance_records', $column),
            ));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }

            try {
                $table->unique(['employee_id', 'date']);
            } catch (\Throwable) {
                // Rollback should not fail if duplicate day rows already exist.
            }
        });
    }
};
