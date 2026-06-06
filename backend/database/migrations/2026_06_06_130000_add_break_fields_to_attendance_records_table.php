<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const UNIQUE_INDEX = 'attendance_records_employee_id_date_unique';
    private const FK_SUPPORT_INDEX = 'attendance_records_employee_fk_index';
    private const LOOKUP_INDEX = 'attendance_records_employee_date_lookup_index';

    public function up(): void
    {
        if (! $this->indexExists(self::FK_SUPPORT_INDEX)) {
            Schema::table('attendance_records', function (Blueprint $table): void {
                $table->index('employee_id', self::FK_SUPPORT_INDEX);
            });
        }

        if ($this->indexExists(self::UNIQUE_INDEX)) {
            Schema::table('attendance_records', function (Blueprint $table): void {
                $table->dropUnique(self::UNIQUE_INDEX);
            });
        }

        Schema::table('attendance_records', function (Blueprint $table): void {
            if (! Schema::hasColumn('attendance_records', 'break_in')) {
                $table->time('break_in')->nullable()->after('check_out');
            }

            if (! Schema::hasColumn('attendance_records', 'break_out')) {
                $table->time('break_out')->nullable()->after('break_in');
            }

            if (! Schema::hasColumn('attendance_records', 'break_minutes')) {
                $table->unsignedInteger('break_minutes')->nullable()->after('break_out');
            }
        });

        if (! $this->indexExists(self::LOOKUP_INDEX)) {
            Schema::table('attendance_records', function (Blueprint $table): void {
                $table->index(['employee_id', 'date'], self::LOOKUP_INDEX);
            });
        }
    }

    public function down(): void
    {
        if ($this->indexExists(self::LOOKUP_INDEX)) {
            Schema::table('attendance_records', function (Blueprint $table): void {
                $table->dropIndex(self::LOOKUP_INDEX);
            });
        }

        Schema::table('attendance_records', function (Blueprint $table): void {
            $columns = array_values(array_filter(
                ['break_in', 'break_out', 'break_minutes'],
                fn (string $column): bool => Schema::hasColumn('attendance_records', $column),
            ));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });

        if (! $this->indexExists(self::UNIQUE_INDEX)) {
            try {
                Schema::table('attendance_records', function (Blueprint $table): void {
                    $table->unique(['employee_id', 'date'], self::UNIQUE_INDEX);
                });
            } catch (\Throwable) {
                // Rollback should not fail if duplicate day rows already exist.
            }
        }

        if ($this->indexExists(self::FK_SUPPORT_INDEX)) {
            try {
                Schema::table('attendance_records', function (Blueprint $table): void {
                    $table->dropIndex(self::FK_SUPPORT_INDEX);
                });
            } catch (\Throwable) {
                // MySQL may still need this index if the unique index was not restored.
            }
        }
    }

    private function indexExists(string $indexName): bool
    {
        return DB::table('information_schema.statistics')
            ->where('table_schema', DB::getDatabaseName())
            ->where('table_name', 'attendance_records')
            ->where('index_name', $indexName)
            ->exists();
    }
};
