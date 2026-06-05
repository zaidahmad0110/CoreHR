<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ResetEmployeeUserPasswordRequest;
use App\Http\Requests\Api\StoreEmployeeDocumentRequest;
use App\Http\Requests\Api\StoreEmployeeRequest;
use App\Http\Requests\Api\UpdateEmployeeAssetRequest;
use App\Http\Requests\Api\UpdateEmployeeDocumentRequest;
use App\Http\Requests\Api\UpdateEmployeeRequest;
use App\Http\Requests\Api\UpsertEmployeeTodayAttendanceRequest;
use App\Models\AttendanceRecord;
use App\Models\Branch;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeAsset;
use App\Models\EmployeeDocument;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Models\LoanRequest;
use App\Models\OnboardingTask;
use App\Models\OrganizationChartPosition;
use App\Models\PayrollItem;
use App\Models\PayrollPeriod;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class EmployeeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $managementContext = $this->resolveEmployeeManagementContext($request);

        $query = Employee::query()
            ->with('department')
            ->orderBy('name');

        if ($managementContext['scope'] === 'global') {
            // Global managers can see all employees.
        } elseif ($managementContext['scope'] === 'department') {
            $query->whereIn('department_id', $managementContext['department_ids']);
        } else {
            $activeEmployee = $this->resolveActiveEmployeeForUser($request->user());
            if ($activeEmployee?->department_id) {
                $query->where('department_id', (int) $activeEmployee->department_id);
            } else {
                $query->where('email', (string) $request->user()?->email);
            }
        }

        if ($search = $request->string('search')->toString()) {
            $query->where(function ($builder) use ($search): void {
                $builder->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('job_title', 'like', "%{$search}%");
            });
        }

        if ($department = $request->string('department')->toString()) {
            $query->whereHas('department', fn ($builder) => $builder->where('name', $department));
        }

        $employees = $query->get();
        $today = Carbon::today();
        $isHolidayToday = Holiday::query()
            ->whereDate('date', $today->toDateString())
            ->exists();
        $attendanceTodayEmployeeMap = AttendanceRecord::query()
            ->whereDate('date', $today->toDateString())
            ->pluck('employee_id')
            ->mapWithKeys(fn ($employeeId): array => [(int) $employeeId => true])
            ->all();
        $approvedLeaveEmployeeMap = LeaveRequest::query()
            ->where('status', 'Approved')
            ->whereDate('start_date', '<=', $today->toDateString())
            ->whereDate('end_date', '>=', $today->toDateString())
            ->pluck('employee_id')
            ->mapWithKeys(fn ($employeeId): array => [(int) $employeeId => true])
            ->all();
        $requestedStatus = trim($request->string('status')->toString());

        $serializedEmployees = $employees->map(fn (Employee $employee): array => [
            'id' => $employee->id,
            'name' => $employee->name,
            'email' => $employee->email,
            'job_title' => $employee->job_title,
            'manager_id' => $employee->manager_id ? (int) $employee->manager_id : null,
            'department' => $employee->department?->name ?? 'N/A',
            'status' => $this->resolveEmployeeDisplayStatus(
                $employee,
                $isHolidayToday,
                $approvedLeaveEmployeeMap,
                $attendanceTodayEmployeeMap,
            ),
            'is_new_hire' => (bool) $employee->is_new_hire,
            'join_date' => $employee->join_date?->format('M d, Y'),
        ]);

        if ($requestedStatus !== '') {
            $serializedEmployees = $serializedEmployees
                ->filter(
                    fn (array $serializedEmployee): bool => strcasecmp($serializedEmployee['status'], $requestedStatus) === 0
                )
                ->values();
        }

        return response()->json([
            'data' => $serializedEmployees->values(),
        ]);
    }

    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        $managementContext = $this->resolveEmployeeManagementContext($request);
        if ($managementContext['scope'] === 'none') {
            abort(403, 'You are not authorized to create employees.');
        }

        $payload = $request->validated();
        $departmentId = $this->resolveDepartmentId($payload['department'] ?? null);
        $manualManagerId = isset($payload['manager_id']) && is_numeric($payload['manager_id'])
            ? (int) $payload['manager_id']
            : null;
        $managerId = $this->resolveManagerIdForEmployee($payload['job_title'], $departmentId, $manualManagerId);

        if ($managementContext['scope'] === 'department') {
            if (! $departmentId) {
                return response()->json([
                    'message' => 'Department managers can only create employees in their managed department.',
                ], 422);
            }

            if (! in_array((int) $departmentId, $managementContext['department_ids'], true)) {
                abort(403, 'You are not authorized to create employees outside your department.');
            }
        }

        $employee = DB::transaction(function () use ($payload, $departmentId, $managerId): Employee {
            $employee = Employee::create([
                'employee_code' => $this->generateEmployeeCode(),
                'name' => $payload['name'],
                'email' => $payload['email'],
                'phone' => $payload['phone'] ?? null,
                'job_title' => $payload['job_title'],
                'department_id' => $departmentId,
                'manager_id' => $managerId,
                'branch_id' => $this->resolveBranchId($payload['branch'] ?? null),
                'location' => $payload['location'] ?? null,
                'join_date' => $payload['join_date'],
                'status' => $payload['status'],
                'is_new_hire' => false,
                'base_salary' => (float) ($payload['base_salary'] ?? 0),
                'allowances' => (float) ($payload['allowances'] ?? 0),
                'deductions' => (float) ($payload['deductions'] ?? 0),
            ]);

            if (($payload['create_user_account'] ?? false) === true) {
                User::query()->create([
                    'name' => $payload['name'],
                    'email' => $payload['email'],
                    'role' => $payload['user_role'],
                    'password' => $payload['user_password'],
                ]);
            }

            return $employee;
        });

        $this->enforceDepartmentManagerJobTitle($employee);
        $employee->load('department');

        return response()->json([
            'message' => 'Employee created successfully.',
            'data' => [
                'id' => $employee->id,
                'name' => $employee->name,
                'email' => $employee->email,
                'job_title' => $employee->job_title,
                'department' => $employee->department?->name ?? 'N/A',
                'status' => $this->resolveEmployeeDisplayStatus($employee),
                'is_new_hire' => (bool) $employee->is_new_hire,
                'join_date' => $employee->join_date?->format('M d, Y'),
            ],
        ], 201);
    }

    public function show(Request $request, Employee $employee): JsonResponse
    {
        $managementContext = $this->resolveEmployeeManagementContext($request);
        $activeEmployee = $this->resolveActiveEmployeeForUser($request->user());
        $this->enforceDepartmentManagerJobTitle($employee);
        $canViewFullProfile = $this->canAccessEmployeeByManagementContext($request, $employee, $managementContext);
        $canViewBasicProfile = $this->canViewEmployeeBasicProfile($employee, $activeEmployee);
        $displayStatus = $this->resolveEmployeeDisplayStatus($employee);
        $managerDisplay = $this->resolveManagerDisplayDetails($employee);

        if (! $canViewFullProfile && ! $canViewBasicProfile) {
            abort(403, 'You are not authorized to access this employee profile.');
        }

        $employee->load(['department', 'branch', 'manager']);

        if (! $canViewFullProfile) {
            return response()->json([
                'data' => [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'email' => $employee->email,
                    'phone' => $employee->phone,
                    'job_title' => $employee->job_title,
                    'department' => $employee->department?->name ?? 'N/A',
                    'branch' => $employee->branch?->name,
                    'manager' => $managerDisplay['name'],
                    'manager_role' => $managerDisplay['role'],
                    'manager_id' => $employee->manager_id ? (int) $employee->manager_id : null,
                    'location' => $employee->location,
                    'join_date' => $employee->join_date?->format('F d, Y'),
                    'employee_id' => $employee->employee_code,
                    'status' => $displayStatus,
                    'is_new_hire' => (bool) $employee->is_new_hire,
                    'base_salary' => null,
                    'allowances' => null,
                    'deductions' => null,
                    'attendance_history' => [],
                    'today_attendance' => null,
                    'leave_history' => [],
                    'documents' => [],
                    'assets' => [],
                ],
            ]);
        }

        $employee->load(['leaveRequests']);

        $attendanceHistory = $employee->attendanceRecords()
            ->latest('date')
            ->limit(30)
            ->get()
            ->map(fn (AttendanceRecord $record): array => $this->serializeAttendanceRecord($record));

        $leaveHistory = $employee->leaveRequests()
            ->latest('start_date')
            ->limit(20)
            ->get()
            ->map(fn ($leave): array => [
                'type' => $leave->type,
                'from' => $leave->start_date?->format('M d, Y'),
                'to' => $leave->end_date?->format('M d, Y'),
                'days' => $leave->days,
                'status' => $leave->status,
            ]);

        $documents = $employee->documents()
            ->latest('upload_date')
            ->get()
            ->map(fn (EmployeeDocument $document): array => $this->serializeDocument($document));

        $assets = $employee->assets()
            ->latest('assigned_date')
            ->get()
            ->map(fn (EmployeeAsset $asset): array => $this->serializeAsset($asset));

        $todayAttendance = $employee->attendanceRecords()
            ->whereDate('date', Carbon::today())
            ->first();

        return response()->json([
            'data' => [
                'id' => $employee->id,
                'name' => $employee->name,
                'email' => $employee->email,
                'phone' => $employee->phone,
                'job_title' => $employee->job_title,
                'department' => $employee->department?->name ?? 'N/A',
                'branch' => $employee->branch?->name,
                'manager' => $managerDisplay['name'],
                'manager_role' => $managerDisplay['role'],
                'manager_id' => $employee->manager_id ? (int) $employee->manager_id : null,
                'location' => $employee->location,
                'join_date' => $employee->join_date?->format('F d, Y'),
                'employee_id' => $employee->employee_code,
                'status' => $displayStatus,
                'is_new_hire' => (bool) $employee->is_new_hire,
                'base_salary' => (float) $employee->base_salary,
                'allowances' => (float) $employee->allowances,
                'deductions' => (float) $employee->deductions,
                'attendance_history' => $attendanceHistory,
                'today_attendance' => $todayAttendance ? $this->serializeAttendanceRecord($todayAttendance) : null,
                'leave_history' => $leaveHistory,
                'documents' => $documents,
                'assets' => $assets,
            ],
        ]);
    }

    public function update(UpdateEmployeeRequest $request, Employee $employee): JsonResponse
    {
        $managementContext = $this->resolveEmployeeManagementContext($request);
        $this->ensureEmployeeAccessPermission($request, $employee, $managementContext);
        $canEditExtendedFields = $managementContext['scope'] === 'global';
        $isSelfUpdate = $this->isSelfEmployeeRecord($request, $employee);

        $payload = $request->validated();
        $linkedUser = User::query()->where('email', $employee->email)->first();
        $targetDepartmentId = $this->resolveDepartmentId($payload['department'] ?? null);

        if ($linkedUser && $payload['email'] !== $employee->email) {
            $userEmailTaken = User::query()
                ->where('email', $payload['email'])
                ->where('id', '!=', $linkedUser->id)
                ->exists();

            if ($userEmailTaken) {
                return response()->json([
                    'message' => 'A user account with this email already exists.',
                ], 422);
            }
        }

        if ($canEditExtendedFields) {
            $manualManagerId = isset($payload['manager_id']) && is_numeric($payload['manager_id'])
                ? (int) $payload['manager_id']
                : null;
            $managerId = $this->resolveManagerIdForEmployee(
                $payload['job_title'],
                $targetDepartmentId,
                $manualManagerId,
                (int) $employee->id,
                $employee->manager_id ? (int) $employee->manager_id : null,
            );

            $employee->update([
                'name' => $payload['name'],
                'email' => $payload['email'],
                'phone' => $payload['phone'] ?? null,
                'job_title' => $payload['job_title'],
                'department_id' => $targetDepartmentId,
                'manager_id' => $managerId,
                'branch_id' => $this->resolveBranchId($payload['branch'] ?? null),
                'location' => $payload['location'] ?? null,
                'join_date' => $payload['join_date'],
                'status' => $payload['status'],
                'base_salary' => (float) ($payload['base_salary'] ?? 0),
                'allowances' => (float) ($payload['allowances'] ?? 0),
                'deductions' => (float) ($payload['deductions'] ?? 0),
            ]);
        } elseif ($isSelfUpdate) {
            $employee->update([
                'email' => $payload['email'],
                'phone' => $payload['phone'] ?? null,
                'location' => $payload['location'] ?? null,
            ]);
        } else {
            $employee->update([
                'name' => $payload['name'],
                'email' => $payload['email'],
                'phone' => $payload['phone'] ?? null,
                'location' => $payload['location'] ?? null,
            ]);
        }

        if ($linkedUser) {
            $linkedUserPayload = $isSelfUpdate && ! $canEditExtendedFields
                ? [
                    'email' => $payload['email'],
                ]
                : [
                    'name' => $payload['name'],
                    'email' => $payload['email'],
                ];

            $linkedUser->update($linkedUserPayload);
        }

        $this->enforceDepartmentManagerJobTitle($employee);
        $employee->load('department');

        return response()->json([
            'message' => 'Employee updated successfully.',
            'data' => [
                'id' => $employee->id,
                'name' => $employee->name,
                'email' => $employee->email,
                'job_title' => $employee->job_title,
                'department' => $employee->department?->name ?? 'N/A',
                'status' => $this->resolveEmployeeDisplayStatus($employee),
                'is_new_hire' => (bool) $employee->is_new_hire,
                'join_date' => $employee->join_date?->format('M d, Y'),
            ],
        ]);
    }

    public function storeDocument(StoreEmployeeDocumentRequest $request, Employee $employee): JsonResponse
    {
        $this->ensureProfileManagementPermission($request, $employee);
        $payload = $request->validated();

        $filePath = $request->hasFile('file')
            ? $request->file('file')->store('employee-documents', 'public')
            : null;

        $documentName = $payload['name'] ?? $request->file('file')?->getClientOriginalName();

        if (! $documentName) {
            return response()->json(['message' => 'Document name is required.'], 422);
        }

        $document = $employee->documents()->create([
            'name' => $documentName,
            'type' => $payload['type'] ?? strtoupper(pathinfo($documentName, PATHINFO_EXTENSION) ?: 'FILE'),
            'file_path' => $filePath,
            'upload_date' => $payload['upload_date'] ?? Carbon::today()->toDateString(),
        ]);

        return response()->json([
            'message' => 'Document uploaded successfully.',
            'data' => $this->serializeDocument($document),
        ], 201);
    }

    public function updateDocument(
        UpdateEmployeeDocumentRequest $request,
        Employee $employee,
        EmployeeDocument $document
    ): JsonResponse {
        $this->ensureProfileManagementPermission($request, $employee);

        if ((int) $document->employee_id !== (int) $employee->id) {
            abort(404);
        }

        $payload = $request->validated();
        $filePath = $document->file_path;

        if ($request->hasFile('file')) {
            if ($document->file_path) {
                Storage::disk('public')->delete($document->file_path);
            }

            $filePath = $request->file('file')->store('employee-documents', 'public');
        }

        $document->update([
            'name' => $payload['name'],
            'type' => $payload['type'],
            'upload_date' => $payload['upload_date'] ?? $document->upload_date?->toDateString(),
            'file_path' => $filePath,
        ]);

        return response()->json([
            'message' => 'Document updated successfully.',
            'data' => $this->serializeDocument($document),
        ]);
    }

    public function deleteDocument(Request $request, Employee $employee, EmployeeDocument $document): JsonResponse
    {
        $this->ensureProfileManagementPermission($request, $employee);

        if ((int) $document->employee_id !== (int) $employee->id) {
            abort(404);
        }

        if ($document->file_path) {
            Storage::disk('public')->delete($document->file_path);
        }

        $document->delete();

        return response()->json([
            'message' => 'Document deleted successfully.',
        ]);
    }

    public function storeAsset(UpdateEmployeeAssetRequest $request, Employee $employee): JsonResponse
    {
        $this->ensureProfileManagementPermission($request, $employee);
        $payload = $request->validated();

        $asset = $employee->assets()->create([
            'name' => $payload['name'],
            'serial_number' => $payload['serial_number'],
            'assigned_date' => $payload['assigned_date'] ?? Carbon::today()->toDateString(),
        ]);

        return response()->json([
            'message' => 'Asset added successfully.',
            'data' => $this->serializeAsset($asset),
        ], 201);
    }

    public function updateAsset(
        UpdateEmployeeAssetRequest $request,
        Employee $employee,
        EmployeeAsset $asset
    ): JsonResponse {
        $this->ensureProfileManagementPermission($request, $employee);

        if ((int) $asset->employee_id !== (int) $employee->id) {
            abort(404);
        }

        $payload = $request->validated();
        $asset->update([
            'name' => $payload['name'],
            'serial_number' => $payload['serial_number'],
            'assigned_date' => $payload['assigned_date'] ?? $asset->assigned_date?->toDateString(),
        ]);

        return response()->json([
            'message' => 'Asset updated successfully.',
            'data' => $this->serializeAsset($asset),
        ]);
    }

    public function deleteAsset(Request $request, Employee $employee, EmployeeAsset $asset): JsonResponse
    {
        $this->ensureProfileManagementPermission($request, $employee);

        if ((int) $asset->employee_id !== (int) $employee->id) {
            abort(404);
        }

        $asset->delete();

        return response()->json([
            'message' => 'Asset deleted successfully.',
        ]);
    }

    public function upsertTodayAttendance(
        UpsertEmployeeTodayAttendanceRequest $request,
        Employee $employee
    ): JsonResponse {
        $this->ensureAttendanceManagementPermission($request, $employee);
        $payload = $request->validated();

        $today = Carbon::today()->toDateString();
        $record = $employee->attendanceRecords()->firstOrNew(['date' => $today]);

        $checkIn = $payload['check_in'] ?? null;
        $checkOut = $payload['check_out'] ?? null;
        $workMinutes = null;

        if ($checkIn && $checkOut) {
            $checkInTime = Carbon::createFromFormat('H:i', $checkIn);
            $checkOutTime = Carbon::createFromFormat('H:i', $checkOut);

            if ($checkOutTime->greaterThan($checkInTime)) {
                $workMinutes = $checkOutTime->diffInMinutes($checkInTime);
            }
        }

        if ($payload['status'] === 'Absent') {
            $checkIn = null;
            $checkOut = null;
            $workMinutes = null;
        }

        $record->employee_id = $employee->id;
        $record->date = $today;
        $record->check_in = $checkIn ? $checkIn.':00' : null;
        $record->check_out = $checkOut ? $checkOut.':00' : null;
        $record->work_minutes = $workMinutes;
        $record->status = $payload['status'];
        $record->save();

        return response()->json([
            'message' => 'Today attendance updated successfully.',
            'data' => $this->serializeAttendanceRecord($record),
        ]);
    }

    public function deleteTodayAttendance(Request $request, Employee $employee): JsonResponse
    {
        $this->ensureAttendanceManagementPermission($request, $employee);

        $record = $employee->attendanceRecords()
            ->whereDate('date', Carbon::today())
            ->first();

        if (! $record) {
            return response()->json([
                'message' => 'No attendance record found for today.',
            ], 404);
        }

        $record->delete();

        return response()->json([
            'message' => 'Today attendance deleted successfully.',
        ]);
    }

    public function payslip(Request $request, Employee $employee): JsonResponse
    {
        $this->ensureEmployeeAccessPermission($request, $employee);

        $month = $request->string('month')->toString();
        $requestedMonth = null;
        $today = Carbon::today();
        $currentMonthStart = $today->copy()->startOfMonth();
        $allowCurrentMonthPayslip = $today->isLastOfMonth();

        if ($month !== '') {
            try {
                $requestedMonth = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
            } catch (\Throwable) {
                return response()->json([
                    'message' => 'Invalid month format. Use YYYY-MM.',
                ], 422);
            }

            if ($requestedMonth->equalTo($currentMonthStart) && ! $allowCurrentMonthPayslip) {
                return response()->json([
                    'message' => 'Current month payslip is not available yet.',
                ], 422);
            }

            $this->ensurePayrollItemFromAttendance($employee, $requestedMonth);
        }

        $buildPayslipQuery = function () use ($employee, $requestedMonth, $currentMonthStart, $allowCurrentMonthPayslip) {
            $query = PayrollItem::query()
                ->with('payrollPeriod')
                ->where('employee_id', $employee->id)
                ->whereHas('payrollPeriod');

            if ($requestedMonth) {
                $query->whereHas('payrollPeriod', function ($builder) use ($requestedMonth): void {
                    $builder->whereDate('month', $requestedMonth->toDateString());
                });
            } else {
                $query->whereHas('payrollPeriod', function ($builder) use ($currentMonthStart, $allowCurrentMonthPayslip): void {
                    if ($allowCurrentMonthPayslip) {
                        $builder->whereDate('month', '<=', $currentMonthStart->toDateString());

                        return;
                    }

                    $builder->whereDate('month', '<', $currentMonthStart->toDateString());
                });
            }

            return $query
                ->join('payroll_periods', 'payroll_periods.id', '=', 'payroll_items.payroll_period_id')
                ->orderByDesc('payroll_periods.month')
                ->select('payroll_items.*');
        };

        $item = $buildPayslipQuery()->first();

        if (! $item && ! $requestedMonth) {
            $latestAttendanceMonth = $this->resolveLatestAttendanceMonth($employee, ! $allowCurrentMonthPayslip);
            if ($latestAttendanceMonth) {
                $this->ensurePayrollItemFromAttendance($employee, $latestAttendanceMonth);
                $item = $buildPayslipQuery()->first();
            }
        }

        if (! $item) {
            return response()->json([
                'message' => 'No payslip found for this employee.',
            ], 404);
        }

        $item->load('payrollPeriod');

        return response()->json([
            'data' => [
                'employee' => [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'employee_id' => $employee->employee_code,
                    'department' => $employee->department?->name ?? 'N/A',
                    'job_title' => $employee->job_title,
                ],
                'payslip' => [
                    'month' => $item->payrollPeriod?->month?->format('F Y'),
                    'status' => $item->status,
                    'base_salary' => (float) $item->base_salary,
                    'allowances' => (float) $item->allowances,
                    'deductions' => (float) $item->deductions,
                    'net_salary' => (float) $item->net_salary,
                ],
            ],
        ]);
    }

    public function onboarding(Request $request, Employee $employee): JsonResponse
    {
        $this->ensureEmployeeAccessPermission($request, $employee);

        $tasks = $employee->onboardingTasks()
            ->get()
            ->map(fn (OnboardingTask $task): array => [
                'id' => $task->id,
                'title' => $task->title,
                'description' => $task->description,
                'is_completed' => (bool) $task->is_completed,
                'completed_at' => $task->completed_at?->toIso8601String(),
                'sort_order' => (int) $task->sort_order,
            ])
            ->values();

        return response()->json([
            'data' => [
                'employee_id' => $employee->id,
                'is_new_hire' => (bool) $employee->is_new_hire,
                'tasks' => $tasks,
                'summary' => [
                    'total' => $tasks->count(),
                    'completed' => $tasks->where('is_completed', true)->count(),
                ],
            ],
        ]);
    }

    public function updateOnboardingTask(
        Request $request,
        Employee $employee,
        OnboardingTask $onboardingTask
    ): JsonResponse {
        $this->ensureProfileManagementPermission($request, $employee);

        if ((int) $onboardingTask->employee_id !== (int) $employee->id) {
            abort(404);
        }

        $payload = $request->validate([
            'is_completed' => ['required', 'boolean'],
        ]);

        $isCompleted = (bool) $payload['is_completed'];

        $onboardingTask->update([
            'is_completed' => $isCompleted,
            'completed_at' => $isCompleted ? Carbon::now() : null,
        ]);

        return response()->json([
            'message' => 'Onboarding task updated successfully.',
            'data' => [
                'id' => $onboardingTask->id,
                'title' => $onboardingTask->title,
                'description' => $onboardingTask->description,
                'is_completed' => (bool) $onboardingTask->is_completed,
                'completed_at' => $onboardingTask->completed_at?->toIso8601String(),
                'sort_order' => (int) $onboardingTask->sort_order,
            ],
        ]);
    }

    private function resolveLatestAttendanceMonth(Employee $employee, bool $excludeCurrentMonth = false): ?Carbon
    {
        $query = $employee->attendanceRecords()->orderByDesc('date');
        if ($excludeCurrentMonth) {
            $query->whereDate('date', '<', Carbon::today()->startOfMonth()->toDateString());
        }

        $latestAttendanceDate = $query->value('date');

        if (! $latestAttendanceDate) {
            return null;
        }

        return Carbon::parse($latestAttendanceDate)->startOfMonth();
    }

    private function ensurePayrollItemFromAttendance(Employee $employee, Carbon $month): void
    {
        $monthStart = $month->copy()->startOfMonth();
        $monthEnd = $month->copy()->endOfMonth();

        $hasAttendanceInMonth = $employee->attendanceRecords()
            ->whereBetween('date', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->exists();

        if (! $hasAttendanceInMonth) {
            return;
        }

        $period = PayrollPeriod::query()->firstOrCreate(
            ['month' => $monthStart->toDateString()],
            [
                'total_amount' => 0,
                'workflow_status' => 'awaiting_hr_submission',
            ],
        );

        $attendanceDays = (int) $employee->attendanceRecords()
            ->whereBetween('date', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->where(function ($query): void {
                $query->whereNull('status')
                    ->orWhere('status', '!=', 'Absent');
            })
            ->count();

        $daysInMonth = max((int) $monthStart->daysInMonth, 1);
        $attendanceRatio = min(max($attendanceDays, 0) / $daysInMonth, 1);

        $fullBaseSalary = (float) ($employee->base_salary ?? 0);
        $fullAllowances = (float) ($employee->allowances ?? 0);
        $fullDeductions = (float) ($employee->deductions ?? 0);
        $activeLoanDeductions = $this->resolveActiveLoanMonthlyDeduction($employee);

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
                'status' => 'Pending HR Submission',
            ],
        );

        $period->total_amount = (float) $period->items()->sum('net_salary');
        $period->save();
    }

    private function resolveActiveLoanMonthlyDeduction(Employee $employee): float
    {
        return (float) LoanRequest::query()
            ->where('employee_id', $employee->id)
            ->where('status', 'Approved')
            ->whereColumn('paid_installments', '<', 'installments')
            ->sum('monthly_payment');
    }

    public function destroy(Request $request, Employee $employee): JsonResponse
    {
        $managementContext = $this->resolveEmployeeManagementContext($request);
        if ($managementContext['scope'] === 'none') {
            abort(403, 'You are not authorized to delete employees.');
        }

        $this->ensureEmployeeAccessPermission($request, $employee, $managementContext);

        $employeeName = $employee->name;
        $employee->delete();

        return response()->json([
            'message' => "Employee {$employeeName} deleted successfully.",
        ]);
    }

    public function resetUserPassword(
        ResetEmployeeUserPasswordRequest $request,
        Employee $employee
    ): JsonResponse {
        $managementContext = $this->resolveEmployeeManagementContext($request);
        $canManageEmployees = $managementContext['scope'] !== 'none';

        if ($canManageEmployees) {
            $this->ensureEmployeeAccessPermission($request, $employee, $managementContext);
        }

        if (! $canManageEmployees && ! $this->isSelfEmployeeRecord($request, $employee)) {
            abort(403, 'You are not authorized to reset this user password.');
        }

        $user = User::query()->where('email', $employee->email)->first();
        if (! $user) {
            return response()->json([
                'message' => 'No user account is linked to this employee.',
            ], 404);
        }

        $user->update([
            'password' => $request->string('password')->toString(),
        ]);

        return response()->json([
            'message' => 'User password reset successfully.',
        ]);
    }

    private function ensureProfileManagementPermission(Request $request, Employee $targetEmployee): void
    {
        if ($this->userCanManageProfileGlobally($request)) {
            return;
        }

        abort(403, 'You are not authorized to manage employee profile records.');
    }

    private function ensureAttendanceManagementPermission(Request $request, Employee $targetEmployee): void
    {
        if ($this->userCanManageProfileGlobally($request)) {
            return;
        }

        if ($this->isSelfEmployeeRecord($request, $targetEmployee)) {
            return;
        }

        $managementContext = $this->resolveEmployeeManagementContext($request);
        if (
            $managementContext['scope'] === 'department'
            && in_array((int) $targetEmployee->department_id, $managementContext['department_ids'], true)
        ) {
            return;
        }

        abort(403, 'You are not authorized to manage attendance for this employee.');
    }

    private function userCanManageProfileGlobally(Request $request): bool
    {
        $user = $request->user();
        if (! $user) {
            return false;
        }

        $activeEmployee = Employee::query()
            ->with('department')
            ->where('email', $user->email)
            ->first();

        return $this->isPowerEmployeeUser($user, $activeEmployee);
    }

    private function isSelfEmployeeRecord(Request $request, Employee $employee): bool
    {
        $userEmail = strtolower(trim((string) $request->user()?->email));
        $employeeEmail = strtolower(trim((string) $employee->email));

        return $userEmail !== '' && $userEmail === $employeeEmail;
    }

    private function ensureEmployeeAccessPermission(
        Request $request,
        Employee $employee,
        ?array $managementContext = null
    ): void {
        if ($this->canAccessEmployeeByManagementContext($request, $employee, $managementContext)) {
            return;
        }

        abort(403, 'You are not authorized to access this employee profile.');
    }

    private function canAccessEmployeeByManagementContext(
        Request $request,
        Employee $employee,
        ?array $managementContext = null
    ): bool {
        $managementContext ??= $this->resolveEmployeeManagementContext($request);

        if ($managementContext['scope'] === 'global') {
            return true;
        }

        if (
            $managementContext['scope'] === 'department'
            && in_array((int) $employee->department_id, $managementContext['department_ids'], true)
        ) {
            return true;
        }

        return $this->isSelfEmployeeRecord($request, $employee);
    }

    private function resolveEmployeeManagementContext(Request $request): array
    {
        if ($request->attributes->has('employee_management_context')) {
            /** @var array{scope:string,department_ids:int[]} $cached */
            $cached = $request->attributes->get('employee_management_context');
            return $cached;
        }

        $context = [
            'scope' => 'none',
            'department_ids' => [],
        ];

        $user = $request->user();
        if (! $user) {
            $request->attributes->set('employee_management_context', $context);
            return $context;
        }

        $activeEmployee = Employee::query()
            ->with('department')
            ->where('email', $user->email)
            ->first();

        if ($this->isPowerEmployeeUser($user, $activeEmployee)) {
            $context['scope'] = 'global';
            $request->attributes->set('employee_management_context', $context);
            return $context;
        }

        $request->attributes->set('employee_management_context', $context);

        return $context;
    }

    private function serializeDocument(EmployeeDocument $document): array
    {
        return [
            'id' => $document->id,
            'name' => $document->name,
            'type' => $document->type,
            'upload_date' => $document->upload_date?->format('M d, Y'),
            'file_url' => $document->file_path ? Storage::disk('public')->url($document->file_path) : null,
        ];
    }

    private function serializeAsset(EmployeeAsset $asset): array
    {
        return [
            'id' => $asset->id,
            'name' => $asset->name,
            'serial_number' => $asset->serial_number,
            'assigned_date' => $asset->assigned_date?->format('M d, Y'),
        ];
    }

    private function serializeAttendanceRecord(AttendanceRecord $record): array
    {
        return [
            'id' => $record->id,
            'date' => $record->date?->format('M d, Y'),
            'check_in' => $record->check_in ? $record->check_in->format('h:i A') : '-',
            'check_out' => $record->check_out ? $record->check_out->format('h:i A') : '-',
            'status' => $record->status,
            'work_hours' => $record->work_minutes ? round($record->work_minutes / 60, 1).'h' : '-',
        ];
    }

    private function resolveManagerDisplayDetails(Employee $employee): array
    {
        $normalizedJobTitle = strtolower(trim((string) $employee->job_title));

        $resolved = match ($normalizedJobTitle) {
            'coordinator' => $this->resolveManagerByRoleHierarchyWithRole(
                $employee,
                ['Supervisor', 'Manager', 'Department manager', 'CEO'],
            ),
            'supervisor' => $this->resolveManagerByRoleHierarchyWithRole(
                $employee,
                ['Manager', 'Department manager', 'CEO'],
            ),
            'manager' => $this->resolveManagerByRoleHierarchyWithRole(
                $employee,
                ['Department manager', 'CEO'],
            ),
            'department manager' => $this->resolveManagerByRoleHierarchyWithRole(
                $employee,
                ['CEO'],
            ),
            default => null,
        };

        if ($resolved !== null) {
            return $resolved;
        }

        if ($employee->manager && (int) $employee->manager->id !== (int) $employee->id) {
            return [
                'name' => (string) $employee->manager->name,
                'role' => (string) ($employee->manager->job_title ?: 'N/A'),
            ];
        }

        return [
            'name' => 'N/A',
            'role' => 'N/A',
        ];
    }

    private function resolveManagerByRoleHierarchyWithRole(Employee $employee, array $roleHierarchy): ?array
    {
        foreach ($roleHierarchy as $roleTitle) {
            $name = $this->resolveManagerNameForRole($employee, (string) $roleTitle);
            if ($name !== null && trim($name) !== '') {
                return [
                    'name' => $name,
                    'role' => (string) $roleTitle,
                ];
            }
        }

        return null;
    }

    private function resolveManagerNameForRole(Employee $employee, string $roleTitle): ?string
    {
        $normalizedRoleTitle = strtolower(trim($roleTitle));

        if ($normalizedRoleTitle === 'ceo') {
            $ceoName = $this->resolveCeoName();

            if ($ceoName === 'N/A') {
                return null;
            }

            return strcasecmp(trim($ceoName), trim((string) $employee->name)) === 0 ? null : $ceoName;
        }

        if ($normalizedRoleTitle === 'department manager') {
            return $this->resolveDepartmentManagerNameStrict($employee);
        }

        if (
            $employee->manager
            && (int) $employee->manager->id !== (int) $employee->id
            && strcasecmp((string) $employee->manager->job_title, $roleTitle) === 0
        ) {
            return (string) $employee->manager->name;
        }

        if ($employee->department_id) {
            $departmentScopedName = Employee::query()
                ->where('id', '!=', (int) $employee->id)
                ->where('department_id', (int) $employee->department_id)
                ->whereRaw('LOWER(job_title) = ?', [$normalizedRoleTitle])
                ->orderBy('id')
                ->value('name');

            if ($departmentScopedName) {
                return (string) $departmentScopedName;
            }

            // If the employee belongs to a department and no one matches this role
            // there, fall through to the next role in the hierarchy instead of
            // selecting the same role from another department.
            return null;
        }

        $globalRoleName = Employee::query()
            ->where('id', '!=', (int) $employee->id)
            ->whereRaw('LOWER(job_title) = ?', [$normalizedRoleTitle])
            ->orderBy('id')
            ->value('name');

        if ($globalRoleName) {
            return (string) $globalRoleName;
        }

        return null;
    }

    private function resolveDepartmentManagerNameStrict(Employee $employee): ?string
    {
        if (
            $employee->manager
            && (int) $employee->manager->id !== (int) $employee->id
            && strcasecmp((string) $employee->manager->job_title, 'Department manager') === 0
        ) {
            return (string) $employee->manager->name;
        }

        if ($employee->department_id) {
            $department = Department::query()
                ->with('managerUser')
                ->find((int) $employee->department_id);

            if ($department?->managerUser) {
                $managerName = Employee::query()
                    ->where('id', '!=', (int) $employee->id)
                    ->where('email', (string) $department->managerUser->email)
                    ->value('name');

                if ($managerName) {
                    return (string) $managerName;
                }

                return (string) $department->managerUser->name;
            }

            $departmentScopedManager = Employee::query()
                ->where('id', '!=', (int) $employee->id)
                ->where('department_id', (int) $employee->department_id)
                ->whereRaw('LOWER(job_title) = ?', ['department manager'])
                ->orderBy('id')
                ->value('name');

            if ($departmentScopedManager) {
                return (string) $departmentScopedManager;
            }
        }
        
        // No department manager available: caller should fall through to CEO directly.
        return null;
    }

    private function resolveCeoName(): string
    {
        $chartCeoName = OrganizationChartPosition::query()
            ->where('role_key', 'ceo')
            ->value('person_name');
        if ($chartCeoName) {
            return (string) $chartCeoName;
        }

        $employeeCeoName = Employee::query()
            ->whereRaw('LOWER(job_title) IN (?, ?)', ['ceo', 'chief executive officer'])
            ->orderBy('id')
            ->value('name');
        if ($employeeCeoName) {
            return (string) $employeeCeoName;
        }

        $userCeoName = User::query()
            ->whereRaw('LOWER(role) IN (?, ?)', ['ceo', 'admin'])
            ->orderBy('id')
            ->value('name');

        return $userCeoName ? (string) $userCeoName : 'N/A';
    }

    private function resolveEmployeeDisplayStatus(
        Employee $employee,
        ?bool $isHolidayToday = null,
        ?array $approvedLeaveEmployeeMap = null,
        ?array $attendanceTodayEmployeeMap = null,
    ): string {
        $today = Carbon::today();
        $hasAttendanceToday = $attendanceTodayEmployeeMap !== null
            ? (bool) ($attendanceTodayEmployeeMap[(int) $employee->id] ?? false)
            : AttendanceRecord::query()
                ->where('employee_id', $employee->id)
                ->whereDate('date', $today->toDateString())
                ->exists();

        if ($hasAttendanceToday) {
            return 'Active';
        }

        if (strcasecmp((string) $employee->status, 'Inactive') === 0) {
            return 'Inactive';
        }

        $holidayToday = $isHolidayToday ?? Holiday::query()
            ->whereDate('date', $today->toDateString())
            ->exists();

        $hasApprovedLeaveToday = $approvedLeaveEmployeeMap !== null
            ? (bool) ($approvedLeaveEmployeeMap[(int) $employee->id] ?? false)
            : LeaveRequest::query()
                ->where('employee_id', $employee->id)
                ->where('status', 'Approved')
                ->whereDate('start_date', '<=', $today->toDateString())
                ->whereDate('end_date', '>=', $today->toDateString())
                ->exists();

        return ($holidayToday || $hasApprovedLeaveToday) ? 'On Leave' : 'Active';
    }

    private function isPowerEmployeeUser(User $user, ?Employee $activeEmployee): bool
    {
        $role = strtolower(trim((string) $user->role));
        if (in_array($role, ['admin', 'hr', 'ceo'], true)) {
            return true;
        }

        $jobTitle = strtolower(trim((string) $activeEmployee?->job_title));
        if (in_array($jobTitle, ['ceo', 'chief executive officer'], true)) {
            return true;
        }

        $departmentName = strtolower(trim((string) $activeEmployee?->department?->name));

        return in_array($departmentName, ['human resources', 'hr'], true);
    }

    private function canViewEmployeeBasicProfile(Employee $targetEmployee, ?Employee $activeEmployee): bool
    {
        if (! $activeEmployee || ! $activeEmployee->department_id || ! $targetEmployee->department_id) {
            return false;
        }

        return (int) $activeEmployee->department_id === (int) $targetEmployee->department_id;
    }

    private function resolveActiveEmployeeForUser(?User $user): ?Employee
    {
        if (! $user) {
            return null;
        }

        return Employee::query()
            ->with('department')
            ->where('email', $user->email)
            ->first();
    }

    private function enforceDepartmentManagerJobTitle(Employee $employee): void
    {
        if (strcasecmp((string) $employee->job_title, 'Department manager') === 0) {
            return;
        }

        $linkedUser = User::query()
            ->whereRaw('LOWER(email) = ?', [strtolower((string) $employee->email)])
            ->first();

        if (! $linkedUser) {
            return;
        }

        $isDepartmentManager = Department::query()
            ->where('manager_user_id', $linkedUser->id)
            ->exists();

        if (! $isDepartmentManager) {
            return;
        }

        $employee->update([
            'job_title' => 'Department manager',
        ]);
    }

    private function resolveDepartmentId(?string $departmentName): ?int
    {
        if (! $departmentName) {
            return null;
        }

        return Department::query()->where('name', $departmentName)->value('id');
    }

    private function resolveBranchId(?string $branchName): ?int
    {
        if (! $branchName) {
            return null;
        }

        return Branch::query()->where('name', $branchName)->value('id');
    }

    private function resolveManagerIdForEmployee(
        string $jobTitle,
        ?int $departmentId,
        ?int $manualManagerId = null,
        ?int $excludeEmployeeId = null,
        ?int $currentManagerId = null
    ): ?int {
        $normalizedJobTitle = strtolower(trim($jobTitle));

        if ($normalizedJobTitle === 'coordinator') {
            if ($manualManagerId !== null) {
                $manualSupervisorId = Employee::query()
                    ->where('id', $manualManagerId)
                    ->whereRaw('LOWER(job_title) = ?', ['supervisor'])
                    ->when(
                        $excludeEmployeeId !== null,
                        fn ($query) => $query->where('id', '!=', $excludeEmployeeId),
                    )
                    ->value('id');

                if (! $manualSupervisorId) {
                    throw ValidationException::withMessages([
                        'manager_id' => 'Selected supervisor is invalid. Please select a valid Supervisor.',
                    ]);
                }

                return (int) $manualSupervisorId;
            }

            if ($currentManagerId !== null) {
                $currentSupervisorId = Employee::query()
                    ->where('id', $currentManagerId)
                    ->whereRaw('LOWER(job_title) = ?', ['supervisor'])
                    ->when(
                        $excludeEmployeeId !== null,
                        fn ($query) => $query->where('id', '!=', $excludeEmployeeId),
                    )
                    ->value('id');

                if ($currentSupervisorId) {
                    return (int) $currentSupervisorId;
                }
            }

            $baseSupervisorQuery = Employee::query()
                ->whereRaw('LOWER(job_title) = ?', ['supervisor'])
                ->when(
                    $excludeEmployeeId !== null,
                    fn ($query) => $query->where('id', '!=', $excludeEmployeeId),
                );

            $supervisorId = null;
            if ($departmentId) {
                $supervisorId = (clone $baseSupervisorQuery)
                    ->where('department_id', $departmentId)
                    ->orderBy('id')
                    ->value('id');
            }

            if (! $supervisorId) {
                $supervisorId = (clone $baseSupervisorQuery)
                    ->orderBy('id')
                    ->value('id');
            }

            if (! $supervisorId) {
                throw ValidationException::withMessages([
                    'job_title' => 'No Supervisor found. Please assign at least one Supervisor first.',
                ]);
            }

            return (int) $supervisorId;
        }

        return $currentManagerId;
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
