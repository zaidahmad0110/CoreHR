<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UpdateOrganizationChartRequest;
use App\Http\Requests\Api\UpsertBranchRequest;
use App\Http\Requests\Api\UpsertDepartmentRequest;
use App\Models\Branch;
use App\Models\Department;
use App\Models\Employee;
use App\Models\OrganizationChartPosition;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OrganizationController extends Controller
{
    private const DEFAULT_ORGANIZATION_CHART = [
        [
            'role_key' => 'ceo',
            'role_title' => 'Chief Executive Officer',
            'person_name' => 'John Doe',
            'department' => null,
            'sort_order' => 1,
        ],
        [
            'role_key' => 'cto',
            'role_title' => 'CTO',
            'person_name' => 'David Martinez',
            'department' => 'Engineering',
            'sort_order' => 2,
        ],
        [
            'role_key' => 'cpo',
            'role_title' => 'CPO',
            'person_name' => 'Michael Chen',
            'department' => 'Product',
            'sort_order' => 3,
        ],
        [
            'role_key' => 'cfo',
            'role_title' => 'CFO',
            'person_name' => 'Robert Taylor',
            'department' => 'Finance',
            'sort_order' => 4,
        ],
    ];

    public function organizationChart(): JsonResponse
    {
        $positions = $this->getOrganizationChartPositions();

        $ceo = $positions->firstWhere('role_key', 'ceo');
        $executives = $positions
            ->filter(fn (OrganizationChartPosition $position): bool => $position->role_key !== 'ceo')
            ->values();

        return response()->json([
            'data' => [
                'ceo' => $ceo ? $this->serializeOrganizationChartPosition($ceo) : null,
                'executives' => $executives
                    ->map(fn (OrganizationChartPosition $position): array => $this->serializeOrganizationChartPosition($position))
                    ->all(),
            ],
        ]);
    }

    public function departments(): JsonResponse
    {
        $departments = Department::query()
            ->with('managerUser:id,name,email')
            ->withCount('employees')
            ->orderBy('name')
            ->get()
            ->map(fn (Department $department): array => [
                'id' => $department->id,
                'name' => $department->name,
                'employees' => $department->employees_count,
                'manager' => $department->managerUser?->name ?? $department->manager_name ?? 'N/A',
                'manager_user_id' => $department->manager_user_id,
            ]);

        return response()->json(['data' => $departments]);
    }

    public function branches(): JsonResponse
    {
        $branches = Branch::query()
            ->with('managerUser:id,name,email')
            ->withCount('employees')
            ->orderBy('name')
            ->get()
            ->map(fn (Branch $branch): array => [
                'id' => $branch->id,
                'name' => $branch->name,
                'location' => $branch->location,
                'manager' => $branch->managerUser?->name ?? $branch->manager_name ?? 'N/A',
                'manager_user_id' => $branch->manager_user_id,
                'employees' => $branch->employees_count,
            ]);

        return response()->json(['data' => $branches]);
    }

    public function storeDepartment(UpsertDepartmentRequest $request): JsonResponse
    {
        $this->ensureStructureManagementPermission($request);
        $managerData = $this->resolveManagerData(
            $request->string('manager_name')->toString(),
            $request->input('manager_user_id'),
        );

        $department = Department::query()->create([
            'name' => $request->string('name')->toString(),
            'manager_name' => $managerData['manager_name'],
            'manager_user_id' => $managerData['manager_user_id'],
        ]);
        $this->syncDepartmentManagerJobTitle($managerData);

        return response()->json([
            'message' => 'Department created successfully.',
            'data' => [
                'id' => $department->id,
            ],
        ], 201);
    }

    public function updateDepartment(UpsertDepartmentRequest $request, Department $department): JsonResponse
    {
        $this->ensureStructureManagementPermission($request);
        $managerData = $this->resolveManagerData(
            $request->string('manager_name')->toString(),
            $request->input('manager_user_id'),
        );

        $department->update([
            'name' => $request->string('name')->toString(),
            'manager_name' => $managerData['manager_name'],
            'manager_user_id' => $managerData['manager_user_id'],
        ]);
        $this->syncDepartmentManagerJobTitle($managerData);

        return response()->json([
            'message' => 'Department updated successfully.',
            'data' => [
                'id' => $department->id,
            ],
        ]);
    }

    public function destroyDepartment(Request $request, Department $department): JsonResponse
    {
        $this->ensureStructureManagementPermission($request);

        $department->delete();

        return response()->json([
            'message' => 'Department deleted successfully.',
        ]);
    }

    public function storeBranch(UpsertBranchRequest $request): JsonResponse
    {
        $this->ensureStructureManagementPermission($request);
        $managerData = $this->resolveManagerData(
            $request->string('manager_name')->toString(),
            $request->input('manager_user_id'),
        );

        $branch = Branch::query()->create([
            'name' => $request->string('name')->toString(),
            'location' => $request->string('location')->toString(),
            'manager_name' => $managerData['manager_name'],
            'manager_user_id' => $managerData['manager_user_id'],
        ]);

        return response()->json([
            'message' => 'Branch created successfully.',
            'data' => [
                'id' => $branch->id,
            ],
        ], 201);
    }

    public function updateBranch(UpsertBranchRequest $request, Branch $branch): JsonResponse
    {
        $this->ensureStructureManagementPermission($request);
        $managerData = $this->resolveManagerData(
            $request->string('manager_name')->toString(),
            $request->input('manager_user_id'),
        );

        $branch->update([
            'name' => $request->string('name')->toString(),
            'location' => $request->string('location')->toString(),
            'manager_name' => $managerData['manager_name'],
            'manager_user_id' => $managerData['manager_user_id'],
        ]);

        return response()->json([
            'message' => 'Branch updated successfully.',
            'data' => [
                'id' => $branch->id,
            ],
        ]);
    }

    public function destroyBranch(Request $request, Branch $branch): JsonResponse
    {
        $this->ensureStructureManagementPermission($request);

        $branch->delete();

        return response()->json([
            'message' => 'Branch deleted successfully.',
        ]);
    }

    public function updateOrganizationChart(UpdateOrganizationChartRequest $request): JsonResponse
    {
        $this->ensureStructureManagementPermission($request);
        $this->ensureDefaultOrganizationChartPositions();

        $positions = collect($request->validated('positions'))->values();
        $recordsById = OrganizationChartPosition::query()
            ->get()
            ->keyBy('id');

        $keptPositionIds = [];

        foreach ($positions as $index => $payload) {
            $positionId = isset($payload['id']) ? (int) $payload['id'] : null;

            $upsertPayload = [
                'role_title' => trim((string) $payload['role_title']),
                'person_name' => trim((string) $payload['person_name']),
                'department' => $this->normalizeNullableString($payload['department'] ?? null),
                'sort_order' => $index + 1,
            ];

            if ($positionId && $recordsById->has($positionId)) {
                /** @var OrganizationChartPosition $record */
                $record = $recordsById->get($positionId);
                $record->update($upsertPayload);
                $keptPositionIds[] = (int) $record->id;
                continue;
            }

            $record = OrganizationChartPosition::query()->create([
                'role_key' => $this->generateOrganizationChartRoleKey(),
                ...$upsertPayload,
            ]);

            $keptPositionIds[] = (int) $record->id;
        }

        if ($keptPositionIds !== []) {
            OrganizationChartPosition::query()
                ->whereNotIn('id', $keptPositionIds)
                ->where('role_key', '!=', 'ceo')
                ->delete();
        }

        return response()->json([
            'message' => 'Organization chart updated successfully.',
        ]);
    }

    private function ensureStructureManagementPermission(Request $request): void
    {
        if (! $this->userCanManageStructure($request)) {
            abort(403, 'You are not authorized to edit company structure.');
        }
    }

    private function userCanManageStructure(Request $request): bool
    {
        $user = $request->user();

        if (! $user) {
            return false;
        }

        if (strcasecmp((string) $user->role, 'Admin') === 0) {
            return true;
        }

        $employee = \App\Models\Employee::query()
            ->with('department')
            ->where('email', $user->email)
            ->first();

        $departmentName = strtolower(trim((string) $employee?->department?->name));
        if (! in_array($departmentName, ['human resources', 'hr'], true)) {
            return false;
        }

        $jobTitle = strtolower((string) $employee?->job_title);
        $managerKeywords = [
            'manager',
            'director',
            'head',
            'chief',
            'vice president',
            'vp',
            'president',
        ];

        foreach ($managerKeywords as $keyword) {
            if (str_contains($jobTitle, $keyword)) {
                return true;
            }
        }

        return false;
    }

    private function getOrganizationChartPositions()
    {
        $this->ensureDefaultOrganizationChartPositions();

        return OrganizationChartPosition::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
    }

    private function ensureDefaultOrganizationChartPositions(): void
    {
        if (OrganizationChartPosition::query()->exists()) {
            return;
        }

        foreach (self::DEFAULT_ORGANIZATION_CHART as $position) {
            OrganizationChartPosition::query()->firstOrCreate(
                ['role_key' => $position['role_key']],
                [
                    'role_title' => $position['role_title'],
                    'person_name' => $position['person_name'],
                    'department' => $position['department'],
                    'sort_order' => $position['sort_order'],
                ],
            );
        }
    }

    private function serializeOrganizationChartPosition(OrganizationChartPosition $position): array
    {
        return [
            'id' => $position->id,
            'role_key' => $position->role_key,
            'role_title' => $position->role_title,
            'person_name' => $position->person_name,
            'department' => $position->department,
        ];
    }

    private function resolveManagerData(string $managerNameInput, mixed $managerUserIdInput): array
    {
        $managerName = trim($managerNameInput);
        $managerUserId = is_numeric($managerUserIdInput) ? (int) $managerUserIdInput : null;

        if ($managerUserId) {
            $user = User::query()->find($managerUserId);
            if ($user) {
                return [
                    'manager_name' => $user->name,
                    'manager_user_id' => $user->id,
                ];
            }
        }

        if ($managerName === '') {
            return [
                'manager_name' => null,
                'manager_user_id' => null,
            ];
        }

        $employee = Employee::query()
            ->where('name', $managerName)
            ->orWhere('email', $managerName)
            ->first();

        if ($employee) {
            $user = User::query()->where('email', $employee->email)->first();

            return [
                'manager_name' => $employee->name,
                'manager_user_id' => $user?->id,
            ];
        }

        $user = User::query()
            ->where('name', $managerName)
            ->orWhere('email', $managerName)
            ->first();

        return [
            'manager_name' => $user?->name ?? $managerName,
            'manager_user_id' => $user?->id,
        ];
    }

    private function generateOrganizationChartRoleKey(): string
    {
        do {
            $roleKey = 'custom_'.str_replace('-', '', Str::uuid()->toString());
        } while (OrganizationChartPosition::query()->where('role_key', $roleKey)->exists());

        return $roleKey;
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));

        return $normalized === '' ? null : $normalized;
    }

    private function syncDepartmentManagerJobTitle(array $managerData): void
    {
        $managerUserId = isset($managerData['manager_user_id']) && is_numeric($managerData['manager_user_id'])
            ? (int) $managerData['manager_user_id']
            : null;
        $managerName = trim((string) ($managerData['manager_name'] ?? ''));

        $employee = null;

        if ($managerUserId) {
            $user = User::query()->find($managerUserId);
            if ($user) {
                $employee = Employee::query()
                    ->whereRaw('LOWER(email) = ?', [strtolower((string) $user->email)])
                    ->first();
            }
        }

        if (! $employee && $managerName !== '') {
            $employee = Employee::query()
                ->whereRaw('LOWER(name) = ?', [strtolower($managerName)])
                ->orWhereRaw('LOWER(email) = ?', [strtolower($managerName)])
                ->first();
        }

        if (! $employee) {
            return;
        }

        if (strcasecmp((string) $employee->job_title, 'Department manager') !== 0) {
            $employee->update([
                'job_title' => 'Department manager',
            ]);
        }
    }
}
