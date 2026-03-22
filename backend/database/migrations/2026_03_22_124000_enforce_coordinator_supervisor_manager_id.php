<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        $globalSupervisorId = DB::table('employees')
            ->whereRaw('LOWER(job_title) = ?', ['supervisor'])
            ->orderBy('id')
            ->value('id');

        if (! $globalSupervisorId) {
            return;
        }

        $coordinators = DB::table('employees')
            ->select(['id', 'department_id', 'manager_id'])
            ->whereRaw('LOWER(job_title) = ?', ['coordinator'])
            ->orderBy('id')
            ->get();

        foreach ($coordinators as $coordinator) {
            $coordinatorId = (int) $coordinator->id;
            $currentManagerId = $coordinator->manager_id ? (int) $coordinator->manager_id : null;
            $departmentId = $coordinator->department_id ? (int) $coordinator->department_id : null;

            if ($currentManagerId !== null) {
                $isCurrentManagerSupervisor = DB::table('employees')
                    ->where('id', $currentManagerId)
                    ->whereRaw('LOWER(job_title) = ?', ['supervisor'])
                    ->exists();

                if ($isCurrentManagerSupervisor && $currentManagerId !== $coordinatorId) {
                    continue;
                }
            }

            $departmentSupervisorId = null;
            if ($departmentId !== null) {
                $departmentSupervisorId = DB::table('employees')
                    ->where('department_id', $departmentId)
                    ->where('id', '!=', $coordinatorId)
                    ->whereRaw('LOWER(job_title) = ?', ['supervisor'])
                    ->orderBy('id')
                    ->value('id');
            }

            $assignedSupervisorId = $departmentSupervisorId ?: (int) $globalSupervisorId;
            if ($assignedSupervisorId === $coordinatorId) {
                continue;
            }

            DB::table('employees')
                ->where('id', $coordinatorId)
                ->update([
                    'manager_id' => $assignedSupervisorId,
                    'updated_at' => $now,
                ]);
        }
    }

    public function down(): void
    {
        // Intentionally left blank to avoid reverting legitimate manager assignments.
    }
};

