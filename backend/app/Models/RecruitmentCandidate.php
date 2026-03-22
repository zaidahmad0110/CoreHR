<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RecruitmentCandidate extends Model
{
    protected $fillable = [
        'job_posting_id',
        'name',
        'email',
        'phone',
        'cv_path',
        'cv_original_name',
        'position',
        'current_stage',
        'application_source',
        'status',
        'skills',
        'years_experience',
        'notes',
        'interview_at',
        'selected_for_next_step',
    ];

    protected function casts(): array
    {
        return [
            'interview_at' => 'datetime',
            'selected_for_next_step' => 'boolean',
        ];
    }

    public function jobPosting(): BelongsTo
    {
        return $this->belongsTo(JobPosting::class);
    }

    public function communications(): HasMany
    {
        return $this->hasMany(CandidateCommunication::class, 'candidate_id');
    }
}
