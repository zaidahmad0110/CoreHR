<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PerformanceReview extends Model
{
    protected $fillable = [
        'employee_id',
        'reviewer_user_id',
        'review_type',
        'period_start',
        'period_end',
        'rating',
        'goals_total',
        'goals_completed',
        'question_responses',
        'meets_requirements',
        'workflow_stage',
        'manager_reviewer_user_id',
        'manager_reviewed_at',
        'department_reviewer_user_id',
        'department_reviewed_at',
        'hr_reviewer_user_id',
        'hr_reviewed_at',
        'review_summary',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'rating' => 'decimal:2',
            'question_responses' => 'array',
            'meets_requirements' => 'boolean',
            'manager_reviewed_at' => 'datetime',
            'department_reviewed_at' => 'datetime',
            'hr_reviewed_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_user_id');
    }

    public function managerReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_reviewer_user_id');
    }

    public function departmentReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'department_reviewer_user_id');
    }

    public function hrReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'hr_reviewer_user_id');
    }
}
