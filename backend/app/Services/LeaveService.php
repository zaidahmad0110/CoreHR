<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\Department;
use App\Models\Employee;
use App\Models\HrNotification;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class LeaveService
{
    public function __construct(
        private readonly DepartmentManagerScopeService $managerScopeService,
        private readonly MessagingService $messagingService,
    )
    {
    }

    public function listForUser(User $user): array
    {
        $employee = $this->resolveOrProvisionEmployeeForUser($user);
        $leaveTypes = $this->resolveConfiguredLeaveTypes();
        $this->ensureLeaveBalances($employee, $leaveTypes);

        $isGlobalApprover = $this->canViewAllRequests($user, $employee);
        $managedDepartmentIds = $this->managerScopeService->managedDepartmentIdsForUser($user);

        $requestsQuery = LeaveRequest::query()
            ->with('employee:id,name,manager_id,department_id,email')
            ->orderByDesc('created_at');

        if (! $isGlobalApprover) {
            $requestsQuery->where(function ($query) use ($employee, $managedDepartmentIds): void {
                $query->where('employee_id', $employee->id);

                if ($managedDepartmentIds !== []) {
                    $query->orWhereHas('employee', function ($employeeQuery) use ($managedDepartmentIds): void {
                        $employeeQuery->whereIn('department_id', $managedDepartmentIds);
                    });
                }
            });
        }

        $balance = LeaveBalance::query()
            ->where('employee_id', $employee->id)
            ->whereIn('type', $leaveTypes->pluck('name')->all())
            ->orderBy('type')
            ->get()
            ->map(fn (LeaveBalance $item): array => [
                'type' => $item->type,
                'total' => $item->total,
                'used' => $item->used,
                'remaining' => max($item->total - $item->used, 0),
            ])
            ->values();

        return [
            'requests' => $requestsQuery
                ->get()
                ->map(fn (LeaveRequest $request): array => [
                    'id' => $request->id,
                    'employee' => $request->employee?->name ?? 'Unknown',
                    'type' => $request->type,
                    'from' => $request->start_date?->format('M d, Y'),
                    'to' => $request->end_date?->format('M d, Y'),
                    'days' => $request->days,
                    'status' => $request->status,
                    'reason' => $request->reason,
                    'sick_leave_photo_available' => (bool) $request->sick_leave_photo_path,
                    'can_approve' => $this->canApproveRequest(
                        $user,
                        $employee,
                        $request,
                        $isGlobalApprover,
                        $managedDepartmentIds,
                    ),
                ])
                ->values(),
            'balance' => $balance,
            'leave_types' => $leaveTypes
                ->map(fn (LeaveType $type): array => [
                    'id' => (int) $type->id,
                    'name' => $type->name,
                    'days' => (int) $type->annual_days,
                ])
                ->values(),
        ];
    }

    public function createForUser(User $user, array $payload, ?UploadedFile $sickLeavePhoto = null): LeaveRequest
    {
        $employee = $this->resolveOrProvisionEmployeeForUser($user);
        $leaveTypes = $this->resolveConfiguredLeaveTypes();
        $this->ensureLeaveBalances($employee, $leaveTypes);

        if (! $leaveTypes->contains(fn (LeaveType $type): bool => $type->name === $payload['type'])) {
            throw ValidationException::withMessages([
                'type' => ['Selected leave type is invalid.'],
            ]);
        }

        $from = Carbon::parse($payload['from_date']);
        $to = Carbon::parse($payload['to_date']);
        $isSickLeave = str_contains(strtolower(trim((string) $payload['type'])), 'sick');
        $sickLeavePhotoPath = $isSickLeave && $sickLeavePhoto
            ? $sickLeavePhoto->store('sick-leave-photos', 'public')
            : null;

        $leaveRequest = LeaveRequest::create([
            'employee_id' => $employee->id,
            'type' => $payload['type'],
            'start_date' => $from->toDateString(),
            'end_date' => $to->toDateString(),
            'days' => $from->diffInDays($to) + 1,
            'status' => 'Pending',
            'reason' => $payload['reason'] ?? null,
            'sick_leave_photo_path' => $sickLeavePhotoPath,
        ]);

        $this->managerScopeService->notifyDepartmentManagers(
            $employee,
            (int) $user->id,
            'Leave request pending approval',
            sprintf(
                "Employee: %s\nRequest Type: %s\nPeriod: %s to %s\nDays: %d\nSick Leave Photo Attached: %s\n\nAction required: Please review this leave request.",
                $employee->name,
                $leaveRequest->type,
                $leaveRequest->start_date?->format('M d, Y') ?? '-',
                $leaveRequest->end_date?->format('M d, Y') ?? '-',
                (int) $leaveRequest->days,
                $sickLeavePhotoPath ? 'Yes' : 'No',
            ),
            'warning',
            'leave_request_notifications',
        );

        return $leaveRequest;
    }

    public function downloadSickLeavePhoto(User $user, LeaveRequest $leaveRequest): StreamedResponse
    {
        $employee = $this->resolveOrProvisionEmployeeForUser($user);
        $isGlobalApprover = $this->canViewAllRequests($user, $employee);
        $managedDepartmentIds = $this->managerScopeService->managedDepartmentIdsForUser($user);

        if (! $this->canViewRequest($employee, $leaveRequest, $isGlobalApprover, $managedDepartmentIds)) {
            abort(403, 'You are not authorized to view this sick leave photo.');
        }

        if (! $leaveRequest->sick_leave_photo_path) {
            abort(404, 'Sick leave photo is not available for this request.');
        }

        if (! Storage::disk('public')->exists($leaveRequest->sick_leave_photo_path)) {
            abort(404, 'Sick leave photo file not found.');
        }

        return Storage::disk('public')->download(
            $leaveRequest->sick_leave_photo_path,
            basename($leaveRequest->sick_leave_photo_path),
        );
    }

    public function updateStatus(User $user, LeaveRequest $leaveRequest, string $status): LeaveRequest
    {
        $employee = $this->resolveOrProvisionEmployeeForUser($user);
        $isGlobalApprover = $this->canViewAllRequests($user, $employee);
        $managedDepartmentIds = $this->managerScopeService->managedDepartmentIdsForUser($user);

        if (! $this->canApproveRequest($user, $employee, $leaveRequest, $isGlobalApprover, $managedDepartmentIds)) {
            throw new AuthorizationException('You are not authorized to update leave request status.');
        }

        $oldStatus = $leaveRequest->status;
        $leaveRequest->status = $status;
        $leaveRequest->save();

        if ($oldStatus !== 'Approved' && $status === 'Approved') {
            $balance = LeaveBalance::query()
                ->where('employee_id', $leaveRequest->employee_id)
                ->where('type', $leaveRequest->type)
                ->first();

            if ($balance) {
                $balance->used = min($balance->total, $balance->used + $leaveRequest->days);
                $balance->save();
            }
        }

        $leaveRequest->loadMissing('employee:id,name,email,phone');
        $requesterEmail = (string) ($leaveRequest->employee?->email ?? '');
        $requesterUser = $requesterEmail !== ''
            ? User::query()->where('email', $requesterEmail)->first()
            : null;

        $statusTitle = "Leave request {$status}";
        $statusBody = sprintf(
            "Dear %s,\n\nYour %s leave request has been %s.\n\nRequest Period: %s to %s\nTotal Days: %d\nReviewed By: %s\n\nFor questions, please contact your manager or HR.",
            $leaveRequest->employee?->name ?? 'Employee',
            $leaveRequest->type,
            strtolower($status),
            $leaveRequest->start_date?->format('M d, Y') ?? '-',
            $leaveRequest->end_date?->format('M d, Y') ?? '-',
            (int) $leaveRequest->days,
            $user->name,
        );

        if ($requesterUser) {
            HrNotification::query()->create([
                'user_id' => $requesterUser->id,
                'title' => $statusTitle,
                'body' => $statusBody,
                'type' => $status === 'Approved' ? 'success' : 'warning',
                'is_read' => false,
            ]);
        }

        $this->messagingService->sendPreferred(
            $requesterEmail !== '' ? $requesterEmail : null,
            $leaveRequest->employee?->phone,
            $statusTitle,
            $statusBody,
            ['email', 'sms'],
            [
                'scope' => 'leave',
                'leave_request_id' => $leaveRequest->id,
                'status' => $status,
            ],
        );

        return $leaveRequest;
    }

    private function resolveOrProvisionEmployeeForUser(User $user): Employee
    {
        $employee = Employee::query()
            ->with('department')
            ->where('email', $user->email)
            ->first();

        if ($employee) {
            return $employee;
        }

        $departmentId = null;
        if (
            strcasecmp((string) $user->role, 'Admin') === 0
            || strcasecmp((string) $user->role, 'HR') === 0
        ) {
            $departmentId = Department::query()
                ->where('name', 'Human Resources')
                ->value('id');
        }

        $branchId = Branch::query()->orderBy('id')->value('id');

        $employee = Employee::query()->create([
            'department_id' => $departmentId,
            'branch_id' => $branchId,
            'employee_code' => $this->generateEmployeeCode(),
            'name' => $user->name,
            'email' => $user->email,
            'job_title' => strcasecmp((string) $user->role, 'Admin') === 0 ? 'Administrator' : 'Employee',
            'join_date' => Carbon::today()->toDateString(),
            'status' => 'Active',
            'base_salary' => 0,
            'allowances' => 0,
            'deductions' => 0,
        ]);

        $this->ensureLeaveBalances($employee, $this->resolveConfiguredLeaveTypes());

        return $employee->load('department');
    }

    private function canViewAllRequests(User $user, Employee $employee): bool
    {
        return $this->managerScopeService->actorIsGlobalApprover($user, $employee);
    }

    private function canApproveRequest(
        User $user,
        Employee $actor,
        LeaveRequest $leaveRequest,
        bool $isGlobalApprover,
        array $managedDepartmentIds
    ): bool {
        $leaveRequest->loadMissing('employee:id,manager_id,department_id,email');

        if ((int) $leaveRequest->employee_id === (int) $actor->id) {
            return false;
        }

        if (
            strcasecmp((string) ($leaveRequest->employee?->email ?? ''), (string) $user->email) === 0
        ) {
            return false;
        }

        if ($isGlobalApprover) {
            return true;
        }

        return in_array((int) ($leaveRequest->employee?->department_id ?? 0), $managedDepartmentIds, true);
    }

    private function canViewRequest(
        Employee $actor,
        LeaveRequest $leaveRequest,
        bool $isGlobalApprover,
        array $managedDepartmentIds
    ): bool {
        $leaveRequest->loadMissing('employee:id,manager_id,department_id,email');

        if ((int) $leaveRequest->employee_id === (int) $actor->id) {
            return true;
        }

        if ($isGlobalApprover) {
            return true;
        }

        return in_array((int) ($leaveRequest->employee?->department_id ?? 0), $managedDepartmentIds, true);
    }

    private function ensureLeaveBalances(Employee $employee, Collection $leaveTypes): void
    {
        foreach ($leaveTypes as $leaveType) {
            $balance = LeaveBalance::query()->firstOrNew([
                'employee_id' => $employee->id,
                'type' => $leaveType->name,
            ]);

            $balance->total = (int) $leaveType->annual_days;
            $balance->used = min((int) ($balance->used ?? 0), (int) $leaveType->annual_days);
            $balance->save();
        }
    }

    private function resolveConfiguredLeaveTypes(): Collection
    {
        $leaveTypes = LeaveType::query()->orderBy('name')->get();
        if ($leaveTypes->isNotEmpty()) {
            return $leaveTypes;
        }

        $defaults = [
            ['name' => 'Annual Leave', 'annual_days' => 20, 'carry_over' => true],
            ['name' => 'Sick Leave', 'annual_days' => 10, 'carry_over' => false],
            ['name' => 'Personal Leave', 'annual_days' => 5, 'carry_over' => false],
        ];

        LeaveType::query()->insert(collect($defaults)->map(function (array $row): array {
            return [
                ...$row,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        })->all());

        return LeaveType::query()->orderBy('name')->get();
    }

    private function generateEmployeeCode(): string
    {
        do {
            $code = sprintf(
                'EMP-%s-%04d',
                Carbon::now()->format('Y'),
                random_int(1, 9999),
            );
        } while (Employee::query()->where('employee_code', $code)->exists());

        return $code;
    }
}
