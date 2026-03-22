<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayrollDeductionType extends Model
{
    protected $fillable = [
        'name',
        'value_type',
        'value',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'float',
        ];
    }
}
