<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\User;
use App\Models\UserPermissionOverride;
use App\Models\Department;

class UserPrivilegeService
{
    public const TERM_ACCEPTED = 'accepted';
    public const TERM_REJECTED = 'rejected';

    public const ALL_PERMISSIONS = [
        'dashboard',
        'employees',
        'attendance',
        'leave',
        'payroll',
        'recruitment',
        'performance',
        'training',
        'training_materials',
        'assets',
        'expenses',
        'loans',
        'company_structure',
        'settings',
    ];

    public function resolveForUser(User $user): array
    {
        $defaults = $this->getRoleDefaults($user);

        $override = UserPermissionOverride::query()
            ->where('user_id', $user->id)
            ->first();

        $overridePermissions = is_array($override?->permissions) ? $override->permissions : [];
        $overrideTerms = $this->sanitizeTerms(is_array($override?->terms) ? $override->terms : []);

        foreach (self::ALL_PERMISSIONS as $permissionKey) {
            if (array_key_exists($permissionKey, $overridePermissions)) {
                $defaults[$permissionKey] = (bool) $overridePermissions[$permissionKey];
            }
        }

        if ($this->isDepartmentManager($user)) {
            // Department managers must be able to manage their department workflows.
            $defaults['employees'] = true;
            $defaults['attendance'] = true;
            $defaults['leave'] = true;
            $defaults['expenses'] = true;
            $defaults['loans'] = true;
            $defaults['performance'] = true;
            $defaults['training'] = true;
        }

        if ($this->isFinanceDepartmentManager($user)) {
            // Finance department managers need full finance module access.
            $defaults['payroll'] = true;
            $defaults['expenses'] = true;
            $defaults['loans'] = true;
        }

        foreach (self::ALL_PERMISSIONS as $permissionKey) {
            if (($overrideTerms[$permissionKey] ?? self::TERM_ACCEPTED) === self::TERM_REJECTED) {
                $defaults[$permissionKey] = false;
            }
        }

        return $defaults;
    }

    public function resolveTermsForUser(User $user): array
    {
        $defaults = $this->allTermsAccepted();

        $override = UserPermissionOverride::query()
            ->where('user_id', $user->id)
            ->first();
        $overrideTerms = $this->sanitizeTerms(is_array($override?->terms) ? $override->terms : []);

        foreach (self::ALL_PERMISSIONS as $permissionKey) {
            if (array_key_exists($permissionKey, $overrideTerms)) {
                $defaults[$permissionKey] = $overrideTerms[$permissionKey];
            }
        }

        return $defaults;
    }

    public function listUsersWithPrivileges(): array
    {
        $users = User::query()
            ->orderBy('name')
            ->get();

        return $users->map(function (User $user): array {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'permissions' => $this->resolveForUser($user),
                'terms' => $this->resolveTermsForUser($user),
            ];
        })->values()->all();
    }

    public function updateOverrides(User $user, array $permissions, array $terms = []): array
    {
        $sanitizedPermissions = [];

        foreach (self::ALL_PERMISSIONS as $permissionKey) {
            if (array_key_exists($permissionKey, $permissions)) {
                $sanitizedPermissions[$permissionKey] = (bool) $permissions[$permissionKey];
            }
        }

        $sanitizedTerms = $this->sanitizeTerms($terms);

        UserPermissionOverride::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'permissions' => $sanitizedPermissions,
                'terms' => $sanitizedTerms,
            ],
        );

        return [
            'permissions' => $this->resolveForUser($user),
            'terms' => $this->resolveTermsForUser($user),
        ];
    }

    public function userCanManagePrivileges(?User $actor): bool
    {
        if (! $actor) {
            return false;
        }

        return strtolower(trim((string) $actor->role)) === 'admin';
    }

    private function getRoleDefaults(User $user): array
    {
        $role = strtolower(trim((string) $user->role));
        $employee = Employee::query()
            ->with('department')
            ->where('email', $user->email)
            ->first();

        $isHr = in_array(
            strtolower(trim((string) $employee?->department?->name)),
            ['human resources', 'hr'],
            true,
        );

        $jobTitle = strtolower(trim((string) $employee?->job_title));

        if (
            $role === 'admin'
            || in_array($role, ['ceo', 'gm', 'general manager'], true)
            || in_array($jobTitle, ['ceo', 'chief executive officer', 'gm', 'general manager'], true)
        ) {
            return $this->allEnabled();
        }

        if ($role === 'hr' || $isHr) {
            return $this->allEnabled();
        }

        if ($role === 'manager') {
            return [
                'dashboard' => true,
                'employees' => true,
                'attendance' => true,
                'leave' => true,
                'payroll' => false,
                'recruitment' => true,
                'performance' => true,
                'training' => true,
                'training_materials' => false,
                'assets' => false,
                'expenses' => true,
                'loans' => true,
                'company_structure' => true,
                'settings' => false,
            ];
        }

        return [
            'dashboard' => true,
            'employees' => true,
            'attendance' => true,
            'leave' => true,
            'payroll' => true,
            'recruitment' => false,
            'performance' => true,
            'training' => true,
            'training_materials' => false,
            'assets' => false,
            'expenses' => true,
            'loans' => true,
            'company_structure' => true,
            'settings' => false,
        ];
    }

    private function allEnabled(): array
    {
        $permissions = [];

        foreach (self::ALL_PERMISSIONS as $permissionKey) {
            $permissions[$permissionKey] = true;
        }

        return $permissions;
    }

    private function allTermsAccepted(): array
    {
        $terms = [];

        foreach (self::ALL_PERMISSIONS as $permissionKey) {
            $terms[$permissionKey] = self::TERM_ACCEPTED;
        }

        return $terms;
    }

    private function sanitizeTerms(array $terms): array
    {
        $sanitized = [];

        foreach (self::ALL_PERMISSIONS as $permissionKey) {
            if (! array_key_exists($permissionKey, $terms)) {
                continue;
            }

            $value = strtolower(trim((string) $terms[$permissionKey]));
            if ($value === self::TERM_ACCEPTED || $value === self::TERM_REJECTED) {
                $sanitized[$permissionKey] = $value;
            }
        }

        return $sanitized;
    }

    private function isDepartmentManager(User $user): bool
    {
        return Department::query()
            ->where('manager_user_id', $user->id)
            ->exists();
    }

    private function isFinanceDepartmentManager(User $user): bool
    {
        return Department::query()
            ->where('manager_user_id', $user->id)
            ->whereRaw('LOWER(name) = ?', ['finance'])
            ->exists();
    }
}
