<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrNotification;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct(private readonly NotificationService $notificationService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->notificationService->listForUser($request->user()),
        ]);
    }

    public function markAsRead(Request $request, HrNotification $notification): JsonResponse
    {
        if ((int) $notification->user_id !== (int) $request->user()->id) {
            abort(403);
        }

        $notification->is_read = true;
        $notification->save();

        return response()->json([
            'message' => 'Notification marked as read.',
        ]);
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        HrNotification::query()
            ->where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'updated_at' => now(),
            ]);

        return response()->json([
            'message' => 'All notifications marked as read.',
        ]);
    }

    public function clearAll(Request $request): JsonResponse
    {
        HrNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('cleared_at')
            ->update([
                'cleared_at' => now(),
                'updated_at' => now(),
            ]);

        return response()->json([
            'message' => 'Notifications cleared from the tab successfully.',
        ]);
    }
}
