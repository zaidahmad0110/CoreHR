<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        $coordinators = DB::table('employees')
            ->select(['id', 'department_id'])
            ->whereRaw('LOWER(job_title) = ?', ['coordinator'])
            ->orderBy('id')
            ->get();

        foreach ($coordinators as $coordinator) {
            $departmentId = (int) ($coordinator->department_id ?? 0);
            if ($departmentId <= 0) {
                continue;
            }

            $supervisorId = DB::table('employees')
                ->where('department_id', $departmentId)
                ->where('id', '!=', (int) $coordinator->id)
                ->whereRaw('LOWER(job_title) = ?', ['supervisor'])
                ->orderBy('id')
                ->value('id');

            if (! $supervisorId) {
                continue;
            }

            DB::table('employees')
                ->where('id', (int) $coordinator->id)
                ->update([
                    'manager_id' => (int) $supervisorId,
                    'updated_at' => $now,
                ]);
        }
    }

    public function down(): void
    {
        // Intentionally left blank to avoid reverting legitimate manager assignments.
    }
};

