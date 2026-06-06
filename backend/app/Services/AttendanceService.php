<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use Carbon\Carbon;

class AttendanceService
{
    public function getByDate(Carbon $date): array
    {
        $records = AttendanceRecord::query()
            ->with(['employee.department'])
            ->whereDate('date', $date)
            ->orderBy('status')
            ->orderBy('employee_id')
            ->get();

        return [
            'date' => $date->toDateString(),
            'stats' => [
                'present' => $records->whereIn('status', ['Present', 'Early', 'Overtime'])->count(),
                'late' => $records->where('status', 'Late')->count(),
                'absent' => $records->where('status', 'Absent')->count(),
                'overtime' => $records->where('status', 'Overtime')->count(),
            ],
            'records' => $records->map(function (AttendanceRecord $record): array {
                return [
                    'id' => $record->id,
                    'employee' => $record->employee?->name ?? 'Unknown',
                    'department' => $record->employee?->department?->name ?? 'N/A',
                    'check_in' => $record->check_in ? Carbon::parse($record->check_in)->format('h:i A') : '-',
                    'check_out' => $record->check_out ? Carbon::parse($record->check_out)->format('h:i A') : '-',
                    'work_hours' => $record->work_minutes ? round($record->work_minutes / 60, 1).'h' : '-',
                    'status' => $record->status,
                ];
            })->values(),
        ];
    }
}
