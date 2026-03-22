<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Department;
use App\Models\Employee;
use App\Models\HrNotification;
use App\Models\LoanRequest;
use App\Models\PayrollItem;
use App\Models\PayrollPeriod;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class PayrollService
{
    public function __construct(private readonly MessagingService $messagingService)
    {
    }

    public function getData(?string $month, ?User $actor = null): array
    {
        $generationCutoffMonthStart = $this->resolvePayrollGenerationCutoffMonthStart();
        $requestedMonth = $this->parseRequestedMonth($month, $generationCutoffMonthStart);

        // Build payroll for all months strictly before the generation cutoff month.
        $this->ensurePayrollDataFromAttendance($generationCutoffMonthStart);

        if ($requestedMonth) {
            $this->ensurePayrollForMonth($requestedMonth, $generationCutoffMonthStart);
        }

        $periods = PayrollPeriod::query()
            ->withSum('items', 'net_salary')
            ->whereDate('month', '<', $generationCutoffMonthStart->toDateString())
            ->orderByDesc('month')
            ->get();

        $selectedPeriod = $this->resolveSelectedPeriod($periods, $requestedMonth);

        if (! $selectedPeriod) {
            return [
                'selected_month' => null,
                'selected_period_id' => null,
                'available_months' => [],
                'summary' => [
                    'total_payroll' => 0,
                    'total_allowances' => 0,
                    'total_deductions' => 0,
                ],
                'workflow' => null,
                'trend' => [],
                'employees' => [],
            ];
        }

        $selectedPeriod->load(['items.employee.department']);
        $items = $selectedPeriod->items;

        return [
            'selected_month' => $selectedPeriod->month?->format('Y-m'),
            'selected_period_id' => (int) $selectedPeriod->id,
            'available_months' => $periods->map(fn (PayrollPeriod $period): array => [
                'value' => $period->month?->format('Y-m'),
                'label' => $period->month?->format('F Y'),
            ])->values(),
            'summary' => [
                'total_payroll' => (float) $items->sum('net_salary'),
                'total_allowances' => (float) $items->sum('allowances'),
                'total_deductions' => (float) $items->sum('deductions'),
            ],
            'workflow' => [
                'status_key' => (string) ($selectedPeriod->workflow_status ?: 'awaiting_hr_submission'),
                'status_label' => $this->resolveWorkflowLabel((string) ($selectedPeriod->workflow_status ?: 'awaiting_hr_submission')),
                'hr_submitted_at' => $selectedPeriod->hr_submitted_at?->toIso8601String(),
                'finance_approved_at' => $selectedPeriod->finance_approved_at?->toIso8601String(),
                'can_submit_hr' => $actor ? $this->canSubmitHr($actor) : false,
                'can_approve_finance' => $actor ? $this->canApproveFinance($actor) : false,
            ],
            'trend' => $periods
                ->sortBy('month')
                ->values()
                ->map(fn (PayrollPeriod $period): array => [
                    'month' => Carbon::parse($period->month)->format('M'),
                    'amount' => (float) ($period->items_sum_net_salary ?? 0),
                ]),
            'employees' => $items->map(fn (PayrollItem $item): array => [
                'id' => (int) $item->employee_id,
                'employee' => $item->employee?->name ?? 'Unknown',
                'department' => $item->employee?->department?->name ?? 'N/A',
                'base_salary' => (float) $item->base_salary,
                'allowances' => (float) $item->allowances,
                'deductions' => (float) $item->deductions,
                'net_salary' => (float) $item->net_salary,
                'status' => (string) $item->status,
            ])->values(),
        ];
    }

    public function submitHr(User $actor, PayrollPeriod $period): PayrollPeriod
    {
        if (! $this->canSubmitHr($actor)) {
            throw new AuthorizationException('You are not authorized to submit payroll as HR.');
        }

        if ((string) $period->workflow_status !== 'awaiting_hr_submission') {
            throw ValidationException::withMessages([
                'workflow' => ['Payroll is not waiting for HR submission.'],
            ]);
        }

        $period->update([
            'workflow_status' => 'awaiting_finance_approval',
            'hr_submitted_by_user_id' => $actor->id,
            'hr_submitted_at' => now(),
        ]);

        $period->items()->update([
            'status' => 'Pending Finance Approval',
        ]);

        if (! $period->finance_notified_at) {
            $this->notifyFinanceTeamForApproval($period, $actor);
            $period->forceFill(['finance_notified_at' => now()])->save();
        }

        return $period->fresh() ?? $period;
    }

    public function approveFinance(User $actor, PayrollPeriod $period): PayrollPeriod
    {
        if (! $this->canApproveFinance($actor)) {
            throw new AuthorizationException('You are not authorized to approve payroll as finance.');
        }

        if ((string) $period->workflow_status !== 'awaiting_finance_approval') {
            throw ValidationException::withMessages([
                'workflow' => ['Payroll is not waiting for finance approval.'],
            ]);
        }

        $period->update([
            'workflow_status' => 'approved',
            'finance_approved_by_user_id' => $actor->id,
            'finance_approved_at' => now(),
        ]);

        $period->items()->update([
            'status' => 'Paid',
        ]);

        return $period->fresh() ?? $period;
    }

    private function parseRequestedMonth(?string $month, Carbon $generationCutoffMonthStart): ?Carbon
    {
        if (! $month) {
            return null;
        }

        try {
            $parsedMonth = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
        } catch (\Throwable) {
            return null;
        }

        if ($parsedMonth->greaterThanOrEqualTo($generationCutoffMonthStart)) {
            return null;
        }

        return $parsedMonth;
    }

    private function resolveSelectedPeriod(Collection $periods, ?Carbon $requestedMonth): ?PayrollPeriod
    {
        if ($periods->isEmpty()) {
            return null;
        }

        if (! $requestedMonth) {
            return $periods->first();
        }

        return $periods->first(function (PayrollPeriod $period) use ($requestedMonth): bool {
            return $period->month?->format('Y-m') === $requestedMonth->format('Y-m');
        }) ?? $periods->first();
    }

    private function ensurePayrollDataFromAttendance(Carbon $generationCutoffMonthStart): void
    {
        $attendanceMonths = AttendanceRecord::query()
            ->selectRaw('DATE_FORMAT(date, "%Y-%m-01") as month_start')
            ->whereDate('date', '<', $generationCutoffMonthStart->toDateString())
            ->distinct()
            ->pluck('month_start');

        foreach ($attendanceMonths as $monthStart) {
            $this->ensurePayrollForMonth(
                Carbon::parse((string) $monthStart)->startOfMonth(),
                $generationCutoffMonthStart,
            );
        }
    }

    private function ensurePayrollForMonth(Carbon $monthStart, Carbon $generationCutoffMonthStart): void
    {
        if ($monthStart->greaterThanOrEqualTo($generationCutoffMonthStart)) {
            return;
        }

        $monthEnd = $monthStart->copy()->endOfMonth();
        $daysInMonth = max((int) $monthStart->daysInMonth, 1);

        $attendanceDaysByEmployee = AttendanceRecord::query()
            ->selectRaw('employee_id, COUNT(*) as attendance_days')
            ->whereBetween('date', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->where(function ($query): void {
                $query->whereNull('status')
                    ->orWhere('status', '!=', 'Absent');
            })
            ->groupBy('employee_id')
            ->pluck('attendance_days', 'employee_id');

        if ($attendanceDaysByEmployee->isEmpty()) {
            return;
        }

        $period = PayrollPeriod::query()->firstOrCreate(
            ['month' => $monthStart->toDateString()],
            [
                'total_amount' => 0,
                'workflow_status' => 'awaiting_hr_submission',
            ],
        );

        $employees = Employee::query()
            ->whereIn('id', $attendanceDaysByEmployee->keys())
            ->get()
            ->keyBy('id');

        foreach ($attendanceDaysByEmployee as $employeeId => $attendanceDaysRaw) {
            /** @var Employee|null $employee */
            $employee = $employees->get((int) $employeeId);
            if (! $employee) {
                continue;
            }

            $attendanceDays = (int) $attendanceDaysRaw;
            $attendanceRatio = min(max($attendanceDays, 0) / $daysInMonth, 1);

            $fullBaseSalary = (float) ($employee->base_salary ?? 0);
            $fullAllowances = (float) ($employee->allowances ?? 0);
            $fullDeductions = (float) ($employee->deductions ?? 0);
            $activeLoanDeductions = $this->resolveActiveLoanMonthlyDeduction((int) $employee->id);

            $baseSalary = round($fullBaseSalary * $attendanceRatio, 2);
            $allowances = round($fullAllowances * $attendanceRatio, 2);
            $deductions = round(($fullDeductions * $attendanceRatio) + $activeLoanDeductions, 2);
            $netSalary = round($baseSalary + $allowances - $deductions, 2);

            PayrollItem::query()->updateOrCreate(
                [
                    'payroll_period_id' => $period->id,
                    'employee_id' => $employee->id,
                ],
                [
                    'base_salary' => $baseSalary,
                    'allowances' => $allowances,
                    'deductions' => $deductions,
                    'net_salary' => $netSalary,
                    'status' => (string) ($period->workflow_status === 'approved' ? 'Paid' : 'Pending HR Submission'),
                ],
            );
        }

        $period->total_amount = (float) $period->items()->sum('net_salary');

        if (! $period->workflow_status || (string) $period->workflow_status === '') {
            $period->workflow_status = 'awaiting_hr_submission';
        }

        $period->save();

        if ((string) $period->workflow_status === 'awaiting_hr_submission' && ! $period->hr_notified_at) {
            $this->notifyHrTeamForSubmission($period);
            $period->forceFill(['hr_notified_at' => now()])->save();
        }
    }

    private function resolveActiveLoanMonthlyDeduction(int $employeeId): float
    {
        return (float) LoanRequest::query()
            ->where('employee_id', $employeeId)
            ->where('status', 'Approved')
            ->whereColumn('paid_installments', '<', 'installments')
            ->sum('monthly_payment');
    }

    private function canSubmitHr(User $actor): bool
    {
        return $this->isHrUser($actor);
    }

    private function canApproveFinance(User $actor): bool
    {
        if ($this->isAdmin($actor)) {
            return true;
        }

        if (Department::query()
            ->where('manager_user_id', $actor->id)
            ->whereRaw('LOWER(name) = ?', ['finance'])
            ->exists()) {
            return true;
        }

        $employee = Employee::query()
            ->with('department')
            ->where('email', $actor->email)
            ->first();

        return strtolower(trim((string) $employee?->department?->name)) === 'finance';
    }

    private function isHrUser(User $actor): bool
    {
        if ($this->isAdmin($actor)) {
            return true;
        }

        if (strcasecmp((string) $actor->role, 'HR') === 0) {
            return true;
        }

        $employee = Employee::query()
            ->with('department')
            ->where('email', $actor->email)
            ->first();

        return in_array(
            strtolower(trim((string) $employee?->department?->name)),
            ['human resources', 'hr'],
            true,
        );
    }

    private function isAdmin(User $actor): bool
    {
        return strcasecmp((string) $actor->role, 'Admin') === 0;
    }

    private function resolvePayrollGenerationCutoffMonthStart(): Carbon
    {
        $today = Carbon::today();

        if ($today->isLastOfMonth()) {
            return $today->copy()->addMonthNoOverflow()->startOfMonth();
        }

        return $today->copy()->startOfMonth();
    }

    private function resolveWorkflowLabel(string $statusKey): string
    {
        return match ($statusKey) {
            'awaiting_finance_approval' => 'Awaiting Finance Approval',
            'approved' => 'Approved',
            default => 'Awaiting HR Submission',
        };
    }

    private function notifyHrTeamForSubmission(PayrollPeriod $period): void
    {
        $recipients = $this->resolveHrUsers();
        if ($recipients->isEmpty()) {
            return;
        }

        $title = sprintf('Payroll generated for %s', $period->month?->format('F Y') ?? 'selected month');
        $body = sprintf(
            "Payroll for %s has been generated.\n\nAction required: HR team should review and submit payroll for finance approval.",
            $period->month?->format('F Y') ?? 'the selected month',
        );

        $this->sendNotificationsAndMessages($recipients, $title, $body, 'warning', [
            'scope' => 'payroll_hr_submission',
            'payroll_period_id' => $period->id,
        ]);
    }

    private function notifyFinanceTeamForApproval(PayrollPeriod $period, User $submittedBy): void
    {
        $recipients = $this->resolveFinanceUsers();
        if ($recipients->isEmpty()) {
            return;
        }

        $title = sprintf('Payroll ready for finance approval - %s', $period->month?->format('F Y') ?? 'month');
        $body = sprintf(
            "HR has submitted payroll for %s.\n\nSubmitted by: %s\nAction required: Finance team must provide final approval.",
            $period->month?->format('F Y') ?? 'the selected month',
            $submittedBy->name,
        );

        $this->sendNotificationsAndMessages($recipients, $title, $body, 'warning', [
            'scope' => 'payroll_finance_approval',
            'payroll_period_id' => $period->id,
        ]);
    }

    private function resolveHrUsers(): Collection
    {
        $hrDepartmentEmails = Employee::query()
            ->whereHas('department', function ($query): void {
                $query->whereRaw('LOWER(name) IN (?, ?)', ['human resources', 'hr']);
            })
            ->pluck('email')
            ->filter(fn ($email): bool => trim((string) $email) !== '')
            ->values()
            ->all();

        $query = User::query()->whereIn('role', ['Admin', 'HR']);

        if ($hrDepartmentEmails !== []) {
            $query->orWhereIn('email', $hrDepartmentEmails);
        }

        return $query
            ->orderBy('id')
            ->get(['id', 'name', 'email'])
            ->unique('id')
            ->values();
    }

    private function resolveFinanceUsers(): Collection
    {
        $financeManagerIds = Department::query()
            ->whereRaw('LOWER(name) = ?', ['finance'])
            ->whereNotNull('manager_user_id')
            ->pluck('manager_user_id')
            ->all();

        $financeDepartmentEmails = Employee::query()
            ->whereHas('department', function ($query): void {
                $query->whereRaw('LOWER(name) = ?', ['finance']);
            })
            ->pluck('email')
            ->filter(fn ($email): bool => trim((string) $email) !== '')
            ->values()
            ->all();

        $query = User::query()->where('role', 'Admin');

        if ($financeManagerIds !== []) {
            $query->orWhereIn('id', $financeManagerIds);
        }

        if ($financeDepartmentEmails !== []) {
            $query->orWhereIn('email', $financeDepartmentEmails);
        }

        return $query
            ->orderBy('id')
            ->get(['id', 'name', 'email'])
            ->unique('id')
            ->values();
    }

    private function sendNotificationsAndMessages(
        Collection $users,
        string $title,
        string $body,
        string $type,
        array $messageContext
    ): void {
        if ($users->isEmpty()) {
            return;
        }

        $emails = $users
            ->pluck('email')
            ->filter(fn ($email): bool => trim((string) $email) !== '')
            ->map(fn ($email): string => strtolower(trim((string) $email)))
            ->all();

        $phonesByEmail = Employee::query()
            ->whereIn('email', $users->pluck('email')->all())
            ->pluck('phone', 'email')
            ->mapWithKeys(fn ($phone, $email): array => [strtolower(trim((string) $email)) => $phone])
            ->all();

        $now = now();
        $notificationRows = $users->map(fn (User $user): array => [
            'user_id' => $user->id,
            'title' => $title,
            'body' => $body,
            'type' => $type,
            'is_read' => false,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        if ($notificationRows !== []) {
            HrNotification::query()->insert($notificationRows);
        }

        foreach ($users as $user) {
            $email = strtolower(trim((string) $user->email));
            $phone = $phonesByEmail[$email] ?? null;

            $this->messagingService->sendPreferred(
                in_array($email, $emails, true) ? $user->email : null,
                is_string($phone) ? $phone : null,
                $title,
                $body,
                ['email', 'sms'],
                $messageContext + ['target_user_id' => $user->id],
            );
        }
    }
}
