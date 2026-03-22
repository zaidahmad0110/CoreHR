<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class HrNotification extends Model
{
    protected $fillable = [
        'user_id',
        'title',
        'body',
        'type',
        'is_read',
        'cleared_at',
    ];

    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
            'cleared_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
