<?php

namespace App\Services;

use App\Models\HrNotification;
use App\Models\User;

class NotificationService
{
    public function listForUser(User $user): array
    {
        $notifications = HrNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('cleared_at')
            ->latest()
            ->limit(20)
            ->get();

        return [
            'unread_count' => $notifications->where('is_read', false)->count(),
            'items' => $notifications->map(fn (HrNotification $notification): array => [
                'id' => $notification->id,
                'title' => $notification->title,
                'body' => $notification->body,
                'type' => $notification->type,
                'is_read' => $notification->is_read,
                'created_at' => $notification->created_at?->toISOString(),
            ])->values(),
        ];
    }

    public function broadcastToAllUsers(
        string $title,
        ?string $body = null,
        string $type = 'info',
        ?int $actorUserId = null,
        bool $includeActor = true
    ): int {
        $userIds = User::query()
            ->when(
                ! $includeActor && $actorUserId !== null,
                fn ($query) => $query->where('id', '!=', $actorUserId),
            )
            ->pluck('id');

        if ($userIds->isEmpty()) {
            return 0;
        }

        $now = now();
        $rows = $userIds->map(fn ($userId): array => [
            'user_id' => (int) $userId,
            'title' => $title,
            'body' => $body,
            'type' => $type,
            'is_read' => false,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        HrNotification::query()->insert($rows);

        return count($rows);
    }
}
