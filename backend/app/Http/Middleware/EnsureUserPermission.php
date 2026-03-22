<?php

namespace App\Http\Middleware;

use App\Services\UserPrivilegeService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserPermission
{
    public function __construct(private readonly UserPrivilegeService $privilegeService)
    {
    }

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();
        if (! $user) {
            abort(401, 'Unauthenticated.');
        }

        $permissions = $this->privilegeService->resolveForUser($user);
        if (! array_key_exists($permission, $permissions)) {
            abort(403, 'Permission key is not supported.');
        }

        if (! (bool) $permissions[$permission]) {
            abort(403, 'You are not authorized to access this module.');
        }

        return $next($request);
    }
}
