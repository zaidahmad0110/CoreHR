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
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
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
        try {
            $credentials = $request->validated();
            $user = User::query()->where('email', $credentials['email'])->first();

            if (! $user || ! $this->validateAndUpgradePassword($user, (string) $credentials['password'])) {
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

            $tokenName = sprintf('web-%s', now()->format('YmdHis'));
            $plainTextToken = $user->createToken($tokenName)->plainTextToken;
            $serializedUser = $this->serializeUser($user);

            return response()->json([
                'data' => [
                    'user' => $serializedUser,
                    'access_token' => $plainTextToken,
                    'token_type' => 'Bearer',
                ],
            ]);
        } catch (QueryException $exception) {
            Log::error('Login failed due to database error.', [
                'email' => $request->input('email'),
                'sql_state' => $exception->getCode(),
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'error_type' => $exception::class,
                'error_detail' => $exception->getMessage(),
            ], Response::HTTP_SERVICE_UNAVAILABLE);
        } catch (Throwable $exception) {
            Log::error('Unexpected login failure.', [
                'email' => $request->input('email'),
                'error' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]);

            return response()->json([
                'error_type' => $exception::class,
                'error_detail' => $exception->getMessage(),
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
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

    public function changePassword(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'max:255', 'confirmed'],
        ]);

        $user = $request->user();
        if (! $user || ! $this->validateAndUpgradePassword($user, (string) $payload['current_password'])) {
            return response()->json([
                'message' => 'Current password is incorrect.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user->forceFill([
            'password' => (string) $payload['password'],
        ])->save();

        return response()->json([
            'message' => 'Password changed successfully.',
        ]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $email = strtolower(trim((string) $payload['email']));
        $user = User::query()->where('email', $email)->first();

        if ($user) {
            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $email],
                [
                    'token' => Hash::make($code),
                    'created_at' => now(),
                ],
            );

            $this->messagingService->send(
                'email',
                $email,
                null,
                'Your CoreHR password reset code',
                sprintf('Your password reset code is %s. It expires in 15 minutes.', $code),
                ['scope' => 'password_reset'],
            );
        }

        return response()->json([
            'message' => 'If this email exists, a password reset code has been sent.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'string', 'size:6'],
            'password' => ['required', 'string', 'min:8', 'max:255', 'confirmed'],
        ]);

        $email = strtolower(trim((string) $payload['email']));
        $reset = DB::table('password_reset_tokens')->where('email', $email)->first();
        $resetCreatedAt = $reset?->created_at ? Carbon::parse((string) $reset->created_at) : null;

        if (
            ! $reset
            || ! $resetCreatedAt
            || ! Hash::check((string) $payload['code'], (string) $reset->token)
            || $resetCreatedAt->lt(now()->subMinutes(15))
        ) {
            return response()->json([
                'message' => 'Invalid or expired password reset code.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user = User::query()->where('email', $email)->first();
        if (! $user) {
            return response()->json([
                'message' => 'Invalid or expired password reset code.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user->forceFill([
            'password' => (string) $payload['password'],
        ])->save();
        $user->tokens()->delete();

        DB::table('password_reset_tokens')->where('email', $email)->delete();

        return response()->json([
            'message' => 'Password reset successfully. You can now sign in.',
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
        if (in_array($role, ['admin', 'hr', 'ceo', 'gm', 'general manager'], true)) {
            return true;
        }

        $jobTitle = strtolower(trim((string) $employee?->job_title));
        if (in_array($jobTitle, ['ceo', 'chief executive officer', 'gm', 'general manager'], true)) {
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

    private function validateAndUpgradePassword(User $user, string $plainPassword): bool
    {
        $storedPassword = (string) $user->password;

        try {
            $isValid = Hash::check($plainPassword, $storedPassword);
        } catch (RuntimeException) {
            $passwordInfo = password_get_info($storedPassword);
            $isKnownPhpHash = ($passwordInfo['algo'] ?? null) !== null && ($passwordInfo['algo'] ?? 0) !== 0;

            if ($isKnownPhpHash) {
                $isValid = password_verify($plainPassword, $storedPassword);
            } else {
                $isValid = hash_equals($storedPassword, $plainPassword);
            }

            if ($isValid) {
                $user->forceFill([
                    'password' => $plainPassword,
                ])->save();
            }

            return $isValid;
        }

        if ($isValid && Hash::needsRehash($storedPassword)) {
            $user->forceFill([
                'password' => $plainPassword,
            ])->save();
        }

        return $isValid;
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
