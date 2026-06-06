<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Employee;
use App\Models\PayrollPeriod;
use App\Services\PayrollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PayrollController extends Controller
{
    public function __construct(private readonly PayrollService $payrollService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        if (! $this->canAccessPayroll($request)) {
            return response()->json([
                'message' => 'You are not authorized to access payroll.',
            ], Response::HTTP_FORBIDDEN);
        }

        return response()->json([
            'data' => $this->payrollService->getData($request->string('month')->toString() ?: null, $request->user()),
        ]);
    }

    public function submitHr(Request $request, PayrollPeriod $payrollPeriod): JsonResponse
    {
        if (! $this->canAccessPayroll($request)) {
            return response()->json([
                'message' => 'You are not authorized to access payroll.',
            ], Response::HTTP_FORBIDDEN);
        }

        $updated = $this->payrollService->submitHr($request->user(), $payrollPeriod);

        return response()->json([
            'message' => 'Payroll submitted by HR and sent to finance team.',
            'data' => [
                'id' => $updated->id,
                'workflow_status' => $updated->workflow_status,
            ],
        ]);
    }

    public function approveFinance(Request $request, PayrollPeriod $payrollPeriod): JsonResponse
    {
        if (! $this->canAccessPayroll($request)) {
            return response()->json([
                'message' => 'You are not authorized to access payroll.',
            ], Response::HTTP_FORBIDDEN);
        }

        $updated = $this->payrollService->approveFinance($request->user(), $payrollPeriod);

        return response()->json([
            'message' => 'Payroll approved by finance successfully.',
            'data' => [
                'id' => $updated->id,
                'workflow_status' => $updated->workflow_status,
            ],
        ]);
    }

    private function canAccessPayroll(Request $request): bool
    {
        $user = $request->user();

        if (! $user) {
            return false;
        }

        if (in_array(strtolower(trim((string) $user->role)), ['admin', 'ceo', 'gm', 'general manager'], true)) {
            return true;
        }

        if (strcasecmp((string) $user->role, 'HR') === 0) {
            return true;
        }

        $employee = Employee::query()
            ->with('department')
            ->where('email', $user->email)
            ->first();

        $departmentName = strtolower(trim((string) $employee?->department?->name));
        $jobTitle = strtolower(trim((string) $employee?->job_title));
        if (in_array($jobTitle, ['ceo', 'chief executive officer', 'gm', 'general manager'], true)) {
            return true;
        }

        $isHr = in_array($departmentName, ['human resources', 'hr'], true);
        if ($isHr) {
            return true;
        }

        if ($departmentName === 'finance') {
            return true;
        }

        return Department::query()
            ->where('manager_user_id', $user->id)
            ->whereRaw('LOWER(name) = ?', ['finance'])
            ->exists();
    }
}
