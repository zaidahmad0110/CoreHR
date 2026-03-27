<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UpdateTwoFactorRequest;
use App\Models\CompanySetting;
use App\Models\Department;
use App\Http\Requests\Api\LoginRequest;
use App\Models\Employee;
use App\Models\User;
use App\Services\MessagingService;
use App\Services\UserPrivilegeService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AuthController extends Controller
{
    public function __construct(
        private readonly UserPrivilegeService $privilegeService,
        private readonly MessagingService $messagingService,
    ) {
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();
        $user = User::query()->where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], (string) $user->password)) {
            return response()->json([
                'message' => 'Invalid email or password.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ((bool) $user->two_factor_enabled) {
            $otpCode = trim((string) ($credentials['otp_code'] ?? ''));

            if ($otpCode === '') {
                $this->issueTwoFactorCode($user);

                return response()->json([
                    'message' => 'A verification code was sent to your email.',
                    'data' => [
                        'two_factor_required' => true,
                        'delivery_channel' => 'email',
                        'email_hint' => $this->maskEmail($user->email),
                        'expires_in_seconds' => 600,
                    ],
                ], Response::HTTP_ACCEPTED);
            }

            if (! $this->isValidTwoFactorCode($user, $otpCode)) {
                return response()->json([
                    'message' => 'Invalid or expired verification code.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $this->clearTwoFactorChallenge($user);
        }

        try {
            $tokenName = sprintf('web-%s', now()->format('YmdHis'));
            $plainTextToken = $user->createToken($tokenName)->plainTextToken;
        } catch (QueryException $exception) {
            Log::error('Failed to create Sanctum access token.', [
                'email' => $user->email,
                'sql_state' => $exception->getCode(),
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'Authentication token storage is not ready. Please run database migrations on the server.',
            ], Response::HTTP_SERVICE_UNAVAILABLE);
        }

        try {
            $serializedUser = $this->serializeUser($user);
        } catch (QueryException $exception) {
            Log::error('Failed to serialize authenticated user due to database schema error.', [
                'email' => $user->email,
                'sql_state' => $exception->getCode(),
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'Authentication succeeded, but user profile data could not be loaded. Please run database migrations on the server.',
            ], Response::HTTP_SERVICE_UNAVAILABLE);
        } catch (Throwable $exception) {
            Log::error('Failed to serialize authenticated user.', [
                'email' => $user->email,
                'error' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]);

            return response()->json([
                'message' => 'Authentication succeeded, but profile loading failed due to a server error.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        return response()->json([
            'data' => [
                'user' => $serializedUser,
                'access_token' => $plainTextToken,
                'token_type' => 'Bearer',
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user && $user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->serializeUser($request->user()),
        ]);
    }

    public function twoFactorStatus(Request $request): JsonResponse
    {
        return response()->json([
            'data' => [
                'enabled' => (bool) $request->user()->two_factor_enabled,
            ],
        ]);
    }

    public function updateTwoFactor(UpdateTwoFactorRequest $request): JsonResponse
    {
        $user = $request->user();
        $enabled = (bool) $request->validated('enabled');

        $user->forceFill([
            'two_factor_enabled' => $enabled,
        ])->save();

        if (! $enabled) {
            $this->clearTwoFactorChallenge($user);
        }

        return response()->json([
            'message' => 'Two-factor authentication settings updated successfully.',
            'data' => [
                'enabled' => (bool) $user->two_factor_enabled,
            ],
        ]);
    }

    private function serializeUser(User $user): array
    {
        $companySetting = CompanySetting::query()->first();
        $employee = Employee::query()
            ->with('department')
            ->where('email', $user->email)
            ->first();
        $managedDepartments = Department::query()
            ->select(['id', 'name'])
            ->where('manager_user_id', $user->id)
            ->orderBy('name')
            ->get();

        $isPowerEmployee = $this->isPowerEmployee($user, $employee);

        $employeeManagementScope = $isPowerEmployee ? 'global' : 'self';

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'company_name' => $companySetting?->company_name ?? 'HRManager',
            'company_logo_url' => $companySetting?->company_logo_path
                ? Storage::disk('public')->url($companySetting->company_logo_path)
                : null,
            'preferred_language' => $companySetting?->default_language ?? 'en',
            'two_factor_enabled' => (bool) $user->two_factor_enabled,
            'employee_profile_id' => $employee?->id,
            'department' => $employee?->department?->name,
            'job_title' => $employee?->job_title,
            'permissions' => $this->privilegeService->resolveForUser($user),
            'can_manage_employees' => $isPowerEmployee,
            'employee_management_scope' => $employeeManagementScope,
            'managed_departments' => $managedDepartments->map(fn (Department $department): array => [
                'id' => $department->id,
                'name' => $department->name,
            ])->values()->all(),
        ];
    }

    private function isPowerEmployee(User $user, ?Employee $employee): bool
    {
        $role = strtolower(trim((string) $user->role));
        if (in_array($role, ['admin', 'hr', 'ceo'], true)) {
            return true;
        }

        $jobTitle = strtolower(trim((string) $employee?->job_title));
        if (in_array($jobTitle, ['ceo', 'chief executive officer'], true)) {
            return true;
        }

        $departmentName = strtolower(trim((string) $employee?->department?->name));

        return in_array($departmentName, ['human resources', 'hr'], true);
    }

    private function issueTwoFactorCode(User $user): void
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $hash = Hash::make($code);
        $expiresAt = now()->addMinutes(10);

        $user->forceFill([
            'two_factor_code_hash' => $hash,
            'two_factor_expires_at' => $expiresAt,
            'two_factor_last_sent_at' => now(),
        ])->save();

        $this->messagingService->send(
            'email',
            $user->email,
            null,
            'Your CoreHR verification code',
            sprintf('Your verification code is %s. It expires in 10 minutes.', $code),
            ['scope' => 'two_factor'],
        );
    }

    private function isValidTwoFactorCode(User $user, string $code): bool
    {
        if (! $user->two_factor_code_hash || ! $user->two_factor_expires_at) {
            return false;
        }

        if (now()->greaterThan($user->two_factor_expires_at)) {
            return false;
        }

        return Hash::check($code, (string) $user->two_factor_code_hash);
    }

    private function clearTwoFactorChallenge(User $user): void
    {
        $user->forceFill([
            'two_factor_code_hash' => null,
            'two_factor_expires_at' => null,
        ])->save();
    }

    private function maskEmail(string $email): string
    {
        $parts = explode('@', $email);
        if (count($parts) !== 2) {
            return $email;
        }

        $local = $parts[0];
        $domain = $parts[1];

        if (strlen($local) <= 2) {
            $maskedLocal = str_repeat('*', strlen($local));
        } else {
            $maskedLocal = substr($local, 0, 1).str_repeat('*', max(strlen($local) - 2, 1)).substr($local, -1);
        }

        return $maskedLocal.'@'.$domain;
    }
}
