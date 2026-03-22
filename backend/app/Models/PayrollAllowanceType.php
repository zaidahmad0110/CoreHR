<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayrollAllowanceType extends Model
{
    protected $fillable = [
        'name',
        'amount',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
        ];
    }
}
