<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\BioTimePunchLog;
use App\Models\CompanySetting;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class AttendanceService
{
    public function getByDate(Carbon $date): array
    {
        $settings = CompanySetting::query()->first();
        $bioTimeEnabled = (bool) ($settings?->biotime_enabled ?? false);

        if ($bioTimeEnabled) {
            return $this->getBioTimeRecordsByDate($date, $settings);
        }

        $records = AttendanceRecord::query()
            ->with(['employee.department'])
            ->whereDate('date', $date)
            ->orderBy('employee_id')
            ->orderByRaw('break_in IS NULL DESC')
            ->orderBy('break_in')
            ->get()
            ->unique(fn (AttendanceRecord $record): string => (string) $record->employee_id);

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

    private function getBioTimeRecordsByDate(Carbon $date, ?CompanySetting $settings): array
    {
        $targetDate = $date->copy()->timezone(config('app.timezone'))->toDateString();

        $logs = BioTimePunchLog::query()
            ->with(['employee.department'])
            ->whereNotNull('employee_id')
            ->whereBetween('punch_time', [
                $date->copy()->subDay()->startOfDay(),
                $date->copy()->addDay()->endOfDay(),
            ])
            ->orderBy('employee_id')
            ->orderBy('punch_time')
            ->get()
            ->map(function (BioTimePunchLog $log): array {
                return [
                    'log' => $log,
                    'local_time' => $this->resolveLocalPunchTime($log),
                ];
            })
            ->filter(fn (array $entry): bool => $entry['local_time']->toDateString() === $targetDate)
            ->groupBy(fn (array $entry): string => (string) $entry['log']->employee_id);

        $records = $logs
            ->map(function (Collection $employeeLogs) use ($settings): array {
                $sortedLogs = $employeeLogs
                    ->sortBy(fn (array $entry): int => $entry['local_time']->getTimestamp())
                    ->values();
                $first = $sortedLogs->first();
                $last = $sortedLogs->last();
                /** @var BioTimePunchLog $firstLog */
                $firstLog = $first['log'];
                /** @var Carbon $checkIn */
                $checkIn = $first['local_time'];
                /** @var Carbon|null $checkOut */
                $checkOut = $sortedLogs->count() > 1 ? $last['local_time'] : null;
                $workMinutes = $checkOut ? max($checkIn->diffInMinutes($checkOut), 0) : null;

                return [
                    'id' => $firstLog->id,
                    'employee' => $firstLog->employee?->name ?? 'Unknown',
                    'department' => $firstLog->employee?->department?->name ?? 'N/A',
                    'check_in' => $checkIn->format('h:i A'),
                    'check_out' => $checkOut?->format('h:i A') ?? '-',
                    'work_hours' => $workMinutes ? round($workMinutes / 60, 1).'h' : '-',
                    'status' => $this->resolveStatus($checkIn, $settings),
                ];
            })
            ->values();

        return [
            'date' => $targetDate,
            'stats' => [
                'present' => $records->whereIn('status', ['Present', 'Early', 'Overtime'])->count(),
                'late' => $records->where('status', 'Late')->count(),
                'absent' => $records->where('status', 'Absent')->count(),
                'overtime' => $records->where('status', 'Overtime')->count(),
            ],
            'records' => $records,
        ];
    }

    private function resolveLocalPunchTime(BioTimePunchLog $log): Carbon
    {
        $rawPunchTime = $log->raw_payload['punch_time'] ?? null;

        if (is_string($rawPunchTime) && trim($rawPunchTime) !== '') {
            return Carbon::parse(trim($rawPunchTime), config('app.timezone'));
        }

        return $log->punch_time->copy()->timezone(config('app.timezone'));
    }

    private function resolveStatus(Carbon $checkIn, ?CompanySetting $settings): string
    {
        $startTime = $this->normalizeWorkTime((string) ($settings?->work_start_time ?? '09:00:00'));
        $checkInTime = $checkIn->format('H:i:s');

        if ($checkInTime < $startTime) {
            return 'Early';
        }

        if ($checkInTime === $startTime) {
            return 'Present';
        }

        return 'Late';
    }

    private function normalizeWorkTime(string $value): string
    {
        $time = trim($value);

        if (preg_match('/^\d{2}:\d{2}$/', $time) === 1) {
            return $time.':00';
        }

        if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $time) === 1) {
            return $time;
        }

        return '09:00:00';
    }
}
