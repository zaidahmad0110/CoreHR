<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\PayrollItem;
use App\Models\PayrollPeriod;
use App\Models\PerformanceReview;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class DashboardService
{
    public function getData(?User $actor): array
    {
        $today = Carbon::today();
        $yesterday = Carbon::yesterday();

        $actorEmployee = null;
        if ($actor) {
            $actorEmployee = Employee::query()
                ->with('department')
                ->where('email', $actor->email)
                ->first();
        }

        $context = $this->resolveDashboardContext($actor, $actorEmployee);

        $totalEmployees = $this->scopedEmployeesQuery($context)->count();
        $previousMonthEmployees = $this->scopedEmployeesQuery($context)
            ->whereDate('join_date', '<=', $today->copy()->subMonth()->endOfMonth()->toDateString())
            ->count();
        $employeeTrend = $this->percentageTrend((float) $totalEmployees, (float) $previousMonthEmployees);

        $todayAttendanceRate = $this->attendanceRateForDate($today, $context);
        $yesterdayAttendanceRate = $this->attendanceRateForDate($yesterday, $context);
        $attendanceTrend = $todayAttendanceRate - $yesterdayAttendanceRate;

        $pendingLeaveRequests = $this->scopedPendingLeaveCount($context, $actorEmployee);
        $previousPendingLeaveRequests = $this->scopedPendingLeaveCount(
            $context,
            $actorEmployee,
            $today->copy()->subWeek()->toDateString(),
        );
        $pendingLeaveTrend = $pendingLeaveRequests - $previousPendingLeaveRequests;

        $currentMonthStart = $today->copy()->startOfMonth();
        $payrollTotals = $this->calculateScopedPayrollTotals($context, $currentMonthStart);
        $payrollTrend = $this->percentageTrend($payrollTotals['latest'], $payrollTotals['previous']);
        $quickStats = $this->buildQuickStats($context, $today);

        return [
            'context' => [
                'mode' => $context['mode'],
            ],
            'kpis' => [
                'total_employees' => [
                    'value' => $totalEmployees,
                    'trend' => [
                        'value' => number_format(abs($employeeTrend), 1).'%',
                        'is_positive' => $employeeTrend >= 0,
                    ],
                ],
                'attendance_today' => [
                    'value' => number_format($todayAttendanceRate, 1).'%',
                    'trend' => [
                        'value' => number_format(abs($attendanceTrend), 1).'%',
                        'is_positive' => $attendanceTrend >= 0,
                    ],
                ],
                'pending_leave_requests' => [
                    'value' => $pendingLeaveRequests,
                    'trend' => [
                        'value' => (string) abs($pendingLeaveTrend),
                        'is_positive' => $pendingLeaveTrend <= 0,
                    ],
                ],
                'monthly_payroll' => [
                    'value' => $payrollTotals['latest'],
                    'trend' => [
                        'value' => number_format(abs($payrollTrend), 1).'%',
                        'is_positive' => $payrollTrend >= 0,
                    ],
                ],
            ],
            'attendance_overview' => $this->buildAttendanceOverview($context, $today),
            'employee_growth' => $this->buildEmployeeGrowth($context, $today),
            'pending_leaves' => $this->buildPendingLeaves($actor, $actorEmployee, $context),
            'upcoming_holidays' => Holiday::query()
                ->whereBetween('date', [$today->copy()->startOfMonth()->toDateString(), $today->copy()->endOfMonth()->toDateString()])
                ->whereDate('date', '>=', $today->toDateString())
                ->orderBy('date')
                ->limit(6)
                ->get()
                ->map(fn (Holiday $holiday): array => [
                    'id' => $holiday->id,
                    'name' => $holiday->name,
                    'date' => $holiday->date?->format('M d, Y'),
                ])
                ->values(),
            'quick_stats' => $quickStats,
        ];
    }

    private function resolveDashboardContext(?User $actor, ?Employee $actorEmployee): array
    {
        if (! $actor || ! $actorEmployee) {
            return [
                'mode' => 'self',
                'employee_ids' => [],
                'department_ids' => [],
            ];
        }

        $role = strtolower(trim((string) $actor->role));
        $jobTitle = strtolower(trim((string) $actorEmployee->job_title));

        if ($this->matchesRoleOrJobTitle($role, $jobTitle, ['ceo', 'chief executive officer'])) {
            return [
                'mode' => 'global',
                'employee_ids' => [],
                'department_ids' => [],
            ];
        }

        if ($this->matchesRoleOrJobTitle($role, $jobTitle, ['department manager'])) {
            $managedDepartmentIds = Department::query()
                ->where('manager_user_id', $actor->id)
                ->pluck('id')
                ->map(fn ($id): int => (int) $id)
                ->all();

            if ($managedDepartmentIds === [] && $actorEmployee->department_id) {
                $managedDepartmentIds = [(int) $actorEmployee->department_id];
            }

            if ($managedDepartmentIds === []) {
                return [
                    'mode' => 'department',
                    'employee_ids' => [],
                    'department_ids' => [],
                ];
            }

            $employeeIds = Employee::query()
                ->whereIn('department_id', $managedDepartmentIds)
                ->pluck('id')
                ->map(fn ($id): int => (int) $id)
                ->filter(fn (int $id): bool => $id !== (int) $actorEmployee->id)
                ->values()
                ->all();

            return [
                'mode' => 'department',
                'employee_ids' => $employeeIds,
                'department_ids' => $managedDepartmentIds,
            ];
        }

        if ($this->matchesRoleOrJobTitle($role, $jobTitle, ['manager'])) {
            $employeeIds = $this->resolveAllSubordinateEmployeeIds((int) $actorEmployee->id);

            return [
                'mode' => 'department',
                'employee_ids' => $employeeIds,
                'department_ids' => $this->resolveDepartmentIdsForEmployees($employeeIds),
            ];
        }

        if ($this->matchesRoleOrJobTitle($role, $jobTitle, ['supervisor'])) {
            $employeeIds = $this->resolveDirectReportEmployeeIds((int) $actorEmployee->id);

            return [
                'mode' => 'department',
                'employee_ids' => $employeeIds,
                'department_ids' => $this->resolveDepartmentIdsForEmployees($employeeIds),
            ];
        }

        if ($this->matchesRoleOrJobTitle($role, $jobTitle, ['coordinator', 'employee'])) {
            return [
                'mode' => 'self',
                'employee_ids' => [(int) $actorEmployee->id],
                'department_ids' => [$actorEmployee->department_id ? (int) $actorEmployee->department_id : 0],
            ];
        }

        return [
            'mode' => 'self',
            'employee_ids' => [(int) $actorEmployee->id],
            'department_ids' => [$actorEmployee->department_id ? (int) $actorEmployee->department_id : 0],
        ];
    }

    private function buildAttendanceOverview(array $context, Carbon $today): Collection
    {
        $start = $today->copy()->startOfMonth()->subMonths(5);

        return collect(range(0, 5))->map(function (int $offset) use ($start, $context): array {
            $month = $start->copy()->addMonths($offset);

            $records = $this->scopedAttendanceQuery($context)
                ->whereBetween('date', [$month->copy()->startOfMonth()->toDateString(), $month->copy()->endOfMonth()->toDateString()])
                ->get();

            return [
                'month' => $month->format('M'),
                'present' => $records->whereIn('status', ['Present', 'Early', 'Late', 'Overtime'])->count(),
                'absent' => $records->where('status', 'Absent')->count(),
            ];
        });
    }

    private function buildEmployeeGrowth(array $context, Carbon $today): Collection
    {
        $start = $today->copy()->startOfMonth()->subMonths(5);

        if ($context['mode'] === 'global') {
            return collect(range(0, 5))->map(function (int $offset) use ($start): array {
                $month = $start->copy()->addMonths($offset);

                return [
                    'month' => $month->format('M'),
                    'employees' => Employee::query()
                        ->whereDate('join_date', '<=', $month->copy()->endOfMonth()->toDateString())
                        ->count(),
                ];
            });
        }

        return collect(range(0, 5))->map(function (int $offset) use ($start, $context): array {
            $month = $start->copy()->addMonths($offset);

            $reviews = PerformanceReview::query()
                ->whereBetween('period_end', [$month->copy()->startOfMonth()->toDateString(), $month->copy()->endOfMonth()->toDateString()]);

            if ($context['employee_ids'] !== []) {
                $reviews->whereIn('employee_id', $context['employee_ids']);
            } else {
                $reviews->whereRaw('1 = 0');
            }

            $averageRating = (float) ($reviews->avg('rating') ?? 0);

            return [
                'month' => $month->format('M'),
                'employees' => round($averageRating, 2),
            ];
        });
    }

    private function buildPendingLeaves(?User $actor, ?Employee $actorEmployee, array $context): Collection
    {
        $query = LeaveRequest::query()
            ->with('employee')
            ->where('status', 'Pending')
            ->orderBy('start_date');

        if ($context['mode'] === 'self' && $actorEmployee) {
            $query->where('employee_id', $actorEmployee->id);
        }

        if ($context['mode'] === 'department' && $context['employee_ids'] !== []) {
            $query->whereIn('employee_id', $context['employee_ids']);
        }

        return $query
            ->limit(10)
            ->get()
            ->map(fn (LeaveRequest $request): array => [
                'id' => $request->id,
                'employee' => $request->employee?->name ?? 'Unknown',
                'type' => $request->type,
                'days' => $request->days,
                'date' => sprintf(
                    '%s - %s',
                    $request->start_date?->format('M d, Y'),
                    $request->end_date?->format('M d, Y'),
                ),
                'can_approve' => $this->canApproveLeaveRequest($context, $actorEmployee, $request),
            ])
            ->values();
    }

    private function canApproveLeaveRequest(array $context, ?Employee $actorEmployee, LeaveRequest $leaveRequest): bool
    {
        if (! $actorEmployee) {
            return false;
        }

        if ((int) $leaveRequest->employee_id === (int) $actorEmployee->id) {
            return false;
        }

        if ($context['mode'] === 'global') {
            return true;
        }

        if ($context['mode'] === 'department') {
            $leaveRequest->loadMissing('employee:id,department_id');

            return in_array((int) ($leaveRequest->employee?->department_id ?? 0), $context['department_ids'], true);
        }

        return false;
    }

    private function attendanceRateForDate(Carbon $date, array $context): float
    {
        $totalEmployees = $this->scopedEmployeesQuery($context)->count();

        if ($totalEmployees === 0) {
            return 0;
        }

        $attendingCount = $this->scopedAttendanceQuery($context)
            ->whereDate('date', $date->toDateString())
            ->whereIn('status', ['Present', 'Early', 'Late', 'Overtime'])
            ->count();

        return round(($attendingCount / $totalEmployees) * 100, 1);
    }

    private function calculateScopedPayrollTotals(array $context, Carbon $currentMonthStart): array
    {
        if ($context['mode'] === 'self') {
            if ($context['employee_ids'] === []) {
                return ['latest' => 0.0, 'previous' => 0.0];
            }

            $items = PayrollItem::query()
                ->join('payroll_periods', 'payroll_periods.id', '=', 'payroll_items.payroll_period_id')
                ->where('payroll_items.employee_id', $context['employee_ids'][0])
                ->whereDate('payroll_periods.month', '<', $currentMonthStart->toDateString())
                ->orderByDesc('payroll_periods.month')
                ->select(['payroll_items.net_salary'])
                ->limit(2)
                ->get();

            return [
                'latest' => (float) ($items->get(0)?->net_salary ?? 0),
                'previous' => (float) ($items->get(1)?->net_salary ?? 0),
            ];
        }

        $periods = PayrollPeriod::query()
            ->whereDate('month', '<', $currentMonthStart->toDateString())
            ->orderByDesc('month')
            ->limit(2)
            ->get();

        $latestAmount = $this->sumPayrollPeriodAmount($periods->get(0), $context);
        $previousAmount = $this->sumPayrollPeriodAmount($periods->get(1), $context);

        return [
            'latest' => $latestAmount,
            'previous' => $previousAmount,
        ];
    }

    private function sumPayrollPeriodAmount(?PayrollPeriod $period, array $context): float
    {
        if (! $period) {
            return 0.0;
        }

        $items = PayrollItem::query()->where('payroll_period_id', $period->id);

        if ($context['mode'] === 'department' && $context['employee_ids'] !== []) {
            $items->whereIn('employee_id', $context['employee_ids']);
        }

        return (float) $items->sum('net_salary');
    }

    private function scopedEmployeesQuery(array $context)
    {
        $query = Employee::query();

        if (in_array($context['mode'], ['department', 'self'], true)) {
            if ($context['employee_ids'] === []) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereIn('id', $context['employee_ids']);
            }
        }

        return $query;
    }

    private function scopedAttendanceQuery(array $context)
    {
        $query = AttendanceRecord::query();

        if (in_array($context['mode'], ['department', 'self'], true)) {
            if ($context['employee_ids'] === []) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereIn('employee_id', $context['employee_ids']);
            }
        }

        return $query;
    }

    private function scopedLeaveQuery(array $context)
    {
        $query = LeaveRequest::query();

        if (in_array($context['mode'], ['department', 'self'], true)) {
            if ($context['employee_ids'] === []) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereIn('employee_id', $context['employee_ids']);
            }
        }

        return $query;
    }

    private function scopedPendingLeaveCount(array $context, ?Employee $actorEmployee, ?string $createdBefore = null): int
    {
        $query = LeaveRequest::query()->where('status', 'Pending');

        if ($createdBefore !== null) {
            $query->whereDate('created_at', '<=', $createdBefore);
        }

        if ($context['mode'] === 'self' && $actorEmployee) {
            $query->where('employee_id', $actorEmployee->id);
        }

        if ($context['mode'] === 'department') {
            if ($context['employee_ids'] === []) {
                return 0;
            }

            $query->whereIn('employee_id', $context['employee_ids']);
        }

        return $query->count();
    }

    private function buildQuickStats(array $context, Carbon $today): array
    {
        $presentToday = $this->scopedAttendanceQuery($context)
            ->whereDate('date', $today->toDateString())
            ->whereIn('status', ['Present', 'Early', 'Late', 'Overtime'])
            ->count();

        $isHolidayToday = Holiday::query()
            ->whereDate('date', $today->toDateString())
            ->exists();

        if ($isHolidayToday) {
            $totalEmployees = $this->scopedEmployeesQuery($context)->count();
            $attendanceEmployeeCount = $this->scopedAttendanceQuery($context)
                ->whereDate('date', $today->toDateString())
                ->distinct()
                ->count('employee_id');

            return [
                'present_today' => $presentToday,
                'on_leave_today' => max($totalEmployees - $attendanceEmployeeCount, 0),
            ];
        }

        $onLeaveToday = $this->scopedLeaveQuery($context)
            ->where('status', 'Approved')
            ->whereDate('start_date', '<=', $today->toDateString())
            ->whereDate('end_date', '>=', $today->toDateString())
            ->count();

        return [
            'present_today' => $presentToday,
            'on_leave_today' => $onLeaveToday,
        ];
    }

    private function matchesRoleOrJobTitle(string $role, string $jobTitle, array $terms): bool
    {
        foreach ($terms as $term) {
            $needle = strtolower(trim($term));
            if ($needle === '') {
                continue;
            }

            if (str_contains($role, $needle) || str_contains($jobTitle, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return int[]
     */
    private function resolveDirectReportEmployeeIds(int $managerEmployeeId): array
    {
        return Employee::query()
            ->where('manager_id', $managerEmployeeId)
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->values()
            ->all();
    }

    /**
     * @return int[]
     */
    private function resolveAllSubordinateEmployeeIds(int $managerEmployeeId): array
    {
        $all = [];
        $frontier = [$managerEmployeeId];

        while ($frontier !== []) {
            $next = Employee::query()
                ->whereIn('manager_id', $frontier)
                ->pluck('id')
                ->map(fn ($id): int => (int) $id)
                ->all();

            $newIds = array_values(array_diff($next, $all));
            if ($newIds === []) {
                break;
            }

            $all = array_values(array_unique(array_merge($all, $newIds)));
            $frontier = $newIds;
        }

        return $all;
    }

    /**
     * @param  int[]  $employeeIds
     * @return int[]
     */
    private function resolveDepartmentIdsForEmployees(array $employeeIds): array
    {
        if ($employeeIds === []) {
            return [];
        }

        return Employee::query()
            ->whereIn('id', $employeeIds)
            ->whereNotNull('department_id')
            ->pluck('department_id')
            ->map(fn ($id): int => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    private function percentageTrend(float $current, float $previous): float
    {
        if ($previous <= 0) {
            return $current > 0 ? 100 : 0;
        }

        return (($current - $previous) / $previous) * 100;
    }
}
