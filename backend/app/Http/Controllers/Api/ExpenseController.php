<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreExpenseClaimRequest;
use App\Http\Requests\Api\UpdateExpenseClaimStatusRequest;
use App\Models\Department;
use App\Models\Employee;
use App\Models\ExpenseClaim;
use App\Models\HrNotification;
use App\Models\User;
use App\Services\DepartmentManagerScopeService;
use App\Services\MessagingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExpenseController extends Controller
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

        $query = ExpenseClaim::query()
            ->with('employee:id,name,email,manager_id,department_id')
            ->orderByDesc('expense_date')
            ->orderByDesc('id');

        if (! $isGlobalApprover) {
            if (! $employee) {
                return response()->json([
                    'data' => [
                        'stats' => [
                            'total_amount' => 0,
                            'pending_count' => 0,
                            'approved_count' => 0,
                        ],
                        'claims' => [],
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

        $claims = $query->get();

        return response()->json([
            'data' => [
                'stats' => [
                    'total_amount' => (float) $claims->sum('amount'),
                    'pending_count' => $claims->where('status', 'Pending')->count(),
                    'approved_count' => $claims->where('status', 'Approved')->count(),
                ],
                'claims' => $claims->map(function (ExpenseClaim $claim) use ($user, $employee, $isGlobalApprover, $managedDepartmentIds): array {
                    $ownedByActor = $user && strcasecmp((string) $claim->employee?->email, (string) $user->email) === 0;

                    return [
                        'id' => $claim->id,
                        'employee' => $claim->employee?->name ?? 'N/A',
                        'category' => $claim->category,
                        'amount' => (float) $claim->amount,
                        'date' => $claim->expense_date?->format('M d, Y'),
                        'date_iso' => $claim->expense_date?->format('Y-m-d'),
                        'description' => $claim->description,
                        'status' => $claim->status,
                        'rejection_note' => $claim->rejection_note,
                        'receipt_available' => (bool) $claim->receipt_path,
                        'can_approve' => $claim->status === 'Pending'
                            && ! $ownedByActor
                            && $this->canApproveClaim(
                                $claim,
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

    public function store(StoreExpenseClaimRequest $request): JsonResponse
    {
        $employee = $this->resolveActorEmployee($request);

        if (! $employee) {
            throw ValidationException::withMessages([
                'employee' => ['No employee profile is linked to this account.'],
            ]);
        }

        $payload = $request->validated();

        $receiptPath = $request->hasFile('receipt')
            ? $request->file('receipt')->store('expense-receipts', 'public')
            : null;

        $claim = ExpenseClaim::query()->create([
            'employee_id' => $employee->id,
            'category' => $payload['category'],
            'amount' => (float) $payload['amount'],
            'expense_date' => $payload['expense_date'],
            'description' => $payload['description'],
            'status' => 'Pending',
            'receipt_path' => $receiptPath,
        ]);

        $submitTitle = 'Expense claim submitted';
        $submitBody = sprintf(
            "Dear %s,\n\nYour expense claim has been submitted and is pending approval.\n\nCategory: %s\nAmount: %.2f\nDate: %s\nReceipt Attached: %s\n\nYou will be notified after it is reviewed.",
            $employee->name,
            $claim->category,
            (float) $claim->amount,
            $claim->expense_date?->format('M d, Y') ?? '-',
            $receiptPath ? 'Yes' : 'No',
        );

        $this->messagingService->send(
            'email',
            $employee->email,
            null,
            $submitTitle,
            $submitBody,
            [
                'scope' => 'expense_submission',
                'expense_claim_id' => $claim->id,
                'employee_id' => $employee->id,
            ],
        );

        $this->managerScopeService->notifyDepartmentManagers(
            $employee,
            (int) $request->user()->id,
            'Expense claim pending approval',
            sprintf(
                "Employee: %s\nCategory: %s\nAmount: %.2f\nDate: %s\nReceipt Attached: %s\n\nAction required: Please review this expense claim.",
                $employee->name,
                $claim->category,
                (float) $claim->amount,
                $claim->expense_date?->format('M d, Y') ?? '-',
                $receiptPath ? 'Yes' : 'No',
            ),
            'warning',
            'expense_approvals',
            ['email'],
        );

        return response()->json([
            'message' => 'Expense claim submitted successfully.',
            'data' => [
                'id' => $claim->id,
                'status' => $claim->status,
            ],
        ], 201);
    }

    public function updateStatus(
        UpdateExpenseClaimStatusRequest $request,
        ExpenseClaim $expenseClaim
    ): JsonResponse {
        $user = $request->user();
        $actorEmployee = $this->resolveActorEmployee($request);
        $isGlobalApprover = ($user
            ? $this->managerScopeService->actorIsGlobalApprover($user, $actorEmployee)
            : false) || ($user ? $this->isFinanceDepartmentManager($user) : false);
        $managedDepartmentIds = $user
            ? $this->managerScopeService->managedDepartmentIdsForUser($user)
            : [];

        if (! $this->canApproveClaim($expenseClaim, $user, $actorEmployee, $isGlobalApprover, $managedDepartmentIds)) {
            abort(403, 'You are not authorized to approve expense claims.');
        }

        if ($this->isClaimOwnedByActor($expenseClaim, $request->user()?->email)) {
            abort(403, 'You cannot approve or reject your own expense claim.');
        }

        if ($expenseClaim->status !== 'Pending') {
            throw ValidationException::withMessages([
                'status' => ['Only pending expense claims can be updated.'],
            ]);
        }

        $payload = $request->validated();
        $status = (string) $payload['status'];
        $rejectionNote = $status === 'Rejected'
            ? trim((string) ($payload['rejection_note'] ?? ''))
            : null;

        $expenseClaim->update([
            'status' => $status,
            'rejection_note' => $rejectionNote !== '' ? $rejectionNote : null,
            'reviewed_by_user_id' => $request->user()?->id,
            'reviewed_at' => Carbon::now(),
        ]);

        $expenseClaim->loadMissing('employee:id,name,email,phone');
        $requesterEmail = (string) ($expenseClaim->employee?->email ?? '');
        $requesterUser = $requesterEmail !== ''
            ? User::query()->where('email', $requesterEmail)->first()
            : null;
        $statusTitle = "Expense claim {$status}";
        $statusBody = $status === 'Rejected'
            ? sprintf(
                "Dear %s,\n\nYour expense claim has been rejected.\n\nCategory: %s\nAmount: %.2f\nSubmitted Date: %s\nReviewed By: %s\nRejection Note: %s\n\nIf you need clarification, please contact Finance or HR.",
                $expenseClaim->employee?->name ?? 'Employee',
                $expenseClaim->category,
                (float) $expenseClaim->amount,
                $expenseClaim->expense_date?->format('M d, Y') ?? '-',
                $request->user()?->name ?? 'Approver',
                $expenseClaim->rejection_note ?: '-',
            )
            : sprintf(
                "Dear %s,\n\nYour expense claim has been approved.\n\nCategory: %s\nAmount: %.2f\nSubmitted Date: %s\nReviewed By: %s\n\nIf you need clarification, please contact Finance or HR.",
                $expenseClaim->employee?->name ?? 'Employee',
                $expenseClaim->category,
                (float) $expenseClaim->amount,
                $expenseClaim->expense_date?->format('M d, Y') ?? '-',
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
            $expenseClaim->employee?->phone,
            $statusTitle,
            $statusBody,
            ['email', 'sms'],
            [
                'scope' => 'expenses',
                'expense_claim_id' => $expenseClaim->id,
                'status' => $status,
            ],
        );

        return response()->json([
            'message' => 'Expense claim status updated successfully.',
            'data' => [
                'id' => $expenseClaim->id,
                'status' => $expenseClaim->status,
            ],
        ]);
    }

    public function viewReceipt(Request $request, ExpenseClaim $expenseClaim): StreamedResponse
    {
        $user = $request->user();
        $actorEmployee = $this->resolveActorEmployee($request);
        $isGlobalApprover = ($user
            ? $this->managerScopeService->actorIsGlobalApprover($user, $actorEmployee)
            : false) || ($user ? $this->isFinanceDepartmentManager($user) : false);
        $managedDepartmentIds = $user
            ? $this->managerScopeService->managedDepartmentIdsForUser($user)
            : [];

        $canAccess = $this->canViewClaim(
            $expenseClaim,
            $user,
            $actorEmployee,
            $isGlobalApprover,
            $managedDepartmentIds,
        );

        if (! $canAccess) {
            abort(403, 'You are not authorized to view this receipt.');
        }

        if (! $expenseClaim->receipt_path) {
            abort(404, 'Receipt is not available for this claim.');
        }

        if (! Storage::disk('public')->exists($expenseClaim->receipt_path)) {
            abort(404, 'Receipt file not found.');
        }

        return Storage::disk('public')->download(
            $expenseClaim->receipt_path,
            basename($expenseClaim->receipt_path),
        );
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

    private function isClaimOwnedByActor(ExpenseClaim $expenseClaim, ?string $actorEmail): bool
    {
        if (! $actorEmail) {
            return false;
        }

        $expenseClaim->loadMissing('employee:id,email');

        return strcasecmp((string) $expenseClaim->employee?->email, $actorEmail) === 0;
    }

    private function canViewClaim(
        ExpenseClaim $expenseClaim,
        ?User $user,
        ?Employee $actorEmployee,
        bool $isGlobalApprover,
        array $managedDepartmentIds
    ): bool {
        if (! $user) {
            return false;
        }

        $expenseClaim->loadMissing('employee:id,email,manager_id,department_id');

        if (
            strcasecmp((string) ($expenseClaim->employee?->email ?? ''), (string) $user->email) === 0
        ) {
            return true;
        }

        if ($isGlobalApprover) {
            return true;
        }

        if (
            $actorEmployee
            && (int) ($expenseClaim->employee?->manager_id ?? 0) === (int) $actorEmployee->id
        ) {
            return true;
        }

        return in_array((int) ($expenseClaim->employee?->department_id ?? 0), $managedDepartmentIds, true);
    }

    private function canApproveClaim(
        ExpenseClaim $expenseClaim,
        ?User $user,
        ?Employee $actorEmployee,
        bool $isGlobalApprover,
        array $managedDepartmentIds
    ): bool {
        if (! $this->canViewClaim($expenseClaim, $user, $actorEmployee, $isGlobalApprover, $managedDepartmentIds)) {
            return false;
        }

        if ($this->isClaimOwnedByActor($expenseClaim, $user?->email)) {
            return false;
        }

        return $expenseClaim->status === 'Pending';
    }

    private function isFinanceDepartmentManager(User $user): bool
    {
        return Department::query()
            ->where('manager_user_id', $user->id)
            ->whereRaw('LOWER(name) = ?', ['finance'])
            ->exists();
    }
}
