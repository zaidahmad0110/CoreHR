<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\BroadcastNotificationRequest;
use App\Http\Requests\Api\UpdateCompanySettingsRequest;
use App\Http\Requests\Api\UpdateCommunicationSettingsRequest;
use App\Http\Requests\Api\UpdateBioTimeSettingsRequest;
use App\Http\Requests\Api\UpdateNotificationPreferencesRequest;
use App\Http\Requests\Api\UpsertAllowanceTypeRequest;
use App\Http\Requests\Api\UpsertDeductionTypeRequest;
use App\Http\Requests\Api\UpsertHolidayRequest;
use App\Http\Requests\Api\UpsertLeaveTypeRequest;
use App\Models\CompanySetting;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\LeaveType;
use App\Models\PayrollAllowanceType;
use App\Models\PayrollDeductionType;
use App\Services\MessagingService;
use App\Services\BioTimeSyncService;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SettingsController extends Controller
{
    public function __construct(
        private readonly NotificationService $notificationService,
        private readonly MessagingService $messagingService,
        private readonly BioTimeSyncService $bioTimeSyncService,
    ) {
    }

    private const DEFAULT_COMPANY_SETTINGS = [
        'company_name' => 'HRManager Inc.',
        'company_email' => 'info@hrmanager.com',
        'company_phone' => '+1 (555) 123-4567',
        'company_website' => 'https://hrmanager.com',
        'company_address' => '123 Business St, San Francisco, CA 94103',
        'default_language' => 'en',
        'mail_mailer' => null,
        'mail_host' => null,
        'mail_port' => null,
        'mail_username' => null,
        'mail_password' => null,
        'mail_encryption' => null,
        'mail_from_address' => null,
        'mail_from_name' => null,
        'sms_gateway_endpoint' => null,
        'sms_gateway_token' => null,
        'sms_gateway_timeout' => 10,
        'biotime_enabled' => false,
        'biotime_base_url' => null,
        'biotime_username' => null,
        'biotime_password' => null,
        'biotime_timeout' => 20,
        'biotime_last_sync_at' => null,
        'notify_leave_requests' => true,
        'notify_attendance_alerts' => true,
        'notify_expense_approvals' => true,
        'notify_payroll_reminders' => false,
    ];

    private const DEFAULT_LEAVE_TYPES = [
        ['name' => 'Annual Leave', 'annual_days' => 20, 'carry_over' => true],
        ['name' => 'Sick Leave', 'annual_days' => 10, 'carry_over' => false],
        ['name' => 'Personal Leave', 'annual_days' => 5, 'carry_over' => false],
    ];

    private const DEFAULT_ALLOWANCE_TYPES = [
        ['name' => 'Housing Allowance', 'amount' => 500],
        ['name' => 'Transport Allowance', 'amount' => 200],
        ['name' => 'Meal Allowance', 'amount' => 150],
    ];

    private const DEFAULT_DEDUCTION_TYPES = [
        ['name' => 'Income Tax', 'value_type' => 'percentage', 'value' => 15],
        ['name' => 'Health Insurance', 'value_type' => 'amount', 'value' => 100],
        ['name' => 'Pension Fund', 'value_type' => 'percentage', 'value' => 5],
    ];

    private const DEFAULT_HOLIDAYS = [
        ['name' => "New Year's Day", 'date' => '2026-01-01'],
        ['name' => 'Good Friday', 'date' => '2026-04-18'],
        ['name' => 'Easter Monday', 'date' => '2026-04-21'],
        ['name' => 'Labor Day', 'date' => '2026-05-01'],
        ['name' => 'Independence Day', 'date' => '2026-07-04'],
        ['name' => 'Thanksgiving', 'date' => '2026-11-26'],
        ['name' => 'Christmas Day', 'date' => '2026-12-25'],
    ];

    public function index(Request $request): JsonResponse
    {
        $this->ensureDefaultSettings();

        $companySetting = $this->resolveCompanySetting();
        $leaveTypes = LeaveType::query()->orderBy('name')->get();
        $allowanceTypes = PayrollAllowanceType::query()->orderBy('name')->get();
        $deductionTypes = PayrollDeductionType::query()->orderBy('name')->get();
        $holidays = Holiday::query()->orderBy('date')->orderBy('id')->get();

        return response()->json([
            'data' => [
                'company' => [
                    'name' => $companySetting->company_name,
                    'email' => $companySetting->company_email,
                    'phone' => $companySetting->company_phone,
                    'website' => $companySetting->company_website,
                    'address' => $companySetting->company_address,
                    'logo_url' => $this->companyLogoUrl($companySetting),
                    'default_language' => $companySetting->default_language ?: 'en',
                ],
                'communications' => $this->serializeCommunicationSettings($companySetting),
                'leave_types' => $leaveTypes
                    ->map(fn (LeaveType $type): array => $this->serializeLeaveType($type))
                    ->values(),
                'payroll_settings' => [
                    'allowances' => $allowanceTypes
                        ->map(fn (PayrollAllowanceType $type): array => $this->serializeAllowanceType($type))
                        ->values(),
                    'deductions' => $deductionTypes
                        ->map(fn (PayrollDeductionType $type): array => $this->serializeDeductionType($type))
                        ->values(),
                ],
                'holidays' => $holidays
                    ->map(fn (Holiday $holiday): array => $this->serializeHoliday($holiday))
                    ->values(),
                'notifications' => [
                    'leave_request_notifications' => (bool) $companySetting->notify_leave_requests,
                    'attendance_alerts' => (bool) $companySetting->notify_attendance_alerts,
                    'expense_approvals' => (bool) $companySetting->notify_expense_approvals,
                    'payroll_reminders' => (bool) $companySetting->notify_payroll_reminders,
                ],
                'biotime' => $this->serializeBioTimeSettings($companySetting),
                'permissions' => [
                    'can_manage' => $this->userCanManageSettings($request),
                ],
            ],
        ]);
    }

    public function updateCompany(UpdateCompanySettingsRequest $request): JsonResponse
    {
        $this->ensureSettingsManagementPermission($request);

        $payload = $request->validated();
        $companySetting = $this->resolveCompanySetting();
        $updatePayload = [
            'company_name' => $payload['company_name'],
            'company_email' => $payload['company_email'] ?? null,
            'company_phone' => $payload['company_phone'] ?? null,
            'company_website' => $payload['company_website'] ?? null,
            'company_address' => $payload['company_address'] ?? null,
            'default_language' => $payload['default_language'] ?? $companySetting->default_language ?? 'en',
        ];

        if ($request->hasFile('company_logo')) {
            if ($companySetting->company_logo_path && Storage::disk('public')->exists($companySetting->company_logo_path)) {
                Storage::disk('public')->delete($companySetting->company_logo_path);
            }

            $updatePayload['company_logo_path'] = $request->file('company_logo')->store('company-logos', 'public');
        }

        $companySetting->update($updatePayload);

        return response()->json([
            'message' => 'Company settings updated successfully.',
            'data' => [
                'name' => $companySetting->company_name,
                'email' => $companySetting->company_email,
                'phone' => $companySetting->company_phone,
                'website' => $companySetting->company_website,
                'address' => $companySetting->company_address,
                'logo_url' => $this->companyLogoUrl($companySetting),
                'default_language' => $companySetting->default_language ?: 'en',
            ],
        ]);
    }

    public function updateNotifications(UpdateNotificationPreferencesRequest $request): JsonResponse
    {
        $this->ensureSettingsManagementPermission($request);

        $payload = $request->validated();
        $companySetting = $this->resolveCompanySetting();
        $companySetting->update([
            'notify_leave_requests' => (bool) $payload['leave_request_notifications'],
            'notify_attendance_alerts' => (bool) $payload['attendance_alerts'],
            'notify_expense_approvals' => (bool) $payload['expense_approvals'],
            'notify_payroll_reminders' => (bool) $payload['payroll_reminders'],
        ]);

        return response()->json([
            'message' => 'Notification preferences updated successfully.',
            'data' => [
                'leave_request_notifications' => (bool) $companySetting->notify_leave_requests,
                'attendance_alerts' => (bool) $companySetting->notify_attendance_alerts,
                'expense_approvals' => (bool) $companySetting->notify_expense_approvals,
                'payroll_reminders' => (bool) $companySetting->notify_payroll_reminders,
            ],
        ]);
    }

    public function broadcastNotification(BroadcastNotificationRequest $request): JsonResponse
    {
        $this->ensureSettingsManagementPermission($request);

        $payload = $request->validated();
        $delivered = $this->notificationService->broadcastToAllUsers(
            trim((string) $payload['title']),
            isset($payload['body']) ? trim((string) $payload['body']) : null,
            isset($payload['type']) ? strtolower(trim((string) $payload['type'])) : 'info',
            $request->user()?->id ? (int) $request->user()->id : null,
            (bool) ($payload['include_sender'] ?? true),
        );

        return response()->json([
            'message' => 'Notification sent successfully.',
            'data' => [
                'delivered' => $delivered,
            ],
        ]);
    }

    public function updateCommunications(UpdateCommunicationSettingsRequest $request): JsonResponse
    {
        $this->ensureSettingsManagementPermission($request);

        $payload = $request->validated();
        $companySetting = $this->resolveCompanySetting();
        $companySetting->update([
            'mail_mailer' => $this->normalizeMailMailer($payload['mail_mailer'] ?? null),
            'mail_host' => $this->nullableTrimmed($payload['mail_host'] ?? null),
            'mail_port' => isset($payload['mail_port']) ? (int) $payload['mail_port'] : null,
            'mail_username' => $this->nullableTrimmed($payload['mail_username'] ?? null),
            'mail_password' => $this->nullableTrimmed($payload['mail_password'] ?? null),
            'mail_encryption' => $this->normalizeMailEncryption($payload['mail_encryption'] ?? null),
            'mail_from_address' => $this->nullableTrimmed($payload['mail_from_address'] ?? null),
            'mail_from_name' => $this->nullableTrimmed($payload['mail_from_name'] ?? null),
            'sms_gateway_endpoint' => $this->nullableTrimmed($payload['sms_gateway_endpoint'] ?? null),
            'sms_gateway_token' => $this->nullableTrimmed($payload['sms_gateway_token'] ?? null),
            'sms_gateway_timeout' => isset($payload['sms_gateway_timeout'])
                ? (int) $payload['sms_gateway_timeout']
                : 10,
        ]);

        $testEmailResult = [
            'status' => 'skipped',
            'recipient' => null,
            'error' => null,
        ];

        $actorEmail = $this->nullableTrimmed((string) ($request->user()?->email ?? ''));
        $configuredMailer = strtolower((string) ($companySetting->mail_mailer ?? ''));

        if ($configuredMailer === 'smtp' && $actorEmail !== null) {
            $delivery = $this->messagingService->send(
                'email',
                $actorEmail,
                null,
                'CoreHR SMTP configuration test',
                "Your SMTP settings were saved successfully. This is a test email from CoreHR to confirm outbound email delivery is working.",
                [
                    'scope' => 'settings_mail_test',
                ],
            );

            $testEmailResult = [
                'status' => $delivery['status'],
                'recipient' => $actorEmail,
                'error' => isset($delivery['meta']['error']) ? (string) $delivery['meta']['error'] : null,
            ];
        }

        return response()->json([
            'message' => 'Email and SMS configuration updated successfully.',
            'data' => [
                ...$this->serializeCommunicationSettings($companySetting),
                'test_email' => $testEmailResult,
            ],
        ]);
    }

    public function updateBioTime(UpdateBioTimeSettingsRequest $request): JsonResponse
    {
        $this->ensureSettingsManagementPermission($request);

        $payload = $request->validated();
        $companySetting = $this->resolveCompanySetting();
        $companySetting->update([
            'biotime_enabled' => (bool) ($payload['enabled'] ?? false),
            'biotime_base_url' => $this->nullableTrimmed($payload['base_url'] ?? null),
            'biotime_username' => $this->nullableTrimmed($payload['username'] ?? null),
            'biotime_password' => $this->nullableTrimmed($payload['password'] ?? null),
            'biotime_timeout' => isset($payload['timeout']) ? (int) $payload['timeout'] : 20,
        ]);

        return response()->json([
            'message' => 'BioTime settings updated successfully.',
            'data' => $this->serializeBioTimeSettings($companySetting),
        ]);
    }

    public function syncBioTime(Request $request): JsonResponse
    {
        $this->ensureSettingsManagementPermission($request);

        $validated = $request->validate([
            'start_time' => ['nullable', 'date'],
            'end_time' => ['nullable', 'date'],
        ]);

        $result = $this->bioTimeSyncService->sync(
            isset($validated['start_time']) ? Carbon::parse((string) $validated['start_time']) : null,
            isset($validated['end_time']) ? Carbon::parse((string) $validated['end_time']) : null,
        );

        return response()->json([
            'message' => 'BioTime attendance sync completed successfully.',
            'data' => $result,
        ]);
    }

    public function storeLeaveType(UpsertLeaveTypeRequest $request): JsonResponse
    {
        $this->ensureSettingsManagementPermission($request);

        $payload = $request->validated();
        $type = LeaveType::query()->create([
            'name' => $payload['name'],
            'annual_days' => (int) $payload['days'],
            'carry_over' => (bool) $payload['carry_over'],
        ]);

        return response()->json([
            'message' => 'Leave type created successfully.',
            'data' => $this->serializeLeaveType($type),
        ], 201);
    }

    public function updateLeaveType(
        UpsertLeaveTypeRequest $request,
        LeaveType $leaveType
    ): JsonResponse {
        $this->ensureSettingsManagementPermission($request);

        $payload = $request->validated();
        $leaveType->update([
            'name' => $payload['name'],
            'annual_days' => (int) $payload['days'],
            'carry_over' => (bool) $payload['carry_over'],
        ]);

        return response()->json([
            'message' => 'Leave type updated successfully.',
            'data' => $this->serializeLeaveType($leaveType),
        ]);
    }

    public function deleteLeaveType(Request $request, LeaveType $leaveType): JsonResponse
    {
        $this->ensureSettingsManagementPermission($request);
        $leaveType->delete();

        return response()->json([
            'message' => 'Leave type deleted successfully.',
        ]);
    }

    public function storeAllowanceType(UpsertAllowanceTypeRequest $request): JsonResponse
    {
        $this->ensureSettingsManagementPermission($request);

        $payload = $request->validated();
        $type = PayrollAllowanceType::query()->create([
            'name' => $payload['name'],
            'amount' => (float) $payload['amount'],
        ]);

        return response()->json([
            'message' => 'Allowance type created successfully.',
            'data' => $this->serializeAllowanceType($type),
        ], 201);
    }

    public function updateAllowanceType(
        UpsertAllowanceTypeRequest $request,
        PayrollAllowanceType $allowanceType
    ): JsonResponse {
        $this->ensureSettingsManagementPermission($request);

        $payload = $request->validated();
        $allowanceType->update([
            'name' => $payload['name'],
            'amount' => (float) $payload['amount'],
        ]);

        return response()->json([
            'message' => 'Allowance type updated successfully.',
            'data' => $this->serializeAllowanceType($allowanceType),
        ]);
    }

    public function deleteAllowanceType(
        Request $request,
        PayrollAllowanceType $allowanceType
    ): JsonResponse {
        $this->ensureSettingsManagementPermission($request);
        $allowanceType->delete();

        return response()->json([
            'message' => 'Allowance type deleted successfully.',
        ]);
    }

    public function storeDeductionType(UpsertDeductionTypeRequest $request): JsonResponse
    {
        $this->ensureSettingsManagementPermission($request);

        $payload = $request->validated();
        $type = PayrollDeductionType::query()->create([
            'name' => $payload['name'],
            'value_type' => $payload['value_type'],
            'value' => (float) $payload['value'],
        ]);

        return response()->json([
            'message' => 'Deduction type created successfully.',
            'data' => $this->serializeDeductionType($type),
        ], 201);
    }

    public function updateDeductionType(
        UpsertDeductionTypeRequest $request,
        PayrollDeductionType $deductionType
    ): JsonResponse {
        $this->ensureSettingsManagementPermission($request);

        $payload = $request->validated();
        $deductionType->update([
            'name' => $payload['name'],
            'value_type' => $payload['value_type'],
            'value' => (float) $payload['value'],
        ]);

        return response()->json([
            'message' => 'Deduction type updated successfully.',
            'data' => $this->serializeDeductionType($deductionType),
        ]);
    }

    public function deleteDeductionType(
        Request $request,
        PayrollDeductionType $deductionType
    ): JsonResponse {
        $this->ensureSettingsManagementPermission($request);
        $deductionType->delete();

        return response()->json([
            'message' => 'Deduction type deleted successfully.',
        ]);
    }

    public function storeHoliday(UpsertHolidayRequest $request): JsonResponse
    {
        $this->ensureSettingsManagementPermission($request);

        $payload = $request->validated();
        $holiday = Holiday::query()->create([
            'name' => $payload['name'],
            'date' => $payload['date'],
        ]);

        return response()->json([
            'message' => 'Holiday created successfully.',
            'data' => $this->serializeHoliday($holiday),
        ], 201);
    }

    public function updateHoliday(UpsertHolidayRequest $request, Holiday $holiday): JsonResponse
    {
        $this->ensureSettingsManagementPermission($request);

        $payload = $request->validated();
        $holiday->update([
            'name' => $payload['name'],
            'date' => $payload['date'],
        ]);

        return response()->json([
            'message' => 'Holiday updated successfully.',
            'data' => $this->serializeHoliday($holiday),
        ]);
    }

    public function deleteHoliday(Request $request, Holiday $holiday): JsonResponse
    {
        $this->ensureSettingsManagementPermission($request);
        $holiday->delete();

        return response()->json([
            'message' => 'Holiday deleted successfully.',
        ]);
    }

    private function ensureDefaultSettings(): void
    {
        $this->resolveCompanySetting();

        if (LeaveType::query()->count() === 0) {
            LeaveType::query()->insert(collect(self::DEFAULT_LEAVE_TYPES)->map(function (array $row): array {
                return [
                    ...$row,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            })->all());
        }

        if (PayrollAllowanceType::query()->count() === 0) {
            PayrollAllowanceType::query()->insert(collect(self::DEFAULT_ALLOWANCE_TYPES)->map(function (array $row): array {
                return [
                    ...$row,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            })->all());
        }

        if (PayrollDeductionType::query()->count() === 0) {
            PayrollDeductionType::query()->insert(collect(self::DEFAULT_DEDUCTION_TYPES)->map(function (array $row): array {
                return [
                    ...$row,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            })->all());
        }

        if (Holiday::query()->count() === 0) {
            Holiday::query()->insert(collect(self::DEFAULT_HOLIDAYS)->map(function (array $row): array {
                return [
                    ...$row,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            })->all());
        }
    }

    private function resolveCompanySetting(): CompanySetting
    {
        return CompanySetting::query()->firstOrCreate(
            ['id' => 1],
            self::DEFAULT_COMPANY_SETTINGS,
        );
    }

    private function ensureSettingsManagementPermission(Request $request): void
    {
        if (! $this->userCanManageSettings($request)) {
            abort(403, 'You are not authorized to manage settings.');
        }
    }

    private function userCanManageSettings(Request $request): bool
    {
        $user = $request->user();

        if (! $user) {
            return false;
        }

        $role = strtolower(trim((string) $user->role));
        if (in_array($role, ['admin', 'hr'], true)) {
            return true;
        }

        $employee = Employee::query()
            ->with('department')
            ->where('email', $user->email)
            ->first();

        $departmentName = strtolower(trim((string) $employee?->department?->name));

        return in_array($departmentName, ['human resources', 'hr'], true);
    }

    private function serializeLeaveType(LeaveType $type): array
    {
        return [
            'id' => $type->id,
            'name' => $type->name,
            'days' => (int) $type->annual_days,
            'carry_over' => (bool) $type->carry_over,
        ];
    }

    private function serializeAllowanceType(PayrollAllowanceType $type): array
    {
        return [
            'id' => $type->id,
            'name' => $type->name,
            'amount' => (float) $type->amount,
        ];
    }

    private function serializeDeductionType(PayrollDeductionType $type): array
    {
        return [
            'id' => $type->id,
            'name' => $type->name,
            'amount' => $type->value_type === 'amount' ? (float) $type->value : null,
            'percentage' => $type->value_type === 'percentage' ? (float) $type->value : null,
        ];
    }

    private function serializeHoliday(Holiday $holiday): array
    {
        return [
            'id' => $holiday->id,
            'name' => $holiday->name,
            'date' => $holiday->date?->format('M j, Y'),
            'date_iso' => $holiday->date?->format('Y-m-d'),
        ];
    }

    private function serializeCommunicationSettings(CompanySetting $companySetting): array
    {
        return [
            'mail_mailer' => $companySetting->mail_mailer,
            'mail_host' => $companySetting->mail_host,
            'mail_port' => $companySetting->mail_port,
            'mail_username' => $companySetting->mail_username,
            'mail_password' => $companySetting->mail_password,
            'mail_encryption' => $companySetting->mail_encryption,
            'mail_from_address' => $companySetting->mail_from_address,
            'mail_from_name' => $companySetting->mail_from_name,
            'sms_gateway_endpoint' => $companySetting->sms_gateway_endpoint,
            'sms_gateway_token' => $companySetting->sms_gateway_token,
            'sms_gateway_timeout' => $companySetting->sms_gateway_timeout ?? 10,
        ];
    }

    private function serializeBioTimeSettings(CompanySetting $companySetting): array
    {
        return [
            'enabled' => (bool) $companySetting->biotime_enabled,
            'base_url' => $companySetting->biotime_base_url,
            'username' => $companySetting->biotime_username,
            'password' => $companySetting->biotime_password,
            'timeout' => $companySetting->biotime_timeout ?? 20,
            'last_sync_at' => $companySetting->biotime_last_sync_at?->toDateTimeString(),
        ];
    }

    private function companyLogoUrl(CompanySetting $companySetting): ?string
    {
        if (! $companySetting->company_logo_path) {
            return null;
        }

        return Storage::disk('public')->url($companySetting->company_logo_path);
    }

    private function nullableTrimmed(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);
        return $trimmed === '' ? null : $trimmed;
    }

    private function normalizeMailEncryption(?string $value): ?string
    {
        $normalized = strtolower(trim((string) $value));
        if ($normalized === '' || $normalized === 'none') {
            return null;
        }

        return $normalized;
    }

    private function normalizeMailMailer(?string $value): ?string
    {
        $normalized = strtolower(trim((string) $value));

        return $normalized === '' ? null : $normalized;
    }
}
