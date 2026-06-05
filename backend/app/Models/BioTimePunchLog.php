<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BioTimePunchLog extends Model
{
    protected $table = 'biotime_punch_logs';

    protected $fillable = [
        'external_id',
        'employee_id',
        'emp_code',
        'punch_time',
        'punch_state',
        'verify_type',
        'terminal_sn',
        'terminal_alias',
        'upload_time',
        'raw_payload',
        'processed_at',
    ];

    protected function casts(): array
    {
        return [
            'punch_time' => 'datetime',
            'upload_time' => 'datetime',
            'raw_payload' => 'array',
            'processed_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
