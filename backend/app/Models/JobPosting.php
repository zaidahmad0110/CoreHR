<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JobPosting extends Model
{
    protected $fillable = [
        'title',
        'department',
        'location',
        'employment_type',
        'status',
        'description',
        'requirements',
        'required_skills',
        'min_experience_years',
        'created_by_user_id',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function candidates(): HasMany
    {
        return $this->hasMany(RecruitmentCandidate::class);
    }

    public function communications(): HasMany
    {
        return $this->hasMany(CandidateCommunication::class);
    }
}

