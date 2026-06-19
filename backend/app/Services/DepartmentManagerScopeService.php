<?php

namespace App\Services;

use App\Models\CompanySetting;
use App\Models\Department;
use App\Models\Employee;
use App\Models\HrNotification;
use App\Models\User;

class DepartmentManagerScopeService
{
    /** @var array<int, int[]> */
    private array $managedDepartmentsCache = [];

    public function __construct(private readonly MessagingService $messagingService)
    {
    }

    public function managedDepartmentIdsForUser(User $user): array
    {
        if (array_key_exists((int) $user->id, $this->managedDepartmentsCache)) {
            return $this->managedDepartmentsCache[(int) $user->id];
        }

        $departmentIds = Department::query()
            ->where('manager_user_id', $user->id)
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->all();

        $this->managedDepartmentsCache[(int) $user->id] = $departmentIds;

        return $departmentIds;
    }

    public function actorIsGlobalApprover(User $user, ?Employee $actorEmployee): bool
    {
        if (strcasecmp((string) $user->role, 'Admin') === 0) {
            return true;
        }

        if (strcasecmp((string) $user->role, 'HR') === 0) {
            return true;
        }

        $role = strtolower(trim((string) $user->role));
        $jobTitle = strtolower(trim((string) $actorEmployee?->job_title));
        if (
            in_array($role, ['ceo', 'gm', 'general manager'], true)
            || in_array($jobTitle, ['ceo', 'chief executive officer', 'gm', 'general manager'], true)
        ) {
            return true;
        }

        return in_array(
            strtolower(trim((string) $actorEmployee?->department?->name)),
            ['human resources', 'hr'],
            true,
        );
    }

    public function notifyDepartmentManagers(
        Employee $requester,
        int $excludeUserId,
        string $title,
        string $body,
        string $type = 'warning',
        ?string $notificationPreference = null,
        ?array $deliveryChannels = null,
    ): void {
        if (! $requester->department_id) {
            return;
        }

        $managerUserIds = Department::query()
            ->where('id', $requester->department_id)
            ->whereNotNull('manager_user_id')
            ->pluck('manager_user_id')
            ->map(fn ($id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0 && $id !== $excludeUserId)
            ->unique()
            ->values();

        if ($managerUserIds->isEmpty()) {
            return;
        }

        $now = now();
        $rows = $managerUserIds
            ->map(fn (int $managerUserId): array => [
                'user_id' => $managerUserId,
                'title' => $title,
                'body' => $body,
                'type' => $type,
                'is_read' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ])
            ->all();

        HrNotification::query()->insert($rows);

        if (! $this->shouldSendExternalNotifications($notificationPreference)) {
            return;
        }

        $managerUsers = User::query()
            ->whereIn('id', $managerUserIds->all())
            ->get(['id', 'name', 'email']);

        $managerPhonesByEmail = Employee::query()
            ->whereIn('email', $managerUsers->pluck('email')->all())
            ->pluck('phone', 'email')
            ->mapWithKeys(fn ($phone, $email): array => [strtolower((string) $email) => $phone])
            ->all();

        foreach ($managerUsers as $managerUser) {
            $managerPhone = $managerPhonesByEmail[strtolower((string) $managerUser->email)] ?? null;
            $channels = is_array($deliveryChannels) && $deliveryChannels !== []
                ? $deliveryChannels
                : ['email', 'sms'];

            $this->messagingService->sendPreferred(
                $managerUser->email,
                is_string($managerPhone) ? $managerPhone : null,
                $title,
                $body,
                $channels,
                [
                    'scope' => 'department_approvals',
                    'requester_employee_id' => $requester->id,
                    'target_user_id' => $managerUser->id,
                    'notification_type' => $type,
                ],
            );
        }
    }

    private function shouldSendExternalNotifications(?string $notificationPreference): bool
    {
        $key = strtolower(trim((string) $notificationPreference));
        if ($key === '') {
            return true;
        }

        $settings = CompanySetting::query()->first();
        if (! $settings) {
            return true;
        }

        return match ($key) {
            'leave_request_notifications' => (bool) $settings->notify_leave_requests,
            'attendance_alerts' => (bool) $settings->notify_attendance_alerts,
            'expense_approvals' => (bool) $settings->notify_expense_approvals,
            'payroll_reminders' => (bool) $settings->notify_payroll_reminders,
            default => true,
        };
    }
}
