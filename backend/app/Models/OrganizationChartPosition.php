<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrganizationChartPosition extends Model
{
    protected $fillable = [
        'role_key',
        'role_title',
        'person_name',
        'department',
        'sort_order',
    ];
}

