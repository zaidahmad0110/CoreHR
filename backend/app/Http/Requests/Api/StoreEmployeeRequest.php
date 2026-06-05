<?php

namespace App\Http\Requests\Api;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEmployeeRequest extends FormRequest
{
    private const ALLOWED_JOB_TITLES = [
        'CEO',
        'GM',
        'Department manager',
        'Manager',
        'Supervisor',
        'Coordinator',
    ];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'employee_code' => ['nullable', 'string', 'max:255', 'unique:employees,employee_code'],
            'email' => [
                'required',
                'email',
                'max:255',
                'unique:employees,email',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! $this->boolean('create_user_account')) {
                        return;
                    }

                    if (User::query()->where('email', (string) $value)->exists()) {
                        $fail('A user account with this email already exists.');
                    }
                },
            ],
            'phone' => ['nullable', 'string', 'max:50'],
            'job_title' => ['required', 'string', 'max:255', Rule::in(self::ALLOWED_JOB_TITLES)],
            'department' => ['nullable', 'string', Rule::exists('departments', 'name')],
            'manager_id' => ['nullable', 'integer', Rule::exists('employees', 'id')],
            'branch' => ['nullable', 'string', Rule::exists('branches', 'name')],
            'location' => ['nullable', 'string', 'max:255'],
            'join_date' => ['required', 'date'],
            'status' => ['required', Rule::in(['Active', 'On Leave', 'Inactive'])],
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'allowances' => ['nullable', 'numeric', 'min:0'],
            'deductions' => ['nullable', 'numeric', 'min:0'],
            'create_user_account' => ['sometimes', 'boolean'],
            'user_role' => [
                Rule::requiredIf(fn (): bool => $this->boolean('create_user_account')),
                'string',
                Rule::in(['Admin', 'HR', 'Manager', 'Employee']),
            ],
            'user_password' => [
                Rule::requiredIf(fn (): bool => $this->boolean('create_user_account')),
                'string',
                'min:8',
                'max:255',
            ],
        ];
    }
}
