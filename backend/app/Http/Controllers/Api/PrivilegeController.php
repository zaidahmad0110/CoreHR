<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UpdateUserPrivilegesRequest;
use App\Models\User;
use App\Services\UserPrivilegeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PrivilegeController extends Controller
{
    public function __construct(private readonly UserPrivilegeService $privilegeService)
    {
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            abort(401, 'Unauthenticated.');
        }

        return response()->json([
            'data' => [
                'permissions' => $this->privilegeService->resolveForUser($user),
                'terms' => $this->privilegeService->resolveTermsForUser($user),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        if (! $this->privilegeService->userCanManagePrivileges($request->user())) {
            abort(403, 'You are not authorized to manage user privileges.');
        }

        return response()->json([
            'data' => [
                'permissions_catalog' => UserPrivilegeService::ALL_PERMISSIONS,
                'users' => $this->privilegeService->listUsersWithPrivileges(),
            ],
        ]);
    }

    public function update(
        UpdateUserPrivilegesRequest $request,
        User $user
    ): JsonResponse {
        if (! $this->privilegeService->userCanManagePrivileges($request->user())) {
            abort(403, 'You are not authorized to manage user privileges.');
        }

        $updatedPrivileges = $this->privilegeService->updateOverrides(
            $user,
            $request->validated('permissions', []),
            $request->validated('terms', []),
        );

        return response()->json([
            'message' => 'User privileges updated successfully.',
            'data' => [
                'user_id' => $user->id,
                'permissions' => $updatedPrivileges['permissions'],
                'terms' => $updatedPrivileges['terms'],
            ],
        ]);
    }
}
