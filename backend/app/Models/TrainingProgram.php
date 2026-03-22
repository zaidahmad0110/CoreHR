<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TrainingProgram extends Model
{
    protected $fillable = [
        'title',
        'description',
        'video_url',
        'article_url',
        'article_content',
        'instructor',
        'duration_weeks',
        'duration_days',
        'capacity',
        'status',
        'start_date',
        'end_date',
        'created_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'duration_weeks' => 'integer',
            'duration_days' => 'integer',
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(TrainingEnrollment::class, 'training_program_id');
    }

    public function materials(): HasMany
    {
        return $this->hasMany(TrainingMaterial::class, 'training_program_id');
    }
}
