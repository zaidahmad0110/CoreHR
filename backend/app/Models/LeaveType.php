<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaveType extends Model
{
    protected $fillable = [
        'name',
        'annual_days',
        'carry_over',
    ];

    protected function casts(): array
    {
        return [
            'annual_days' => 'int',
            'carry_over' => 'bool',
        ];
    }
}
