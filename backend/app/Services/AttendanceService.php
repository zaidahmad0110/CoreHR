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
        $uniqueDayRecords = $records->unique(fn (AttendanceRecord $record): string => (string) $record->employee_id);

        return [
            'date' => $date->toDateString(),
            'stats' => [
                'present' => $uniqueDayRecords->whereIn('status', ['Present', 'Early', 'Overtime'])->count(),
                'late' => $uniqueDayRecords->where('status', 'Late')->count(),
                'absent' => $uniqueDayRecords->where('status', 'Absent')->count(),
                'overtime' => $uniqueDayRecords->where('status', 'Overtime')->count(),
            ],
            'records' => $records->map(function (AttendanceRecord $record): array {
                return [
                    'id' => $record->id,
                    'employee' => $record->employee?->name ?? 'Unknown',
                    'department' => $record->employee?->department?->name ?? 'N/A',
                    'check_in' => $record->check_in ? Carbon::parse($record->check_in)->format('h:i A') : '-',
                    'check_out' => $record->check_out ? Carbon::parse($record->check_out)->format('h:i A') : '-',
                    'break_in' => $record->break_in ? Carbon::parse($record->break_in)->format('h:i A') : '-',
                    'break_out' => $record->break_out ? Carbon::parse($record->break_out)->format('h:i A') : '-',
                    'break_duration' => $record->break_minutes ? $record->break_minutes.' Min' : '-',
                    'work_hours' => $record->work_minutes ? round($record->work_minutes / 60, 1).'h' : '-',
                    'status' => $record->status,
                ];
            })->values(),
        ];
    }
}
