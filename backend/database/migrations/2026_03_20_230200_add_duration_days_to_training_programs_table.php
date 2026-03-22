<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('training_programs', function (Blueprint $table): void {
            if (! Schema::hasColumn('training_programs', 'duration_days')) {
                $table->unsignedSmallInteger('duration_days')->default(7)->after('duration_weeks');
            }
        });

        if (Schema::hasColumn('training_programs', 'duration_weeks') && Schema::hasColumn('training_programs', 'duration_days')) {
            DB::table('training_programs')
                ->where(function ($query): void {
                    $query->whereNull('duration_days')
                        ->orWhere('duration_days', '<=', 0);
                })
                ->update([
                    'duration_days' => DB::raw('GREATEST(duration_weeks * 7, 1)'),
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('training_programs', function (Blueprint $table): void {
            if (Schema::hasColumn('training_programs', 'duration_days')) {
                $table->dropColumn('duration_days');
            }
        });
    }
};

