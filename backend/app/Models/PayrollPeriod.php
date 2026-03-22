<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class PayrollPeriod extends Model
{
    protected $fillable = [
        'month',
        'total_amount',
        'workflow_status',
        'hr_notified_at',
        'hr_submitted_by_user_id',
        'hr_submitted_at',
        'finance_notified_at',
        'finance_approved_by_user_id',
        'finance_approved_at',
    ];

    protected function casts(): array
    {
        return [
            'month' => 'date',
            'total_amount' => 'decimal:2',
            'hr_notified_at' => 'datetime',
            'hr_submitted_at' => 'datetime',
            'finance_notified_at' => 'datetime',
            'finance_approved_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(PayrollItem::class);
    }

    public function hrSubmitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hr_submitted_by_user_id');
    }

    public function financeApprover(): BelongsTo
    {
        return $this->belongsTo(User::class, 'finance_approved_by_user_id');
    }
}
