<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\BioTimePunchLog;
use App\Models\CompanySetting;
use App\Models\Employee;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class BioTimeSyncService
{
    /**
     * @var array{start_time: string, full_day_minutes: int}|null
     */
    private ?array $workHourSettings = null;

    public function sync(?Carbon $startTime = null, ?Carbon $endTime = null, bool $fullSync = false): array
    {
        $settings = CompanySetting::query()->first();
        $this->workHourSettings = null;

        if (! $settings || ! $settings->biotime_enabled) {
            throw new RuntimeException('BioTime integration is not enabled.');
        }

        $baseUrl = rtrim((string) $settings->biotime_base_url, '/');
        $username = trim((string) $settings->biotime_username);
        $password = trim((string) $settings->biotime_password);
        $timeout = max((int) ($settings->biotime_timeout ?? 20), 1);

        if ($baseUrl === '' || $username === '' || $password === '') {
            throw new RuntimeException('BioTime base URL, username, and password are required.');
        }

        $endTime ??= now();
        $startTime ??= $this->resolveSyncStartTime($settings, $endTime, $fullSync);

        $token = $this->authenticate($baseUrl, $username, $password, $timeout);
        $transactions = $this->fetchTransactions($baseUrl, $token, $startTime, $endTime, $timeout);

        $employeeMap = $this->buildEmployeeMap();
        $unmatchedCodes = [];
        $imported = 0;

        foreach ($transactions as $transaction) {
            $empCode = trim((string) ($transaction['emp_code'] ?? ''));
            $punchTimeRaw = $transaction['punch_time'] ?? null;

            if ($empCode === '' || ! is_string($punchTimeRaw) || trim($punchTimeRaw) === '') {
                continue;
            }

            $punchTime = Carbon::parse($punchTimeRaw);
            $employee = $employeeMap[$empCode] ?? null;

            if (! $employee) {
                $unmatchedCodes[$empCode] = true;
            }

            $externalId = $this->resolveExternalId($transaction, $empCode, $punchTime);

            BioTimePunchLog::query()->updateOrCreate(
                ['external_id' => $externalId],
                [
                    'employee_id' => $employee?->id,
                    'emp_code' => $empCode,
                    'punch_time' => $punchTime,
                    'punch_state' => isset($transaction['punch_state']) ? (string) $transaction['punch_state'] : null,
                    'verify_type' => isset($transaction['verify_type']) ? (int) $transaction['verify_type'] : null,
                    'terminal_sn' => isset($transaction['terminal_sn']) ? (string) $transaction['terminal_sn'] : null,
                    'terminal_alias' => isset($transaction['terminal_alias']) ? (string) $transaction['terminal_alias'] : null,
                    'upload_time' => ! empty($transaction['upload_time']) ? Carbon::parse((string) $transaction['upload_time']) : null,
                    'raw_payload' => $transaction,
                    'processed_at' => $employee ? now() : null,
                ],
            );

            if ($employee) {
                $imported++;
            }
        }

        $updatedAttendance = $this->rebuildAttendanceFromPunches($startTime, $endTime);
        $absentMarked = $this->markMissingTodayAsAbsent($startTime, $endTime);
        $settings->forceFill(['biotime_last_sync_at' => now()])->save();

        return [
            'fetched' => $transactions->count(),
            'imported' => $imported,
            'attendance_updated' => $updatedAttendance + $absentMarked,
            'absent_marked' => $absentMarked,
            'unmatched_emp_codes' => array_values(array_keys($unmatchedCodes)),
            'start_time' => $startTime->toDateTimeString(),
            'end_time' => $endTime->toDateTimeString(),
            'synced_at' => now()->toDateTimeString(),
        ];
    }

    private function authenticate(string $baseUrl, string $username, string $password, int $timeout): string
    {
        $response = Http::timeout($timeout)
            ->acceptJson()
            ->asJson()
            ->post($baseUrl.'/api-token-auth/', [
                'username' => $username,
                'password' => $password,
            ]);

        if (! $response->successful()) {
            throw new RuntimeException('BioTime authentication failed: '.$response->body());
        }

        $payload = $response->json();
        $token = $payload['token'] ?? $payload['data']['token'] ?? $payload['access'] ?? null;

        if (! is_string($token) || trim($token) === '') {
            throw new RuntimeException('BioTime authentication did not return a usable token.');
        }

        return trim($token);
    }

    private function resolveSyncStartTime(CompanySetting $settings, Carbon $endTime, bool $fullSync): Carbon
    {
        if ($fullSync || ! $settings->biotime_last_sync_at) {
            return Carbon::create(2000, 1, 1, 0, 0, 0, $endTime->timezone);
        }

        return Carbon::parse($settings->biotime_last_sync_at)->subDay();
    }

    private function fetchTransactions(
        string $baseUrl,
        string $token,
        Carbon $startTime,
        Carbon $endTime,
        int $timeout
    ): Collection {
        $allRows = collect();
        $page = 1;
        $limit = 100;

        do {
            $response = Http::timeout($timeout)
                ->acceptJson()
                ->withHeaders([
                    'Authorization' => 'Token '.$token,
                ])
                ->get($baseUrl.'/iclock/api/transactions/', [
                    'page' => $page,
                    'limit' => $limit,
                    'start_time' => $startTime->format('Y-m-d H:i:s'),
                    'end_time' => $endTime->format('Y-m-d H:i:s'),
                ]);

            if (! $response->successful()) {
                throw new RuntimeException('BioTime transaction sync failed: '.$response->body());
            }

            $payload = $response->json();
            $rows = collect($payload['data'] ?? $payload['results'] ?? []);
            $allRows = $allRows->merge($rows);

            $hasNext = ! empty($payload['next']) || $rows->count() === $limit;
            $page++;
        } while ($hasNext && $page <= 1000);

        return $allRows;
    }

    /**
     * @return array<string, Employee>
     */
    private function buildEmployeeMap(): array
    {
        $map = [];

        Employee::query()
            ->select(['id', 'employee_code', 'biotime_emp_code'])
            ->get()
            ->each(function (Employee $employee) use (&$map): void {
                $employeeCode = trim((string) $employee->employee_code);
                $bioTimeCode = trim((string) $employee->biotime_emp_code);

                if ($employeeCode !== '') {
                    $map[$employeeCode] = $employee;
                }

                if ($bioTimeCode !== '') {
                    $map[$bioTimeCode] = $employee;
                }
            });

        return $map;
    }

    private function rebuildAttendanceFromPunches(Carbon $startTime, Carbon $endTime): int
    {
        $updated = 0;

        BioTimePunchLog::query()
            ->whereNotNull('employee_id')
            ->whereBetween('punch_time', [$startTime, $endTime])
            ->orderBy('punch_time')
            ->get()
            ->groupBy(fn (BioTimePunchLog $log): string => $log->employee_id.'|'.$log->punch_time->toDateString())
            ->each(function (Collection $logs) use (&$updated): void {
                $sortedLogs = $logs
                    ->sortBy(fn (BioTimePunchLog $log): int => $log->punch_time->getTimestamp())
                    ->values();

                /** @var BioTimePunchLog $first */
                $first = $sortedLogs->first();
                /** @var BioTimePunchLog $last */
                $last = $sortedLogs->last();

                $checkIn = $first->punch_time;
                $checkOut = $sortedLogs->count() > 1 ? $last->punch_time : null;
                $workMinutes = $checkOut ? max($checkIn->diffInMinutes($checkOut), 0) : null;

                AttendanceRecord::query()->updateOrCreate(
                    [
                        'employee_id' => $first->employee_id,
                        'date' => $checkIn->toDateString(),
                    ],
                    [
                        'check_in' => $checkIn->format('H:i:s'),
                        'check_out' => $checkOut?->format('H:i:s'),
                        'work_minutes' => $workMinutes,
                        'status' => $this->resolveAttendanceStatus($checkIn, $workMinutes),
                    ],
                );

                $updated++;
            });

        return $updated;
    }

    private function resolveAttendanceStatus(Carbon $checkIn, ?int $workMinutes): string
    {
        $settings = $this->resolveWorkHourSettings();

        if ($checkIn->format('H:i:s') < $settings['start_time']) {
            return 'Early';
        }

        if ($checkIn->format('H:i:s') === $settings['start_time']) {
            return 'Present';
        }

        return 'Late';
    }

    private function markMissingTodayAsAbsent(Carbon $startTime, Carbon $endTime): int
    {
        $today = now()->toDateString();

        if ($startTime->toDateString() > $today || $endTime->toDateString() < $today) {
            return 0;
        }

        $existingEmployeeIds = AttendanceRecord::query()
            ->whereDate('date', $today)
            ->pluck('employee_id')
            ->all();

        $missingEmployeeIds = Employee::query()
            ->where('status', 'Active')
            ->whereNotIn('id', $existingEmployeeIds)
            ->pluck('id');

        foreach ($missingEmployeeIds as $employeeId) {
            AttendanceRecord::query()->create([
                'employee_id' => $employeeId,
                'date' => $today,
                'check_in' => null,
                'check_out' => null,
                'work_minutes' => null,
                'status' => 'Absent',
            ]);
        }

        return $missingEmployeeIds->count();
    }

    /**
     * @return array{start_time: string, full_day_minutes: int}
     */
    private function resolveWorkHourSettings(): array
    {
        if ($this->workHourSettings !== null) {
            return $this->workHourSettings;
        }

        $settings = CompanySetting::query()->first();

        return $this->workHourSettings = [
            'start_time' => $this->normalizeWorkTime((string) ($settings?->work_start_time ?? '09:00:00')),
            'full_day_minutes' => max((int) ($settings?->work_full_day_minutes ?? 540), 1),
        ];
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

    private function resolveExternalId(array $transaction, string $empCode, Carbon $punchTime): string
    {
        if (! empty($transaction['id'])) {
            return 'biotime:'.(string) $transaction['id'];
        }

        return 'biotime:'.sha1(implode('|', [
            $empCode,
            $punchTime->toDateTimeString(),
            (string) ($transaction['terminal_sn'] ?? ''),
            Str::limit(json_encode($transaction) ?: '', 100, ''),
        ]));
    }
}
