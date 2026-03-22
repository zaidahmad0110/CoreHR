<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreLoanRequest;
use App\Http\Requests\Api\UpdateLoanRequestStatusRequest;
use App\Models\Department;
use App\Models\Employee;
use App\Models\HrNotification;
use App\Models\LoanRequest;
use App\Models\User;
use App\Services\DepartmentManagerScopeService;
use App\Services\MessagingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class LoanController extends Controller
{
    public function __construct(
        private readonly DepartmentManagerScopeService $managerScopeService,
        private readonly MessagingService $messagingService,
    )
    {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $employee = $this->resolveActorEmployee($request);
        $isGlobalApprover = ($user
            ? $this->managerScopeService->actorIsGlobalApprover($user, $employee)
            : false) || ($user ? $this->isFinanceDepartmentManager($user) : false);
        $managedDepartmentIds = $user
            ? $this->managerScopeService->managedDepartmentIdsForUser($user)
            : [];

        $query = LoanRequest::query()
            ->with('employee:id,name,email,manager_id,department_id')
            ->orderByDesc('request_date')
            ->orderByDesc('id');

        if (! $isGlobalApprover) {
            if (! $employee) {
                return response()->json([
                    'data' => [
                        'stats' => [
                            'total_loans' => 0,
                            'active_loans' => 0,
                            'pending_loans' => 0,
                        ],
                        'requests' => [],
                    ],
                ]);
            }

            $query->where(function ($builder) use ($employee, $managedDepartmentIds): void {
                $builder->where('employee_id', $employee->id)
                    ->orWhereHas('employee', function ($employeeQuery) use ($employee): void {
                        $employeeQuery->where('manager_id', $employee->id);
                    });

                if ($managedDepartmentIds !== []) {
                    $builder->orWhereHas('employee', function ($employeeQuery) use ($managedDepartmentIds): void {
                        $employeeQuery->whereIn('department_id', $managedDepartmentIds);
                    });
                }
            });
        }

        $requests = $query->get();

        return response()->json([
            'data' => [
                'stats' => [
                    'total_loans' => (float) $requests
                        ->where('status', 'Approved')
                        ->sum('amount'),
                    'active_loans' => $requests->where('status', 'Approved')->count(),
                    'pending_loans' => $requests->where('status', 'Pending')->count(),
                ],
                'requests' => $requests->map(function (LoanRequest $loan) use ($user, $employee, $isGlobalApprover, $managedDepartmentIds): array {
                    $ownedByActor = $user && strcasecmp((string) $loan->employee?->email, (string) $user->email) === 0;

                    return [
                        'id' => $loan->id,
                        'employee' => $loan->employee?->name ?? 'N/A',
                        'amount' => (float) $loan->amount,
                        'purpose' => $loan->purpose,
                        'request_date' => $loan->request_date?->format('M d, Y'),
                        'request_date_iso' => $loan->request_date?->format('Y-m-d'),
                        'status' => $loan->status,
                        'installments' => (int) $loan->installments,
                        'paid_installments' => (int) $loan->paid_installments,
                        'monthly_payment' => (float) $loan->monthly_payment,
                        'can_approve' => $loan->status === 'Pending'
                            && ! $ownedByActor
                            && $this->canApproveLoan(
                                $loan,
                                $user,
                                $employee,
                                $isGlobalApprover,
                                $managedDepartmentIds,
                            ),
                    ];
                })->values(),
            ],
        ]);
    }

    public function store(StoreLoanRequest $request): JsonResponse
    {
        $employee = $this->resolveActorEmployee($request);

        if (! $employee) {
            throw ValidationException::withMessages([
                'employee' => ['No employee profile is linked to this account.'],
            ]);
        }

        $payload = $request->validated();
        $installments = (int) $payload['installments'];
        $amount = (float) $payload['amount'];

        $loan = LoanRequest::query()->create([
            'employee_id' => $employee->id,
            'amount' => $amount,
            'purpose' => $payload['purpose'],
            'request_date' => $payload['request_date'] ?? Carbon::today()->toDateString(),
            'status' => 'Pending',
            'installments' => $installments,
            'paid_installments' => 0,
            'monthly_payment' => round($amount / max(1, $installments), 2),
        ]);

        $this->managerScopeService->notifyDepartmentManagers(
            $employee,
            (int) $request->user()->id,
            'Loan request pending approval',
            sprintf(
                "Employee: %s\nAmount: %.2f\nPurpose: %s\nInstallments: %d\n\nAction required: Please review this loan request.",
                $employee->name,
                $amount,
                $loan->purpose,
                (int) $loan->installments,
            ),
            'warning',
            'expense_approvals',
        );

        return response()->json([
            'message' => 'Loan request submitted successfully.',
            'data' => [
                'id' => $loan->id,
                'status' => $loan->status,
            ],
        ], 201);
    }

    public function updateStatus(
        UpdateLoanRequestStatusRequest $request,
        LoanRequest $loanRequest
    ): JsonResponse {
        $user = $request->user();
        $actorEmployee = $this->resolveActorEmployee($request);
        $isGlobalApprover = ($user
            ? $this->managerScopeService->actorIsGlobalApprover($user, $actorEmployee)
            : false) || ($user ? $this->isFinanceDepartmentManager($user) : false);
        $managedDepartmentIds = $user
            ? $this->managerScopeService->managedDepartmentIdsForUser($user)
            : [];

        if (! $this->canApproveLoan($loanRequest, $user, $actorEmployee, $isGlobalApprover, $managedDepartmentIds)) {
            abort(403, 'You are not authorized to approve loan requests.');
        }

        if ($this->isLoanOwnedByActor($loanRequest, $request->user()?->email)) {
            abort(403, 'You cannot approve or reject your own loan request.');
        }

        if ($loanRequest->status !== 'Pending') {
            throw ValidationException::withMessages([
                'status' => ['Only pending loan requests can be updated.'],
            ]);
        }

        $payload = $request->validated();
        $loanRequest->update([
            'status' => $payload['status'],
            'reviewed_by_user_id' => $request->user()?->id,
            'reviewed_at' => Carbon::now(),
        ]);

        $loanRequest->loadMissing('employee:id,name,email,phone');
        $requesterEmail = (string) ($loanRequest->employee?->email ?? '');
        $requesterUser = $requesterEmail !== ''
            ? User::query()->where('email', $requesterEmail)->first()
            : null;
        $status = (string) $loanRequest->status;

        $statusTitle = "Loan request {$status}";
        $statusBody = sprintf(
            "Dear %s,\n\nYour loan request has been %s.\n\nRequested Amount: %.2f\nPurpose: %s\nInstallments: %d\nReviewed By: %s\n\nFor any questions, please contact Finance or HR.",
            $loanRequest->employee?->name ?? 'Employee',
            strtolower($status),
            (float) $loanRequest->amount,
            $loanRequest->purpose,
            (int) $loanRequest->installments,
            $request->user()?->name ?? 'Approver',
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
            $loanRequest->employee?->phone,
            $statusTitle,
            $statusBody,
            ['email', 'sms'],
            [
                'scope' => 'loans',
                'loan_request_id' => $loanRequest->id,
                'status' => $status,
            ],
        );

        return response()->json([
            'message' => 'Loan request status updated successfully.',
            'data' => [
                'id' => $loanRequest->id,
                'status' => $loanRequest->status,
            ],
        ]);
    }

    private function resolveActorEmployee(Request $request): ?Employee
    {
        $user = $request->user();
        if (! $user) {
            return null;
        }

        return Employee::query()
            ->with('department')
            ->where('email', $user->email)
            ->first();
    }

    private function isLoanOwnedByActor(LoanRequest $loanRequest, ?string $actorEmail): bool
    {
        if (! $actorEmail) {
            return false;
        }

        $loanRequest->loadMissing('employee:id,email');

        return strcasecmp((string) $loanRequest->employee?->email, $actorEmail) === 0;
    }

    private function canApproveLoan(
        LoanRequest $loanRequest,
        ?User $user,
        ?Employee $actorEmployee,
        bool $isGlobalApprover,
        array $managedDepartmentIds
    ): bool {
        if (! $user) {
            return false;
        }

        $loanRequest->loadMissing('employee:id,email,manager_id,department_id');

        if (
            strcasecmp((string) ($loanRequest->employee?->email ?? ''), (string) $user->email) === 0
        ) {
            return false;
        }

        if ($isGlobalApprover) {
            return true;
        }

        if (
            $actorEmployee
            && (int) ($loanRequest->employee?->manager_id ?? 0) === (int) $actorEmployee->id
        ) {
            return true;
        }

        return in_array((int) ($loanRequest->employee?->department_id ?? 0), $managedDepartmentIds, true);
    }

    private function isFinanceDepartmentManager(User $user): bool
    {
        return Department::query()
            ->where('manager_user_id', $user->id)
            ->whereRaw('LOWER(name) = ?', ['finance'])
            ->exists();
    }
}
